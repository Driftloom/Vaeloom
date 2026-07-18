#!/bin/bash
# Environment check script for Vaeloom
set -e

echo "🔍 Checking Vaeloom environment..."

check_var() {
  if [ -z "${!1}" ]; then
    echo "❌ $1 is not set"
    return 1
  else
    echo "✅ $1 is set"
  fi
}

check_command() {
  if command -v "$1" &> /dev/null; then
    echo "✅ $1 $(eval $2)"
    return 0
  else
    echo "❌ $1 is not installed"
    return 1
  fi
}

# Check commands
check_command "node" "--version"
check_command "pnpm" "--version"
check_command "docker" "--version"
check_command "git" "--version"

# Check Node version >= 20
NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js version must be >= 20 (found v$NODE_MAJOR)"
  exit 1
fi

echo "✅ Environment ready"
