# Trustful Indexer with Horizon Proxy

Este projeto indexa dados da blockchain Stellar/Soroban com um proxy intermediário que corrige um bug de paginação no Horizon API.

## 🚀 Quick Start

```bash
# 1. Clone e instale dependências
git clone <repo>
cd trustful-indexer
make install

# 2. Configure ambiente
cp .env.example .env
# Edite .env com suas configurações

# 3. Inicie todos os serviços
make up

# 4. Verifique se está funcionando
make test
```

## 📁 Estrutura do Projeto

```
trustful-indexer/
├── indexer/           # SubQuery indexer para Stellar
├── proxy/            # Proxy que corrige bug do Horizon API
├── docker-compose.yml # Orquestração local
├── Makefile          # Comandos úteis
└── .env              # Configurações
```

## 🐛 O Problema e a Solução

### Problema
O Horizon API tem um bug de paginação quando blocos têm >200 transações:
- Retorna páginas vazias mas continua indicando "próxima página"
- SubQuery fica em loop infinito tentando buscar páginas vazias
- Timeout após ~2.5 minutos com erro "startLedger must be positive"

### Solução
Proxy interceptador que:
1. Recebe requisições do SubQuery
2. Encaminha para Horizon API
3. Detecta páginas vazias com link "next"
4. Remove o link problemático
5. Retorna resposta corrigida

## 🛠️ Comandos Principais

```bash
make up          # Inicia todos os serviços
make down        # Para todos os serviços
make logs        # Mostra logs
make test        # Testa se proxy está funcionando
make stats       # Mostra estatísticas do proxy
make clean       # Remove tudo e recomeça
```

## 📊 Monitoramento

- **Proxy Health**: http://localhost:8080/health
- **Proxy Stats**: http://localhost:8080/stats
- **GraphQL**: http://localhost:3000 (opcional)

## 🚢 Deploy no Railway

### 1. Deploy do Proxy

```bash
cd proxy
railway init
railway up
# Anote a URL: https://horizon-proxy-xxx.railway.app
```

### 2. Deploy do Indexer

```bash
cd ../indexer
railway init
# Configure variável PROXY_URL com a URL do proxy
railway up
```

### 3. Variáveis no Railway

**Proxy:**
```
PORT=8080
HORIZON_URLS=https://horizon.stellar.org,https://horizon.stellar.lobstr.co
```

**Indexer:**
```
PROXY_URL=https://horizon-proxy-xxx.railway.app
NODE_ENV=mainnet
START_BLOCK=58333000
CHAIN_ID=Public Global Stellar Network ; September 2015
SCORER_FACTORY_CONTRACT_ID=<seu_contract_id>
SOROBAN_ENDPOINT=https://soroban-rpc.mainnet.stellar.gateway.fm
```

## 🧪 Testando

### Teste Local
```bash
# Teste o proxy
make test

# Teste bloco problemático (>200 transações)
make test-block

# Veja estatísticas
make stats
```

### Verificar Correção do Bug
```bash
# Sem proxy: trava após 2.5 min
curl "https://horizon.stellar.org/ledgers/58253671/operations?limit=200"

# Com proxy: funciona normalmente
curl "http://localhost:8080/ledgers/58253671/operations?limit=200"
```

## 📈 Estatísticas do Proxy

O endpoint `/stats` mostra:
- Total de requisições
- Quantas vezes o bug foi corrigido
- Taxa de correção
- Status dos endpoints
- Uptime

## 🔧 Troubleshooting

### Erro "startLedger must be positive"
- Certifique-se que o proxy está rodando
- Verifique se o indexer está usando o proxy URL

### Proxy não inicia
```bash
cd proxy
npm install
docker-compose build horizon-proxy
```

### Database issues
```bash
make clean-db
make up
```

## 📝 Notas

- O proxy adiciona ~10-20ms de latência (insignificante)
- Suporta múltiplos endpoints Horizon com failover
- Cache pode ser adicionado para melhor performance
- Quando Stellar corrigir o bug, apenas remova o proxy

## 🤝 Contribuindo

1. Teste localmente com `make test`
2. Verifique logs com `make logs`
3. Monitore estatísticas com `make stats`

## 📄 License

MIT