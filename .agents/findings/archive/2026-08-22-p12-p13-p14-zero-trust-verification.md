# Zero-Trust Verification — MVP-P12/P13/P14 + Current Working Tree

> **Audit Date:** 2026-08-22 (second session, build mode)  
> **Auditor stance:** ZERO TRUST — did not trust prior gate reports
> (EXECUTION-STATUS 88-94, P13 89/100, P14 88/100) until code/tests/migrations
> re-read. Previous audit `P13-zero-trust-audit-2026-08-22.md` (19 findings
> F-01..F-19) was re-verified, not assumed. **Baseline:** `0feb7ff` HEAD + 99
> modified/untracked (per `git status --porcelain`), including
> `0018_graph_memory_end_to_end`, `0019_rls_and_sanitize_hardening`,
> `pyproject.toml` dep bumps, `schemas/memory.py` + `schemas/workspace.py` fixes
> applied **this session**. **Standards re-verified via websearch 2026-08-22
> (second session):** MCP 2026-07-28 stateless core + 6 auth hardenings
> (blog.modelcontextprotocol.io 2026-07-28, spec changelog SEP-2575/2468/2352),
> OWASP Agentic Top 10 2026 ASI01–ASI10 published 2025-12-09 (genai.owasp.org),
> RFC 9700 BCP 240 Jan 2025 (PKCE everywhere, S256 only, exact redirect_uri).
> Logs: this session's websearch `ses_*`.

---

## Executive Verdict (honest, not waived)

| Phase                    | Claimed Gate                  | Recomputed Honest                                                  | Verdict vs §28                                                                                                                                             | Blocker?                                        |
| ------------------------ | ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **P12** AI/Agent/Memory  | 88.4/100 CONDITIONAL          | **85.6 raw → 88.4 with Score 11/10 inflation** (same class as P11) | CONDITIONAL only via exception lift; honest 85.6 is FAILED under strict <88                                                                                | No hard blocker, but 4 exceptions carry         |
| **P13** Security/Privacy | 89/100 CONDITIONAL (84.4 raw) | **84.4 raw FAILED**, 89 waived                                     | **FAILED without explicit user waiver** — §28 does not allow points for exceptions, only time-bound deferral                                               | None hard, but waiver required to authorize P14 |
| **P14** Testing/QA       | 88/100 CONDITIONAL (87.6 raw) | **87.6 → 88 honest**                                               | **CONDITIONAL is honest**, but **3 GO-conditions remain unmet** (see N-01) so status should be **CONDITIONAL — RESTRICTIONS APPLY (3 fixes)** not clean GO | No hard, but 3 pre-prod fixes                   |

**Project health:** Vaeloom is a well-scaffolded MVP with hardening in progress
— NOT production-ready. Real numbers: **2555 tests collected** (not 2527 in
`mvp-p13/05-test-results.md`), **233 security tests (170 unique)** after de-dup,
**RLS 37/42 tables** after 0019 (not 4/36 stale), **DPIA v1.0 DRAFT pending
DPO**, **prompt injection regex-only**, **memory type enum missing** (fixed this
session). The previous session's 19 findings were accurate and have been
partially remediated this session; 6 remain open + 4 new N- findings below.

---

## P12 — AI, Agent, Memory, Data-Pipeline (re-verified)

**Claimed:** 88.4/100 CONDITIONAL, 25 failures→0, 68 new tests, BYOK, 88 OpenAPI
paths  
**Verified:**

- `09-gate-report.md` arithmetic: Score 11/10 = 110% per category (13.2 > 12
  weight) inflates 85.6→88.4 — same inflation as P11. Raw 85.6 is honest FAILED;
  conditional via 4 exceptions (EXC-P12-01..04) is defensible only with waiver.
  This audit re-confirms prior audit's F-03.
- `08-registers.md:70-71` EXC-P12-03 (in-memory versioning) and EXC-P12-04
  (chunk→embedding not wired) were **claimed deferred to P14** — both were
  **closed this session** via `0018` + `models/schema.py:900,928` +
  `ingestion/pipeline.py:188,322` + `memory_versioning.py:79` (see below).
  Register now marked **CLOSED 2026-08-22** — correct.
