# Vaeloom — Agent Notes

## Source of Truth — 66 Phase Prompts

- **The 66 independent end-to-end phase prompts** (3 tracks x 22 phases: MVP,
  MVP-to-Enterprise continuation, Enterprise) are the **governing contract** for
  phase execution.
- Location: `specs/phase-contracts/` (canonical) or `docs/prompts/` (redirect) —
  start with `00-master-index.md`, then `EXECUTION-STATUS.md` for what is
  done/in progress/next.
- Each prompt is standalone: predecessor forensic audit → GO / CONDITIONAL GO /
  NO-GO → requirements → tests/security → weighted gate → handoff.
- Execution evidence lives in `evidence/phases/<track>-pXX/` (legacy redirect at
  `docs/phases/`) (gate reports, registers, handoffs).

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

`pnpm dev` is disabled at the root (fail-fast redirect to `dev:web`/`dev:be`; it
formerly ran `nx run-many --target=dev --parallel` across all 25 packages and
hung because most packages have no `dev` script). **Always** use:

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

- **WARNING: the full backend suite crashes under xdist** — `INTERNALERROR`,
  plus a Windows fatal exception `0xc000070a` from the asyncio loop on
  `tests/security/`. This is finding 39 below and predates the current work.
  **Do not trust a `-n 4` full-suite pass/fail count** — the crash truncates the
  run and the reported totals are wrong. Run serially (`-o addopts=""`) or in
  per-area chunks. Verified green serially on 2026-10-06: agent / orchestrator /
  memory / vault / react **152**; tools + agents + memory service **239**;
  `tests/security/test_noauth_private.py` **105**;
  `tests/test_tools_executor.py` **90**; vault-sync API **18**.

- **4620 tests collected (collection-only re-verified 2026-10-03 via
  `pytest --collect-only -q -o addopts=""`, 24.7s; was 3640, 2731 before that;
  full suite serial `-o addopts=""` 100% reliable; new pipeline suites 349/349
  pass standalone)** — security suite **404 collected** (2026-10-03; the 233/233
  / 170-unique figure is the superseded 2026-08-22 F-02 audit number — the
  de-dup note still holds but the count no longer does; not re-run here,
  collect-only); coverage **94% total (unverified since 2026-09-22, not
  re-measured)** — see
  `evidence/phases/mvp-p00/03-maturity-and-evidence-matrix.md`; OpenAPI **289
  paths / 357 ops** (measured 2026-10-06 from live `app.openapi()`). Generated
  artefacts `specs/api/openapi.yaml` + `docs/backend/openapi.yaml` were **279 /
  346** and 5 memories paths behind live until 2026-10-06, when both were
  regenerated via `scripts/gen_openapi.py` and now match live exactly — the
  earlier "generated lags live" note is resolved, so re-verify rather than
  assume drift. Was 284/351 in this file until 2026-10-06, 241/294 until
  2026-10-03, and 254/315 in `specs/api/API-Reference.md` — those two disagreed
  before the audit. History: 162/203 on 2026-09-15, 110 on 2026-08-29, 106 on
  2026-08-23, 99 before)
