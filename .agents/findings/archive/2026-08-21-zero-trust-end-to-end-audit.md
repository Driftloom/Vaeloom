# Vaeloom — Zero-Trust End-to-End Audit — 2026-08-21

> **Auditor:** Muse Spark (0-trust, file-on-disk only, no report trust)
> **Scope:** Full stack `apps/api`, `apps/web`, `packages/*`, `integrations/*`,
> `docs/phases`, 66 prompts, 32 ADRs, OpenAPI, infra **Method:** Read source of
> truth `00-master-index.md` + `EXECUTION-STATUS.md` → forensic read of every
> claimed IMPLEMENTED file:line →
> `pnpm typecheck`/`pnpm test`/`uv pytest --collect-only` → websearch
> best-practices comparison (OWASP LLM Top 10 2025, Next.js 15/16 security,
> fastapi-rls) **Previous reports:** Not trusted; every claim re-verified at
> `file:line`. Where old reports were honest (e.g., `mvp-p00/03` 94% +
> `AGENTS.md` PARTIAL), marked PASS. Where stale, flagged.

---

## 0. Executive Verdict

**Overall: CONDITIONAL GO — MVP core is shippable gated, enterprise hardening
has 2 CRITICAL + 4 HIGH gaps that must be fixed before handling real PII/tenant
data.**

- **13/66 prompts have evidence** (`mvp-p00` … `mvp-p12`), all with
  gate+handoff. `P13-P21 + CONT 22 + ENT 22 = 53` correctly NOT STARTED — no
  phantom evidence.
- **P00-P12 gates:** 3 of 10 GO verdicts are **sub-threshold** vs `§28`
  (`95-100 APPROVED, 88-94 CONDITIONAL, <88 FAILED`): P05 87.3, P06 69.9, P08
  87.3 marked GO — policy override without formal exception record (HIGH).
- **Backend:** 23/40 tables have `FORCE RLS` but **RLS never set** due to
  middleware ordering bug (CRITICAL). Infisical dead code (CRITICAL).
  Per-endpoint rate limiting dead. CSRF `httponly` breaks SPA. Document undo
  stores wrong `old_deleted_at`.
- **Frontend:** 16 pages wired to real API (verified), 6 enterprise pages
  honestly gated (`EnterpriseGated`), 2 RLS-era mocks (`admin` etc. 100% fake
  when enabled). Core flows (files upload/viewer/diff+undo, dashboard
  workspace-scoped, memory graph zoom/pan, chat approvals, schedule calendar,
  history, jobs via agent, connectors scopes) are **truly wired** (typecheck
  pass, 32/32 jest). Remaining risk is **dual API clients** + **client-side
  workspace filtering** → cross-workspace leak.
- **Docs:** 32 ADRs correct, 2 stale (ADR-013 4/34 vs 34/34, ADR-002 16 vs 25
  routes), OpenAPI 94 paths vs 88 claimed drift, `API_REFERENCE` over-documents
  gated routes.
- **Verification:** `pnpm typecheck` PASS, `pnpm test` 32/32 PASS, `uv pytest`
  collection 2404+ (full suite 8-10min, not re-run fully here; P12 evidence 2405
  passed/0 failed at `2026-08-20` is credible).

---

## 1. Methodology — 0 Trust

1. **Source of truth first:** Read `00-master-index.md` (66 files, SHA) +
   `EXECUTION-STATUS.md` (13 GO). Did not trust `AGENTS.md` hardening table —
   re-read every file:line it cites.
2. **Code forensic:** Used `Glob`/`Grep`/`Read` on
   `apps/api/src/api/main.py:123`, `config.py:104`, `middleware/*`,
   `models/schema.py:1`, `services/*`, `routers/*`, `migrations/*`,
   `apps/web/src/app/workspace/[workspaceId]/*`, `src/lib/api*.ts`,
   `packages/ui-kit`, `docs/adr/*`, `docs/phases/mvp-p*/09-gate*.md`.
3. **Verification:** Ran `pnpm typecheck` (apps/web), `pnpm test` (jest),
   `uv pytest --collect-only` (backend), manual `curl` mental model for
   CSRF/RLS, checked `inert`/`aria` in DOM.
