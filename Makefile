.PHONY: help dev build test lint typecheck clean setup docker-up docker-down \
        docker-build db-migrate db-studio db-seed format format-check hooks-install \
        services-dev services-lint services-typecheck services-test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
dev: ## Start all apps in dev mode
	pnpm dev

build: ## Build all packages
	pnpm build

test: ## Run all tests
	pnpm test

lint: ## Lint all packages
	pnpm lint

typecheck: ## TypeScript type checking
	pnpm typecheck

# Setup
setup: ## One-click developer setup
	pnpm install
	pnpm build
	cp -n .env.example .env || true

# Cleanup
clean: ## Remove all build artifacts and node_modules
	pnpm clean
	find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name ".next" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name "__pycache__" -type d -prune -exec rm -rf {} + 2>/dev/null || true
	find . -name ".pnpm-store" -type d -prune -exec rm -rf {} + 2>/dev/null || true

# Docker (all services)
docker-up: ## Start all services with Docker Compose
	docker compose up -d

docker-down: ## Stop all services
	docker compose down

docker-build: ## Build all Docker images
	docker compose build

docker-up-core: ## Start only core infrastructure (postgres + redis)
	docker compose up -d postgres redis

# Docker (single service)
docker-up-service: ## Start a specific service: make docker-up-service S=memory-store
	docker compose up -d $(S)

docker-logs: ## Tail logs for a service: make docker-logs S=memory-store
	docker compose logs -f $(S)

# Database
db-migrate: ## Run Prisma migrations
	pnpm --filter @vaeloom/api exec prisma migrate dev

db-studio: ## Open Prisma Studio
	pnpm --filter @vaeloom/api exec prisma studio

db-seed: ## Seed database
	pnpm --filter @vaeloom/api exec prisma db seed

db-reset: ## Reset database (all data lost)
	pnpm --filter @vaeloom/api exec prisma migrate reset --force

# Quality
format: ## Format code with Prettier
	pnpm format

format-check: ## Check formatting
	pnpm format:check

# Git hooks
hooks-install: ## Install Git hooks
	git config core.hooksPath .husky
	pnpm exec husky install

# Microservices (bulk commands)
services-dev: ## Start all microservices in dev mode (runs each in background)
	pnpm --filter @vaeloom/memory-store --filter @vaeloom/auth-service \
	  --filter @vaeloom/knowledge-graph --filter @vaeloom/event-bus \
	  --filter @vaeloom/search-service --filter @vaeloom/agent-engine \
	  --filter @vaeloom/analytics-service --filter @vaeloom/audit-service \
	  --filter @vaeloom/billing-service --filter @vaeloom/connector-service \
	  --filter @vaeloom/document-ingestion --filter @vaeloom/iam-service \
	  --filter @vaeloom/integration-service --filter @vaeloom/job-scheduler \
	  --filter @vaeloom/notification-service --filter @vaeloom/plugin-service \
	  --filter @vaeloom/rbac-service --filter @vaeloom/recommendation-service \
	  dev &

services-lint: ## Lint all microservices
	pnpm -r --filter @vaeloom/*-service lint

services-typecheck: ## Typecheck all microservices
	pnpm -r --filter @vaeloom/*-service typecheck

services-test: ## Test all microservices
	pnpm -r --filter @vaeloom/*-service test

# Integrations
integration-test: ## Run integration tests (requires postgres + redis)
	pnpm --filter @vaeloom/api test:e2e
