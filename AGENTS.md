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

| Action                 | Command                                                                                             | Time                                                                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend dev**       | **`pnpm dev:web`**                                                                                  | **2-5s**                                                                                                                                                                         |
| Frontend dev (direct)  | `make dev-web`                                                                                      | **2-5s**                                                                                                                                                                         |
| API dev                | `pnpm dev:be`                                                                                       | instant                                                                                                                                                                          |
| Install deps           | `pnpm install`                                                                                      | **2.2s**                                                                                                                                                                         |
| Backend tests          | `cd apps/api && uv run --project apps/api python -m pytest -q`                                      | **Full suite currently hangs/crashes under xdist — see finding 39.** Per-file runs or serial (`-o addopts=""`) ~8-10min are reliable. 4 workers mem-friendly; 16 workers ≈ 4-5GB |
| Backend tests (fast)   | `cd apps/api && uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"` | ~2-3min (16 workers, needs 32GB; `--dist loadfile` groups by file)                                                                                                               |
| Backend tests (serial) | `cd apps/api && uv run --project apps/api python -m pytest -q -o addopts=""`                        | ~8-10min                                                                                                                                                                         |
| ALL tests w/ cov       | `cd apps/api && uv run --project apps/api python -m pytest --cov=api --cov-report=term -q`          | ~4-6min                                                                                                                                                                          |

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

- **2731 tests collected (was 2672 on 2026-08-23; +59 from parallel track; full
  suite currently has known xdist hang — see `.agents/findings/39`; new pipeline
  suites 349/349 pass standalone)** — security suite 233/233 (170 unique
  de-duplicated; middleware/test_csrf duplicates security/test_csrf per
  zero-trust audit 2026-08-22 F-02; F-20/F-22 fixes 2026-08-22 do not change
  count); coverage **94% total** — see
  `docs/phases/mvp-p00/03-maturity-and-evidence-matrix.md`; OpenAPI **110
  paths** (`docs/backend/openapi.yaml` — was 106 on 2026-08-23, was 99; +4
  since)
- Python 3.12.13 (per `apps/api/.python-version` pinned via
  `uv python pin 3.12`; `.venv` managed by `uv`)
- Tests use SQLite with mock backend (`tmp_path` per-test DB via `NullPool`);
  `mock_llm` + `mock_connector_test` autouse fixtures in
  `apps/api/tests/conftest.py:215,251`. When patching LLM methods in tests,
  patch BOTH the class and the `llm_service` singleton — instance attrs are
  UNBOUND (no self) and other tests may leak instance attributes that shadow
  class patches (see `tests/test_semantic_ats_tools.py`)
- **Runner: `uv` + `pytest-xdist`** (`pyproject.toml:46` `addopts = "-n 4"` → 4
  workers, ~1.2GB; 16 workers ≈ 4-5GB). Fast:
  `uv run --project apps/api python -m pytest -q -o addopts="-n auto --dist loadfile"`
  (~2-3min, needs 32GB). Serial:
  `uv run --project apps/api python -m pytest -q -o addopts=""` (~8-10min).
  Determinism fix: `test_noauth_private.py:90` now `sorted(PUBLIC_PATHS)` to
  avoid xdist collection mismatch (`frozenset` → `list` was non-deterministic)
- `.venv` is 3.12.13 (managed by `uv`); old `3.14` venv removed 2026-08-21

## Resume Document Pipeline (added 2026-08-23)

- **Templates**: 5 industry templates in `services/resume_templates.py` (+
  Jinja2 HTML under `src/api/templates/resumes/*.html.j2`). Registry is
  data-only; `suggest_template()` maps role→template for agents.
- **Compilation**: `services/document_builder.py` renders PDF via Playwright
  Chromium (`page.pdf()`), DOCX via python-docx, HTML passthrough. Page-fit loop
  auto-shrinks type until ≤ max_pages. Chromium missing → HTTP 503 with setup
  hint; enable locally once via:
  `uv run --project apps/api playwright install chromium`