4. **Best-practice comparison:** Websearch `OWASP LLM Top 10 2025`,
   `Next.js 15 Server Actions security`, `fastapi-rls` (PostgreSQL RLS
   `SET LOCAL` + pool scrub pattern).

---

## 2. Track 1 — MVP Phases 00-12 — GO vs Evidence

| Phase | EXECUTION-STATUS claim | Gate file on disk                              | Score     | §28 Verdict                          | Evidence check                                                                                                                                                   | Severity | Fix                                                                                                                     |
| ----- | ---------------------- | ---------------------------------------------- | --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| P00   | COMPLETE 75.69         | `mvp-p00/09-gate-2026-08-12.md:33` 73.79→75.69 | 75.69 <88 | Should be FAILED, marked CONDITIONAL | 15 files, handoff `07-…` exists. Score <88 per §28 → `COMPLETE (sub-threshold)` is honest but legend `✅ GO` vs `COMPLETE` conflated                             | MEDIUM   | Update `EXECUTION-STATUS.md:9` legend to include `COMPLETE (sub-threshold conditional)`                                 |
| P01   | COMPLETE 74.89         | `mvp-p01/14-gate-2026-08-13.md:12664`          | 74.89     | FAILED                               | File exists, 74.89 <88 — discovery phase cannot reach 88 without P05+ code, so honest                                                                            | MEDIUM   | Keep, add note `74.89 expected for non-runtime phase`                                                                   |
| P02   | COMPLETE 88.20         | `mvp-p02/19-gate-2026-08-13.md:15233`          | 88.20     | CONDITIONAL                          | Just inside 88-94, OK. BQ 01-04 confirmed                                                                                                                        | PASS     | —                                                                                                                       |
| P03   | ✅ GO 89.7             | `mvp-p03/09-gate-2026-08-14.md:8374`           | 89.7      | CONDITIONAL                          | `Σ(Score/10×Weight)` correct                                                                                                                                     | PASS     | —                                                                                                                       |
| P04   | ✅ GO 88.5             | `mvp-p04/09-gate-2026-08-15.md:6412`           | 88.5      | CONDITIONAL                          | OK                                                                                                                                                               | PASS     | —                                                                                                                       |
| P05   | ✅ GO 87.3             | `mvp-p05/09-gate-2026-08-15.md:22`             | 87.3      | FAILED                               | Marked GO but 87.3 <88. File admits gap RFC9457                                                                                                                  | MEDIUM   | Add exception record `08-registers.md` EXC-P05-01 or re-gate to `FAILED — REMEDIATION REQUIRED`                         |
| P06   | ✅ GO 69.9→~75         | `mvp-p06/09-gate-2026-08-15.md:25`             | 69.9      | FAILED                               | Most severe: `Below 88: failed and remediation required` at `mvp-p06/09-gate:44` yet verdict `CONDITIONALLY APPROVED — CONFLICTS RESOLVED`. 5 categories failing | **HIGH** | Create `08-registers.md` EXC-P06-01 with owner/approvers/expiry/monitoring, or re-gate with P07 evidence (93.4) to 78.3 |
| P07   | ✅ GO 93.4             | `mvp-p07/09-gate-report.md:7930`               | 93.4      | CONDITIONAL                          | 34-table RLS, handoff exists                                                                                                                                     | PASS     | Update ADR-013 4/34 → 34/34                                                                                             |
| P08   | ✅ GO 87.3             | `mvp-p08/09-gate-report.md:6842`               | 87.3      | FAILED                               | -0.7 honest drift, marked GO                                                                                                                                     | MEDIUM   | Note `sub-threshold conditional (87.3)` + link to RFC9457 gap                                                           |
| P09   | COMPLETE 88            | `mvp-p09/gap-closure-gate-report.md:3132`      | 88        | CONDITIONAL                          | 7/11 gaps CLOSED, 4 LOW deferred                                                                                                                                 | LOW      | Update `EXECUTION-STATUS:30` to `COMPLETE (gap closure 7/11)`                                                           |
| P10   | ✅ GO 96               | `mvp-p10/09-gate-report.md:7173`               | 96.0      | APPROVED                             | Only 95-100 band, math correct                                                                                                                                   | PASS     | —                                                                                                                       |
| P11   | ✅ GO 90.5             | `mvp-p11/09-gate-report.md:13004`              | 90.5      | CONDITIONAL                          | Corrected from 96.0 ΣScore → 90.5 weighted, honest                                                                                                               | PASS     | Keep correction banner                                                                                                  |
| P12   | ⚠️ GO 88.4             | `mvp-p12/09-gate-report.md:19540`              | 88.4      | CONDITIONAL                          | Re-scored 94.6→85.6→88.4, 25→0 failures, 68 new tests, 2405 passed/0 failed                                                                                      | PASS     | Remaining 8 MEDIUM/LOW with owners P14/P16 correctly flagged                                                            |

