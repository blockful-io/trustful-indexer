import {
  StellarDatasourceKind,
  StellarHandlerKind,
  StellarProject,
} from "@subql/types-stellar";

import * as dotenv from 'dotenv';
import path from 'path';

// Get environment from .env file
const dotenvBasePath = path.resolve(__dirname, '.env');
dotenv.config({ path: dotenvBasePath });

const testnetEndpoints = [
  "https://rpc.ankr.com/http/stellar_testnet_horizon",
  "https://horizon-testnet.stellar.org",
  "https://lb.nodies.app/v1/b4138b83de73401284f25ff83b9ce30d"
];

const mainnetEndpoints = [
  "https://horizon.stellar.org",
  "https://rpc.ankr.com/http/stellar_horizon",
  "https://lb.nodies.app/v1/b07564ed2a8f40fcba62614a34ae1767",
];

const mode = process.env.NODE_ENV || 'testnet';
const defaultEndpoints = mode === 'mainnet' ? mainnetEndpoints : testnetEndpoints;

const endpoints = process.env.ENDPOINT ? [process.env.ENDPOINT] : defaultEndpoints;

/* This is your project configuration */
const project: StellarProject = {
  specVersion: "1.0.0",
  name: "soroban-starter",
  version: "0.0.1",
  runner: {
    node: {
      name: "@subql/node-stellar",
      version: "*",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  description:
    "This project can be use as a starting point for developing your new Stellar SubQuery project (mainnet)",
  repository: "https://github.com/subquery/stellar-subql-starter",
  schema: {
    file: "./schema.graphql",
  },
  network: {
    /* Stellar and Soroban uses the network passphrase as the chainId
      'Test SDF Network ; September 2015' for testnet
      'Public Global Stellar Network ; September 2015' for mainnet
      'Test SDF Future Network ; October 2022' for Future Network */
    chainId: process.env.CHAIN_ID!,
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     * You can find RPC endpoints for Stellar here https://soroban.stellar.org/docs/reference/rpc-list
     */
    endpoint: endpoints,
    /* This is a specific Soroban endpoint
      It is only required when you are using a soroban/EventHandler */
    sorobanEndpoint: process.env.SOROBAN_ENDPOINT!,
  },
  dataSources: [
    {
      kind: StellarDatasourceKind.Runtime,
      /* Set this as a logical start block, it might be block 1 (genesis) or when your contract was deployed */
      startBlock: parseInt(process.env.START_BLOCK!),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            handler: "handleScorerUserAdd",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "user",
                "add",  
              ],
            },
          },
          {
            handler: "handleScorerUserRemove",
            kind: StellarHandlerKind.Event,
            filter: {
              topics:[
                "user", 
                "remove",
              ]
            }
          },
          {
            handler: "handleScorerManagerAdd",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "manager",
                "add",
              ],
            },
          },
          {
            handler: "handleScorerManagerRemove",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "manager",
                "remove",
              ],
            },
          },
          {
            handler: "handleScorerInit",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "init",
                "contract",
              ],
            },
          },
          {
            handler: "handleScorerBadgeAdd",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "badge",
                "add",
              ],
            },
          },
          {
            handler: "handleScorerBadgeRemove",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: [
                "badge",
                "remove",
              ],
            },
          },
          {
            handler: "handlerScorerFactoryCreateCommunity",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ["scorer", "create"],
              contractId: process.env.SCORER_FACTORY_CONTRACT_ID!,
            },
          },
          {
            handler: "handlerScorerFactoryRemoveCommunity",
            kind: StellarHandlerKind.Event,
            filter: {
              topics: ["scorer", "remove"],
              contractId: process.env.SCORER_FACTORY_CONTRACT_ID!,
            },
          }
        ],
      },
    },
  ],
};

// Must set default to the project instance
export default project;
