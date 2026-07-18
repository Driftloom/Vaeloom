#!/bin/bash
# Clean build artifacts
set -e

echo "🧹 Cleaning Vaeloom build artifacts..."

# Remove build outputs
rm -rf apps/*/dist apps/*/.next packages/*/dist services/*/dist

# Remove dependencies
rm -rf node_modules apps/*/node_modules packages/*/node_modules services/*/node_modules

# Remove caches
rm -rf .nx .turbo apps/*/.next/cache

echo "✅ Clean complete"
