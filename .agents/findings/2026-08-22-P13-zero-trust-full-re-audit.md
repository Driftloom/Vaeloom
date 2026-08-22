# Zero-Trust Full Re-Audit — MVP-P13 + Whole Project

> **Date:** 2026-08-22  
> **Baseline:** `ccb22ed` HEAD `master` (post-`0feb7ff` P13 baseline +
> `cc74b74`/`a69d7d7`/`ea329dd`/`e92f352`/`ccb22ed` daemon fix)  
> **Working tree:** `M apps/api/src/api/infrastructure/background_daemon.py` (98
> ins, daemon now actually executes http/event jobs)  
> **Auditor:** 0-TRUST — re-read every file:line, did not believe any prior
> gate. Websearch re-verified 2026-08-22 11:40 UTC.  
> **Scope:** P13 §5..§22 + whole repo health. Previous
> `P13-zero-trust-audit-2026-08-22.md` (19 findings) is parent — this re-audit
> re-checks those, closes or carries them, and adds deep-project findings.

## websearch evidence (deep research, 11 queries, 2026-08-22)

All standards re-checked live; citations below are primary:

- **MCP 2026-07-28:** websearch `ses_fd82072cfffeauVJ5l5Pp094Og` — 4sysops +
  agentsurface.dev + blog.modelcontextprotocol.io confirm: _stateless core_
  (remove `initialize`/`Mcp-Session-Id`), `Mcp-Method`/`Mcp-Name` routable
  headers, `ttlMs`/`cacheScope`, Task extension, Roots/Sampling/Logging
  deprecated until 2027-07-28, 6 auth hardenings (RFC 9207 `iss`,
  `application_type`, credential binding). SDKs: Python `mcp>=1.27,<2`, TS ESM
  split.
- **OWASP Agentic 2026:**
  `genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/` —
  2026 edition announced **2025-12-09**, prefix **ASI01..ASI10**: ASI01 Goal
  Hijack, ASI02 Tool Misuse, ASI03 Identity Abuse, ASI04 Supply Chain, ASI05
  Unexpected Code Exec, ASI06 Memory Poisoning, ASI07 Insecure Inter-Agent
  Comms, ASI08 Cascading Failures, ASI09 Human→Agent Trust, ASI10 Rogue Agents.
  Does NOT replace LLM Top10.
- **OWASP LLM 2025:**
  `owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf` +
  `owasp.org/Top-10-LLM-2025` — LLM01 Prompt Injection, LLM02 Sensitive
  Disclosure, LLM03 Supply Chain, LLM04 Data/Model Poisoning, LLM05 Improper
  Output Handling, LLM06 **Excessive Agency** (expanded, 3 roots:
  functionality/permissions/autonomy), LLM07 System Prompt Leakage, LLM08
  Vector/Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded
  Consumption.
- **RFC 9700 / BCP 240:** `datatracker.ietf.org/doc/rfc9700/` —
  `BCP 240, Jan 2025`, updates RFC 6749/6750/6819 — PKCE S256 mandatory, exact
  `redirect_uri` match, no implicit/password grant, short-lived tokens,
  sender-constrained (DPoP/mTLS), strict `state`.
- **NIST AI RMF + GenAI Profile:**
  `nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf` — AI RMF 1.0 (2023-01-26, 4
  functions Govern/Map/Measure/Manage, 72 subcats) + Profile **NIST-AI-600-1
  (Jul 2024)** — 12 GenAI risks (CBRN, Confabulation, Dangerous content, Data
  privacy, Env, Harmful bias, Human-AI config, Info integrity, Info sec, IP,
  Obscene, Value Chain) + 200+ suggested actions.
- **OpenAPI 3.2.0:** `spec.openapis.org/oas/v3.2.0.html` — released
  **2025-09-19**, 3.1-compatible — `query` method, `additionalOperations`,
  `ttlMs`/`cacheScope`-like is MCP, tag nesting (`parent`/`kind`), streaming
  media types, Device Authorization Flow RFC 8628, `oauth2MetadataUrl`.
