// Patch para corrigir o bug do SubQuery Stellar
// Bug: startLedger fica undefined durante paginação quando não há mais eventos

console.log('[SOROBAN-PATCH] 🚀 Iniciando patch do SubQuery Stellar...');

// Rastrear último ledger válido
let lastValidLedger = null;
let requestCount = 0;
let lastLoggedLedger = null; // Para evitar logs repetidos do mesmo ledger

// Rate-limit cooldown state — shared across ALL http(s) requests in the process.
// When any response returns 429, cooldownUntil is set to now + backoff. Every
// subsequent req.end() waits until that moment before dispatching. Backoff is
// exponential per consecutive 429 burst, capped below SubQuery's --timeout=120000
// so our hold never trips the request-timeout machinery.
let cooldownUntil = 0;
let consecutive429 = 0;
const BACKOFF_BASE_MS = 2000;   // 2s on first 429
const BACKOFF_MAX_MS = 60000;   // never hold a request longer than 60s

// Hook no módulo HTTP/HTTPS para interceptar requisições
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent) {
  const exports = originalLoad.apply(this, arguments);
  
  // Interceptar módulos HTTP/HTTPS
  if (request === 'http' || request === 'https') {
    const originalRequest = exports.request;
    
    exports.request = function(...args) {
      const req = originalRequest.apply(this, args);
      const originalWrite = req.write;
      const originalEnd = req.end;
      const originalSetHeader = req.setHeader;

      let requestStartLedger = null;

      // Hold req.end() until any active rate-limit cooldown expires.
      // Writes still happen instantly (they only buffer), so headers and body
      // are fully assembled — we just delay the final socket flush.
      req.end = function(...endArgs) {
        const self = this;
        const now = Date.now();
        const delay = cooldownUntil > now ? cooldownUntil - now : 0;
        if (delay > 0) {
          console.log(`[SOROBAN-PATCH] ⏳ Rate-limit cooldown: holding request ${delay}ms (consecutive 429s: ${consecutive429})`);
          setTimeout(() => originalEnd.apply(self, endArgs), delay);
          return self;
        }
        return originalEnd.apply(self, endArgs);
      };

      req.write = function(data) {
        try {
          const originalLength = data.length;
          
          // Verificar se é uma requisição JSON-RPC
          const body = JSON.parse(data.toString());
          
          if (body && body.method === 'getEvents' && body.params) {
            requestCount++;
            const hasStartLedger = body.params.startLedger > 0;
            // Soroban RPC nests the cursor under pagination.cursor; an older
            // patch revision only looked at params.cursor, which is never set,
            // so paginated continuations were misidentified as "no cursor" and
            // a startLedger was injected — producing
            // "ledger ranges and cursor cannot both be set".
            const hasCursor = !!(body.params.cursor || body.params.pagination?.cursor);
            const originalLimit = body.params.pagination?.limit;
            
            // FORÇAR LIMITE MAIOR PARA PEGAR TODOS OS EVENTOS DE UMA VEZ
            // TESTANDO com 2000 para confirmar que funciona
            let modified = false;
            if (originalLimit && originalLimit < 2000) {
              body.params.pagination.limit = 2000;
              modified = true;
            }
            
            // Log apenas quando processar um novo ledger
            if (hasStartLedger && body.params.startLedger !== lastLoggedLedger) {
              console.log(`[SOROBAN-PATCH] 📊 Processando ledger: ${body.params.startLedger}`);
              lastLoggedLedger = body.params.startLedger;
            }
            
            // CORREÇÃO DO BUG!
            if (!hasStartLedger && !hasCursor) {
              console.error('[SOROBAN-PATCH] ❌ BUG DETECTADO! Corrigindo startLedger undefined...');
              
              // Sempre corrigir quando detectado
              const ledgerToUse = lastValidLedger || 58254000;
              body.params.startLedger = ledgerToUse;
              data = Buffer.from(JSON.stringify(body));
            } else if (hasCursor && hasStartLedger) {
              // BUG: Soroban não aceita cursor E startLedger juntos!
              delete body.params.startLedger;
              data = Buffer.from(JSON.stringify(body));
            } else if (hasStartLedger) {
              // Salvar ledger válido
              lastValidLedger = body.params.startLedger;
              requestStartLedger = body.params.startLedger; // Salvar para filtrar resposta
            }
            
            // Se modificamos algo, atualizar o data
            if (modified) {
              const newData = JSON.stringify(body);
              const newBuffer = Buffer.from(newData);
              
              // CRÍTICO: Atualizar Content-Length se mudou o tamanho
              if (newBuffer.length !== originalLength) {
                req.setHeader('Content-Length', newBuffer.length.toString());
              }
              
              data = newBuffer;
            }
          }
        } catch (e) {
          // Não é JSON, ignorar
        }
        
        return originalWrite.call(this, data);
      };
      
      // Interceptar resposta e filtrar eventos
      req.on('response', (res) => {
        // Rate-limit feedback loop: 429 arms the cooldown, success resets it.
        // Runs for EVERY response (Horizon /ledgers, Soroban getEvents, anything),
        // because all upstreams share the same per-IP rate-limit bucket.
        if (res.statusCode === 429) {
          consecutive429++;
          const backoff = Math.min(
            BACKOFF_BASE_MS * Math.pow(2, consecutive429 - 1),
            BACKOFF_MAX_MS
          );
          cooldownUntil = Math.max(cooldownUntil, Date.now() + backoff);
          console.log(`[SOROBAN-PATCH] 🛑 HTTP 429 from upstream. Backoff #${consecutive429}: ${backoff}ms`);
        } else if (res.statusCode >= 200 && res.statusCode < 300 && consecutive429 > 0) {
          console.log(`[SOROBAN-PATCH] ✅ Rate limit recovered (was ${consecutive429} consecutive 429s)`);
          consecutive429 = 0;
        }

        // Aumentar limite de listeners para evitar warnings com múltiplas requisições simultâneas
        res.setMaxListeners(50);
        
        let responseData = '';
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            responseData = Buffer.concat(chunks).toString();
            
            const response = JSON.parse(responseData);
            
            if (response.result && response.result.events && requestStartLedger) {
              const originalCount = response.result.events.length;
              
              // Filtrar apenas eventos do bloco solicitado
              const filteredEvents = response.result.events.filter(event => 
                event.ledger === requestStartLedger
              );
              
              if (filteredEvents.length < originalCount) {
                // Modificar a resposta para retornar apenas eventos do bloco atual
                response.result.events = filteredEvents;
                response.result.cursor = null; // Remover cursor já que filtramos
                
                const modifiedResponse = JSON.stringify(response);
                
                // Log apenas quando realmente filtrar eventos
                if (filteredEvents.length > 0) {
                  console.log(`[SOROBAN-PATCH] ✅ Filtrado: ${originalCount} → ${filteredEvents.length} eventos`);
                }
                
                // Substituir o response data
                res.removeAllListeners('data');
                res.removeAllListeners('end');
                
                // Emitir o novo data modificado
                process.nextTick(() => {
                  res.emit('data', Buffer.from(modifiedResponse));
                  res.emit('end');
                });
                
                return;
              }
            }
          } catch (e) {
            // Não é JSON ou não é resposta de eventos
            // Re-emitir os dados originais
            res.removeAllListeners('data');
            res.removeAllListeners('end');
            process.nextTick(() => {
              chunks.forEach(chunk => res.emit('data', chunk));
              res.emit('end');
            });
          }
        });
      });
      
      return req;
    };
  }
  
  return exports;
};

console.log('[SOROBAN-PATCH] ✅ Patch aplicado com sucesso!');
console.log('[SOROBAN-PATCH] 📊 Monitorando requisições para Soroban RPC...');