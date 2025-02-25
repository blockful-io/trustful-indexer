FROM subquerynetwork/subql-node-stellar:latest

WORKDIR /app
COPY . .

# Comando para iniciar o serviço - usando o comando correto
ENTRYPOINT ["subql-node-stellar", "-f=/app", "--db-schema=app", "--workers=1", "--batch-size=5", "--unsafe"]