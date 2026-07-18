#!/bin/bash
# Local deployment script
set -e

echo "🚀 Deploying Vaeloom locally..."

# Check environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created .env from template"
fi

# Start infrastructure
docker compose up -d postgres redis
echo "⏳ Waiting for infrastructure..."
sleep 5

# Run migrations
pnpm db-migrate

# Seed database
pnpm db-seed

# Build and start services
pnpm build
pnpm dev &

echo "✅ Local deployment complete"
echo "   Web: http://localhost:3000"
echo "   API: http://localhost:4000"
echo "   AI:  http://localhost:8000"