- BYOK `provider_keys` Fernet, `0016` migration, 68 tests verified passing in
  subset run (`test_memory_versioning` 14, `test_memory_service` 28,
  `test_knowledge_graph_service` 27).
- Eval framework 12 golden cases: **still mock-LLM only** (EXC-P12-01 open) —
  not re-executed with live provider this session.

**This session's remediation (graph-memory end-to-end):**

- `models/schema.py:900` `MemoryVersion` + `models/schema.py:928`
  `DocumentChunk` + `0018` migration — closes EXC-P12-03/04.
- `services/memory_versioning.py:79` `persist_version()` DB-backed with
  `SELECT max(version_number)` + `GET /memories/{id}/history`
  `routers/memory.py:303` — verified via `test_memory_versioning.py` 14 passing.
- `ingestion/pipeline.py:188` `_persist_chunks_with_embeddings()` — each
  `TextChunk` → `Embedding` (document_chunk) + `DocumentChunk` row +
  `Memory document_chunk` + knowledge_nodes hub (`contain` edges) —
  obsidian-style graph. `agents/memory_agent/retrieval.py:98,222` now handles
  `document_chunk` vectors/keyword, `services/provenance_service.py:45` traces
  `document_chunks→memory_versions`.

**Remaining P12 carry:**

- EXC-P12-01 eval live-provider, EXC-P12-02 breaker hardcoded (now partially
  fixed via `config.py:69` per-agent overrides — see below), RISK-P12-08 chunk
  overlap (now fixed via `retrieval.py:308` dedup).

---

## P13 — Security, Privacy, Compliance (re-verified, second session)

**Claimed:** 89/100 CONDITIONAL (84.4 raw), 233/233, DPIA v1.0, RLS 4/36  
**Verified against code:**

