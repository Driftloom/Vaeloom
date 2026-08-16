# Vaeloom Developer Onboarding Guide

Welcome to Vaeloom. This guide walks you through setting up a local development
environment, running the stack, and understanding the architecture.

## Prerequisites

| Tool           | Version               | Purpose                          |
| -------------- | --------------------- | -------------------------------- |
| Node.js        | >=18.x (see `.nvmrc`) | Frontend + tooling               |
| pnpm           | >=9.x                 | Package management (25 packages) |
| Python         | >=3.12                | Backend                          |
| Docker Desktop | Latest                | PostgreSQL, Redis, MinIO         |
| Git            | Latest                | Version control                  |

## Clone & Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/vaeloom.git
cd vaeloom

# 2. Install Node.js dependencies (all 25 packages)
pnpm install
# This runs: typecheck, build (all packages), postinstall hooks
# Expected time: ~2-3 minutes

# 3. Set up the Python backend
cd apps/api
python -m venv .venv
source .venv/Scripts/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cd ../..

# 4. Copy environment file
cp .env.example .env
```

## Running the Stack

### Start Infrastructure (Docker)

```bash
docker compose up -d postgres redis minio
```

This starts PostgreSQL (port 5432), Redis (6379), and MinIO (9000/9001).

### Run the Backend

```bash
pnpm dev:be
# or directly:
cd apps/api && python -m uvicorn api.main:app --reload --port 8000
```

API available at `http://localhost:8000/docs` (Swagger UI).

### Run the Frontend

```bash
pnpm dev:web
# or directly:
cd apps/web && pnpm next dev
```

**IMPORTANT:** Never use `pnpm dev` — it runs Nx across all 25 packages and
hangs. Use `pnpm dev:web` or `pnpm dev:be`.

Frontend available at `http://localhost:3000`.

## Running Tests

### Backend Tests

```bash
cd apps/api
python -m pytest tests/ -q
# With coverage:
python -m pytest tests/ --cov=src --cov-report=term-missing
```

- 1626 tests, all passing, 0 failures
- Tests use SQLite async with mock providers
- `mock_llm` and `mock_connector_test` are autouse fixtures in `conftest.py`

### Frontend Tests

```bash
cd apps/web && pnpm test
```

### Integration Tests

```bash
pnpm test:integration
```

### E2E Tests (Playwright)

```bash
cd apps/web && pnpm exec playwright test
```

### Load Tests (k6)

```bash
cd testing/load && k6 run smoke-test.js
```

## Common Issues & Fixes

### Port 3000 collision

```powershell
Get-Process -Name "node" | Stop-Process -Force
```

### pnpm install hangs

`.npmrc` is pre-configured: `auto-install-peers=true`,
`strict-peer-dependencies=false`.

### Backend can't connect to PostgreSQL

Ensure Docker containers are running: `docker ps | findstr vaeloom`.

### Alembic migration fails

```bash
cd apps/api
alembic downgrade -1
alembic upgrade head
```

### Python dependency conflicts

Always use `pip install -e ".[dev]"` inside the venv, never pip install
individual packages.

## PR Workflow

1. **Branch**: `git checkout -b feat/your-feature` (prefix: `feat/`, `fix/`,
   `chore/`, `docs/`)
2. **Develop**: Write code, add tests, run lint + typecheck
3. **Lint & Typecheck**

   ```bash
   pnpm lint           # ESLint across all packages
   pnpm typecheck      # TypeScript type checking
   cd apps/api && ruff check src/ tests/
   cd apps/api && python -m pytest tests/ -q
   ```

4. **Commit**: Conventional commits — `feat:`, `fix:`, `docs:`, `chore:`
5. **Push**: `git push -u origin feat/your-feature`
6. **PR**: Create PR against `main`. CI runs: lint, typecheck, test (backend +
   frontend), security audit
7. **Review**: At least one approval required. Address all comments.
8. **Merge**: Squash merge with descriptive message.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Interface Layer                        │
│  Web App (Next.js 15) | Desktop | VS Code | Mobile (F) │
├─────────────────────────────────────────────────────────┤
│               Connectors & Plugin Layer                  │
│  Gmail | GitHub | Drive | MCP | Plugin SDK              │
├─────────────────────────────────────────────────────────┤
│                  Ingestion Engine                        │
│  Document Parser | OCR | Semantic Extractor | Dedup     │
├─────────────────────────────────────────────────────────┤
│               Agent Orchestration                        │
│  Orchestrator | Resume | ATS | Job Search | ... (8)     │
├─────────────────────────────────────────────────────────┤
│           ⭐ Memory & Knowledge Layer (CORE)             │
│  Knowledge Graph | Vector Store | Structured Memory     │
├─────────────────────────────────────────────────────────┤
│               Storage & Security                         │
│  PostgreSQL | Redis | MinIO/S3 | Infisical | Auth       │
└─────────────────────────────────────────────────────────┘
```

### Key Directories

| Path                     | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `apps/api/`              | FastAPI backend (Python)                 |
| `apps/web/`              | Next.js 15 frontend (TypeScript)         |
| `packages/ui-kit/`       | Shared React components (shadcn/ui)      |
| `packages/shared-types/` | TypeScript types shared across packages  |
| `integrations/*/`        | External service integrations            |
| `connectors/*/`          | Protocol connectors (MCP, REST, GraphQL) |
| `plugins/*/`             | Sandboxed plugins                        |
| `sdk/typescript/`        | Public TypeScript SDK                    |
| `infra/terraform/`       | AWS infrastructure (IaC)                 |
| `infra/kubernetes/`      | Kubernetes manifests (Kustomize)         |

### Technology Stack

- **Backend**: FastAPI, SQLAlchemy async, asyncpg, Redis, pgvector, Alembic
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui
- **LLM**: Anthropic Claude (primary), OpenAI (secondary)
- **Storage**: PostgreSQL, Redis, MinIO (S3-compatible)
- **Auth**: JWT (access + refresh tokens), SSO (Google, Microsoft)
- **Observability**: OpenTelemetry, Prometheus, structlog
- **CI/CD**: GitHub Actions, Docker, Terraform (AWS EKS)

## Need Help?

- Check `AGENTS.md` for agent-specific development notes
- Check `docs/adr/` for architecture decision records
- Check `SECURITY.md` for security policies
- Ask in the team's engineering channel