- **Artifacts**: `resume_artifacts` table (migration 0023, bytes inline,
  workspace RLS). Routes: `GET /resumes/templates`,
  `POST /resumes/{id}/tailor|compile|cover-letter|cheatsheet`,
  `GET /resumes/{id}/artifacts`, `GET /resumes/artifacts/{aid}/download`.
  Compile endpoints rate-limited (chromium renders are expensive).
- **Semantic ATS tools** (28 total tools now): `calculate_semantic_ats_score`,
  `extract_missing_hard_skills`, `audit_ats_formatting` — embeddings cosine +
  keyword gazetteer fallback; all mock-safe offline.
- **Browser tools** (2026-08-23, ADR-035): `browse_job_page`,
  `scrape_company_insights`, `verify_application_link` — chromium-first w/ httpx
  fallback, SSRF-guarded (`utils/url_guard.py`: https-only + global-IP
  enforcement), per-workspace quota (`SCRAPE_QUOTA_PER_HOUR`, default 20/h)
  - kill switch (`BROWSER_TOOLS_ENABLED`). Read-only → no approval gate; wired
    into JobSearchAgent + ApplicationAgent. DNS failure ≠ policy block: dead
    domains map to `expired_or_error` verdicts.
- Frontend: template picker / live preview / PDF+DOCX download / AI-tailor modal
  in `ResumeBuilder.tsx`; responses are camelCase (transformKeys) — request
  bodies stay snake_case.
- **MCP integration** (2026-08-23, ADR-036): official `mcp` SDK (v2) in
  apps/api. Servers = `mcp`-type connectors (`connector_ext_service`, env values
  encrypted per-key; shell interpreters denied; update path now revalidates ALL
  connector configs). `services/mcp_client_service.py`: one-shot sessions
  (stdio + streamable-http), 300s discovery TTL cache. Tools bridge as
  `mcp__<Server>__<Tool>` into executor's DYNAMIC_* registry (scope
  `connector.mcp.execute`, 30s timeout); non-readOnly → approval-gated via
  unified `approval_gated_tools()` in loop.py. Routes:
  `/connectors/{id}/mcp/tools|tools/refresh|sync|call`; startup warm-up re-syncs
  bridges non-fatally. Seed configs: `docs/mcp/servers/seed-configs.md`.
- See `docs/adr/ADR-034-resume-document-pipeline.md`.

## Enterprise Hardening — Status