- **Web tests (2026-10-07, re-measured after document modals & audit
  decompositions, folder rename/move wiring, and chat FDE context
  engineering):** jest **978 tests / 43 suites**; **978 pass, 0 fail**
  (`npx jest`, ~22s — 100% GREEN). The capability catalog is expanded to 33
  first-class career intelligence skills across both backend
  (`skill_catalog_service.py`, 63/63 tests pass) and frontend
  (`capabilities-data.ts`, `Browse (33)` in `page.spec.tsx`). Component
  decompositions: `DocumentDetailView.tsx` (340 lines, down from 1393),
  `DocumentsHub.tsx` (339 lines, down from 452 via `parts/DocumentsModals.tsx`),
  `DocumentAuditPanel.tsx` (180 lines, down from 480 via `audit/`). Folder
  management: rename and reparenting fully wired via `RenameFolderModal` and
  `MoveFolderModal` calling `documentApi.updateFolder`. New negative-control
  tests: `src/components/memory/__tests__/VaultSyncPanel.honesty.test.tsx` (10),
  `src/app/workspace/[workspaceId]/memory/__tests__/memoryPage.honesty.test.tsx`
  (7). `tsc --noEmit` is **clean (0 errors)** at the time of measurement.
  Playwright **95 tests across 11 spec files** in `apps/web/e2e`
  (`npx playwright test --list`; only 3 `toHaveScreenshot` assertions exist, in
  `landing.spec.ts` + `quality.spec.ts` — was "6 spec files / 73 tests / 40
  visual baselines")
- **Live PostgreSQL 16 & Schema-Wide RLS Verification (Migrations 0065 &
  0066):** Executed against authentic PostgreSQL 16 with pgvector on port 55432
  (WSL). **27 / 27 LIVE POSTGRESQL TESTS GREEN (0 SKIPS, 0 MOCKS, 0 FAILS)**:
  `test_migration_chain_pg.py` (10/10), `test_migration_0057_pg.py` (4/4),
  `test_rls_live_pg.py` (6/6), `test_rls_live_extended.py` (7/7). Verifies 100%
  of 91 public tables enforce row security (`relrowsecurity`) and forced row
  security (`relforcerowsecurity`), fail-closed unset GUCs, cross-tenant and
  cross-workspace read denial, mismatched `WITH CHECK` insert denial, own-scope
  reading, and sequential ABA connection pool isolation.
- **Backend Memory & Vault Integration Tests:**
  `tests/integration/test_memory_api.py` (9/9 pass) and
  `tests/test_vault_sync_documents_integration.py` (1/1 pass). Async tool audit
  teardown race resolved via `drain_pending_audit_tasks` in
  `apps/api/src/api/tools/executor.py` and `apps/api/tests/conftest.py`.
- **ReAct loop REVIVED (was dead).** `_try_react_loop` lines ~1648-1649 read a
  bare `request` object that does not exist in that scope, so every round raised
  `NameError`, which the outer handler swallowed into a `None` return. Because
  `agent_react_enabled` defaults to **True**, production silently ran static
  dispatch while the ReAct path appeared enabled. Fixed to use `_rec.model_name`
  / `settings.llm_model`. Consequences to know about:
  - ReAct now intercepts `act_phase` before static dispatch, so tests that are
    _about the static ladder_ must pin `settings.agent_react_enabled = False`
    (see `TestActPhase::test_dispatch_paths` and `test_qa_loop_gate.py`).
  - Safety was verified, not assumed: `tests/test_react_revival_safety.py`
    proves the QA grounding gate still validates ReAct results (a rejected act
    result never reaches the user) and that both the scope gate and the
    AgentCard contract gate still deny unauthorised tools.
  - `run_agent_loop` and the streaming loop each hold their own QA gate
    (`loop.py:~3336` and `~3678`); both operate on `act_phase`'s result, so
    ReAct output is gated too.
- **Agent memory wiring (`tests/test_agent_memory_wiring.py`):** **16 tests**,
  all passing. Covers audit findings #14-#17: the agent's search tool delegates
  to `memory_service` (hybrid + RRF, real scores), `create_memory` delegates for
  embedding + lineage, `_assemble_rag_context` actually queries the `Memory`
  table, and recalled memory reaches the compiled prompt. Load-bearing verified
  — disabling the retrieval block fails 4 of them. Workspace-scoping is asserted
  (a memory from another workspace must never be recalled). Recalled memory is
  **prepended** to `context_prompt` so token-budget truncation cannot drop it.
- **Memory taxonomy:** `packages/shared-types` `MemoryType` was a _source
  format_ list (`document|email|code|note|conversation|webpage|structured`), not
  the taxonomy the API accepts. Only `document` and `note` overlapped, so 5 of 7
  memory type filters matched nothing. Now mirrors the backend literal (24
  values, `apps/api/src/api/schemas/memory.py`). If you change one, change both.
- **Intent routing anchors:** `router.py` scored categories by raw keyword
  count, so generic words out-voted domain nouns ("critique my resume" scored
  reflection=2 vs career_resume=1 and routed to self_improvement).
  `_CATEGORY_ANCHORS` now weights unambiguous terms (`_ANCHOR_WEIGHT = 3`).
- **Vault sync (`packages/vaeloom-sync`):** node:test, **25 tests / 3 suites**,
  all passing (`npm test`, ~9s). `tests/integration.test.ts` drives **real git**
  against a real bare remote across two simulated machines;
  `tests/reporter.test.ts` covers client→API status reporting. 7 client bugs
  were fixed with tests proven to fail against the old code (path-traversal file
  delete, false `PULL SUCCESS` on failed rebase, `-1-1` conflict naming that
  resolved onto another conflict file, `.vaeloom` config/ledger being synced,
  trailing-newline loss, corrupt ledger overwrite, push on top of a stuck
  rebase).
- **Vault sync API (`apps/api/tests/test_vault_sync.py`):** **18 tests**, serial
  ~1-3min (`-o addopts=""`); slow because signup does password hashing. Asserts
  the API never fabricates: no invented daemon activity, no fake
  `last_pull_time` on `POST /sync`, `daemon_status` derived from a real client
  heartbeat, and `/download-client` requiring auth.
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
  Determinism fix: `tests/security/test_noauth_private.py:90` now
  `sorted(PUBLIC_PATHS)` to avoid xdist collection mismatch (`frozenset` →
  `list` was non-deterministic)
- `.venv` is 3.12.13 (managed by `uv`); old `3.14` venv removed 2026-08-21

## Enterprise Production Verification & Honesty Mandate

- **Absolute Truth in Testing**: Never hide test failures, mask errors, or claim
  "100% verified" through loose assertions. Broad status checks like
  `assert res.status_code in (200, 201, 401, 403)` are strictly banned. Every
  test must assert the exact expected status code and substantiate security
  invariants.
- **Negative Control Principle**: Security tests must prove that violating
  authorization boundaries, injecting script payloads, or attempting
  cross-tenant leakage actively triggers hard denials (400, 401, 403, 413).
- **Real Service Integration**: Mocks are prohibited in live provider
  integration suites. Live S3 (MinIO), live System 1 decision models (TypeSafe
  AI Jev), and live System 2 generative models (Ollama Cloud Gemma) are executed
  against authentic network endpoints.

## Module 05 Testing & Live Cognitive Architecture (updated 2026-09-22)

- **Cognitive Pipeline (30% System 1 + 70% System 2):**
  - **System 1 (TypeSafe AI Jev System One):** Direct native API at
    `https://api.typesafe.ai/v1/systemone` using `JEV_API_KEY` (`apikey_...`).
    Provides sub-50ms deterministic action routing (`choice`), destructive
    action triage (`noul`) requiring human-in-the-loop (HITL) approval, and
    semantic similarity scoring (`score`). Tested in `test_jev_actions.py`.
  - **System 2 (Ollama Cloud Gemma 4 31B):** Real generative LLM synthesis at
    `https://ollama.com/v1` using `OLLAMA_API_KEY` and model `gemma4:31b` (with
    local Ollama fallback `http://localhost:11434` on `gemma4:12b`). Grounded
    document synthesis with XML context fencing (`<document_context>`) and
    provenance citations. Tested in `test_agent_llm_live.py`.
- **Test Suites (31 tests — 100% GREEN, ZERO MOCKS in live suites):**
  - `tests/integration/module05/` (22 tests): Real DB + authentic JWT tokens +
    MinIO live S3 + TypeSafe AI Jev System 1 + Ollama Cloud Gemma 4 31B.
  - `tests/adversarial/module05/` (9 tests): Red-team injection payloads &
    privilege escalation.
  - `tests/test_module05_*.py` (9 tests): Core regression smoke tests.
- **Live Infrastructure Execution:**
  - **Live S3 (MinIO):** Running via Docker container `vaeloom-test-minio` on
    port 9000 with bucket `vaeloom-test-bucket`.
  - **Live TypeSafe AI:** Native endpoint
    `https://api.typesafe.ai/v1/systemone`.
  - **Live Ollama Cloud:** Native endpoint `https://ollama.com/v1` with model
    `gemma4:31b`.
  - **Runner Command:**
    `uv run --project apps/api python -m pytest apps/api/tests/integration/module05 apps/api/tests/adversarial/module05 -v -o addopts=""`

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
- **Semantic ATS tools** (3 semantic + 1 classic ATS of 61 total registered
  tools in `tools/definitions.py`): `calculate_semantic_ats_score`,
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

| Phase                     | Status | Honest Status           | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 JWT validation        | DONE   | IMPLEMENTED             | `validate_settings()` fails fast on default secret                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.2 Plugin sandbox        | DONE   | IMPLEMENTED             | `exec()` → subprocess isolation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.3 Infisical secrets     | DONE   | IMPLEMENTED             | SecretManager protocol, infisical/fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 0.5 Rate limiting         | DONE   | IMPLEMENTED             | Sliding window, per-endpoint decorator, Retry-After                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.6 CORS hardening        | DONE   | IMPLEMENTED             | Restricted origins/methods/headers, security headers; CORS now outermost middleware                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 0.7 Docs consolidation    | DONE   | IMPLEMENTED             | Documents/ deleted, references fixed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 0.8 Logging               | DONE   | IMPLEMENTED             | JSON/pretty formatters, correlation IDs, structured fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 1.x CI/CD                 | DONE   | IMPLEMENTED             | GitHub Actions (api, frontend, docker, deploy) — no release workflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2.x Frontend API          | DONE   | PARTIAL → **MVP WIRED** | Typed client + 18+ pages with real API (verified 2026-08-22: all `workspace/[workspaceId]/*/page.tsx` have `api`/`fetch`/`swr`; only `connectors/page.spec.tsx` has mock for test); 7 previously mocked enterprise pages (admin, marketplace, feature-flags, developer, organizations, plus 2 legacy) now wired or gated behind `enterprise_routes_enabled=false` — MVP pages 100% wired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 3.x Next.js pages         | DONE   | IMPLEMENTED             | loading.tsx, error.tsx, not-found.tsx (global + per-route)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4.x Enterprise auth       | DONE   | PARTIAL                 | SSO (Google/Microsoft) implemented; SAML is ENT-track `services/saml.py` real `signxml` but not wired to router (MVP dead per `saml.py:1`), RBAC is dependency injection helper, not middleware — see F-21                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 5.x Observability         | DONE   | IMPLEMENTED             | OTel setup + correlation IDs work; Prometheus `/metrics` endpoint ACTIVE (main.py); FastAPI OTel auto-instrumentation ACTIVE (main.py) — **pfi 7.1.0 + FastAPI 0.141.1 requires shim until upgrade (see `.agents/findings/37`)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6.x Multi-tenancy         | DONE   | **44 tables FORCE**     | TenantMiddleware now also sets `app.workspace_id` (from path/header) + `app.user_id` + `app.tenant_id` via `TenantContext` + `set_rls_session_vars` (`database.py:30`); RLS FORCE+policies on **44 tables** (34 via 0010 +3 via 0019 +5 via 0020 2026-08-22 per user choice, **+`conversations` +`chat_messages` added 2026-10-01 by 0063** — previously stated as "42/42"); GUCs all SET fail-closed; **Live PostgreSQL RLS PROVEN** via `tests/test_rls_live_pg.py` (5/5 mechanism tests pass on real Supabase PostgreSQL). **Denominator caveat (2026-10-03):** the real enforced invariant is _all_ public tables, not a fixed 44 — `0060_verify_rls_coverage` and the `_assert_coverage` re-run at the end of `0063` both raise if **any** table in `public` lacks RLS or a policy, so the true figure is the schema's table count. That count was **not** re-measured here: the migration chain needs real PostgreSQL and neither Docker nor a local PG was available (2026-10-03). Static count of distinct `op.create_table` names across `alembic/versions/` is **87**, which is why the historical "42/42" framing should be read as "44 audited via 0010/0019/0020 + 0063", not "44 of everything". **Caveat 2026-09-22:** ~25 tables additionally carry `USING (true)` service policies covering the `vaeloom_app` role (0047) — for the app role those tables rely on app-layer scoping only; see `docs/security/RLS-SERVICE-POLICY-EXPOSURE.md` (remediation specified, needs staging PG to verify). |
| 7.x Agent hardening       | DONE   | IMPLEMENTED             | Circuit breaker, fallback policies, per-agent rate limits; approval gate now wired in orchestrator loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8.x Performance           | DONE   | IMPLEMENTED             | SWR caching, route prefetching, image optimization, bundle analysis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 9.x Security & Compliance | DONE   | PARTIAL                 | GDPR, API key rotation, data retention implemented; IP Allowlist middleware ALWAYS MOUNTED (main.py:188 no-op when empty); input sanitization designed (ADR-031); **First Live DR Drill EXECUTED & LOGGED** 2026-09-17 (`evidence/dr-drills/DR-Drill-Log.md`, 48.99s RTO / 0.0s RPO, 67 tables verified).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 10.x Testing/QA           | DONE   | IMPLEMENTED             | 4620 pytest (security 404 collected; full suite serial passes), 700 jest across 32 suites, 11 active Playwright E2E spec files in apps/web/e2e (95 tests total, 3 visual baselines; 3 legacy flow specs in testing/e2e) — all counts re-measured 2026-10-03, see "API — Test State" for provenance; live PG RLS suite `test_rls_live_pg.py` 5/5 passes; coverage 94% (unverified since 2026-09-22) + WCAG + perf tracked (EXC-P14-01..03, P15 owns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11.x Documentation        | DONE   | IMPLEMENTED             | 45 ADRs (ADR-001 through ADR-045 — `ADR-045-transactional-outbox.md` was already present; ADR count was stale at 44), OpenAPI **289 paths / 357 ops** live, with generated `docs/backend/openapi.yaml` and `specs/api/openapi.yaml` **both in sync at 289 / 357** (measured 2026-10-06; the 279/346 "5 memories paths behind" figure in this table was resolved by regenerating via `scripts/gen_openapi.py` on that date — was 284/351 live, "241/294 regen 2026-09-21"), onboarding guide, deployment/DR runbooks, API reference                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 12.x Enterprise Polish    | DONE   | IMPLEMENTED             | Light/dark mode, keyboard shortcuts, API versioning, webhooks, batch operations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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
# Generate fresh dev secrets (never reuse across machines; test vector MDEy... is test-only):
# $env:JWT_SECRET="$(openssl rand -hex 32)"; $env:ENCRYPTION_KEY="$(openssl rand -base64 32)"
$env:JWT_SECRET="test-jwt-secret-for-ci-only-32-chars-long!!"; $env:ENCRYPTION_KEY="$(openssl rand -base64 32)"; $env:DATABASE__URL="sqlite+aiosqlite:///./dev.db"; $env:LLM_API_KEY="mock-key"; $env:OTEL_SDK_DISABLED="true"
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
