FROM subquerynetwork/subql-node-stellar:latest

# Mudar para usuário root antes de copiar arquivos
USER root

WORKDIR /app
COPY . .

# Corrigir permissões
RUN chown -R node:node /app

# Trocar para o usuário node para instalar pacotes
USER node

# Instalar dependências
RUN yarn install

# Gerar tipos e fazer build
RUN yarn codegen
RUN yarn build

# Mudar novamente para o usuário node para executar a aplicação
USER node

# Comando para iniciar o serviço
CMD ["--name=app", "--playground", "--indexer=http://subquery-node:3000"]