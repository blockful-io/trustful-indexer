# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SubQuery indexer for the Stellar Soroban blockchain that indexes community and badge-related events from smart contracts. The indexer tracks users, communities, badges, and membership relationships in a PostgreSQL database exposed via GraphQL.

## Key Architecture Components

### Data Flow
1. **Event Ingestion**: SubQuery node listens to Stellar/Soroban blockchain events filtered by topics (user, badge, manager events)
2. **Event Processing**: Mapping handlers in `src/mappings/mappingHandlers.ts` process events and transform data
3. **Database Storage**: Processed data is stored in PostgreSQL following the schema defined in `schema.graphql`
4. **GraphQL API**: Query service exposes indexed data via GraphQL endpoint (port 3000)

### Core Entities
- **User**: Tracks user addresses and their community memberships/badges
- **Community**: Represents scorer contracts with metadata (name, description, creator)
- **CommunityMember**: Junction entity tracking user roles in communities (member/manager/creator)
- **Badge**: Defines badge types within communities
- **UserBadge**: Tracks badges assigned to specific users

### Event Handlers
The indexer processes these Soroban contract events:
- `handleScorerUserAdd/Remove`: User membership changes
- `handleScorerManagerAdd/Remove`: Manager role changes
- `handleScorerBadgeAdd/Remove`: Badge assignment/removal
- `handleScorerInit`: Community initialization
- `handlerScorerFactoryCreateCommunity/Remove`: Factory contract community lifecycle

## Development Commands

### Build and Run
```bash
# Install dependencies
npm install

# Generate TypeScript types from GraphQL schema
npm run codegen

# Build the project (includes codegen)
npm run build

# Run full development stack with Docker
npm run dev

# Start indexer only (requires .env configuration)
npm run start:indexer
```

### Database Reset (when schema changes or fresh start needed)
```bash
docker-compose down -v
docker rm -f $(docker ps -a -q)
docker volume rm $(docker volume ls -q)
rm -rf .data
rm -rf dist
yarn codegen
yarn build
```

## Environment Configuration

The project uses environment variables to configure network endpoints and starting blocks.

### Required Variables
- `ENDPOINT`: Stellar Horizon API endpoint
- `CHAIN_ID`: Network passphrase identifier
- `SOROBAN_ENDPOINT`: Soroban RPC endpoint for contract events
- `START_BLOCK`: Block number to start indexing from
- `SCORER_FACTORY_CONTRACT_ID`: Factory contract address for community creation events

### Network Configurations

**Testnet** (`.env.testnet`):
```
ENDPOINT=https://horizon-testnet.stellar.org
CHAIN_ID=Test SDF Network ; September 2015
SOROBAN_ENDPOINT=https://soroban-testnet.stellar.org
START_BLOCK=1090207
```

**Mainnet** (`.env.mainnet`):
```
ENDPOINT=https://horizon.stellar.org
CHAIN_ID=Public Global Stellar Network ; September 2015
SOROBAN_ENDPOINT=https://soroban-rpc.mainnet.stellar.gateway.fm
START_BLOCK=50460000
```

## Docker Configuration

The project uses Docker Compose with:
- **subquery-node**: Indexes blockchain data (configured for single worker, batch size 1 to avoid rate limits)
- **PostgreSQL**: External database connection via Railway (credentials in docker-compose.yml)
- **graphql-engine** (commented out): Query service for GraphQL API

### Performance Tuning
- `--workers=1`: Conservative setting to avoid rate limiting
- `--batch-size=1`: Process one ledger at a time for stability
- Multiple RPC endpoints configured in `project.ts` for failover

## Project Configuration

The `project.ts` file defines:
- Multiple RPC endpoints with automatic failover
- Event filters by topic and contract ID
- Handler mappings to TypeScript functions
- Network selection based on NODE_ENV or explicit configuration

## Important Notes

- The indexer uses external PostgreSQL database (Railway) - ensure connection details are correct
- Rate limiting is a concern with public RPC endpoints - the project is configured conservatively
- Ankr endpoints have known issues with mixed HTTP/HTTPS responses and should be avoided
- When adding new event handlers, update both `project.ts` filters and implement corresponding handler in `mappingHandlers.ts`