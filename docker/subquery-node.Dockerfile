FROM subquerynetwork/subql-node-stellar:latest

WORKDIR /app
COPY . .

# Instalar dependências
RUN yarn install

# Gerar tipos e fazer build
RUN yarn codegen
RUN yarn build

# Instalar a extensão btree_gist no PostgreSQL
USER root
RUN apt-get update && apt-get install -y postgresql-client

# Comando para iniciar o serviço
CMD ["node", "/usr/local/lib/node_modules/@subql/node-stellar/dist/main.js", "-f=/app", "--db-schema=app", "--workers=1", "--batch-size=5", "--unsafe"] 