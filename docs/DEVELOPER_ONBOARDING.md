# Vaeloom Developer Onboarding Guide

> **Last Updated:** 2026-09-22 · Backend 0.2.0 · API spec 254 paths / 315 ops

Welcome to Vaeloom. This guide walks you through setting up a local development
environment, running the stack, and understanding the architecture.

## Prerequisites

| Tool           | Version                                        | Purpose                                            |
| -------------- | ---------------------------------------------- | -------------------------------------------------- |
| Node.js        | **20.14.0** (`.nvmrc`)                         | Frontend + tooling                                 |
| pnpm           | >=9.x                                          | Package management (25 packages)                   |
| Python         | 3.12.13 (`apps/api/.python-version`, via `uv`) | Backend                                            |
| `uv`           | Latest                                         | Python runner + venv (do NOT use raw `pip`/`venv`) |
| Docker Desktop | Latest                                         | PostgreSQL, Redis, MinIO (prod-like only)          |
| Git            | Latest                                         | Version control                                    |

## Clone & Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/vaeloom.git
cd vaeloom

# 2. Install Node.js dependencies (all 25 packages)
pnpm install
# Expected time: ~2-3 minutes (.npmrc pre-configured)

# 3. Python backend needs no manual venv: uv manages it
uv python pin 3.12  # already pinned in apps/api/.python-version

# 4. One-time: Chromium for resume PDF compile
uv run --project apps/api playwright install chromium
```

## Environment (read this — 4 gotchas)

Pydantic `model_config` has **no `env_file`**: `.env` files are ignored. Export
vars in the shell before starting anything. Nested delimiter = **double
underscore**.

```powershell
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"  # 32+ chars or boot refusal
$env:ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"              # NOT DATABASE_URL (single-_ won't bind)
$env:LLM_API_KEY="mock-key"
$env:OTEL_SDK_DISABLED="true"
```

| Gotcha                               | Rule                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE__URL` vs `DATABASE_URL`    | Double underscore binds; root `.env.example` single-`_` is wrong, `apps/api/.env.example` is correct                             |
| `JWT_SECRET` (not `AUTH_JWT_SECRET`) | Min 32 chars (`openssl rand -hex 32`); `validate_settings()` refuses to boot otherwise                                           |
| CSP `connect-src`                    | `middleware.ts` + `next.config.js` must allow `http://localhost:8000` in dev, or the browser blocks API calls that work via curl |
| CSRF                                 | `GET /csrf-token` → `X-CSRF-Token` header on mutations; `/api/v1/auth/*` exempt; missing header = 403                            |

Full detail:
[`docs/backend/Local-Development.md`](./backend/Local-Development.md),
[`docs/backend/Troubleshooting.md`](./backend/Troubleshooting.md).

## Running the Stack

### Start Infrastructure (Docker, prod-like only)

```bash
docker compose up -d postgres redis minio
```

Local dev needs none of this (SQLite + mocks).

### Run the Backend

```bash
pnpm dev:be
# or directly (from repo root, env exported first):
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

API at `http://localhost:8000/docs` (Swagger UI).

### Run the Frontend

```bash
pnpm dev:web
# or directly:
cd apps/web && pnpm next dev
```

**IMPORTANT:** Never use bare `pnpm dev` — it is disabled fail-fast (prints a
redirect; it formerly ran Nx across all 25 packages and hung). Use
`pnpm dev:web` (`make dev-web` is fastest) or `pnpm dev:be`.

Frontend at `http://localhost:3000`. Test account: `demo@vaeloom.app` /
`demo1234` (seeded demo DB; sign up if missing).

## Running Tests

### Backend Tests (2731 tests, 94% coverage, security 233/233)

```bash
# Fast: 2-3 min, needs 32 GB
uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"
# Serial: 8-10 min, reliable
uv run --project apps/api python -m pytest -q -o addopts=""
# With coverage
uv run --project apps/api python -m pytest --cov=api --cov-report=term -q
```

- Tests use SQLite + `NullPool` with a per-test `tmp_path` DB
- `mock_llm` and `mock_connector_test` are autouse fixtures in
  `tests/conftest.py`
- Full suite has a known xdist hang (finding 39) — per-file or serial runs are
  reliable

### Frontend Tests

```bash
cd apps/web && pnpm test        # 34 jest
cd apps/web && pnpm exec playwright test  # 60 e2e (24 gating + 36 visual)
```

