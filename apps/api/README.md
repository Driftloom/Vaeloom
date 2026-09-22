# Vaeloom API (`apps/api`)

> Single monolithic FastAPI application — auth, CRUD, permissions, agents,
> memory, RAG, model routing. **Version 0.2.0** · Python 3.12.13 (via `uv`) ·
> **Last Updated:** 2026-09-15

## Overview

All request handling lives in `src/api/`: routers in `src/api/routers/`,
business logic in `src/api/services/` (82 files), middleware in
`src/api/middleware/` (logger → auth → permissions → rate limit → validation).
Docs: `docs/backend/` (start at
[`docs/backend/API-Reference.md`](../../docs/backend/API-Reference.md), 241
paths / 294 ops, regen 2026-09-21). Migrations: `alembic/versions/` (42
versions, RLS 42/42).

## Environment (correct names)

`model_config` has **no `env_file`** — export vars in the shell for certainty.
Repo `.env` files (root, `apps/api/.env`) load as non-overriding fallback
defaults only; explicit environment always wins. Nested delimiter = **double
underscore**.

| Variable                  | Local value                        | Required                                      |
| ------------------------- | ---------------------------------- | --------------------------------------------- |
| `JWT_SECRET`              | 32+ chars (`openssl rand -hex 32`) | Yes — boot refusal if empty/short/default     |
| `ENCRYPTION_KEY`          | base64 32+ chars                   | Yes — same boot rule                          |
| `DATABASE__URL`           | `sqlite+aiosqlite:///./dev.db`     | Yes (`DATABASE_URL` single-`_` does NOT bind) |
| `DATABASE_MIGRATION__URL` | (unset locally)                    | Prod DDL/owner URL only                       |
| `LLM_API_KEY`             | `mock-key`                         | Yes (tests use `mock_llm`)                    |
| `OTEL_SDK_DISABLED`       | `true`                             | Local                                         |
| `BROWSER_TOOLS_ENABLED`   | `true`                             | Kill switch for browser tools                 |
| `SCRAPE_QUOTA_PER_HOUR`   | `20`                               | Per-workspace scrape quota                    |
| `TEMPORAL_ENABLED`        | `false`                            | Durable workflows off by default              |
| `AGENT_REACT_ENABLED`     | `0`                                | `1` enables ReAct tool-calling + streaming    |

Wrong names that will silently not bind: `AUTH_JWT_SECRET`. `DATABASE_URL`
(single underscore) is accepted as a convenience alias for `DATABASE__URL`.

## Run

```powershell
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"
$env:ENCRYPTION_KEY="$(openssl rand -base64 32)"  # fresh per machine; test vector MDEy... is test-only
$env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"
$env:LLM_API_KEY="mock-key"
$env:OTEL_SDK_DISABLED="true"
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Swagger: `http://localhost:8000/docs` · Health: `GET /health`.

## Test

```powershell
# Fast (2-3 min, 32 GB)
uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"
# Serial (8-10 min, reliable)
uv run --project apps/api python -m pytest -q -o addopts=""
```

3640 tests collected · 94% coverage · security 233/233. SQLite + `NullPool`,
per-test `tmp_path` DB; `mock_llm` + `mock_connector_test` autouse fixtures.
Known xdist hang (finding 39) — see
[`docs/backend/Troubleshooting.md`](../../docs/backend/Troubleshooting.md).

## System Dependencies & Parsing Prerequisites

- **PDF & Document Parsing**: `pdfplumber`, `python-docx`, `pypdf` are installed
  via `uv`.
- **OCR Engine (Scanned PDFs/Images)**: Scanned image/PDF extraction requires
  Tesseract OCR (`tesseract-ocr` + `tesseract-ocr-eng`). In production Docker
  images, Tesseract is pre-installed. In local development, install via
  `winget install UB-Mannheim.TesseractOCR` (Windows) or
  `apt install tesseract-ocr` (Linux). If missing, `parsers.py` flags
  `DOC_SCANNED_IMAGE_NO_TEXT` and logs structured alerts gracefully.
- **Headless Chromium (Resume Compilation)**: Run
  `uv run --project apps/api playwright install chromium` once locally for PDF
  compilation.

## Migrate

```powershell
uv run --project apps/api alembic check
uv run --project apps/api alembic upgrade head
```

## Router Inventory

Always-on (`/api/v1` unless noted): `auth`, `workspaces` (+ nested
`applications`), `memories`, `agents` (+ `chat`, `admin/agents/usage`),
`events`, `search`, `integrations`, `documents`, `resumes` (13),
`notifications`, `connectors` (incl. 4 `mcp/*`), `scheduler`, `knowledge-graph`,
`gdpr` + `consent`, `approvals`, `gmail`, `provider-keys` (4), `temporal` (6),
`profile` (15), `opportunities` (2), `council` (3), `cognition` (6),
`sovereignty` (8), `anticipation` (4), `federation` (1). Top-level: `/health`
(×3), `/metrics`, `/csrf-token`, `/api/v1/security/encryption-status`.

Enterprise-gated (`enterprise_routes_enabled=true`, default off — excluded from
`openapi.yaml` by design): `billing`, `plugins`, `analytics`, `audit`, `iam`,
`recommendations`, `webhooks`, `admin_console`, `scim`, `feature_flags`.

Regen the spec after router changes: `python scripts/gen_openapi.py` (repo root)
→ 243 paths expected.