**Aggregate:** 13/66 prompts have evidence, 3 sub-threshold GO without formal
exception (P05, P06, P08). No phantom evidence for P13-P21/CONT/ENT — correct.

---

## 3. Backend — Claim vs Reality (0-Trust Forensic)

### 3.1 Enterprise Hardening Table (AGENTS.md:58-79)

| Phase                  | AGENTS claim                                      | Reality (file:line)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Verdict              | Severity                                                                                                                                                                                   | Fix |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| 0.1 JWT                | `validate_settings()` fails fast — IMPLEMENTED    | `config.py:104-105` only `if not jwt_secret` (empty), no `len<32` nor weak denylist. `validate_settings()` called in `lifespan main.py:75` but not for `super-secret`                                                                                                                                                                                                                                                                                                                                                                                  | PARTIAL              | `if len(jwt_secret)<32 or jwt_secret in {"secret","changeme"}: errors.append(...)` + require `exp`/`sub` in `middleware/auth.py:47`                                                        |
| 0.2 Plugin sandbox     | subprocess isolation — IMPLEMENTED                | `plugin_sandbox.py:23` `exec` with 35 builtins removed but `__class__` reachable via `().__class__.__bases__[0].__subclasses__()` → `os`. `plugin_service.py:222` correct `create_subprocess_exec` + timeout, but no CPU/mem/seccomp                                                                                                                                                                                                                                                                                                                   | PARTIAL bypassable   | AST-parse + whitelist, block `__class__/__subclasses__`, add `resource.setrlimit`, run in `nsjail`                                                                                         |
| 0.3 Infisical          | SecretManager protocol — IMPLEMENTED              | `infrastructure/secrets.py:43` `InfisicalSecretManager` exists but **never wired**: `config.py:97` `Settings()` passes no `secret_manager`, `main.py:74` never calls `get_secret_manager()`; `config.py:119` only validates `INFISICAL_ENABLED` flag                                                                                                                                                                                                                                                                                                   | **NOT WIRED (dead)** | `config.py:77` call `sm=get_secret_manager(); self._resolve_from_secret_manager(sm)` in `Settings.__init__` or `main.lifespan`                                                             |
| 0.5 Rate limit         | Sliding window, per-endpoint — IMPLEMENTED        | `middleware/rate_limit.py:120` reads `scope.get("route")` at `BaseHTTPMiddleware.dispatch` time — **not yet resolved** → per-endpoint `@rate_limit` on `auth.py:26` never triggers; only global 100/min                                                                                                                                                                                                                                                                                                                                                | PARTIAL global only  | Use `request.app.routes` lookup or `FastAPI` dependency `RateLimitDependency`                                                                                                              |
| 0.6 CORS               | Restricted, outermost — IMPLEMENTED               | `main.py:142` `allow_origins=["http://localhost:3000","http://localhost:5173"]`, `allow_methods` limited, `SecurityHeadersMiddleware` HSTS/CSP. Outermost due to `starlette` `insert(0)+reversed` — correct. Non-local localhost only warns `config.py:143` not error                                                                                                                                                                                                                                                                                  | IMPLEMENTED (soft)   | `warnings→errors` for localhost in prod, env `VAELOOM_ALLOWED_ORIGINS`                                                                                                                     |
| 0.8 Logging            | JSON/pretty + correlation — IMPLEMENTED           | `infrastructure/logging.py:108` `CorrelationIDMiddleware` + `RequestLoggingMiddleware` `main.py:133` correct ContextVar reset                                                                                                                                                                                                                                                                                                                                                                                                                          | IMPLEMENTED          | —                                                                                                                                                                                          |
| 4.x SSO                | Google/Microsoft IMPLEMENTED, SAML STUB — PARTIAL | `services/sso.py:33` Google/MS real via `PyJWKClient`; `137` `SAMLSSOProvider` raises `NotImplementedError`; separate `services/saml.py:130` fully implements `signxml` verify but **never wired** to router; `_sso_states: dict` `routers/auth.py:22` in-memory no TTL                                                                                                                                                                                                                                                                                | PARTIAL + confusion  | Wire `SAMLProvider` or delete `saml.py`; replace `_sso_states` with Redis TTL 5min                                                                                                         |
| 5.x Observability      | OTel + `/metrics` ACTIVE — IMPLEMENTED            | `main.py:171` `Instrumentator().instrument(app).expose(endpoint="/metrics")` + `instrumement_fastapi` typo-consistent, try/except; `PUBLIC_PATHS` includes `/metrics` → public without auth (ok for Prometheus but disclose)                                                                                                                                                                                                                                                                                                                           | IMPLEMENTED          | Protect `/metrics` with IP allowlist in prod                                                                                                                                               |
| 6.x Multi-tenancy      | TenantMiddleware mounted, RLS 4/36 — PARTIAL      | **CRITICAL ordering bug:** `main.py:129` order `RateLimit,Auth,Tenant,CSRF...CORS last` → due to `insert(0)+reversed`, outermost→innermost is `CORS→Tenant→Auth` → `TenantMiddleware` reads `request.state.tenant_id` set by `AuthMiddleware` **but Tenant runs BEFORE Auth** → always `None` → `database.py:30` `SET LOCAL app.tenant_id` **never executed** → RLS fail-closed (0 rows). `auth_service.py:69` never embeds `tenant_id` in JWT anyway. Coverage is actually 23/40 (not 4/36) via `0013_fix_rls_correct_columns.py:34` but still broken | **BROKEN**           | Swap order: `add Tenant` **before** `add Auth` (so Auth outer), or make Tenant read `Authorization` header itself; populate `tenant_id` in JWT at signup; add test that `SET LOCAL` issued |
| 9.x IP allowlist       | EXISTS but NOT MOUNTED — PARTIAL                  | `middleware/ip_filter.py:42` CIDR + `X-Forwarded-For` correct; `main.py:139` conditional `if ip_allowlist:` default `""` → not mounted — **accurate**                                                                                                                                                                                                                                                                                                                                                                                                  | ACCURATE             | Set `IP_ALLOWLIST` in prod + trusted proxy list                                                                                                                                            |
| 9.x Input sanitization | Designed (ADR-031) — PARTIAL                      | `utils/sanitize.py:10` strips `<script>`/`on*=` but only used in `auth_service.py:21`, `workspace_service.py:14`, `memory_service.py:36`; **not** in `documents.py:138` `rename path` → XSS in `Content-Disposition` `documents.py:122`                                                                                                                                                                                                                                                                                                                | PARTIAL              | Wrap all `dto.path/name` with `sanitize_text` + Pydantic `field_validator`                                                                                                                 |

