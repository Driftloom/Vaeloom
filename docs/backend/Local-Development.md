# Local Development (Backend)

> **Purpose:** Run the Vaeloom API locally from zero to first request **Owner:**
> Backend Team **Last Updated:** 2026-09-15

## Prerequisites

| Tool    | Version                                      | Notes                                   |
| ------- | -------------------------------------------- | --------------------------------------- |
| Python  | 3.12.13 (pinned, `apps/api/.python-version`) | Managed via `uv` (`uv python pin 3.12`) |
| `uv`    | Latest                                       | Runner + venv manager                   |
| Node.js | 20.14.0 (`.nvmrc`)                           | Frontend only                           |

## 1. Environment (exports, not `.env`)

Pydantic `model_config` has **no `env_file`** — `.env` files are ignored for
settings binding. Export variables in the shell **before** starting the server.
Nested delimiter means **double underscore** (`DATABASE__URL`); single
underscore (`DATABASE_URL`) does **not** bind. Root `.env.example` still shows
`DATABASE_URL` (wrong); `apps/api/.env.example` shows `DATABASE__URL` (correct).

```powershell
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"
$env:ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"
$env:LLM_API_KEY="mock-key"
$env:OTEL_SDK_DISABLED="true"
```

| Variable                  | Value (local)                      | Why                                                                             |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`              | 32+ chars (`openssl rand -hex 32`) | `validate_settings()` refuses to boot on empty/short/default                    |
| `ENCRYPTION_KEY`          | base64, 32+ chars                  | Same boot rule                                                                  |
| `DATABASE__URL`           | `sqlite+aiosqlite:///./dev.db`     | Local SQLite; Postgres (`postgresql+asyncpg://…`) for prod-like                 |
| `DATABASE_MIGRATION__URL` | (unset locally)                    | Owner URL for DDL only; when set, runtime must be least-privilege non-BYPASSRLS |
| `LLM_API_KEY`             | `mock-key`                         | Tests + offline use `mock_llm` autouse fixture                                  |
| `OTEL_SDK_DISABLED`       | `true`                             | Silence tracing locally                                                         |

`AUTH_JWT_SECRET` is wrong — the code reads `JWT_SECRET` (`config.py`).

## 2. Run the API

```powershell
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Swagger UI: `http://localhost:8000/docs`. Health: `GET /health`.

Never `pnpm dev` (spawns Nx across all 25 packages, hangs). API-only:
`pnpm dev:be`. Frontend: `pnpm dev:web` (or `make dev-web`).

## 3. Chromium (resume compile)

PDF compile uses Playwright Chromium (`services/document_builder.py`,
`page.pdf()` + page-fit loop). Without it, compile endpoints return **503 with a
setup hint** — by design, not a bug. One-time enable:

```powershell
uv run --project apps/api playwright install chromium
```

## 4. Frontend Gotchas

- **CSP `connect-src`**: `middleware.ts` + `next.config.js` block
  `localhost:8000` unless dev URLs are allow-listed
  (`NODE_ENV === 'development'`). Symptom: browser console CSP errors, API works
  via curl.
- **`transformKeys` is response-only**: backend serializes snake_case
  (`access_token`); `api.ts` / `api-client.ts` convert _responses_ to camelCase.
  Request bodies stay snake_case. Any new API client needs the same transform.
- **CSRF flow**: `GET /csrf-token` → send `X-CSRF-Token` header on mutations.
  `/api/v1/auth/*` and `/csrf-token` are exempt (`SKIP_PREFIXES`, `SKIP_PATHS`);
  without the header elsewhere you get 403. Test account: `demo@vaeloom.app` /
  `demo1234` (seeded demo DB; sign up if missing).

## 5. Tests

```powershell
# Fast (2-3 min, needs 32 GB): 16 workers grouped by file
cd apps/api; uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"
# Serial (8-10 min, reliable)
cd apps/api; uv run --project apps/api python -m pytest -q -o addopts=""
# Default: -n 4 (~1.2 GB)
```

2731 tests, 94% coverage, security 233/233. Tests use SQLite + `NullPool` with a
per-test `tmp_path` DB; `mock_llm` + `mock_connector_test` are autouse fixtures
(`tests/conftest.py`). Full suite has a known xdist hang (finding 39) — see
[Troubleshooting](./Troubleshooting.md).

## 6. Migrations

```powershell
cd apps/api; uv run --project apps/api alembic upgrade head  # apply
uv run --project apps/api alembic check                      # drift check
```

Dual-URL least-privilege: DDL runs on `DATABASE_MIGRATION__URL` (owner); runtime
stays on `DATABASE__URL`. See
[../database/Migrations.md](../database/Migrations.md).

## 7. OpenAPI Sync

After any router change: `python scripts/gen_openapi.py` → verify 162 paths →
update [API-Reference](./API-Reference.md). Full table in
[API-Overview](./API-Overview.md).

> _Last verified: 2026-09-15 — `openapi.yaml` 162 paths / 203 ops, service
> version 0.2.0._
