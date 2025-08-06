// Patch para corrigir o bug do SubQuery Stellar
// Bug: startLedger fica undefined durante paginação quando não há mais eventos

console.log('[SOROBAN-PATCH] 🚀 Iniciando patch do SubQuery Stellar...');

// Rastrear último ledger válido
let lastValidLedger = null;
let requestCount = 0;

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
      
      let requestStartLedger = null;
      
      req.write = function(data) {
        try {
          // Verificar se é uma requisição JSON-RPC
          const body = JSON.parse(data.toString());
          
          if (body && body.method === 'getEvents' && body.params) {
            requestCount++;
            const hasStartLedger = body.params.startLedger > 0;
            const hasCursor = body.params.cursor;
            
            // AUMENTAR limite para pegar mais eventos de uma vez
            let modified = false;
            if (body.params.pagination && body.params.pagination.limit < 2000) {
              body.params.pagination.limit = 2000;
              console.log(`[SOROBAN-PATCH] 🚀 Aumentando limit de ${body.params.pagination.limit} para 2000 para evitar paginação`);
              modified = true;
            }
            
            console.log(`[SOROBAN-PATCH] Request #${requestCount} - startLedger: ${body.params.startLedger}, cursor: ${body.params.cursor ? 'presente' : 'ausente'}, limit: ${body.params.pagination?.limit || 'N/A'}`);
            
            // CORREÇÃO DO BUG: startLedger undefined
            if (!hasStartLedger && !hasCursor) {
              console.error('[SOROBAN-PATCH] ❌ BUG DETECTADO! Nem startLedger nem cursor presentes!');
              
              // Sempre corrigir quando detectado
              const ledgerToUse = lastValidLedger || 58254000;
              body.params.startLedger = ledgerToUse;
              console.log(`[SOROBAN-PATCH] ✅ Corrigido para startLedger: ${ledgerToUse}`);
              data = Buffer.from(JSON.stringify(body));
            } else if (hasStartLedger) {
              // Salvar ledger válido
              lastValidLedger = body.params.startLedger;
              requestStartLedger = body.params.startLedger; // Salvar para filtrar resposta
              console.log(`[SOROBAN-PATCH] 📝 Salvando ledger válido: ${lastValidLedger}`);
            }
            
            // Se modificamos algo, atualizar o data
            if (modified && !data.toString().includes('"limit":2000')) {
              data = Buffer.from(JSON.stringify(body));
            }
          }
        } catch (e) {
          // Não é JSON, ignorar
        }
        
        return originalWrite.call(this, data);
      };
      
      // Interceptar resposta e filtrar eventos
      req.on('response', (res) => {
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const responseData = Buffer.concat(chunks).toString();
            const response = JSON.parse(responseData);
            
            if (response.result && response.result.events && requestStartLedger) {
              const originalCount = response.result.events.length;
              
              // Filtrar apenas eventos do bloco solicitado
              const filteredEvents = response.result.events.filter(event => 
                event.ledger === requestStartLedger
              );
              
              // Se tem eventos de outros blocos ou tem cursor, filtrar
              if (filteredEvents.length < originalCount || response.result.cursor) {
                response.result.events = filteredEvents;
                response.result.cursor = null; // Remover cursor
                
                const modifiedResponse = JSON.stringify(response);
                
                if (filteredEvents.length < originalCount) {
                  console.log(`[SOROBAN-PATCH] 🎯 Filtrado: ${originalCount} → ${filteredEvents.length} eventos (apenas ledger ${requestStartLedger})`);
                } else {
                  console.log(`[SOROBAN-PATCH] 📌 Removido cursor: ${filteredEvents.length} eventos do ledger ${requestStartLedger}`);
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
              
              console.log(`[SOROBAN-PATCH] 📥 Resposta: ${originalCount} eventos, sem modificação`);
            }
          } catch (e) {
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