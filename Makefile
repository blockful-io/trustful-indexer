.PHONY: help up down logs clean build test proxy-logs indexer-logs stats rebuild

# Default target
help:
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "  Trustful Indexer - Makefile Commands"
	@echo "═══════════════════════════════════════════════════════════════"
	@echo ""
	@echo "  Setup & Run:"
	@echo "    make up          - Start all services (postgres, proxy, indexer)"
	@echo "    make down        - Stop all services"
	@echo "    make restart     - Restart all services"
	@echo ""
	@echo "  Development:"
	@echo "    make build       - Build indexer project"
	@echo "    make rebuild     - Clean and rebuild everything"
	@echo "    make logs        - Show logs from all services"
	@echo "    make proxy-logs  - Show only proxy logs"
	@echo "    make indexer-logs- Show only indexer logs"
	@echo ""
	@echo "  Testing & Debug:"
	@echo "    make test        - Test proxy health and stats"
	@echo "    make stats       - Show proxy statistics"
	@echo "    make test-block  - Test specific block (58253671)"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean       - Stop services and remove all data"
	@echo "    make clean-db    - Remove only database data"
	@echo ""
	@echo "═══════════════════════════════════════════════════════════════"

# Start all services
up:
	@echo "🚀 Starting all services..."
	docker-compose up -d
	@echo ""
	@echo "⏳ Waiting for services to be healthy..."
	@sleep 10
	@echo ""
	@echo "✅ Services started successfully!"
	@echo ""
	@echo "📊 Access points:"
	@echo "  - Proxy Health: http://localhost:8080/health"
	@echo "  - Proxy Stats:  http://localhost:8080/stats"
	@echo "  - PostgreSQL:   localhost:5432"
	@echo ""
	@docker-compose ps

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	docker-compose down
	@echo "✅ All services stopped"

# Restart services
restart: down up

# Show logs from all services
logs:
	docker-compose logs -f --tail=100

# Show only proxy logs
proxy-logs:
	docker-compose logs -f horizon-proxy --tail=100

# Show only indexer logs
indexer-logs:
	docker-compose logs -f subquery-node --tail=100

# Build indexer
build:
	@echo "🔨 Building indexer..."
	cd indexer && npm run build
	@echo "✅ Build complete"

# Rebuild everything
rebuild: clean
	@echo "🔨 Rebuilding everything from scratch..."
	cd proxy && npm install
	cd indexer && npm install && npm run build
	make up

# Test proxy endpoints
test:
	@echo "🧪 Testing proxy..."
	@echo ""
	@echo "1. Health Check:"
	@curl -s http://localhost:8080/health | python3 -m json.tool || echo "❌ Proxy not responding"
	@echo ""
	@echo "2. Statistics:"
	@curl -s http://localhost:8080/stats | python3 -m json.tool || echo "❌ Stats not available"
	@echo ""
	@echo "3. Test Ledger Request:"
	@curl -s "http://localhost:8080/ledgers/58333147" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'✅ Ledger {d.get(\"sequence\")} fetched successfully')" || echo "❌ Failed to fetch ledger"

# Show proxy statistics
stats:
	@echo "📊 Proxy Statistics:"
	@curl -s http://localhost:8080/stats | python3 -m json.tool || echo "Proxy not running"

# Test problematic block
test-block:
	@echo "🧪 Testing problematic block 58253671..."
	@curl -s "http://localhost:8080/ledgers/58253671" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Ledger: {d.get(\"sequence\")}, Transactions: {d.get(\"successful_transaction_count\")}')"
	@echo ""
	@echo "Testing operations (should trigger pagination):"
	@curl -s "http://localhost:8080/ledgers/58253671/operations?limit=200" | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Records: {len(d.get(\"_embedded\", {}).get(\"records\", []))}, Has next: {\"next\" in d.get(\"_links\", {})}')"

# Clean everything
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	rm -rf indexer/dist indexer/.data postgres_data
	@echo "✅ Cleanup complete"

# Clean only database
clean-db:
	@echo "🧹 Cleaning database..."
	docker-compose stop postgres
	docker-compose rm -f postgres
	docker volume rm trustful-indexer_postgres_data 2>/dev/null || true
	@echo "✅ Database cleaned"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	cd proxy && npm install
	cd indexer && npm install
	@echo "✅ Dependencies installed"

# Show service status
status:
	@docker-compose ps