FROM subquerynetwork/subql-query:latest

WORKDIR /app
COPY . .

# Instalar dependências
RUN yarn install

# Gerar tipos e fazer build
RUN yarn codegen
RUN yarn build

# Comando para iniciar o serviço
CMD ["node", "/usr/local/lib/node_modules/@subql/query/dist/main.js", "--name=app", "--playground", "--indexer=${INDEXER_URL:-http://localhost:3000}"] 