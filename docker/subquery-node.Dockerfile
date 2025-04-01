FROM subquerynetwork/subql-node-stellar:latest as base

#Build project
FROM node:18 as builder
WORKDIR /build
COPY . .
RUN yarn install
RUN yarn codegen
RUN yarn build

#Building on container
FROM base
WORKDIR /app
COPY --from=builder /build .
USER root
RUN npm install
EXPOSE 3000

#Run project
ENTRYPOINT ["subql-node-stellar", "-f=/app", "--db-schema=public", "--workers=1", "--batch-size=1", "--unsafe", "--log-level=debug", "--create-db-schema"]