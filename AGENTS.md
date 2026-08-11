# Vaeloom — Agent Notes

## 📜 Source of Truth — 66 Phase Prompts

- **The 66 independent end-to-end phase prompts** (3 tracks x 22 phases: MVP,
  MVP-to-Enterprise continuation, Enterprise) are the **governing contract** for
  phase execution.
- Location: `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/` —
  start with `00-master-index.md`, then `EXECUTION-STATUS.md` for what is
  done/in progress/next.
- Each prompt is standalone: predecessor forensic audit → GO / CONDITIONAL GO /
  NO-GO → requirements → tests/security → weighted gate → handoff.
- Execution evidence lives in `docs/phases/<track>-pXX/` (gate reports,
  registers, handoffs).

## Quick Commands

| Action                | Command                                           | Time     |
| --------------------- | ------------------------------------------------- | -------- |
| **Frontend dev**      | **`pnpm dev:web`**                                | **2-5s** |
| Frontend dev (direct) | `make dev-web`                                    | **2-5s** |
| Backend dev           | `pnpm dev:be`                                     | instant  |
| Install deps          | `pnpm install`                                    | **2.2s** |
| Backend tests         | `cd apps/backend && python -m pytest tests/ -q`   | ~5min    |
| ALL tests w/ cov      | `cd apps/backend && python -m pytest tests/ --co` | ~10min   |

## 🚨 CRITICAL: Never use `pnpm dev`

`pnpm dev` runs `nx run-many --target=dev --parallel` which spawns Nx across
**all 25 packages**. Most packages have no `dev` script, so it hangs forever.
**Always** use:

- **`pnpm dev:web`** — runs only the web app via Nx (2-5s startup)
- **`make dev-web`** — runs `cd apps/web && pnpm next dev` directly (fastest)
- **`pnpm dev:be`** — runs the backend only

## Frontend — Startup Issues

1. **Port 3000 collisions** — leftover processes block port. Fix:
   `Get-Process -Name "node" | Stop-Process -Force` then retry
2. **`.npmrc`** — `auto-install-peers=true, strict-peer-dependencies=false` for
   fast installs
3. **`next.config.js`** — `output: 'standalone'` is gated behind
   `process.env.CI` (local builds are fast)

## Backend — Test State

- **2353 tests pass**, 2 xfailed, 0 failures (suite grew with P11: approval API,
  idempotency, migrations, openapi-sync, gmail watch/drafts)
- **All source files 100% coverage** (verified individually)
- Python 3.14 (note: `__athrow__` removed from async generators, use `athrow()`)
- Tests use SQLite with mock backend; `mock_llm` + `mock_connector_test` autouse
  fixtures in conftest.py

## Enterprise Hardening — Status

| Phase                     | Status | Details                                                                                                                       |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 0.1 JWT validation        | ✅     | `validate_settings()` fails fast on default secret                                                                            |
| 0.2 Plugin sandbox        | ✅     | `exec()` → subprocess isolation                                                                                               |
| 0.3 Infisical secrets     | ✅     | SecretManager protocol, infisical/fallback                                                                                    |
| 0.5 Rate limiting         | ✅     | Sliding window, per-endpoint decorator, Retry-After                                                                           |
| 0.6 CORS hardening        | ✅     | Restricted origins/methods/headers, security headers                                                                          |
| 0.7 Docs consolidation    | ✅     | Documents/ deleted, references fixed                                                                                          |
| 0.8 Logging               | ✅     | JSON/pretty formatters, correlation IDs, structured fields                                                                    |
| 1.x CI/CD                 | ✅     | GitHub Actions (backend, frontend, docker, deploy, release)                                                                   |
| 2.x Frontend API          | ✅     | Typed client + all 16 pages wired                                                                                             |
| 3.x Next.js pages         | ✅     | loading.tsx, error.tsx, not-found.tsx (global + per-route)                                                                    |
| 4.x Enterprise auth       | ✅     | SSO (Google/Microsoft), RBAC middleware                                                                                       |
| 5.x Observability         | ✅     | OpenTelemetry, health checks, Prometheus metrics                                                                              |
| 6.x Multi-tenancy         | ✅     | Tenant context, tenant-aware DB, audit logging, data isolation                                                                |
| 7.x Agent hardening       | ✅     | Circuit breaker, fallback policies, per-agent rate limits                                                                     |
| 8.x Performance           | ✅     | SWR caching, route prefetching, image optimization, bundle analysis                                                           |
| 9.x Security & Compliance | ✅     | GDPR, API key rotation, IP allowlisting, data retention, compliance docs                                                      |
| 10.x Testing/QA           | ✅     | Integration tests (32), E2E smoke (Playwright), load test (k6), stress test, security tests, mutation tests, SonarQube config |
| 11.x Documentation        | ✅     | 20 ADRs, OpenAPI spec, onboarding guide, deployment/DR runbooks, API reference                                                |
| 12.x Enterprise Polish    | ✅     | Light/dark mode, keyboard shortcuts, API versioning, webhooks, batch operations                                               |

## 🔴 Critical Config for Agent Sessions

When starting fresh, **these 4 things WILL break** if not handled:

1. **`.env` not read by Pydantic** — `model_config` lacks `env_file`. Use
   `DATABASE__URL` (double underscore), NOT `.env` file
2. **CSP `connect-src`** — `middleware.ts` + `next.config.js` block
   `localhost:8000`; conditionally add dev URLs via
   `process.env.NODE_ENV === 'development'`
3. **snake_case ↔ camelCase** — Backend Pydantic serializes as `access_token`;
   frontend expects `accessToken`. Both `api.ts` and `api-client.ts` have
   `transformKeys()` to convert responses. Any new API client needs the same.
4. **CSRF blocks auth endpoints** — `middleware/csrf.py` has
   `SKIP_PREFIXES = frozenset({"/api/v1/auth"})` and `middleware/auth.py` has
   `"/csrf-token"` in `PUBLIC_PATHS`. POST to auth endpoints without these will
   get 403 or 500.

### Server Startup

```
# Terminal 1: Backend (set vars BEFORE python)
$env:JWT_SECRET="super-secret-key-12345-dev-only"; $env:ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="; $env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"; $env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
pnpm dev:web
```

### Test Account

- Email: `demo@vaeloom.app`
- Password: `demo1234`
- Or sign up at `localhost:3000/signup`

## Graphify Knowledge Graph

- **13,511 nodes, 20,107 edges, 735 communities** built from 904 files
- Top god nodes: BaseModel, UUID, BaseAgent, LLMService, Tool
- 3 main layers: shared foundations → integrations → agent/memory/LLM core

## Workspace Structure

25 packages total:

- `apps/` — web (Next.js 15), backend (FastAPI/Python)
- `packages/` — ui-kit, shared-types, eslint-config, tsconfig, observability,
  etc.
- `integrations/` — calendar, email, github, google-drive, notion, slack
- `connectors/` — graphql, mcp, rest
- `sdk/` — typescript
- `plugins/` — tag-generator, word-count, sentiment, summarizer, translator
