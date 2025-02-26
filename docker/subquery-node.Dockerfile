FROM subquerynetwork/subql-node-stellar:latest as base

# Estágio de build usando Node 18 (em vez de 16)
FROM node:18 as builder
WORKDIR /build
COPY . .
RUN yarn install
RUN yarn codegen
RUN yarn build

# Estágio final usando a imagem subquery
FROM base
WORKDIR /app
# Copiar tudo do estágio de build
COPY --from=builder /build .

USER root

# Não precisamos instalar novamente pois já fizemos isso no estágio de build
# (Mantenha esta linha se houver dependências específicas do ambiente de execução)
RUN npm install

EXPOSE 3000

CMD ["subql-node-stellar", "-f=/app", "--db-schema=public", "--workers=1", "--batch-size=1", "--unsafe", "--log-level=debug", "--create-db-schema"]