### Integration / Load Tests

```bash
cd apps/api && uv run --project apps/api python -m pytest tests/test_noauth_private.py -q  # auth boundary example
cd testing/load && k6 run smoke-test.js
```

> There is no `pnpm test:integration` script — use the commands above.

### Migrations

```bash
uv run --project apps/api alembic check
uv run --project apps/api alembic upgrade head
```

42 versions; RLS 42/42. Dual-URL least-privilege (`DATABASE_MIGRATION__URL` for
DDL only) — see [`docs/database/Migrations.md`](./database/Migrations.md).

## Common Issues & Fixes

| Issue                        | Fix                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Port 3000 collision          | `Get-Process -Name "node" \| Stop-Process -Force`                                 |
| Env ignored / wrong DB       | Export `DATABASE__URL` (double-`_`); `.env` files are not read                    |
| 403 on mutations             | CSRF: `GET /csrf-token` → `X-CSRF-Token` header                                   |
| Boot refusal (`JWT_SECRET…`) | 32+ chars; `openssl rand -hex 32`                                                 |
| 503 from resume compile      | `uv run --project apps/api playwright install chromium`                           |
| pytest xdist hang            | Serial `-o addopts=""` or per-file runs                                           |
| Alembic fails                | `alembic downgrade -1` → `alembic upgrade head` (via `uv run --project apps/api`) |

## PR Workflow

1. **Branch**: `git checkout -b feat/your-feature` (prefix: `feat/`, `fix/`,
   `chore/`, `docs/`)
2. **Develop**: Write code, add tests, run lint + typecheck
3. **Lint & Typecheck**

   ```bash
   pnpm lint           # ESLint across all packages
   pnpm typecheck      # TypeScript type checking
   cd apps/api && uv run --project apps/api ruff check src/ tests/
   uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"
   ```

4. **Commit**: Conventional commits — `feat:`, `fix:`, `docs:`, `chore:`
5. **Push**: `git push -u origin feat/your-feature`
6. **PR**: Create PR against `main`. If you touched routers, regen OpenAPI
   (`python scripts/gen_openapi.py`) and update `docs/backend/API-Reference.md`
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
│           Memory & Knowledge Layer (CORE)                │
│  Knowledge Graph | Vector Store | Structured Memory     │
├─────────────────────────────────────────────────────────┤
│               Storage & Security                         │
│  PostgreSQL (RLS 42/42) | Redis | MinIO/S3 | Auth       │
└─────────────────────────────────────────────────────────┘
```

Backend = **one** monolithic FastAPI app (`apps/api`), version 0.2.0.

### Key Directories

| Path                     | Purpose                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `apps/api/`              | FastAPI backend (Python) — see [`apps/api/README.md`](../apps/api/README.md) |
| `apps/web/`              | Next.js 15 frontend (TypeScript)                                             |
| `packages/ui-kit/`       | Shared React components (shadcn/ui)                                          |
| `packages/shared-types/` | TypeScript types shared across packages                                      |
| `integrations/*/`        | External service integrations                                                |
| `connectors/*/`          | Protocol connectors (MCP, REST, GraphQL)                                     |
| `plugins/*/`             | Sandboxed plugins                                                            |
| `sdk/typescript/`        | Public TypeScript SDK                                                        |

### Technology Stack

- **Backend**: FastAPI, SQLAlchemy async, asyncpg, Redis, pgvector, Alembic
- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui
- **LLM**: Anthropic Claude (primary), OpenAI (secondary); `mock-key` offline
- **Storage**: PostgreSQL (RLS 42/42), Redis, MinIO (S3-compatible)
- **Auth**: JWT (access 1h + refresh 30d rotation), SSO (Google, Microsoft)
- **Observability**: OpenTelemetry, Prometheus (`/metrics`)
- **CI/CD**: GitHub Actions, Docker

## Need Help?

- Backend local setup:
  [`docs/backend/Local-Development.md`](./backend/Local-Development.md)
- When it breaks:
  [`docs/backend/Troubleshooting.md`](./backend/Troubleshooting.md)
- API endpoints: [`docs/backend/API-Reference.md`](./backend/API-Reference.md)
- Check `AGENTS.md` for agent-specific development notes
- Check `docs/adr/` for architecture decision records