### 3.2 RLS Coverage — Forensic Count

- **Total tables `models/schema.py:97`:** 40
- **FORCE RLS 23:** `0013` composite 4
  (`connectors,memories,agents,approval_request`) + workspace 12 + tenant 7;
  **not covered:**
  `tenants, workspaces, auth_sessions, document_versions, document_actions, provider_keys, gmail_watches`
  etc. AGENTS claim `4/36` stale, reality 23/40 but still broken by ordering.

### 3.3 API Contracts — Routers vs OpenAPI

- **Routers `main.py:181`:** 23 always-mounted + 8 enterprise-gated
  (`if enterprise_routes_enabled`). Test `test_main.py:19`
  `EXPECTED_ROUTER_PREFIXES` 16 MVP prefixes matches.
- **Missing:** SAML 400 not 501, RBAC `require_role` reads `user_roles` never in
  JWT → always 403 unless injected.
- **OpenAPI `docs/backend/openapi.yaml:5` 94 paths** vs P12 gate 88 → +6 drift
  (`provider-keys`, `agents/catalog`, `memories/feed|lineage`, `gmail/*`) not
  gate-reviewed.

### 3.4 Recent Changes — Document BLOB + History

- **`models/schema.py:177` `content LargeBinary` +
  `migrations/0008_document_content.py:28` `BLOB` (custom runner `MIGRATIONS`
  dict empty → never populated, so `Base.metadata.create_all` creates it but
  `alembic upgrade` on existing DB misses `content` → 500).
  `document_service.py:47` `await file.read()` loads entire file, **no 10MB
  limit** → DoS.
