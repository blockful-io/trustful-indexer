const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Support multiple Horizon endpoints for fallback
const HORIZON_URLS = (process.env.HORIZON_URLS || 'https://horizon.stellar.org').split(',');
let currentEndpointIndex = 0;

// Statistics tracking
const stats = {
  totalRequests: 0,
  bugFixedCount: 0,
  requestsByEndpoint: {},
  failedRequests: 0,
  startTime: new Date()
};

// Initialize stats for each endpoint
HORIZON_URLS.forEach(url => {
  stats.requestsByEndpoint[url] = { success: 0, failed: 0 };
});

// Middleware
app.use(cors());
app.use(morgan('combined', {
  skip: (req) => req.path === '/health' || req.path === '/stats'
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: Math.floor((new Date() - stats.startTime) / 1000),
    currentEndpoint: HORIZON_URLS[currentEndpointIndex]
  });
});

// Statistics endpoint
app.get('/stats', (req, res) => {
  res.json({
    ...stats,
    uptime: Math.floor((new Date() - stats.startTime) / 1000) + ' seconds',
    bugFixRate: stats.totalRequests > 0 
      ? ((stats.bugFixedCount / stats.totalRequests) * 100).toFixed(2) + '%'
      : '0%'
  });
});

// Get current endpoint with rotation on failure
function getCurrentEndpoint() {
  return HORIZON_URLS[currentEndpointIndex];
}

// Rotate to next endpoint
function rotateEndpoint() {
  currentEndpointIndex = (currentEndpointIndex + 1) % HORIZON_URLS.length;
  console.log(`[PROXY] Rotated to endpoint: ${getCurrentEndpoint()}`);
}

// Main proxy handler
app.use(async (req, res) => {
  stats.totalRequests++;
  
  const startTime = Date.now();
  let lastError = null;
  
  // Try each endpoint until one succeeds
  for (let attempt = 0; attempt < HORIZON_URLS.length; attempt++) {
    const horizonUrl = getCurrentEndpoint();
    
    try {
      console.log(`[PROXY] Forwarding ${req.method} ${req.originalUrl} to ${horizonUrl}`);
      
      // Modify the URL to limit transactions to avoid pagination issues
      let targetUrl = `${horizonUrl}${req.originalUrl}`;
      
      // If it's a transactions request with limit=150, reduce to 100 to be safe
      if (req.originalUrl.includes('/transactions') && req.originalUrl.includes('limit=150')) {
        targetUrl = targetUrl.replace('limit=150', 'limit=100');
        console.log(`[PROXY] Reduced transaction limit from 150 to 100 for ${req.originalUrl}`);
      }
      
      // Also reduce operations and effects limits
      if ((req.originalUrl.includes('/operations') || req.originalUrl.includes('/effects')) && req.originalUrl.includes('limit=150')) {
        targetUrl = targetUrl.replace('limit=150', 'limit=100');
        console.log(`[PROXY] Reduced limit from 150 to 100 for ${req.originalUrl}`);
      }
      
      // Forward request to Horizon API
      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers: {
          ...req.headers,
          host: new URL(horizonUrl).host,
          'x-forwarded-for': req.ip,
          'x-proxy-version': '1.0.0'
        },
        data: req.body,
        timeout: parseInt(process.env.REQUEST_TIMEOUT) || 60000, // 60 second timeout by default
        validateStatus: () => true // Accept any status code
      });

      let data = response.data;

      // CRITICAL BUG FIX: Remove pagination link when records array is empty
      if (data && 
          data._embedded && 
          data._embedded.records && 
          Array.isArray(data._embedded.records) &&
          data._embedded.records.length === 0 && 
          data._links && 
          data._links.next) {
        
        console.log(`[PROXY] 🔧 Fixed pagination bug for ${req.originalUrl}`);
        console.log(`[PROXY] Removed next link: ${data._links.next.href}`);
        
        // Remove the problematic next link
        delete data._links.next;
        stats.bugFixedCount++;
        
        // Add a custom header to indicate the fix was applied
        res.set('X-Proxy-Bug-Fixed', 'true');
      }

      // Log response time
      const responseTime = Date.now() - startTime;
      console.log(`[PROXY] Response in ${responseTime}ms - Status: ${response.status}`);
      
      // Update stats
      stats.requestsByEndpoint[horizonUrl].success++;
      
      // Forward all headers from Horizon
      Object.keys(response.headers).forEach(key => {
        if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.set(key, response.headers[key]);
        }
      });
      
      // Add custom headers
      res.set('X-Proxy-Endpoint', horizonUrl);
      res.set('X-Proxy-Response-Time', responseTime.toString());
      
      // Send response
      return res.status(response.status).json(data);
      
    } catch (error) {
      lastError = error;
      console.error(`[PROXY] Error with ${horizonUrl}: ${error.message}`);
      stats.requestsByEndpoint[horizonUrl].failed++;
      
      // If this endpoint failed, try the next one
      if (attempt < HORIZON_URLS.length - 1) {
        rotateEndpoint();
        continue;
      }
    }
  }
  
  // All endpoints failed
  stats.failedRequests++;
  console.error(`[PROXY] All endpoints failed for ${req.originalUrl}`);
  
  res.status(502).json({ 
    error: 'Bad Gateway',
    message: 'All Horizon endpoints failed',
    detail: lastError?.message,
    endpoints: HORIZON_URLS,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Horizon Proxy Server`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Port:       ${PORT}`);
  console.log(`  Endpoints:  ${HORIZON_URLS.join(', ')}`);
  console.log(`  Health:     http://localhost:${PORT}/health`);
  console.log(`  Stats:      http://localhost:${PORT}/stats`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Started at: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');
});