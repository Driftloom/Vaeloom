# MVP-P14 — 04. Code and Configuration

> **Phase:** MVP-P14 — Testing and Quality Engineering  
> **Date:** 2026-08-22 · **Baseline:** `a69d7d7` (P13 remediation) + P14 test-hardening

## Architecture Preservation (§13)

Preserved monolith `FastAPI 0.115.x + Next.js 15 + Postgres pgvector + Redis + MinIO` per ADR-001. No NestJS, no legacy `packages/service-auth` deployment. PaaS-first, workspace-scoped. `enterprise_routes_enabled=false` remains.

## Code Changes in This Phase (testing focus, additive only)

P14 is **test-hardening**; production code changes are minimal additive guards, not destructive (`allow_destructive_changes=false`).

| File | Change | Purpose | Evidence |
|---|---|---|---|
| `apps/api/tests/conftest.py:9` | JWT 27→32+ chars `test-jwt-secret-for-ci-only-32-chars-long!!` (carried from P13 F-07) | Zero `InsecureKeyLengthWarning` | 2 quick runs 0 warnings |
| `apps/api/src/api/services/gdpr.py:15` | `ALLOWED_TABLES`/`USER_TABLES` 12→31 (added `consent_records`, `documents`, `document_chunks`, `memory_versions`, `provider_keys`, `entities`, `relationships`, `embeddings`, etc) | Complete Art.20 portability (F-09) | `test_gdpr empty` PASSED 12.07s, `test_delete` PASSED 13.88s |
| `apps/api/alembic/versions/0019_rls_and_sanitize_hardening.py:51` | `OR ''` fail-open → fail-closed (carried) | Tenant isolation hardening | PG-only, SQLite `create_all` fallback |
| `docs/security/DPIA.md:5` | `COMPLETE→DRAFT` region TBD | Honest F-10 | Header 1.1 |
| `docs/security/Threat-Model.md:20` | Added `Document chunks` + `BYOK provider_keys` assets | F-17 | 9 assets now |

### Unchanged (verified preserved)

- `apps/api/src/api/main.py:177` `TenantMiddleware` inner than `AuthMiddleware` (correct Starlette reverse, fixes CRITICAL RLS bug)
- `main.py:188` `IPAllowlistMiddleware` always mounted no-op when empty (F-18 corrected)
- `main.py:232` `csrf_token` TODO Redis for multi-worker (F-06 EXC-P13-07)
- `main.py: lifespan` `create_all` 42 tables + alembic `0018/0019` migration chain
- `middleware/tenant.py:41` `SET LOCAL app.tenant_id` fail-closed (missing→0 rows)
- `middleware/auth.py:1` JWT `exp/sub` + `PUBLIC_PATHS` sorted (F-02 determinism)
- `middleware/prompt_injection.py:14` 14 patterns + base64 + override (gap F-08: JSON-only)

## Configuration (representative env for tests)

| Key | Value | Notes |
|---|---|---|
| `DATABASE__URL` | `sqlite+aiosqlite:///...tmp_path.../test.db` via `db_path(tmp_path)` per-test `NullPool` | Representative via `sqlalchemy.types` MockVector/MockArray/MockUUID in `conftest.py`/`security/conftest.py` |
| `JWT_SECRET` | `test-jwt-secret-for-ci-only-32-chars-long!!` (test), `super-secret-key-12345-dev-only-32-chars-long!!` (dev) | ≥32 chars, no warning, `validate_settings()` enforces in non-local |
| `ENCRYPTION_KEY` | `test-encryption-key-must-be-at-least-32-chars!!` | 32+ |
| `OTEL_SDK_DISABLED` | `true` local | Disabled for test speed |
| `PROMPT_INJECTION_CHECK` | `true` | 14 patterns active |
| `LLM mock` | `mock_llm` autouse no real API | Deterministic |
| `uv` | `pytest -q -o addopts="-n 4"` (xdist 4 workers ~1.2GB) vs serial `-o addopts=""` ~8-10min | `pytest --collect-only -q` 2555 |

## Connectors / Migrations

- `alembic/versions` `0001`–`0019` linear, `0018` adds `memory_versions` + `document_chunks` (SQLite `create_all` fallback), `0019` adds RLS on new `document_chunks`, `memory_versions`, `embeddings` (fail-closed after F-05)
- `models/schema.py:42` tables, `conftest.py` `create_all` + raw `consent_records` + `usage_records` per-test
- `openapi.yaml` 88 paths (uncommitted working-tree 4052-line regen from prior feat branch — not committed this phase, not relied upon)

## Verification

- `git rev-parse HEAD` `a69d7d7` + working-tree `003-workstreams` etc additive only
- `pytest --collect-only -q -o addopts=""` 2555 (verified 12.91s, 30.85s cold)
- `uv run -c "from api.services.gdpr import ALLOWED_TABLES; print(len(ALLOWED_TABLES))"` → 31
- Warnings 0 on 2 quick `test_gdpr`/`test_csrf` runs (was 21 pre-F-07)