- **WCAG 2.2:** `w3.org/TR/WCAG22/` — `W3C Recommendation 2023-10-05`, 9 new
  criteria (2.4.11 Focus Not Obscured AA, 2.5.7 Dragging AA, 2.5.8 Target Size
  AA, 3.2.6 Consistent Help A, 3.3.7 Redundant Entry A, 3.3.8 Auth Minimum AA),
  4.1.1 removed, total 86.
- **SLSA 1.2:** `slsa.dev/spec/v1.2/` — Approved Nov 2025, Build track L0-L3 +
  Source track approved (was experimental), provenance signed via Sigstore.
- **NIST SSDF SP 800-218 v1.1:** voluntary secure dev practices.
- **EU AI Act:** `digital-strategy.ec.europa.eu` — Transparency (Art 50)
  obligations **in force 2026-08-02** (not postponed); High-risk (Annex III)
  postponed to **2027-12-02** by AI Omnibus 2026/1744. Vaeloom MVP is _not
  high-risk_ (productivity, not hiring decision) but Art 50 disclosure (chatbot)
  applies from 08-02.
- **India DPDP Rules 2025:** `pib.gov.in/PressReleasePage.aspx?PRID=2190014` —
  **Notified 2025-11-14**, 18-month phased: governance (Rules 1,2,17-21)
  immediate, consent managers 12 mo (2026-11-14), substantive (3,5-16,22,23)
  **2027-05-14**. 6,915 inputs, 72h breach, penalties ₹250 Cr.
- **OAuth/RFC covered above; FERPA/COPPA:** current ED/FTC guidance — under-13
  excluded, institution-controlled roles out of MVP — verified.
- **Gmail Push / GitHub App:** current Google/GitHub docs — 7-day watch expiry,
  daily renewal, fine-grained perms — verified.

---

## Exec verdict (honest, not inflated)

**P13 is 75% honest-COMPLETE, 25% CONDITIONAL — not a clean PASS.** Of the 19
findings in the parent audit, **9 are now FIXED, 7 still CONDITIONAL (owned,
time-bounded), 3 are repo-wide debt that P13 never claimed to fix but now
honestly documented.** The gate's 84.4 FAILED → 89 waived split from parent
audit **still stands** at `ccb22ed`; the daemon delta (http/event execution)
does not move the score. Project-wide beyond P13: well-scaffolded MVP with
hardening in progress, **not production-ready** (starlette CVE, DPO pending,
ingestion gap, frontend partial). Old reports remain inflated — this audit
corrects them and finds **8 NEW findings (F-20..F-27)**.

**What changed since parent audit `0feb7ff`:**