| Phase                     | Status | Honest Status           | Details                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------- | ------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 JWT validation        | DONE   | IMPLEMENTED             | `validate_settings()` fails fast on default secret                                                                                                                                                                                                                                                                                                                                       |
| 0.2 Plugin sandbox        | DONE   | IMPLEMENTED             | `exec()` → subprocess isolation                                                                                                                                                                                                                                                                                                                                                          |
| 0.3 Infisical secrets     | DONE   | IMPLEMENTED             | SecretManager protocol, infisical/fallback                                                                                                                                                                                                                                                                                                                                               |
| 0.5 Rate limiting         | DONE   | IMPLEMENTED             | Sliding window, per-endpoint decorator, Retry-After                                                                                                                                                                                                                                                                                                                                      |
| 0.6 CORS hardening        | DONE   | IMPLEMENTED             | Restricted origins/methods/headers, security headers; CORS now outermost middleware                                                                                                                                                                                                                                                                                                      |
| 0.7 Docs consolidation    | DONE   | IMPLEMENTED             | Documents/ deleted, references fixed                                                                                                                                                                                                                                                                                                                                                     |
| 0.8 Logging               | DONE   | IMPLEMENTED             | JSON/pretty formatters, correlation IDs, structured fields                                                                                                                                                                                                                                                                                                                               |
| 1.x CI/CD                 | DONE   | IMPLEMENTED             | GitHub Actions (api, frontend, docker, deploy) — no release workflow                                                                                                                                                                                                                                                                                                                     |
| 2.x Frontend API          | DONE   | PARTIAL → **MVP WIRED** | Typed client + 18+ pages with real API (verified 2026-08-22: all `workspace/[workspaceId]/*/page.tsx` have `api`/`fetch`/`swr`; only `connectors/page.spec.tsx` has mock for test); 7 previously mocked enterprise pages (admin, marketplace, feature-flags, developer, organizations, plus 2 legacy) now wired or gated behind `enterprise_routes_enabled=false` — MVP pages 100% wired |
| 3.x Next.js pages         | DONE   | IMPLEMENTED             | loading.tsx, error.tsx, not-found.tsx (global + per-route)                                                                                                                                                                                                                                                                                                                               |
| 4.x Enterprise auth       | DONE   | PARTIAL                 | SSO (Google/Microsoft) implemented; SAML is ENT-track `services/saml.py` real `signxml` but not wired to router (MVP dead per `saml.py:1`), RBAC is dependency injection helper, not middleware — see F-21                                                                                                                                                                               |
| 5.x Observability         | DONE   | IMPLEMENTED             | OTel setup + correlation IDs work; Prometheus `/metrics` endpoint ACTIVE (main.py); FastAPI OTel auto-instrumentation ACTIVE (main.py) — **pfi 7.1.0 + FastAPI 0.141.1 requires shim until upgrade (see `.agents/findings/37`)**                                                                                                                                                         |
| 6.x Multi-tenancy         | DONE   | **42/42 RLS**           | TenantMiddleware now also sets `app.workspace_id` (from path/header) + `app.user_id` + `app.tenant_id` via `TenantContext` + `set_rls_session_vars` (`database.py:30`); RLS **42/42** (34 via 0010 +3 via 0019 +5 via 0020 2026-08-22 per user choice); GUCs all SET fail-closed                                                                                                         |
| 7.x Agent hardening       | DONE   | IMPLEMENTED             | Circuit breaker, fallback policies, per-agent rate limits; approval gate now wired in orchestrator loop                                                                                                                                                                                                                                                                                  |
| 8.x Performance           | DONE   | IMPLEMENTED             | SWR caching, route prefetching, image optimization, bundle analysis                                                                                                                                                                                                                                                                                                                      |
| 9.x Security & Compliance | DONE   | PARTIAL                 | GDPR, API key rotation, data retention implemented; IP Allowlist middleware ALWAYS MOUNTED (main.py:188 no-op when empty) — was stale NOT MOUNTED claim fixed 2026-08-22 F-18; input sanitization designed (ADR-031)                                                                                                                                                                     |
| 10.x Testing/QA           | DONE   | PARTIAL                 | 2731 pytest (was 2557; security 233/233 170 unique; full suite currently hangs — see finding 39), 34 jest, 60 e2e (24 gating + 36 visual) real; testing/smoke/, security/, chaos/, fuzz/ are EMPTY — coverage 94% + WCAG + perf not re-measured (EXC-P14-01..03, P15 owns)                                                                                                               |
| 11.x Documentation        | DONE   | IMPLEMENTED             | 36 ADRs (ADR-001 through ADR-036), OpenAPI **110 paths** (`docs/backend/openapi.yaml`), onboarding guide, deployment/DR runbooks, API reference                                                                                                                                                                                                                                          |
| 12.x Enterprise Polish    | DONE   | IMPLEMENTED             | Light/dark mode, keyboard shortcuts, API versioning, webhooks, batch operations                                                                                                                                                                                                                                                                                                          |

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
# Terminal 1: API (set vars BEFORE python; use uv so correct venv + Python 3.12 is used)
# Use a strong JWT secret for local dev: openssl rand -hex 32 (32+ chars required; F-07 fix)
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"; $env:ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE="; $env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"; $env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
uv run --project apps/api python -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
pnpm dev:web
```

### Test Account

- `demo@vaeloom.app` / `demo1234` — demo DB seed (not present on fresh DBs; sign
  up if missing)
- `audit@vaeloom.test` / `AuditPass123!` — auto-seeded for e2e via
  `apps/web/e2e/api-launcher.py`
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
