# SubQuery - Example Project for Stellar Soroban

[SubQuery](https://subquery.network) is a fast, flexible, and reliable open-source data indexer that provides you with custom APIs for your web3 project across all of our supported networks. To learn about how to get started with SubQuery, [visit our docs](https://academy.subquery.network).

**The example project indexes all soroban transfer events on Stellar's Mainnet. It also indexes all account payments including credits and debits**

## Start

First, install SubQuery CLI globally on your terminal by using NPM `npm install -g @subql/cli`

You can either clone this GitHub repo, or use the `subql` CLI to bootstrap a clean project in the network of your choosing by running `subql init` and following the prompts.

Don't forget to install dependencies with `npm install` or `yarn install`!

## Editing your SubQuery project

Although this is a working example SubQuery project, you can edit the SubQuery project by changing the following files:

- The project manifest in `project.yaml` defines the key project configuration and mapping handler filters
- The GraphQL Schema (`schema.graphql`) defines the shape of the resulting data that you are using SubQuery to index
- The Mapping functions in `src/mappings/` directory are typescript functions that handle transformation logic

SubQuery supports various layer-1 blockchain networks and provides [dedicated quick start guides](https://academy.subquery.network/quickstart/quickstart.html) as well as [detailed technical documentation](https://academy.subquery.network/build/introduction.html) for each of them.

## Run your project

_If you get stuck, find out how to get help below._

The simplest way to run your project is by running `yarn dev` or `npm run-script dev`. This does all of the following:

1.  `yarn codegen` - Generates types from the GraphQL schema definition and contract ABIs and saves them in the `/src/types` directory. This must be done after each change to the `schema.graphql` file or the contract ABIs
2.  `yarn build` - Builds and packages the SubQuery project into the `/dist` directory
3.  `docker-compose pull && docker-compose up` - Runs a Docker container with an indexer, PostgeSQL DB, and a query service. This requires [Docker to be installed](https://docs.docker.com/engine/install) and running locally. The configuration for this container is set from your `docker-compose.yml`

If running for the first time, or maybe wants to reset the database:
```sh
docker-compose down -v
docker rm -f $(docker ps -a -q)  
docker volume rm $(docker volume ls -q)  
rm -rf .data
rm -rf dist
yarn codegen
yarn build
```
You can observe the three services start, and once all are running (it may take a few minutes on your first start), please open your browser and head to [http://localhost:3000](http://localhost:3000) - you should see a GraphQL playground showing with the schemas ready to query. [Read the docs for more information](https://academy.subquery.network/run_publish/run.html) or [explore the possible service configuration for running SubQuery](https://academy.subquery.network/run_publish/references.html).

## Variables

To run the project in testnet, you need to set the following variables in the .env.develop file:

```.env
ENDPOINT="https://horizon-testnet.stellar.org"
CHAIN_ID="Test SDF Network ; September 2015"
SOROBAN_ENDPOINT="https://soroban-testnet.stellar.org"
START_BLOCK=1089948
``` 

to run the project in mainnet, you need to set the following variables in the .env.develop file:

```.env
ENDPOINT="https://horizon.stellar.org"
CHAIN_ID="Public Global Stellar Network ; September 2015"
SOROBAN_ENDPOINT="https://soroban-rpc.mainnet.stellar.gateway.fm"
START_BLOCK=50460000
