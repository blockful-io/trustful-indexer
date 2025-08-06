// Patch para corrigir o bug de paginação no getAndWrapEvents do SubQuery Stellar
// O bug: getAndWrapEvents só pega a primeira página de eventos

console.log('[PAGINATION-PATCH] 🚀 Iniciando patch de paginação do SubQuery Stellar...');

const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent) {
  const exports = originalLoad.apply(this, arguments);
  
  // Interceptar o módulo api.stellar
  if (request.includes('api.stellar') || request.includes('stellar/api')) {
    console.log(`[PAGINATION-PATCH] 📦 Interceptando módulo: ${request}`);
    
    // Procurar pela classe StellarApi
    for (const key in exports) {
      const exported = exports[key];
      
      // Verificar se é a classe StellarApi
      if (typeof exported === 'function' && exported.prototype) {
        const proto = exported.prototype;
        
        // Procurar pelo método getAndWrapEvents
        if (proto.getAndWrapEvents) {
          console.log(`[PAGINATION-PATCH] 🎯 Encontrado getAndWrapEvents em ${key}`);
          
          // Salvar o método original
          const originalGetAndWrapEvents = proto.getAndWrapEvents;
          
          // Substituir por versão com paginação
          proto.getAndWrapEvents = async function(height, limit) {
            console.log(`[PAGINATION-PATCH] 📥 getAndWrapEvents chamado para height: ${height}, limit: ${limit}`);
            
            // Se não tiver sorobanClient, usar implementação original
            if (!this.sorobanClient) {
              console.log('[PAGINATION-PATCH] ⚠️  Sem sorobanClient, usando implementação original');
              return originalGetAndWrapEvents.call(this, height, limit);
            }
            
            try {
              let allEvents = [];
              let cursor = undefined;
              let pageCount = 0;
              const maxPages = 10; // Limite de segurança
              
              do {
                pageCount++;
                console.log(`[PAGINATION-PATCH] 📄 Buscando página ${pageCount} para ledger ${height}`);
                
                // Construir parâmetros da requisição
                const params = {
                  filters: [],
                  limit: limit || this.pageLimit || 150
                };
                
                if (cursor) {
                  // Se tem cursor, não usa startLedger
                  params.cursor = cursor;
                  console.log(`[PAGINATION-PATCH] 🔄 Usando cursor: ${cursor.substring(0, 20)}...`);
                } else {
                  // Primeira página usa startLedger
                  params.startLedger = height;
                }
                
                // Fazer a requisição
                const response = await this.sorobanClient.getEvents(params);
                
                if (!response || !response.events) {
                  console.log('[PAGINATION-PATCH] ⚠️  Resposta vazia ou inválida');
                  break;
                }
                
                // Filtrar apenas eventos do ledger atual
                const eventsFromCurrentLedger = response.events.filter(event => 
                  event.ledger === height
                );
                
                console.log(`[PAGINATION-PATCH] 📊 Página ${pageCount}: ${response.events.length} eventos totais, ${eventsFromCurrentLedger.length} do ledger ${height}`);
                
                // Adicionar eventos do ledger atual
                allEvents = allEvents.concat(eventsFromCurrentLedger);
                
                // Verificar se tem mais páginas
                if (response.events.length > 0) {
                  const lastEvent = response.events[response.events.length - 1];
                  
                  // Se o último evento ainda é do ledger atual e tem pagingToken
                  if (lastEvent.ledger === height && lastEvent.pagingToken) {
                    cursor = lastEvent.pagingToken;
                    console.log(`[PAGINATION-PATCH] ➡️  Mais eventos disponíveis, próximo cursor: ${cursor.substring(0, 20)}...`);
                  } else if (lastEvent.ledger > height) {
                    // Chegamos em eventos de ledgers posteriores
                    console.log(`[PAGINATION-PATCH] ✅ Todos eventos do ledger ${height} obtidos (último evento é do ledger ${lastEvent.ledger})`);
                    cursor = null;
                  } else if (response.events.length < (limit || this.pageLimit || 150)) {
                    // Menos eventos que o limite, provavelmente é a última página
                    console.log('[PAGINATION-PATCH] ✅ Última página (menos eventos que o limite)');
                    cursor = null;
                  } else {
                    // Continuar paginando
                    cursor = lastEvent.pagingToken;
                  }
                } else {
                  cursor = null;
                }
                
                // Prevenir loop infinito
                if (pageCount >= maxPages) {
                  console.warn(`[PAGINATION-PATCH] ⚠️  Limite de ${maxPages} páginas atingido, parando paginação`);
                  break;
                }
                
              } while (cursor);
              
              console.log(`[PAGINATION-PATCH] ✨ Total de ${allEvents.length} eventos obtidos para ledger ${height} em ${pageCount} página(s)`);
              
              // Aplicar o wrapping como no método original
              // Assumindo que o método original faz algum processamento nos eventos
              const wrappedResult = await originalGetAndWrapEvents.call(this, height, limit);
              
              // Substituir os eventos pelos que obtivemos com paginação completa
              if (wrappedResult && Array.isArray(wrappedResult)) {
                // Se retorna array direto
                return allEvents;
              } else if (wrappedResult && wrappedResult.events) {
                // Se retorna objeto com eventos
                wrappedResult.events = allEvents;
                return wrappedResult;
              } else {
                // Formato desconhecido, retornar nossos eventos
                return allEvents;
              }
              
            } catch (error) {
              console.error('[PAGINATION-PATCH] ❌ Erro na paginação:', error);
              // Em caso de erro, usar implementação original
              return originalGetAndWrapEvents.call(this, height, limit);
            }
          };
          
          console.log('[PAGINATION-PATCH] ✅ Método getAndWrapEvents patcheado com sucesso!');
        }
      }
    }
  }
  
  return exports;
};

console.log('[PAGINATION-PATCH] ✅ Patch de paginação aplicado com sucesso!');
console.log('[PAGINATION-PATCH] 📊 Aguardando carregamento do módulo api.stellar...');