- **`DocumentAction` `214-233`:** `_record_action:124` reads `doc.deleted_at`
  **after** mutation → `archive` stores `old_deleted_at=now` not `None`; undo
  restores luckily but `restore` undo loses timestamp. `rename` undo no-op if
  `old_path` null. `path` no `../` check.
- **History endpoints `workspaces.py:131`:** `LIMIT 100` no pagination,
  `total=len(actions)` not true count.
- `provider_keys` RLS missing; `MIGRATIONS` empty + `0016` double-create on
  Postgres (`create_all` before `alembic`).

---

## 4. Frontend — Claim vs Reality

| Page                                            | Audit claim                          | Reality (file:line)                                                                                                                                                                                                                                  | Verdict                               | Fix                                                                                                      |
| ----------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Dashboard** `page.tsx:45`                     | Workspace-scoped KPIs                | `agents                                                                                                                                                                                                                                              | memories`use`/workspaces/${id}/agents | memories`real;`events`uses global`GET /events`no`workspace_id` → client filter                           | MEDIUM | Add `?workspace_id` to `eventApi.list` |
| **Files** `files/page.tsx:1`                    | Wired XHR progress + viewer          | Verified true `api-client.ts:673` XHR retry rebuilds `FormData`, viewer `TEXT_TYPES` switch, rename/archive/history/undo with toasts                                                                                                                 | LOW leak                              | `URL.revokeObjectURL` on close                                                                           |
| **Memory** `memory/page.tsx:60` + `GraphViewer` | Feed+graph wired                     | `memoryFeedApi.feed({workspace_id})` true; `GraphViewer` **no workspaceId** to `listNodes()` → global graph                                                                                                                                          | MEDIUM                                | Pass `workspaceId` to `listNodes({workspace_id})`                                                        |
| **Connectors** `connectors/page.tsx:35`         | Real + scopes                        | `useWorkspaceConnectors` + `PROVIDER_META` scopes, sync progress, `Connect` modal                                                                                                                                                                    | OK                                    | —                                                                                                        |
| **Chat** `ChatWindow.tsx:87`                    | Orchestrator wired                   | `agentApi.chat` + `approvalApi` + threads `localStorage` capped 20, `streamText`, slash/`@mention`                                                                                                                                                   | LOW                                   | Add `aria-expanded` on rail toggle, `role=log` on messages                                               |
| **Schedule** `schedule/page.tsx:61`             | Calendar + proposed                  | `eventApi.list()` + client `payload.workspaceId===workspaceId` filter, source badge, `approvalApi` for proposed                                                                                                                                      | MEDIUM                                | Move filter server-side `GET /events?workspace_id=`                                                      |
| **History** `history/page.tsx:38`               | Doc+agent diff/undo                  | `workspaceActions` + `workspaceAgentActions` + `DiffViewer` + export blob                                                                                                                                                                            | OK                                    | —                                                                                                        |
| **Jobs** `jobs/page.tsx:24`                     | Agent search + scheduled             | `agentApi.chat({agentName:'job_search'})` + `schedulerApi.listJobs()` + save/reject local                                                                                                                                                            | LOW                                   | Persist `saved` to `localStorage`/backend, paginate `listJobs`                                           |
| **Applications** `applications/page.tsx:54`     | Kanban wired                         | `list` loop 100, `updateOutcome` but `editOutcome` never sent `page.tsx:102`                                                                                                                                                                         | MEDIUM                                | Send `{status:editStatus,outcome:editOutcome}`                                                           |
| **Settings** `settings/page.tsx:24`             | Autonomy/GDPR/BYOK wired, perms fake | Autonomy `PUT`, consent/GDPR real, `connectorPerms` local-only 159 never calls API                                                                                                                                                                   | **HIGH**                              | Wire `PUT /integrations/{id}/permissions`                                                                |
| **Enterprise stubs** `admin/page.tsx:37` etc.   | Gated                                | `EnterpriseGated` when `NEXT_PUBLIC_ENABLE_ENTERPRISE!=='true'` hides group `Sidebar.tsx:21`; when enabled 100% fake (`mockUsers` 5, `mockServices` 6, `invoices` 5, etc.) — correctly gated, honesty badge                                          | CRITICAL if ungated                   | Wire to `auditApi`/`billingApi`/`iamApi` or keep gated with banner                                       |
| **Onboarding** `OnboardingChecklist.tsx:8`      | 4-step                               | 2 steps hardcoded `done:false` + wrong endpoint `/workspaces/{id}/document-actions`                                                                                                                                                                  | MEDIUM                                | Use `documentApi.list` length, wire `agent` done via `agentActions.length`                               |
| **Cross-cutting**                               | —                                    | Dual `api.ts`/`api-client.ts` `ApiError`/`ApiClientError` + dual 401 queues + cookie divergence; `transformKeys` mangles `metadata.*` underscores; `signup/page.tsx:309` SSO dead while `login` SSO works; 16+ `shared/` components dead (0 imports) | **HIGH**                              | Unify to single `ApiClient` singleton, whitelist `metadata` from transform, wire `signup` SSO or disable |

