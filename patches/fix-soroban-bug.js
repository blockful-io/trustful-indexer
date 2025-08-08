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
      // DEBUG: Log headers da requisição
      if (args[0] && args[0].headers) {
        console.log(`[SOROBAN-PATCH-DEBUG] Request headers Content-Length: ${args[0].headers['content-length'] || args[0].headers['Content-Length'] || 'not set'}`);
      }
      
      const req = originalRequest.apply(this, args);
      const originalWrite = req.write;
      const originalEnd = req.end;
      const originalSetHeader = req.setHeader;
      
      // Interceptar setHeader para capturar Content-Length
      req.setHeader = function(name, value) {
        if (name.toLowerCase() === 'content-length') {
          console.log(`[SOROBAN-PATCH-DEBUG] setHeader Content-Length: ${value}`);
        }
        return originalSetHeader.call(this, name, value);
      };
      
      let requestStartLedger = null;
      
      req.write = function(data) {
        try {
          // DEBUG: Log tamanho original
          const originalLength = data.length;
          console.log(`[SOROBAN-PATCH-DEBUG] Original data length: ${originalLength} bytes`);
          
          // Verificar se é uma requisição JSON-RPC
          const body = JSON.parse(data.toString());
          
          if (body && body.method === 'getEvents' && body.params) {
            requestCount++;
            const hasStartLedger = body.params.startLedger > 0;
            const hasCursor = body.params.cursor;
            const originalLimit = body.params.pagination?.limit;
            
            // FORÇAR LIMITE MAIOR PARA PEGAR TODOS OS EVENTOS DE UMA VEZ
            // TESTANDO com 2000 para confirmar que funciona
            let modified = false;
            if (originalLimit && originalLimit < 2000) {
              body.params.pagination.limit = 2000;
              console.log(`[SOROBAN-PATCH] 🚀 Aumentando limit de ${originalLimit} para 2000`);
              modified = true;
            }
            
            console.log(`[SOROBAN-PATCH] Request #${requestCount} - startLedger: ${body.params.startLedger}, cursor: ${body.params.cursor ? 'presente' : 'ausente'}, limit: ${body.params.pagination?.limit || 'N/A'}`);
            
            // CORREÇÃO DO BUG!
            if (!hasStartLedger && !hasCursor) {
              console.error('[SOROBAN-PATCH] ❌ BUG DETECTADO! Nem startLedger nem cursor presentes!');
              
              // Sempre corrigir quando detectado
              const ledgerToUse = lastValidLedger || 58254000;
              body.params.startLedger = ledgerToUse;
              console.log(`[SOROBAN-PATCH] ✅ Corrigido para startLedger: ${ledgerToUse}`);
              data = Buffer.from(JSON.stringify(body));
            } else if (hasCursor && hasStartLedger) {
              // BUG: Soroban não aceita cursor E startLedger juntos!
              console.error('[SOROBAN-PATCH] ⚠️  BUG: cursor e startLedger juntos! Removendo startLedger...');
              delete body.params.startLedger;
              console.log(`[SOROBAN-PATCH] ✅ Removido startLedger, mantendo apenas cursor: ${body.params.cursor.substring(0, 20)}...`);
              data = Buffer.from(JSON.stringify(body));
            } else if (hasStartLedger) {
              // Salvar ledger válido
              lastValidLedger = body.params.startLedger;
              requestStartLedger = body.params.startLedger; // Salvar para filtrar resposta
              console.log(`[SOROBAN-PATCH] 📝 Salvando ledger válido: ${lastValidLedger}`);
            }
            
            // Se modificamos algo, atualizar o data
            if (modified) {
              const newData = JSON.stringify(body);
              const newBuffer = Buffer.from(newData);
              
              // DEBUG: Comparar tamanhos
              console.log(`[SOROBAN-PATCH-DEBUG] Original length: ${originalLength}, New length: ${newBuffer.length}`);
              console.log(`[SOROBAN-PATCH-DEBUG] Length difference: ${newBuffer.length - originalLength} bytes`);
              
              // CRÍTICO: Atualizar Content-Length se mudou o tamanho
              if (newBuffer.length !== originalLength) {
                console.log(`[SOROBAN-PATCH-DEBUG] Updating Content-Length from ${originalLength} to ${newBuffer.length}`);
                req.setHeader('Content-Length', newBuffer.length.toString());
              }
              
              // DEBUG: Log do que está sendo enviado quando limit >= 1000
              if (body.params.pagination && body.params.pagination.limit >= 1000) {
                console.log(`[SOROBAN-PATCH-DEBUG] Limit 1000+ payload: ${newData.substring(0, 200)}`);
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
        let responseData = '';
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            responseData = Buffer.concat(chunks).toString();
            
            // DEBUG: Log tamanho da resposta
            if (requestStartLedger) {
              console.log(`[SOROBAN-PATCH-DEBUG] Response size: ${responseData.length} bytes, chunks: ${chunks.length}`);
              
              // Se resposta muito pequena, provavelmente é erro
              if (responseData.length < 200) {
                console.log(`[SOROBAN-PATCH-DEBUG] Small response content: ${responseData}`);
              }
            }
            
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
                console.log(`[SOROBAN-PATCH] 🎯 Filtrado: ${originalCount} → ${filteredEvents.length} eventos (apenas ledger ${requestStartLedger})`);
                
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
              
              console.log(`[SOROBAN-PATCH] 📥 Resposta: ${originalCount} eventos, cursor: ${response.result.cursor ? 'presente' : 'ausente'}`);
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

// Interceptar console.error para detectar o erro
const originalConsoleError = console.error;
console.error = function(...args) {
  const message = args.join(' ');
  
  if (message.includes('startLedger must be positive')) {
    console.warn('[SOROBAN-PATCH] ⚠️  ERRO DETECTADO! "startLedger must be positive"');
    console.warn('[SOROBAN-PATCH] ⚠️  Último ledger válido: ' + lastValidLedger);
    console.warn('[SOROBAN-PATCH] ⚠️  O patch deveria ter prevenido isso!');
  }
  
  return originalConsoleError.apply(console, args);
};

console.log('[SOROBAN-PATCH] ✅ Patch aplicado com sucesso!');
console.log('[SOROBAN-PATCH] 📊 Monitorando requisições para Soroban RPC...');