#!/bin/bash
# Enterprise deployment script
set -euo pipefail

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying Vaeloom to $ENVIRONMENT"

# Validate environment
case $ENVIRONMENT in
  dev|staging|prod) ;;
  *) echo "❌ Invalid environment: $ENVIRONMENT"; exit 1 ;;
esac

# Build
echo "🏗️  Building..."
pnpm install --frozen-lockfile
pnpm build

# Docker build
echo "🐳 Building Docker images..."
docker compose -f "$PROJECT_ROOT/docker-compose.yml" build

# Deploy based on environment
if [ "$ENVIRONMENT" = "dev" ]; then
  docker compose -f "$PROJECT_ROOT/docker-compose.yml" up -d
elif [ "$ENVIRONMENT" = "staging" ] || [ "$ENVIRONMENT" = "prod" ]; then
  echo "📦 Deploying to Kubernetes..."
  kubectl apply -k "$PROJECT_ROOT/infra/kubernetes/overlays/$ENVIRONMENT"
  kubectl rollout status deployment -n vaeloom --timeout=300s
fi

echo "✅ Deployment to $ENVIRONMENT complete"
