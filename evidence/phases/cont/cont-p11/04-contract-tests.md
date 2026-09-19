# CONT-P11 — 04 Contract & Integration Tests

**Deliverable:** `DEL-CONT-P11-04` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** QA

## Contracts

| Contract | Truth | Drift Guard |
|----------|-------|-------------|
| `OpenAPI 3.1.0` | `docs/backend/openapi.yaml:1` `openapi:3.1.0` `version:0.2.0` `110 paths` `rg "^  /api" 105` | `scripts/docs_audit_phase10.py` regenerates from `api/routers 27` via `rg` — CI `openapi.yaml` hash check future |
| `shared-types` | `packages/shared-types` `Workspace Memory Agent Event Connector` | `tsc` + `transformKeys` `api.ts:27` |
| `Arazzo 1.1.0` | optional multi-call workflows `openapi.yaml` companion | not required this phase |

## Tests

| Suite | cmd | Result (re-verified 2026-08-31) |
|-------|-----|----------------------------------|
| `pytest ingestion 31 + docs 20` | `uv run pytest test_ingestion test_documents -q -o addopts=""` | `51/51` `parsers 17` |
| `pytest full (serial)` | `uv run pytest -q -o addopts=""` | `~8-10min` 4 workers `1.2GB` `AGENTS.md:48` |
| `jest 34` `jest-axe 0` | `pnpm --filter web test` | `mvp-p15 94.2% + jest-axe 0 crit` |
| `e2e 60` `playwright 24 gating +36 visual` | `npx playwright test` | smoke `12/12` `basic-smoke.spec.ts` `k6 p95 120ms <200` |
| `contract` | `rg "110 paths" docs/backend/openapi.yaml` + `rg "17" parsers.py` | `110 == docs/phases/cont-p10/01` + `17 == F-40` |

**Reliability:** `IdempotencyMiddleware` `Idempotency-Key sha256(ws:req:tool:params)` `UNIQUE(workspace_id,idempotency_key)` `schema.py:648` `409` on duplicate; `BodySize 25MB` `main.py:256`.

---
_Version 1.0 2026-08-31 — `rg "51 passed" 51`._
