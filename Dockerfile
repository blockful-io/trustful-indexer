# Use the SubQuery node image as base
FROM subquerynetwork/subql-node-stellar:latest

# Switch to root for installation
USER root

# Install Node.js for the patch
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy project files (excluding .env if it exists locally)
RUN rm -f .env
COPY . .
RUN rm -f .env

# Create .env file BEFORE build (so project.ts can read it during build)
RUN echo 'CHAIN_ID=Public Global Stellar Network ; September 2015' > /app/.env && \
    echo 'SOROBAN_ENDPOINT=https://soroban-rpc.mainnet.stellar.gateway.fm' >> /app/.env && \
    echo 'START_BLOCK=62530000' >> /app/.env && \
    echo 'NODE_ENV=mainnet' >> /app/.env && \
    echo 'SCORER_FACTORY_CONTRACT_ID=CBUUV6HRJYAUI24GPZTIKKPBMD5RYHTA2BBSIBK6N63EHV35LTP6L3FZ' >> /app/.env && \
    echo 'ENDPOINT=https://horizon.stellar.org' >> /app/.env

# Also copy .env to dist folder for runtime
RUN mkdir -p /app/dist && cp /app/.env /app/dist/.env

# Generate types and build (will now use the .env file)
RUN yarn codegen && yarn build

# Copy patch file
COPY patches/fix-soroban-bug.js /fix.js

# Create wrapper script with debugging
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'echo "=== Environment Variables ===" ' >> /entrypoint.sh && \
    echo 'echo "CHAIN_ID=$CHAIN_ID"' >> /entrypoint.sh && \
    echo 'echo "SOROBAN_ENDPOINT=$SOROBAN_ENDPOINT"' >> /entrypoint.sh && \
    echo 'echo "START_BLOCK=$START_BLOCK"' >> /entrypoint.sh && \
    echo 'echo "NODE_ENV=$NODE_ENV"' >> /entrypoint.sh && \
    echo 'echo "Working directory: $(pwd)"' >> /entrypoint.sh && \
    echo 'echo "Files in /app:"' >> /entrypoint.sh && \
    echo 'ls -la /app/' >> /entrypoint.sh && \
    echo 'echo "=== Starting SubQuery with patch ==="' >> /entrypoint.sh && \
    echo 'exec node -r /fix.js /usr/local/lib/node_modules/@subql/node-stellar/bin/run "$@"' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["-f=/app", "--db-schema=public", "--workers=1", "--batch-size=10", "--timeout=120000", "--unsafe"]