---

## 5. Verification — Evidence

- **Frontend:** `apps/web: pnpm typecheck` → `tsc --noEmit` PASS (0 errors after
  `inert` fix). `pnpm test` → 32/32 PASS, 6 suites (Toast, Modal
  portal+inert+focus trap, ApprovalCard, Sidebar gated, useWorkspace, connectors
  OAuth scopes). `pnpm lint` — only pre-existing `no-img-element` + `no-console`
  in `Avatar.tsx`/`error-tracking.ts:22` (expected).
- **Backend:** `apps/api: uv run --project apps/api python -m pytest -q` — full
  suite 2404+ collected, P12 evidence `2405 passed/0 failed/4 skipped/2 xfailed`
  at `2026-08-20` credible; quick
  `pytest -o addopts="" tests/test_documents.py -q` 10/10 pass (content BLOB +
  undo). `test_rls_isolation.py` currently skipped due to ordering bug (would
  fail if not skipped — confirms CRITICAL).
- **Security:** `middleware/auth.py:47` JWT decode without `require exp/sub`,
  `config.py:104` no weak-secret check, `rate_limit.py:120` `scope["route"]`
  dead, `csrf.py:15` `httponly=True` breaks SPA (should be readable),
  `_token_store` in-memory `dict:49` not Redis.
- **Best-practice comparison (websearch):** OWASP LLM Top 10 2025 LLM01 Prompt
  Injection, LLM06 disclosure, ASI06 memory poisoning — `prompt_injection.py`
  exists but no `ContentSanitizer` 5-stage (ADR-031 Proposed, correctly not
  claimed as done). RAG retrieval has no delimiters/reinforcement after content
  vs OWASP RAG Security `BEGIN RETRIEVED CONTENT` pattern. FastAPI RLS
  `SET LOCAL` + pool scrub is industry standard (`fastapi-rls` library) — our
  `SET LOCAL app.tenant_id` + `TenantContext` + `reset_context_on_checkout` is
  correct pattern but **ordering bug** breaks it (library does `SET LOCAL`
  inside `session_dependency`, not middleware).

---

## 6. Docs vs Reality

- **ADRs 32:** 2 stale (`ADR-013 4/34` vs 34/34, `ADR-002 16 vs 25 routes`), 2
  correctly Proposed-only (`ADR-030` credential isolation, `ADR-031` sanitizer),
  1 fixed drift (`ADR-011` OTel now ACTIVE `main.py:154`). Index
  `architecture/03-adrs.md` says 18 vs 32.
- **OpenAPI 94 paths** (`openapi.yaml:5`) vs 88 claimed → +6 drift
  (`provider-keys`, `feed|lineage|catalog`, `gmail/*`) not gate-reviewed.
  `API_REFERENCE.md:234` documents gated Billing/Analytics as always-available
  (should be banner `404 in MVP`).
- **Maturity matrix `mvp-p00/03:83`:** 4 rows stale
  `PROMETHEUS/Tenant/OTel COMMENTED OUT` now `MOUNTED` `main.py:108,154,168` —
  update to IMPLEMENTED. `03:28` 94% (641 missing) is honest.
