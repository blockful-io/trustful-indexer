# Comandos Disponíveis

## Desenvolvimento

```bash
# Instalar dependências
yarn install

# Build do projeto
yarn build

# Limpar arquivos de build
yarn clean

# Limpar tudo (incluindo node_modules)
yarn clean:all
```

## Docker

```bash
# Iniciar serviços
yarn start
# ou
yarn docker:up

# Parar serviços
yarn stop
# ou
yarn docker:down

# Ver logs
yarn logs
# ou
yarn docker:logs

# Reiniciar serviços
yarn docker:restart

# Build do Docker
yarn docker:build
```

## Desenvolvimento Rápido

```bash
# Build + Start + Logs
yarn dev
```

## Estrutura de Pastas

```
/
├── src/           # Código fonte
├── dist/          # Build compilado
├── docker/        # Arquivos Docker e docker-compose
├── patches/       # Patches e fixes (fix-soroban-bug.js)
├── config/        # Arquivos de configuração (.env.mainnet, .env.testnet)
├── package.json   # Scripts e dependências
├── project.ts     # Configuração do SubQuery
└── schema.graphql # Schema GraphQL
```