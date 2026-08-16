# Vaeloom — Agent Notes

## Source of Truth — 66 Phase Prompts

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

| Action                | Command                                       | Time     |
| --------------------- | --------------------------------------------- | -------- |
| **Frontend dev**      | **`pnpm dev:web`**                            | **2-5s** |
| Frontend dev (direct) | `make dev-web`                                | **2-5s** |
| API dev               | `pnpm dev:be`                                 | instant  |
| Install deps          | `pnpm install`                                | **2.2s** |
| Backend tests         | `cd apps/api && python -m pytest tests/ -q`   | ~5min    |
| ALL tests w/ cov      | `cd apps/api && python -m pytest tests/ --co` | ~10min   |

## CRITICAL: Never use `pnpm dev`

`pnpm dev` runs `nx run-many --target=dev --parallel` which spawns Nx across
**all 25 packages**. Most packages have no `dev` script, so it hangs forever.
**Always** use:

- **`pnpm dev:web`** — runs only the web app via Nx (2-5s startup)
- **`make dev-web`** — runs `cd apps/web && pnpm next dev` directly (fastest)
- **`pnpm dev:be`** — runs the API only

## Frontend — Startup Issues

1. **Port 3000 collisions** — leftover processes block port. Fix:
   `Get-Process -Name "node" | Stop-Process -Force` then retry
2. **`.npmrc`** — `auto-install-peers=true, strict-peer-dependencies=false` for
   fast installs
3. **`next.config.js`** — `output: 'standalone'` is gated behind
   `process.env.CI` (local builds are fast)

## API — Test State

- **2333 tests pass, 2 xfailed, 0 failures** (re-measured 2026-08-13 via fresh
  full-suite run; security suite 172/172; coverage **94% total** — see
  `docs/phases/mvp-p00/03-maturity-and-evidence-matrix.md`)
- Python 3.12 (per `.python-version`)
- Tests use SQLite with mock backend; `mock_llm` + `mock_connector_test` autouse
  fixtures in conftest.py

## Enterprise Hardening — Status

| Phase                     | Status | Honest Status | Details                                                                                                                                              |
| ------------------------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 JWT validation        | DONE   | IMPLEMENTED   | `validate_settings()` fails fast on default secret                                                                                                   |
| 0.2 Plugin sandbox        | DONE   | IMPLEMENTED   | `exec()` → subprocess isolation                                                                                                                      |
| 0.3 Infisical secrets     | DONE   | IMPLEMENTED   | SecretManager protocol, infisical/fallback                                                                                                           |
| 0.5 Rate limiting         | DONE   | IMPLEMENTED   | Sliding window, per-endpoint decorator, Retry-After                                                                                                  |
| 0.6 CORS hardening        | DONE   | IMPLEMENTED   | Restricted origins/methods/headers, security headers; CORS now outermost middleware                                                                  |
| 0.7 Docs consolidation    | DONE   | IMPLEMENTED   | Documents/ deleted, references fixed                                                                                                                 |
| 0.8 Logging               | DONE   | IMPLEMENTED   | JSON/pretty formatters, correlation IDs, structured fields                                                                                           |
| 1.x CI/CD                 | DONE   | IMPLEMENTED   | GitHub Actions (api, frontend, docker, deploy) — no release workflow                                                                                 |
| 2.x Frontend API          | DONE   | PARTIAL       | Typed client + 16 pages with real API; 7 pages use hardcoded mock data                                                                               |
| 3.x Next.js pages         | DONE   | IMPLEMENTED   | loading.tsx, error.tsx, not-found.tsx (global + per-route)                                                                                           |
| 4.x Enterprise auth       | DONE   | PARTIAL       | SSO (Google/Microsoft) implemented; SAML is STUB (methods return None); RBAC is dependency injection helper, not middleware                          |
| 5.x Observability         | DONE   | IMPLEMENTED   | OTel setup + correlation IDs work; Prometheus `/metrics` endpoint ACTIVE (main.py:152); FastAPI OTel auto-instrumentation ACTIVE (main.py:153)       |
| 6.x Multi-tenancy         | DONE   | PARTIAL       | TenantMiddleware MOUNTED (main.py:122); set_rls_session_vars wired into get_db(); RLS on 4/36 tables only; GUC app.tenant_id now SET                 |
| 7.x Agent hardening       | DONE   | IMPLEMENTED   | Circuit breaker, fallback policies, per-agent rate limits; approval gate now wired in orchestrator loop                                              |
| 8.x Performance           | DONE   | IMPLEMENTED   | SWR caching, route prefetching, image optimization, bundle analysis                                                                                  |
| 9.x Security & Compliance | DONE   | PARTIAL       | GDPR, API key rotation, data retention implemented; IP Allowlist middleware EXISTS but NOT MOUNTED in main.py; input sanitization designed (ADR-031) |
| 10.x Testing/QA           | DONE   | PARTIAL       | 2335 pytest, 172 security, 37 jest, 39 e2e real; testing/smoke/, security/, chaos/, fuzz/, visual-regression/ are EMPTY                              |
| 11.x Documentation        | DONE   | IMPLEMENTED   | 32 ADRs (ADR-001 through ADR-032), OpenAPI spec, onboarding guide, deployment/DR runbooks, API reference                                             |
| 12.x Enterprise Polish    | DONE   | IMPLEMENTED   | Light/dark mode, keyboard shortcuts, API versioning, webhooks, batch operations                                                                      |

## Critical Config for Agent Sessions

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
# Terminal 1: API (set vars BEFORE python)
$env:JWT_SECRET="super-secret-key-12345-dev-only"; $env:ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="; $env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"; $env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

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

- `apps/` — web (Next.js 15), api (FastAPI/Python)
- `packages/` — ui-kit, shared-types, eslint-config, tsconfig, observability,
  etc.
- `integrations/` — calendar, email, github, google-drive, notion, slack
- `connectors/` — graphql, mcp, rest
- `sdk/` — typescript
- `plugins/` — tag-generator, word-count, sentiment, summarizer, translator