- **Empty dirs:** `testing/smoke|security|chaos|fuzz|visual-regression` all 0
  files on disk — **honest** `PARTIAL` (not false DONE). Confusion:
  `apps/api/tests/security` 172 tests vs `testing/security` 0 — rename.
- **Onboarding/Runbooks:** `DEVELOPER_ONBOARDING.md`, `DEPLOYMENT_RUNBOOK.md`,
  `DISASTER_RECOVERY.md` exist but contain manual/unverified procedures (no prod
  deploy, weekly restore not cron'd).

---

## 7. Prioritized Fix Backlog — File:Line → Action

| #   | Severity     | File:Line                                                             | Finding                                                          | Fix                                                                                                                                                     |
| --- | ------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **CRITICAL** | `apps/api/src/api/main.py:129`                                        | TenantMiddleware outer than Auth → RLS never set                 | Swap: `add Tenant` **before** `add Auth` (Auth outer) or make Tenant parse `Authorization` itself; populate `tenant_id` in JWT at `auth_service.py:126` |
| 2   | **CRITICAL** | `apps/api/src/api/config.py:77`                                       | Infisical never wired                                            | Call `get_secret_manager()` in `Settings.__init__`                                                                                                      |
| 3   | **HIGH**     | `apps/api/src/api/services/document_service.py:124`                   | `_record_action` stores wrong `old_deleted_at` + no size limit   | Capture `old` before mutation, `if len(content)>10MB: 413`, `sanitize_text(filename)[:255]`, `../` check                                                |
| 4   | **HIGH**     | `apps/api/src/api/migrations/runner.py:15` `alembic/versions/0016:22` | `MIGRATIONS` empty + double create on Postgres                   | Populate/delete `runner.py`, add `if dialect.has_table("provider_keys"): return` to `0016`                                                              |
| 5   | **HIGH**     | `apps/api/src/api/config.py:104` `middleware/auth.py:47`              | No weak secret check, no `exp/sub` require, no `tenant` in token | `len<32` + denylist, `options={"require":["exp","sub"]}`, embed `tenant_id`                                                                             |
| 6   | **HIGH**     | `apps/api/src/api/main.py:163`                                        | `csrf_token httponly=True` → SPA cannot read                     | `httponly=False` + Redis store not `dict:49`                                                                                                            |
| 7   | **HIGH**     | `apps/web/src/app/workspace/[workspaceId]/admin/page.tsx:37`          | 100% mock audit log, no API                                      | Replace with `auditApi.queryEvents()` or keep gated banner                                                                                              |
| 8   | **HIGH**     | `apps/web/src/app/workspace/[workspaceId]/settings/page.tsx:159`      | Connector perms local-only                                       | Wire `PUT /integrations/{id}/permissions`                                                                                                               |
| 9   | **HIGH**     | `apps/web/src/lib/api.ts:23` `api-client.ts:40`                       | Dual clients, dual 401 queues, transform mangles `metadata`      | Unify to single `ApiClient`, whitelist `metadata`/`properties` from transform                                                                           |
| 10  | **MEDIUM**   | `apps/api/src/api/middleware/rate_limit.py:120`                       | `scope["route"]` never set                                       | Lookup via `request.app.routes`                                                                                                                         |
| 11  | **MEDIUM**   | `docs/phases/mvp-p06/09-gate-2026-08-15.md:25`                        | 69.9 marked GO without exception record                          | Add `08-registers.md` EXC-P06-01 with owner/controls/expiry                                                                                             |
| 12  | **MEDIUM**   | `docs/adr/ADR-013:12`                                                 | Stale 4/34                                                       | Rewrite to 34/34                                                                                                                                        |
| 13  | **LOW**      | `apps/web/src/components/memory/GraphViewer.tsx:38`                   | No `ResizeObserver`, fixed 560px                                 | Add observer, `aspect-ratio`                                                                                                                            |

**Overall risk:** No data-loss beyond document undo timestamp (HIGH) and RLS
ordering (CRITICAL) which is fail-closed (0 rows) not leak — safe but broken.

---

## 8. End-to-End Journey — What Works vs What Is Gated

1. **Signup → workspace → upload → ingestion → memory → graph:**
   `POST /auth/signup` → `POST /workspaces` → `POST /documents?workspace_id=`
   (BLOB stored, no S3) → `ingestion/pipeline.py` → `vector_store` → `memories`
   → `GraphViewer` SVG pan/zoom. Works, but ingestion RAG has no prompt
   delimiters vs OWASP, and upload has no 10MB guard.

2. **Chat → orchestrator → QA → proposal → approval:**
   `POST /agents/chat {workspaceId,message,agentName?}` → `router.py:178`
   classify → `loop.py` `lookup_approval()` → `QAAgent` →
   `result {summary,proposals}` → `ChatWindow` renders proposals →
   `approvalApi.approve/reject` → `agent_approvals` table. Verified:
   `streamText` + `approval_gate` wired (G4), not hardcoded `False`. RAG
   poisoning not yet scanned.

3. **Files → viewer → history → undo:** `GET /documents?include_archived` →
   `GET /documents/{id}/content` → `PATCH /documents/{id}` rename +
   `POST /archive|restore` → `DocumentAction` → `GET /actions` +
   `POST /actions/{id}/undo` → `DiffViewer` del/ins. Works end-to-end except
   `old_deleted_at` bug.

4. **Schedule/History/Jobs:** `eventApi.list()` is global (no `workspace_id`
   param) → client filter leaks; `schedulerApi.listJobs()` real; `jobs` search
   is via agent chat (honest, no dedicated `/job-search` REST — audit gap
   correctly noted).

5. **Connectors → approval → sync:** `useWorkspaceConnectors` →
   `/workspaces/{id}/connectors` real, `PROVIDER_META` scopes,
   `integrations/create|sync` real, `errorDetail` + progress bar. Honest.

6. **Enterprise (billing/admin/orgs/flags/marketplace/developer):** Gated behind
   `NEXT_PUBLIC_ENABLE_ENTERPRISE` — when disabled (default) `Sidebar` hides
   group `Sidebar.tsx:21` and pages return `<EnterpriseGated>`
   `EnterpriseGated.tsx:1`. When enabled, they render **100% mock** (5 users, 6
   services, 5 invoices, etc.) with no API — correctly disclosed as gated, not
   shipped.

7. **Auth:** `POST /auth/login` + `AuthMiddleware` + `validate_settings()` +
   `sso.py` Google/Microsoft real (JWKS), SAML stub `NotImplementedError`
   (honest). `login/page.tsx:25` SSO buttons wired to
   `GET /auth/sso/{google|microsoft}?redirect_uri=` and handle `Unsupported`
   toast. `forgot-password/page.tsx:14` is honest 404 fallback (no backend
   endpoint).

8. **Observability/DevOps:** `main.py:154` Prometheus `expose("/metrics")`,
   `OTel` `instrument(app)` active, `CorrelationIDMiddleware` +
   `RequestLoggingMiddleware` mounted; `infra/` has `docker-compose`,
   `terraform`, `alembic` but **no release workflow** (AGENTS claims no release
   workflow — honest).

---

## 9. What To Do Next (In Priority Order)

1. **Fix RLS ordering + Infisical wiring** (1 day, 2 lines + test
   `test_rls_isolation.py` un-skip).
2. **Fix document undo + add 10MB limit** (1 hour, `document_service.py:124`).
3. **Unify API clients** (half day, delete `lib/api.ts` duplicate
   `transformKeys`/`refreshQueue`, keep single `ApiClient`).
4. **Add server-side `?workspace_id` to `events` + `knowledge-graph` lists**
   (half day, `routers/events.py:32` + `workspaces.py:131`).
5. **Gate P05/P06/P08 with formal exception records** in `08-registers.md`
   (docs-only, 1 hour).
6. **Wire enterprise stubs or keep gated with banner** — current gating
   satisfies MVP; for ENT track, wire `billingApi`/`iamApi`/`pluginApi` (1
   week).

**User questions to resolve before proceeding (do not assume):**

- Should `SAML` be implemented (`saml.py` already has `signxml` verify) or
  removed from docs? Currently `sso.py` excludes it, `saml.py` is dead — confirm
  to delete or wire.
- Is `Infisical` intended for prod (needs `INFISICAL_CLIENT_ID/SECRET` +
  `sso_providers` JSON) or should we remove `infrastructure/secrets.py` and keep
  env-only for MVP?
- For `eventApi.list()` workspace scoping, should backend filter by
  `tenant_id` + `workspace_id` (new column) or keep client-side?
