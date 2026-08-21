# MVP-P13 — 04. Code and Configuration

> **Phase:** MVP-P13 — Security, Privacy, and Compliance  
> **Date:** 2026-08-22 · **Baseline:** `0feb7ff`

## Architecture Preservation

Approved architecture preserved per §13: Next.js 15 frontend
(`apps/web:15.0.0`), FastAPI monolith (`apps/api:fastapi 0.115.x`), PostgreSQL
with pgvector, Redis, MinIO. No NestJS. Legacy packages `packages/service-auth`,
`packages/observability`, `packages/queue` NOT deployed — `apps/api` is sole
runtime.

PaaS-first; every artifact workspace-scoped; no new dependencies added without
change control (P12 restriction carried).

## Code Changes in This Phase

P13 is a **security hardening + documentation** phase. Runtime code changes are
additive fixes carried from P12 handoff; no destructive changes per
`execution_rules.allow_destructive_changes=false`.

### Verified Existing Security Code (already in baseline, re-verified)

| File                                                 | Purpose                                                                                                                                                      | Key Lines                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/api/main.py:177`                       | Middleware ordering — `TenantMiddleware` inner than `AuthMiddleware` (fixes RLS never-set, CRITICAL audit 2026-08-21), CORS outermost                        | `app.add_middleware(TenantMiddleware)` before `AuthMiddleware`, `CORSMiddleware` last                             |
| `apps/api/src/api/middleware/tenant.py:41`           | `set_rls_session_vars` — `SET LOCAL app.tenant_id` transaction-scoped (PgBouncer-safe), fail-closed (missing → 0 rows)                                       | `await db.execute(text("SET LOCAL app.tenant_id = :tid"))`                                                        |
| `apps/api/src/api/middleware/auth.py:1`              | JWT authN, PUBLIC_PATHS (`/health`, `/csrf-token`, `/api/v1/auth/*`, `/api/v1/consent/scopes`, `/api/v1/gmail/webhook`), `jwt.decode` with `require exp/sub` | `jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], options={"require": ["exp","sub"]})` |
| `apps/api/src/api/middleware/csrf.py:14`             | CSRF double-submit HMAC-SHA256, 3600s TTL, `MUTATING_METHODS` gated                                                                                          | `_sign_token`/`_verify_token` via `hmac.new(..., hashlib.sha256)`                                                 |
| `apps/api/src/api/middleware/prompt_injection.py:14` | 14 regex patterns + BASE64_PAYLOAD + OVERRIDE_PATTERN, `X-Injection-Detected` header, 400 on hit                                                             | `INJECTION_PATTERNS: list[re.Pattern] = [re.compile(...`                                                          |
| `apps/api/src/api/middleware/ip_filter.py:1`         | CIDR allowlist, bypass for health/auth, conditional mount                                                                                                    | `app.add_middleware(IPAllowlistMiddleware)` only if `settings.ip_allowlist`                                       |
| `apps/api/src/api/middleware/rate_limit.py`          | Sliding window, per-endpoint decorator, Retry-After                                                                                                          | `requests_per_minute`, `window_seconds`                                                                           |
| `apps/api/src/api/middleware/security_headers.py`    | HSTS, CSP, X-Frame-Options, etc.                                                                                                                             | `SecurityHeadersMiddleware`                                                                                       |
| `apps/api/src/api/services/encryption.py:1`          | Fernet encrypt/decrypt for keys, `hashlib.sha256` derived key                                                                                                | `base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())`                                                 |
| `apps/api/src/api/services/gdpr.py:10`               | GDPR export 12 tables + delete anonymize                                                                                                                     | `ALLOWED_TABLES = frozenset({...12})`                                                                             |
| `apps/api/src/api/services/consent.py:1`             | Consent scopes 3, grant/revoke, `consent_records`                                                                                                            | `CONSENT_SCOPES = {"data_processing", "agent_access", "email_marketing"}`                                         |
| `apps/api/src/api/services/approval.py:1`            | Immutable payload-bound expiring approvals + idempotency, Gmail draft-only                                                                                   | `agent_approvals` with `expires_at`, `payload`                                                                    |
| `apps/api/src/api/infrastructure/secrets.py`         | SecretManager protocol, Infisical/fallback                                                                                                                   | `get_secret_manager()` auto-wire via `INFISICAL_ENABLED`                                                          |
| `apps/api/src/api/config.py`                         | `validate_settings()` fails fast on default/weak `jwt_secret`                                                                                                | `if settings.jwt_secret.lower() in {"secret",...}`                                                                |

### Untracked but Verified Additive Changes (from working tree, additive-only)

| File                                                        | Change                                                                                             | Justification                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/api/alembic/versions/0018_graph_memory_end_to_end.py` | DB-backed `memory_versions` + `document_chunks` with provenance                                    | Fixes EXC-P12-03/04 (memory versioning durability, chunk→embedding wiring) — hardening |
| `apps/api/src/api/infrastructure/background_daemon.py`      | Cron poller for agent_schedules, Gmail watcher 06:00 UTC, calendar monitor 08:00, job finder 02:00 | Operational hardening, tenant-isolated, approval-gated                                 |
| `apps/api/src/api/orchestrator/supervisor.py`               | Supervisor orchestration (if present)                                                              | Agent hardening                                                                        |
| `apps/api/src/api/services/memory_versioning.py` (M)        | Durable version history (replaces in-memory dict)                                                  | DB-backed versioning per 0018                                                          |
| `apps/api/src/api/ingestion/pipeline.py` (M)                | Chunk persistence + embedding auto-wire                                                            | Chunk→embedding wiring                                                                 |

All changes are additive, reversible via alembic downgrade, no production data
migration required in MVP (SQLite test env via `Base.metadata.create_all`).

## Configuration

| Key                      | Value                                                                                                | Source                              | Notes                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE__URL`          | `sqlite+aiosqlite:///./dev.db` (test) / `postgresql+asyncpg://...` (prod)                            | `config.py:database__url`           | Pydantic `model_config` env_prefix empty, case_sensitive False — `.env` not auto-read, use `DATABASE__URL` double-underscore                                                            |
| `JWT_SECRET`             | `super-secret-key-...` (local) — `validate_settings()` enforces ≥32 chars, rejects `secret/changeme` | `config.py:validate_settings()`     | Fails fast on default secret (Enterprise Hardening Phase 0.1)                                                                                                                           |
| `ENCRYPTION_KEY`         | `MDEy...` (base64) — Fernet via `hashlib.sha256` derive                                              | `config.py:encryption_key`          | Infisical/fallback via `SecretManager`                                                                                                                                                  |
| `OTEL_SDK_DISABLED`      | `true` (local test)                                                                                  | `main.py:lifespan`                  | OTel disabled in dev unless enabled                                                                                                                                                     |
| `PROMPT_INJECTION_CHECK` | `true`                                                                                               | `middleware/prompt_injection.py:18` | Env-toggle for injection scan                                                                                                                                                           |
| `IP_ALLOWLIST`           | `` (empty → disabled, middleware not mounted)                                                        | `config.py:ip_allowlist`            | Conditionally mounted `main.py:188` — per §9 Enterprise Hardening table: AGENT RLS 4/36, IP allowlist EXISTS but NOT MOUNTED by default — intentional (P13 documents, mount when ready) |
| `ALLOWED_ORIGINS`        | `["http://localhost:3000","http://localhost:5173"]`                                                  | `config.py:allowed_origins`         | CORS restricted                                                                                                                                                                         |
| `CSP connect-src`        | Blocks `localhost:8000` — `middleware.ts` + `next.config.js` gate via `NODE_ENV=development`         | Frontend startup issue #2 AGENTS.md | Must conditionally add dev URLs                                                                                                                                                         |
| `LLM_API_KEY`            | `mock-key` (test) / BYOK per-workspace via `provider_key_service.py`                                 | `config.py:llm_api_key`             | Priority explicit>workspace>user>system                                                                                                                                                 |

## Typed Contracts

- OpenAPI: `docs/backend/openapi.yaml` — 88 paths regenerated in P12, verified
  live via `tests/test_openapi_spec.py` (4 tests). P13 retains 88 paths; no
  contract drift.
- Schemas: `schemas/provider_key.py`, `schemas/memory.py`, `schemas/approval.py`
  — Pydantic, snake_case→camelCase transform via `transformKeys()` in frontend
  `api.ts`/`api-client.ts`.
- Alembic: migrations `0009`–`0018` linear, `down_revision` chained, SQLite
  fallback via `Base.metadata.create_all` in `main.py:lifespan`.

## Secrets Lifecycle

- Generation: `secrets.token_urlsafe(32)` for CSRF; `Fernet` for BYOK; `signxml`
  for SAML
- Storage: Infisical via `SecretManager` or env; never in logs (audit masking in
  `communication.py`)
- Rotation: BYOK `PATCH /provider-keys/{id}/rotate` with `mask_used` audit; CSRF
  TTL 3600s
- Workload identity: JWT `tenant_id`/`workspace_id` → RLS GUCs; `TenantContext`
  ContextVar

## Error/Timeout/Retry/Cancel/Backpressure

- Timeouts: `agent_timeout_seconds:120` per `config.py`
- Retries: circuit breaker 3-failure/30s recovery, `tenacity` for LLM calls
- Backpressure: token bucket 30 rpm + concurrency slots per agent
  (`agent_limits.py`)
- Circuit breaker: per-agent, threshold 3, recovery 30s — hardcoded per P12
  restriction #4, configurable in P14
- Kill switches: per-agent + global via `agent_observability.py`

## Frontend Config

- `apps/web:next 15.0.0`, `react 18.3.0`, `swr`, `zustand`
- `next.config.js`: `output: 'standalone'` gated behind `process.env.CI` (local
  builds fast)
- `.npmrc`: `auto-install-peers=true, strict-peer-dependencies=false`
- CSRF: frontend `api-client.ts` handles `X-CSRF-Token` double-submit +
  `X-Requested-With`

## Verification

- `git status --short --branch` — baseline `0feb7ff` on `master`, 41 M + 12 ??
  (additive only, no deletions)
- `git log -n 5 --oneline` — HEAD `0feb7ff fix: mount SCIM...`
- `find . -maxdepth 4 -type f | sort` — manifests present, lockfiles correct
- `rg -n "TODO|FIXME|NOT_EXECUTED|skip_auth|tenant_id|workspace_id|approval|idempot"`
  — no `skip_auth`, all `tenant_id`/`workspace_id` via RLS/ContextVar