| Claim                         | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | File:line                                                                                                                    | Status                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| RLS 4/36 tables               | `0010_rls_force_and_roles.py: RLS_TABLES=34` + `0019` adds 3 → **37/42** (gap 5: `users, agents, permissions, provider_keys, document_actions`) — matches prior audit F-04, gate now updated to 37/42                                                                                                                                                                                                                                                                               | `alembic/versions/0010_rls_force_and_roles.py`, `0019_rls_and_sanitize_hardening.py:42`, `models/schema.py:__tablename__ 42` | **PASS (fixed, doc lag in 05-test-results still says 2527 not RLS)** |
| 0019 fail-closed F-05         | New 0019 policies: `USING (workspace_id::text = current_setting('app.workspace_id', true))` **without** `OR ''` fallback — **fail-closed**, verified `0019:58-66`                                                                                                                                                                                                                                                                                                                   | `0019_rls_and_sanitize_hardening.py:58`                                                                                      | **PASS (fixed)**                                                     |
| IP allowlist NOT MOUNTED      | `main.py:187` now `app.add_middleware(IPAllowlistMiddleware, allowlist_raw=settings.ip_allowlist or "")` — **always mounted, no-op when empty**                                                                                                                                                                                                                                                                                                                                     | `main.py:187`                                                                                                                | **PASS (fixed)**                                                     |
| CSRF in-memory `_token_store` | `middleware/csrf.py:49` dict + TODO `main.py:207` Redis for multi-worker — still **single-process** (F-06 open)                                                                                                                                                                                                                                                                                                                                                                     | `middleware/csrf.py:49`                                                                                                      | **WARN (EXC-P13-07)**                                                |
| JWT weak 27 bytes             | `tests/conftest.py:9` `test-jwt-secret-for-ci-only-32-chars-long!!` now 32+ (fixed, but `05-test-results` still shows old warning 27 bytes in log excerpt)                                                                                                                                                                                                                                                                                                                          | `tests/conftest.py:9`                                                                                                        | **PASS (fixed)**                                                     |
| Prompt injection 14 regex     | `middleware/prompt_injection.py:14` 14 patterns + base64 + override, scans JSON/form only — **still regex-only, not LLM**, no PDF/DOCX scan via `ingestion/pipeline.py` (F-08, EXC-P13-05)                                                                                                                                                                                                                                                                                          | `middleware/prompt_injection.py:14`                                                                                          | **WARN**                                                             |
| GDPR export 12 tables         | `services/gdpr.py:10` `ALLOWED_TABLES` expanded this session to **~30 tables** (`consent_records` … `memory_versions`) — closes F-09 partially                                                                                                                                                                                                                                                                                                                                      | `services/gdpr.py:16`                                                                                                        | **PASS (expanded)**                                                  |
| DPIA v1.0 VERIFIED            | `docs/security/DPIA.md` 6KB template, dated 2026-07-12, **DPO PENDING** — still DRAFT, not signed                                                                                                                                                                                                                                                                                                                                                                                   | `docs/security/DPIA.md`                                                                                                      | **WARN (EXC, not closed)**                                           |
| Input sanitization ADR-031    | `utils/sanitize.py:10` `sanitize_text` exists, wired in `services/memory_service.py:36,142` for title/summary/content, but `tools/executor.py` not wired — **service-layer only** (F-11)                                                                                                                                                                                                                                                                                            | `utils/sanitize.py`, `0019` docstring                                                                                        | **WARN (EXC-P13-04)**                                                |
| B608 38 MEDIUM FP             | `bandit -t B608` still **25 MEDIUM** after 11 suppressions — `infrastructure/search.py`, `vector_store.py` `text(f"""` with `{tenant_clause}` interpolation remain. Gate's 38→25 is improvement but not 0                                                                                                                                                                                                                                                                           | `bandit -t B608` run 2026-08-22                                                                                              | **WARN (accepted FP)**                                               |
| pytest/starlette CVEs         | `pyproject.toml:13` `starlette>=0.49.1` → `0.49.3` installed (was 0.46.2), `fastapi 0.120.4` — **7 vulns remain** requiring `starlette 1.3.1` which is **unsatisfiable** with `fastapi<0.121` (`<0.50` cap). `pytest` 8.4.2 UNIX-only CVE deferred. This session's attempt to bump to `pytest 9.0.3` + `pytest-asyncio 1.4.0` **hung security suite** (9.18s per test vs 0.08s, 15 tests 51s with -n4 vs 0.19s for other suites) and was **reverted** to 8.4.2/0.26.0 — documented. | `pyproject.toml:13,100`, `uv.lock: starlette 0.49.3`                                                                         | **WARN (blocked upstream)**                                          |
| 2555 collected                | `pytest --collect-only -q -o addopts=""` → **2555** (proven) vs `05-test-results.md:12` still **2527** (stale)                                                                                                                                                                                                                                                                                                                                                                      | `apps/api/tests` 145 files, `grep def test_ 2322`                                                                            | **WARN (doc lag)**                                                   |
| Security duplicate            | `tests/security/test_csrf.py` vs `tests/middleware/test_csrf.py` duplicate (F-02) — still present, not de-duplicated                                                                                                                                                                                                                                                                                                                                                                | `tests/security/test_csrf.py:1`, `tests/middleware/test_csrf.py:1`                                                           | **WARN**                                                             |

**This session's hardening verified:**

- `config.py:69` `agent_circuit_failure_threshold/recovery_timeout` +
  `agent_circuit_config JSON` + `orchestrator/loop.py:30` per-agent overrides —
  closes EXC-P12-02 partially.
- `agents/memory_agent/retrieval.py:308` `rerank()` overlap dedup — closes
  RISK-P12-08.
- `main.py:187` IP allowlist always mounted — closes prior Finding 21.
- `pyproject.toml:13` starlette 0.49.3 + `0019` RLS + `services/gdpr.py:16`
  expansion — all verified.

**P13 honest score remains 84.4 FAILED without waiver** — gate's 89 with 4
exceptions (EXC-P13-01 RLS 5 tables, EXC-P13-02 IP, EXC-P13-03 starlette,
EXC-P13-05 regex) is only defensible with explicit user waiver per §28. The
`09-gate-report.md:30` honesty note is accurate and must be signed.

---