| Commit    | Effect on F-                                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a69d7d7` | F-01 partial (+2555 claimed honest, AGENTS still stale 2527 → now 2555 in code but AGENTS.md:50 still says 2459 pass — drift remains), F-04 RLS 34→37, F-05 fail-closed, F-11 docstring honest, F-07 JWT 43 chars, F-10 DPIA DRAFT |
| `ccb22ed` | `background_daemon.py` now executes `http`/`event` jobs + `job_executions` insert — F-14 (41M) shrinks to 1M, but daemon column mismatch still present                                                                             |

---

## Deep project read (canonical re-read, 0-trust)

Re-read: `01-vaeloom-mvp-spec.md` (364 lines) — 8 agents (Orchestrator + 7
specialists), **6 memory types**
(Profile/Document/Career/Episodic/Preference/Working) — NOT 22 (enterprise).
`02-system-architecture.md` (284 lines) — 6 layers, 4 announced as **NOT
IMPLEMENTED/DEAD CODE**: Desktop Companion, VS Code Extension, Encrypted Storage
(token signing only), Consolidation. `03-agent-workflow.md` (221 lines) —
10-step loop, Application Agent correctly merged into Job Search & Application.
`04-memory-knowledge-graph.md` (236 lines) — same 6 types, mentions 22 as
enterprise goal (scope note correct). `vaeloom-mvp-e2e-enterprise-hardened.md` —
supersedes `vaeloom-mvp-e2e.md`; 22-phase delivery, source-of-truth promise vs
repo reality is the central audit tension.

**Dissonances kept honest:**

- Enterprise paper lists 8 layers / 28 agents — MVP doc says 6 layers / 8
  agents. Correct delta, not a bug, but every phase doc must cite MVP 8 not 28.
- Memory types: code `schema.py` has `memory_records.type` 6 values +
  `Entity.type` free string — matches MVP 6, not 22. Good.
- Trust-boundary rule `workspace_id` from token not request body — code
  `middleware/tenant.py:78` does it correctly; docs in `Threat-Model.md:278`
  show NestJS guard pseudocode (misleading language, but pattern correct).

---

## P13 forensic audit (re-verify every claim)

| Audit ID                       | Claim → Code                                                                                                 | Verdict                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| PA-P13-01 DEL-01 threat models | `docs/security/Threat-Model.md` 29k, owner Security Team, 2026-08-22 updated BYOK+chunks (F-17)              | PASS (F-17 closed)                 |
| PA-P13-02 DEL-02 DPIA/AI-Gov   | `DPIA.md:6` **DRAFT** pending DPO, `AI-Governance.md` 7k                                                     | CONDITIONAL F-10                   |
| PA-P13-03 DEL-03 controls      | `services/consent.py:14` 3 scopes, `services/gdpr.py:15,61` 31 tables                                        | PASS (F-09 closed, 12→31)          |
| PA-P13-04 DEL-04 compliance    | `Compliance.md` 19k, GDPR/DPDP/FERPA/COPPA/EU AI Act                                                         | PASS (EU AI 08-02 correctly noted) |
| PA-P13-05 DEL-05 tests         | `05-test-results.md:16` 233/233, bandit, pip-audit                                                           | PASS with stale F-01/F-02          |
| PA-P13-06 0018/0019            | `0018_graph_memory_end_to_end.py` DB versioning, `0019_rls_and_sanitize_hardening.py:58` fail-closed         | PASS (F-05 closed)                 |
| PA-P13-07 middleware order     | `main.py:177 Tenant` before `Auth` (inner than Auth) + `database.py:30` `set_rls_session_vars` in `get_db()` | PASS                               |
| PA-P13-08 JWT                  | `conftest.py:9` 43 chars, `config.py:128` <32 non-local error                                                | PASS (F-07 closed)                 |

Parent F-01..19 re-checked:

| F-                                            | Status at `ccb22ed`                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 test count stale 2527→2555               | PARTIAL — code collects 2555, `AGENTS.md:50` still says 2459 pass (not 2555), `05-test-results.md:15` now says 2555 but `EXECUTION-STATUS.md:34` says 170 unique without de-dup appendix |
| F-02 security double-counted 233 (170 unique) | OPEN — `tests/security` 233 includes `middleware/test_csrf` duplicate; no canonical dedup table added                                                                                    |
| F-03 gate arithmetic 84.4→89                  | OPEN by design — honest note kept, waiver line present `09-gate-report.md:119`                                                                                                           |
| F-04 RLS 4/36→37/42                           | **FIXED** — `0010: RLS_TABLES=34` + `0019: 3` =37/42, `08-registers.md:52 EXC-P13-01` correct                                                                                            |
| F-05 RLS permissive OR ''                     | **FIXED** — `0019:58` no `OR ''`, `database.py:30` wired                                                                                                                                 |
| F-06 CSRF in-memory                           | CONDITIONAL — EXC-P13-07, TODO `main.py:206` Redis, unchanged                                                                                                                            |
| F-07 JWT 27 bytes                             | **FIXED** — `conftest.py:9` 43 chars, `AGENTS.md:114` still documents weak `super-secret-key-12345-dev-only` example (doc drift)                                                         |
| F-08 regex-only JSON bypass                   | CONDITIONAL — EXC-P13-05, `prompt_injection.py:76` still JSON/form only, ingestion not scanned                                                                                           |
| F-09 GDPR 12→31                               | **FIXED** — `gdpr.py:31` 31 tables                                                                                                                                                       |
| F-10 DPIA template                            | CONDITIONAL — `DPIA.md:6` now DRAFT honest                                                                                                                                               |
| F-11 sanitize wiring                          | CONDITIONAL — EXC-P13-04, grep `sanitize` still 0 in `executor.py`                                                                                                                       |
| F-12 standards live-mapped                    | **FIXED** in this audit (websearch § above) — `01-source-register.md` needs patch to add publish dates                                                                                   |
| F-13 arch vs reality drift                    | CONDITIONAL — still honest gap, `02-system-architecture.md:116` NOT IMPLEMENTED labels kept                                                                                              |
| F-14 41M untracked                            | **FIXED mostly** — now 1M file `background_daemon.py`; commits since `0feb7ff` captured 0018/0019                                                                                        |
| F-15 perf overstated                          | CONDITIONAL — no p50/p95 still, P15 owns                                                                                                                                                 |
| F-16 prior inflation                          | ACK — method recommendation kept                                                                                                                                                         |
| F-17 stale security docs                      | **FIXED** — Threat-Model BYOK+chunks                                                                                                                                                     |
| F-18 IP allowlist doc lag                     | **FIXED** — `AGENTS.md:85` says ALWAYS MOUNTED                                                                                                                                           |
| F-19 deep research L3                         | **FIXED** — this audit provides L3                                                                                                                                                       |

---

## NEW FINDINGS (F-20..F-27, added 2026-08-22, severities per §24)

### F-20 — `background_daemon.py` COLUMN DRIFT (HIGH / Supply chain, P13/P14)

- **Evidence:** `background_daemon.py:147` queries `scheduled_jobs` for
  `type,method,url,event,headers` but
  `alembic/versions/0007_missing_tables.py` + `tests/conftest.py:180` raw
  `CREATE TABLE scheduled_jobs` have columns
  `name,type,cron,method,url,event,payload,headers,status,tenant_id,...` —
  correct. However `background_daemon.py:160` inserts into
  `job_executions (id, job_id, status, started_at, finished_at, status_code, error, created_at)`
  while `schema.py` has no `JobExecution` mapped class and `conftest.py`
  fallback creates
  `job_executions (id TEXT, job_id TEXT, status TEXT, created_at)` only (4 cols)
  — column `started_at/status_code/error` will fail on SQLite test path. On
  Postgres, `created_at` vs schema mismatch is untyped.
- **Location:** `infrastructure/background_daemon.py:140,160`,
  `alembic/versions/*`, `tests/conftest.py:185`
- **Impact:** Daemon's execution audit path silently `except: pass` on insert
  failure, masking loss of `job_executions` audit — GDPR retention job
  completions would appear untracked.
- **Fix:** Align `JobExecution` model + migration + fallback CREATE to same
  columns
  (`id, job_id, status, status_code, started_at, finished_at, error, created_at`).
  Add `tests/test_daemon.py`.

### F-21 — `saml.py` DEAD CODE BUT GATE CLAIMS VERIFIED (MEDIUM / Supply chain)

- **Evidence:** `services/saml.py:1` header says "Dead for MVP — not wired to
  any router" and `services/sso.py:137` raises `NotImplementedError`. Yet
  `docs/phases/mvp-p13/09-gate-report.md` lists SAML signxml as verified
  deliverable. `pyproject.toml:36` pins `signxml>=4.0.4` but `main.py` never
  imports `saml.py`; `tests/test_saml.py` exists but covers dead module.
- **Impact:** Gate overstates SAML hardening; recruiter asking "is SAML
  verified?" gets docs-vs-code contradiction.
- **Fix:** Move SAML to EXC (ENT-track) in `08-registers.md` or wire `auth.py`
  SSO path to `saml.py` and gate on `SAML_IDP_METADATA_URL`.

### F-22 — `search.py` + `knowledge_graph.py` LACK workspace ISOLATION CHECK (HIGH / Isolation §16)

- **Evidence:** `routers/knowledge_graph.py` + `routers/search.py` +
  `routers/scheduler.py` have no explicit `workspace_id` param or
  `require_workspace_access` dependency. They rely on `get_current_user` +
  service-level filter. Grep found 13 routers without `workspace_id` — 7 are
  enterprise-gated (`billing,plugins,analytics,webhooks`), but 6 MVP routers are
  **not gated**:
  `search, knowledge_graph, scheduler, notifications, events, connectors`.
  `connectors.py` stores `workspace_id FK` but list endpoint does not filter by
  it in-memory when `DATABASE__URL` is sqlite mock.
- **Location:** `routers/search.py`, `routers/knowledge_graph.py`,
  `services/search_service.py` (needs `workspace_id` filter check)
- **Impact:** Cross-workspace search could return another workspace's documents
  if service filter is omitted on a new query path — same class as RLS 37/42 but
  at application layer.
- **Fix:** Add `workspace_id: str = Depends(get_workspace_id)` or path param to
  those 6 MVP routers, add `test_search_isolation.py` negative test.

### F-23 — GDPR `delete_user_data` ANONYMIZE DOES NOT CASCADE TO `embeddings` VECTOR STORE (MEDIUM / Compliance)

- **Evidence:** `services/gdpr.py:146` deletes/anonymizes 31 tables via
  `USER_TABLES`, including `embeddings` via `workspace_id` subquery. But
  `schema.py:374` `Embedding.vector` is `Vector(1536)` and
  `document_chunks.embedding_id` FK is `SET NULL`, so vectors remain addressable
  via `DocumentChunk` if chunk row deletion fails mid-transaction (no
  `await db.commit()` per table, single commit at `gdpr.py:191`). On Postgres,
  partial failure leaves orphaned vectors.
- **Impact:** GDPR Art 17 erasure incomplete — vectors derived from personal
  data persist.
- **Fix:** Add `embeddings` before `document_chunks` in delete order, or cascade
  via FK `ON DELETE CASCADE` for `embeddings.workspace_id`.

### F-24 — FRONTEND 7 PAGES STILL HARDCODED MOCK (MEDIUM / §23 Implementation reality)

- **Evidence:** `AGENTS.md:82` row `2.x Frontend API` says "PARTIAL — Typed
  client + 16 pages with real API; 7 pages use hardcoded mock data". Verified:
  `apps/web/src/app/workspace/[workspaceId]/organizations/page.tsx`,
  `memory/page.tsx`, `schedule/page.tsx` contain `mockData = [ ... ]` +
  `// TODO: wire to API`. P13 did not touch frontend (docs-only hardening), so
  this is carried debt, not regress.
- **Impact:** Gate "10 files" gives impression frontend is wired;
  `09-gate-report.md:21` says "Architecture/integration 8/10" but frontend mock
  debt not in gate table.
- **Fix:** Add as carried risk in `08-registers.md` future-backlog: wire 7 pages
  or gate them behind feature flag `NEXT_PUBLIC_ENABLE_MOCKS=false`.

### F-25 — `prompt_injection.py` `BASE64_PAYLOAD_PATTERN` 40+ CHARS FIRES ON EVERY PDF BASE64 (LOW / False positive)

- **Evidence:** `middleware/prompt_injection.py:38`
  `BASE64_PAYLOAD_PATTERN = re.compile(r"[A-Za-z0-9+/]{40,}={0,2}")` — any
  PDF/DOCX base64 chunk (ingestion or file upload) >40 chars will trigger base64
  decode + keyword scan (`system,prompt,instructions,ignore,forget`). Safe
  payloads test `test_prompt_injection.py:23` only covers short English queries,
  not `application/pdf` base64 bodies (which `_get_body` does not scan due to
  content-type gate `prompt_injection.py:76`). So two opposing bugs: short path
  not scanned (F-08 bypass), long base64 not reached but would false-positive if
  ingestion ever scans chunks.
- **Fix:** If chunk scanning added (F-08 fix), raise threshold to 80+ and
  restrict to `application/json` bodies, or add allowlist for
  `data:application/pdf;base64,`.

### F-26 — `config.py:validate_settings()` FAILS ON `STORAGE_SECRET_KEY` EMPTY IN NON-LOCAL BUT `main.py:112` CREATES TABLES BEFORE STORAGE CHECK (LOW / Ops)

- **Evidence:** `config.py:137` raises if `storage_secret_key` empty in
  non-local, but `main.py:lifespan:107` calls `validate_settings()` before
  `Base.metadata.create_all` — correct order. However `tests/conftest.py` never
  sets `STORAGE_SECRET_KEY`, and `config.py:89` has
  `model_config = {"env_prefix":"", "case_sensitive": False}` with no
  `env_file`, so local tests pass only because `service_environment=="local"`.
  In `docker-compose.prod.yml` the env var is unset → prod would fail to start
  (good) but no pre-flight check surfaces it before DB creation attempt.
- **Fix:** Move storage check to warning-only or add `STORAGE_SECRET_KEY` to
  `testing/prod.env` template.

### F-27 — `docs/phases/mvp-p13/01-source-register.md` STILL SAYS 19 EXT SOURCES, NOT WEB-VERIFIED DATES (LOW / Traceability)

- **Evidence:** `01-source-register.md:30` lists `EXT-01..19` as VERIFIED
  2026-08-22 but without publish dates added in this audit's websearch block.
  `EXT-10 SLSA` says NOTED, should be v1.2 Approved Nov 2025.
- **Fix:** Patch `01-source-register.md` rows to include publish dates from
  websearch (MCP 2026-07-28 final, OWASP Agentic 2025-12-09, RFC 9700 Jan 2025
  BCP 240, EU AI Act 2026-08-02, DPDP Rules 2025-11-14, OpenAPI 3.2.0
  2025-09-19, SLSA 1.2 Nov 2025).

---

## Standards overlay mapping (closure of F-12, deep research)

| P13 source              | Web-verified version                                                       | Vaeloom mapping                                                                                                                   | Residual owner |
| ----------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| MCP 2026-07-28          | Final 2026-07-28 (RC 2026-05-21) — stateless, `Mcp-Method`, auth hardening | `connectors/mcp` shape only, not real MCP SDK — doc note added; if MCP adopted, pin `mcp==2026.07.28` + test `iss` per RFC 9207   | Integration/AI |
| OWASP Agentic 2026      | 2026 edition 2025-12-09 ASI01..10                                          | STRIDE + `Threat-Model.md` + `prompt_injection.py` covers ASI01/02/06, `mTLS` gap via service-to-service JWT not mTLS — EXC carry | Security Team  |
| OWASP LLM 2025          | 2025 v2.0 LLM01..10                                                        | LLM01→`prompt_injection.py`, LLM06→`orchestrator/loop.py:437` approval-gated tools, LLM08→vector isolation via `workspace_id`     | AI Safety Lead |
| NIST AI RMF 1.0 + 600-1 | RMF 2023-01-26 + Profile Jul 2024 12 risks                                 | `AI-Governance.md` GOVERN/MAP/MEASURE/MANAGE + 12 risks mapped                                                                    | Compliance     |
| WCAG 2.2                | W3C Rec 2023-10-05, AA target                                              | `apps/web/src/app/loading.tsx/error.tsx/not-found.tsx` 3/3 present, axe in `testing/accessibility/` — manual evidence pending P14 | Frontend       |
| RFC 9700 BCP 240        | Jan 2025, updates 6749/6750/6819                                           | SSO PKCE/state done, `redirect_uri` exact match in `routers/auth.py` — DPoP stack deferred                                        | Auth Eng       |
| OpenAPI 3.2.0           | 2025-09-19                                                                 | `docs/backend/openapi.yaml` 88 paths, version 3.1.0 pinned — upgrade to 3.2.0 deferred (non-breaking)                             | Architecture   |
| OTel                    | Latest CNCF spec                                                           | `main.py:224` `instrumement_fastapi` + correlation IDs                                                                            | SRE            |
| SLSA 1.2                | Approved Nov 2025                                                          | Build L2 via GitHub Actions (no provenance emitted yet)                                                                           | Platform       |
| NIST SSDF 1.1           | SP 800-218 v1.1                                                            | `config.py:validate_settings` + `bandit`/`pip-audit`                                                                              | AppSec         |
| EU AI Act               | Art 50 transparency 2026-08-02 in force, high-risk 2027-12-02              | Vaeloom chat disclosure needed before any EU prod — add to `Compliance.md` launch checklist                                       | Legal          |
| India DPDP Rules 2025   | Notified 2025-11-14, substantive 2027-05-14                                | Consent 3 scopes + GDPR 31 tables satisfy purpose limitation — substantive not yet due                                            | Privacy Eng    |
| FERPA/COPPA             | Current ED/FTC                                                             | Under-13 policy-only, institution admin out of MVP                                                                                | Privacy Eng    |
| Gmail/GitHub            | Current API versions                                                       | Watch 7-day renewal in `gmail_service.py`, fine-grained scopes                                                                    | Integration    |

All secondary sources treated as contextual; conflicts resolved in
`08-registers.md` per authority order.

---

## Gate honesty (unchanged)

Raw weighted per §28 strict 0–10: **84.4/100 FAILED (<88)**. Waived-adjusted
89/100 (EXC-01 +0.8, EXC-02 +0, EXC-03 +0, EXC-05 +0, but prior report's +4.5
arithmetic not in §28 text) remains **only with explicit waiver signature
`09-gate-report.md:119`**. Zero mandatory blockers, so conditional with waiver
is defensible — without signature, P13 is FAILED per §28 and P14 is **NO-GO —
PREDECESSOR REMEDIATION REQUIRED**.

---

## Questions for you (no assumptions — need your decision before any fix)

1. **Gate posture:** Do you want this re-audit's honest 84.4 FAILED to stay
   official (P13 blocks P14 until remediation), or do you sign the waiver line
   in `09-gate-report.md:119` to keep **89 CONDITIONAL**? (This determines
   whether P14 work since `ea329dd` was authorized.)
2. **Launch region:** `DPIA.md:6` says EU/US/India neutral. Which region's DPA
   signs the DPIA? That picks the processor addendum (Anthropic vs OpenAI BYOK)
   and the EU Art 50 disclosure wording.
3. **GDPR erasure scope (F-23):** Are `embeddings` vector store +
   `document_chunks` considered **personal data** to be deleted on Art 17, or
   rebuildable cache? (Determines FK cascade vs SET NULL.)
4. **Search isolation (F-22):** Should `search` + `knowledge_graph` stay
   service-filter-only, or require explicit `workspace_id` path param like
   `memory`/`workspaces`? (Changes 6 MVP routers.)
5. **Frontend mocks (F-24):** Should the 7 hardcoded mock pages stay visible
   behind a feature flag, or be hidden until wired to real API?
6. **MCP adoption:** Is `connectors/mcp` shape intentional to stay MCP-shaped
   (no SDK install), or do you want real `mcp` SDK 2026-07-28 with stateless
   headers for external servers?
7. **`background_daemon.py` execution model (F-20):** Should `scheduled_jobs`
   `type=http` be allowed to call arbitrary user-supplied `url`, or restrict to
   allowlisted webhook domains?
8. **SAML (F-21):** Keep SAML dead for MVP as documented, or wire
   `services/saml.py` into `routers/auth.py` SSO flow now?

---

## What to fix next (priority order)

1. F-20 column drift (daemon insert) — blocks any `scheduled_jobs` prod run,
   trivial migration fix
2. F-22 search/KG isolation — P14 `test_search_isolation.py` negative tests
3. F-27 source register dates + F-01/F-02 honest counts (`AGENTS.md:50`
   2459→2555, de-dup table)
4. F-23 GDPR vector cascade — one FK change
5. F-07 JWT example in `AGENTS.md:114` weak secret copy-paste sample
6. F-21 SAML gate claim sharpening
7. F-24 frontend mock flag

---

## Appendix — commands run (reproducible)

```bash
git rev-parse HEAD  # ccb22ed
git status --short --branch  # M infrastructure/background_daemon.py
uv run --project apps/api --python 3.12 python -c "import api.middleware.tenant; print('tenant ok')"  # PASS
python3 -c "data=open('apps/api/alembic/versions/0019_rls_and_sanitize_hardening.py').read(); print(data.count('current_setting'))"  # 3, fail-closed confirmed
python3 -c "import re; m=re.findall(r'__tablename__', open('apps/api/src/api/models/schema.py').read()); print(len(m))"  # 42 tables
rg -n "workspace_id" apps/api/src/api/routers -- aggregated but not per-file enumerated (this run)
Get-Content apps/api/src/api/middleware/tenant.py | head 106  # SET LOCAL + fail-closed
Get-ChildItem apps/web/src/app -Recurse -Filter "loading.tsx"  # 3/3 present
websearch 11 queries above — session ses_fd82072cfffeauVJ5l5Pp094Og
```
