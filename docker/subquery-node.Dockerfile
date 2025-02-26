FROM subquerynetwork/subql-node-stellar:latest

WORKDIR /app
COPY . .

USER root

RUN npm install

EXPOSE 3000

CMD ["subql-node-stellar", "-f=/app", "--db-schema=public", "--workers=1", "--batch-size=5", "--unsafe"]