## P14 — Testing and Quality (re-verified, fixes applied this session)

**Claimed:** 88/100 CONDITIONAL (87.6 raw), 42 new tests (15 contract + 11 AI
eval + 16 resilience), 2527→2555 delta, 0 regressions  
**Verified:**

| Check                                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | File:line                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Gate arithmetic 40*1.0 + 30*1.0 + 20*0.88 + 10*0.0 = 87.6 → 88 | **Correct** (no inflation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `01-gate-report.md:74`                                                              |
| 42 new tests exist                                             | `test_contract_validation.py:15`, `test_ai_evaluation.py:11`, `test_resilience.py:16` — all present                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `apps/api/tests/test_*.py`                                                          |
| 42 tests pass (this session)                                   | `test_contract_validation.py -q` 15 passed 21.70s, `test_ai_evaluation + test_resilience` 27 passed 19.68s — **all 42 green after fixes**                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `uv run pytest -q` logs                                                             |
| Contract validation meaningful?                                | Low — OpenAPI 4 tests are smoke, not contract severity; `test_contract_validation.py:60` warns `async def` not async                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `test_contract_validation.py:49`                                                    |
| **GO-conditions unmet (N-01) — FIXED THIS SESSION**            | **Before:** `schemas/memory.py:13` `content: str \| None` no validator → empty `content/title/summary` → `services/memory_service.py:39` `content_hash=None` → DB `NOT NULL` IntegrityError 500; `schemas/workspace.py:7` `name: str \| None` allows empty; `schemas/memory.py:9` `type: str` allows `invalid_type_xyz` 201. **After:** `schemas/memory.py:1` `MemoryType Literal` + `note/fact` compat + `@model_validator` rejects all-empty → 422; `schemas/workspace.py:7` `name: str = Field(..., min_length=1)`; `services/memory_service.py:39` `content_hash` always `hash("")` not None | `schemas/memory.py:1-22`, `schemas/workspace.py:7`, `services/memory_service.py:39` |
| Stale counts                                                   | `01-gate-report.md:68-69` claims 2,425→2,527 but real 2555→2555 (delta +0, not +102) — doc lag vs `AGENTS.md:50` 2555                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `01-gate-report.md:68`                                                              |
| Security duplicate carry                                       | P14 added no security tests, but did not de-duplicate P13's 233 (170 unique) — still 233 claimed vs 170 honest                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `05-test-results.md` (P13)                                                          |
| Documentation 0/10                                             | `01-gate-report.md:82` scores documentation 0 — honest, no `05-test-results` for P14 full suite run captured                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `01-gate-report.md:82`                                                              |

**P14 now truly CONDITIONAL GO after fixes** — the 3 GO-conditions are met on
disk, but gate report still lists them as "Condition for GO: fix ..." (not
updated) and `EXECUTION-STATUS.md:35` already says `✅ GO (accepted 2026-08-22)`
before fixes — premature. After this session's fixes, P14 should be re-audited
to **88/100 CONDITIONAL — RESTRICTIONS APPLY (0 new, 6 carried)**.

---

## Cross-cutting & Standards (websearch 2026-08-22 this session)

- **MCP 2026-07-28:** Stateless core (no `initialize`, no `Mcp-Session-Id`,
  `_meta` per-request), `Mcp-Method`/`Mcp-Name` routing, `ttlMs`/`cacheScope`, 6
  auth hardenings (RFC 9207 `iss` validation SEP-2468, `application_type`
  SEP-837, issuer-bound credentials SEP-2352, DCR deprecated for CIMD).
  Vaeloom's `connectors/mcp` is internal tool shape
  `tools/definitions.py:ALL_TOOLS`, not MCP SDK — **gap**:
  `docs/02-system-architecture.md` claims MCP integration but code is not
  wire-compatible. OK for MVP (enterprise exclusions), but doc over-promises per
  F-13.
- **OWASP Agentic 2026 ASI01-ASI10 (2025-12-09, v2.01 Jun 2026):** ASI01
  EchoLeak (goal hijack), ASI02 tool misuse, ASI03 identity abuse, ASI04 supply
  chain, ASI05 unexpected code exec, ASI06 memory poisoning, ASI07 inter-agent
  spoof, ASI08 cascading, ASI09 trust exploitation, ASI10 rogue. Vaeloom's
  `prompt_injection.py:14` covers ASI01 partially (14 regex),
  `circuit_breaker.py` + `agent_limits.py` cover ASI08, `approval.py` HMAC
  covers ASI09, but ASI06 (memory poisoning via ingestion bypass) and ASI07/10
  not modeled in `Threat-Model.md` (dated 2026-07-12 pre-BYOK/0018).
- **RFC 9700 BCP 240 Jan 2025:** PKCE everywhere (public MUST, confidential
  RECOMMENDED, `S256` only), exact `redirect_uri`, DPoP,
  `code_challenge_methods_supported` discovery. Vaeloom's `sso.py`
  Google/Microsoft OAuth does PKCE but not DPoP; `signxml` SAML verified —
  **meets BCP for MVP scope** (enterprise SAML stub noted as STUB in
  `AGENTS.md:84`).

---

## Findings Register (this session, N- prefix, in addition to prior F-01..F-19)

| ID       | Severity | Title                                                                                                                              | Evidence                                                                                                                                                                           | Fix (this session or deferred)                                                                                                                                                        |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N-01** | HIGH     | P14 GO-conditions unmet but marked ✅ GO                                                                                           | `mvp-p14/01-gate-report.md:96` lists 3 fixes as "Condition for GO" but `EXECUTION-STATUS.md:35` already ✅ GO; `schemas/memory.py:13`/`schemas/workspace.py:7` allow empty/invalid | **FIXED** `schemas/memory.py:1` Literal + validator, `schemas/workspace.py:7` min_length=1, `services/memory_service.py:39` hash fix — verified 15 contract + 27 eval/resilience pass |
| **N-02** | MEDIUM   | P14 test counts stale 2,425→2,527 vs real 2555                                                                                     | `mvp-p14/01-gate-report.md:68` delta, `AGENTS.md:50` 2555, `pytest --collect-only 2555`                                                                                            | Document lag — patch gate report counts                                                                                                                                               |
| **N-03** | CRITICAL | Major dep upgrades unverified (pytest 9 / asyncio 1.4 / fastapi 0.120) hung suite                                                  | `pyproject.toml` bump attempts timed out `tests/security` 51s vs 0.19s; reverted to 8.4.2/0.26.0; `uv run pytest -q` timed out at 600s @25%                                        | **REVERTED** to 8.4.2/0.26.0/0.115.14/0.46.2 stable; starlette 0.49.3 kept but still 7 CVEs blocked upstream — document as deferred, do not re-bump without full CI green             |
| **N-04** | HIGH     | 99 uncommitted files at HEAD `0feb7ff` (§14 immutable revision violation)                                                          | `git status --porcelain` 99, `0018`/`0019` + all hardening uncommitted                                                                                                             | Commit after green (Phase 4)                                                                                                                                                          |
| **N-05** | MEDIUM   | `mvp-p13/05-test-results.md` still claims 2527 not 2555                                                                            | `05-test-results.md:12` 2527 vs `AGENTS.md:50` 2555 vs `collect-only 2555`                                                                                                         | Patch doc                                                                                                                                                                             |
| **N-06** | LOW      | `docs/security/*` dated 2026-07-12 pre-BYOK/0018/0019 — `Threat-Model.md` missing `provider_keys`, `document_chunks` assets        | `docs/security/Threat-Model.md:1`                                                                                                                                                  | Update per `03-workstreams.md`                                                                                                                                                        |
| **N-07** | LOW      | `AGENTS.md` vs `docs/02-system-architecture.md` drift (Desktop/VS Code/Mobile claimed but `NOT IMPLEMENTED`) — F-13 class persists | `docs/02-system-architecture.md:115` `NOT IMPLEMENTED` notes                                                                                                                       | Add appendix in next gate                                                                                                                                                             |

Prior F-01..F-19 remain as documented in `P13-zero-trust-audit-2026-08-22.md:21`
— F-04, F-05, F-18 partially or fully fixed this session (see table above),
others open as `EXC-P13-*` carry.

---

## What Is Actually Good (re-verified PASS, 0-trust)

- **AuthN/Z sound:** `middleware/auth.py:1` JWT `exp/sub` required,
  `PUBLIC_PATHS` sorted deterministic `test_noauth_private.py:90`,
  `TenantMiddleware` inner than `Auth` `main.py:177` correct Starlette reverse,
  `SET LOCAL app.tenant_id` fail-closed `middleware/tenant.py:41`.
- **CSRF double-submit correct:** `middleware/csrf.py:14` HMAC +
  `hmac.compare_digest` + 3600s, SKIP health/auth, 15/15 pass (with 27-byte HMAC
  warning F-07 now fixed to 32+).
- **Tenant fail-closed:** `tenant.py:41` missing GUC → 0 rows (PgBouncer safe).
- **Fernet:** `services/encryption.py:1` `sha256→urlsafe_b64encode` valid
  length, `decrypt_value` raises `InvalidToken`.
- **Rate limit + SecurityHeaders:** `middleware/rate_limit.py` 100rpm sliding +
  30rpm per-agent `infrastructure/agent_limits.py`,
  `middleware/security_headers.py` HSTS 31536000 — match ADR.
- **Graph-memory end-to-end:** `0018` + `DocumentChunk` +
  `_persist_chunks_with_embeddings` + knowledge_nodes hub + `retrieval.py`
  `document_chunk` + provenance — closes EXC-P12-03/04 durably.
- **Circuit breaker + dedup + IP allowlist:** `config.py:69` per-agent,
  `retrieval.py:308` overlap dedup, `main.py:187` always mounted — all verified.

---

## End-to-End Explanation (for user, no assumptions)

**What Vaeloom is:** Memory-first second brain for students/early-career
(`01-mvp-spec.md:22` 8 agents: Orchestrator + 7 specialists +
Planning/Research). **Next.js 15 → FastAPI monolith (ADR-001) → Postgres
pgvector HNSW + Redis + MinIO**, not NestJS. Memory = 6 canonical types
(Profile, Document, Career, Episodic, Preference, Working — spec 6 vs prompt 22
unresolved, test compat adds `note`/`fact` aliases). Knowledge graph
`knowledge_nodes`/`knowledge_edges` + vector store `embeddings` + hybrid RAG
`retrieval.py: retrieve()`; workspace-scoped `suggest` first with HMAC-bound
expiring approvals `services/approval.py`.

**How a request flows (verified):** `apps/web` (`pnpm dev:web` 2-5s
`AGENTS.md:17`) → `POST /api/v1/agents/chat` `routers/agents.py` →
`middleware/prompt_injection.py:14` 14 regex → `orchestrator/router.py:116`
two-stage intent (coarse category → disambiguate resume/ats,
job_search/application etc, 0.70 threshold) → `orchestrator/loop.py:30`
per-agent `CircuitBreaker` (now configurable) + `AgentRateLimiter` +
`asyncio.wait_for(agent_timeout_seconds)` + `state.py:67` `save_checkpoint` →
`agents/* /handler.py` (8 MVP + 14 enterprise via `registry_key` fallback) →
`qa_agent/handler.py:20` QAAgent 5 checks + 3 retries → `routers/memory.py`
approval cards + `knowledge_graph` + `Document` ingestion
`ingestion/pipeline.py:188` 3-strategy chunking → `pipeline.py:188`
chunk→embedding→memory→graph auto-wiring → `retrieval.py:347` hybrid
vector+keyword+graph with `fit_to_context_window`.

**Where it truly stands:** P00–P11 CONDITIONALLY APPROVED 75–96 (inflated honest
75–90), P12 85.6→88.4, P13 84.4→89 (both via exception lift), P14 87.6→88 honest
but 3 GO-conditions were unmet until this session's fix. After this session's 4
fixes (memory type+empty check, workspace name, content_hash) + 0018/0019 +
starlette 0.49.3 + B608 suppressions, **P13 is still 84.4 FAILED without waiver,
P14 is now 88 CONDITIONAL — RESTRICTIONS APPLY (6 carried)**. Production blocked
until **starlette 1.3.1** (upstream fastapi), **DPIA DPO sign**, and **RLS 5
tables**.

---

## Recommendations (ordered)

1. **Gate honesty:** Keep `mvp-p13/09-gate-report.md:30` honesty note (84.4
   FAILED / 89 waived). Require explicit user waiver signature to authorize P14
   — do not trust 89 as honest.
2. **Counts:** Patch `mvp-p13/05-test-results.md:12` 2527→2555 and
   `mvp-p14/01-gate-report.md:68` 2,425→2,527 delta, de-duplicate
   `tests/middleware/test_csrf.py` (F-02).
3. **No more major dep bumps without CI green:** Keep `pytest 8.4.2` /
   `pytest-asyncio 0.26.0` / `fastapi 0.115.14` / `starlette 0.46.2` until full
   2555 suite passes in CI with ~32GB. `starlette 0.49.3` is OK to keep if you
   want (boot passes) but note 7 CVEs remain blocked upstream — document as
   EXC-P13-03.
4. **Commit:**
   `git add 0018 0019 schemas/memory.py schemas/workspace.py services/memory_service.py services/gdpr.py` +
   phase docs + findings → 2 commits (code, docs) after final green.
5. **DPO/DPIA:** Keep `docs/security/DPIA.md` DRAFT — no prod with personal data
   until sign, per `09-gate-report.md:86`.
6. **Next phase entry:** P15 Performance may start only after P14 re-audit signs
   the 3 fixes (done) + waiver for P13 84.4.

---

## Questions For You (no assumptions, need decisions)

1. Should I patch `09-gate-report.md` to **honest 84.4 FAILED** as the official
   gate (blocks P14 until waiver), or keep **89 with your explicit signed
   waiver** as previously documented?
2. Which region's DPA signs the DPIA (EU/US/India) — determines whether
   Anthropic or OpenAI processor addendum must be published vs BYOK generic
   (F-10)?
3. Are `document_chunks`/`memory_versions` user-deletable under GDPR (add to
   `USER_TABLES` already done this session via `services/gdpr.py:16` — keep or
   revert to rebuildable-cache interpretation)?
4. Is `note`/`fact` as legacy memory types acceptable long-term, or should we
   migrate tests/docs to the 6 canonical and deprecate them?

---

## Appendix — Commands Run To Disprove Old Reports (this session)

```bash
git rev-parse HEAD  # 0feb7ff
git status --porcelain  # 99 M + ?? (raw)
uv run --project apps/api python -m pytest --collect-only -q -o addopts=""  # 2555 collected in 3.69s
Get-ChildItem tests -Recurse -Filter test_*.py | Select-String "def test_" | Measure  # 2322 defs / 145 files / 63 security defs
Test-Path tests/middleware/test_csrf.py  # True (duplicate)
Test-Path tests/debug_test.py  # False (removed)
python -m pytest tests/security/test_csrf.py --collect-only -q  # 15
python -m pytest tests/test_contract_validation.py -q  # 15 passed 21.70s (after Field fix)
python -m pytest tests/test_ai_evaluation.py tests/test_resilience.py -q  # 27 passed 19.68s
python -m pytest tests/test_memory_versioning.py tests/test_memory_service.py -q  # 42 passed 0.52s
from api.main import app; print(boot)  # BOOT OK 136 routes, middleware order correct, starlette 0.49.3 fastapi 0.120.4 (reverted to 0.46.2 after hang)
uv run --with bandit bandit -t B608 -r apps/api/src/api  # 25 MEDIUM after 11 suppressions (was 38)
rg __tablename__ | wc -l  # 42 tables
rg RLS_TABLES  # 34 + 3 via 0019 = 37
websearch: MCP 2026-07-28 stateless + 6 auth hardenings, OWASP ASI01-10 2025-12-09 v2.01, RFC 9700 BCP240 Jan2025 S256 PKCE
```

_Generated by second-session zero-trust verifier, 2026-08-22, not trusting prior
reports until re-proven._
