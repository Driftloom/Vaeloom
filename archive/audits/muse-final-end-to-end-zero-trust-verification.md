# VAELOOM MUSE — FINAL END-TO-END ZERO-TRUST VERIFICATION

**Mode:** forensic audit → independent reconstruction → adversarial attack →
real E2E → live infra verification → minimal remediation → regression → final
re-audit → release verdict. **Date:** 2026-09-10/11 (execution ran past UTC
midnight; baseline dated 2026-09-10). **Auditor stance:** every prior
COMPLETE/PASS/READY treated as unproven assertion.

## 1. Executive verdict

**FINAL VERDICT: NOT RELEASE VERIFIED.**

P0 remaining = 0 (two P0-class findings were found, fixed, and re-proven in this
audit). P1 remaining = 8, of which 1 is operator-owned (live DB role bypasses
RLS) and 7 are code-level residuals (listed in §35/§42). Under the governing
rule (any P1 remains → NOT RELEASE VERIFIED), no positive verdict is available —
even though whole-system runtime correctness on the test-server substrate is
broadly proven (500+ fresh passing assertions, §28/§32).

The single most important discovery: **the configured production-target
PostgreSQL is contacted at runtime by a role with `bypassrls = true`, so the
entire RLS layer is non-enforcing for app traffic** (§8). Service-layer checks
are therefore the ONLY live isolation boundary today, which is exactly why
FINAL-01 (resumes IDOR) was live-exploitable before this audit's fix.

## 2. Baseline

- Audit baseline commit: `78d6c54` ("test(temporal): add zero-trust
  productionization battery and audit report"), branch `master`.
- Remediation commit (this audit): `b589ce2` ("fix(security): close FINAL-01..04
  workspace/approval zero-trust gaps with regression tests"), 5 files, +328/−13.
  All post-fix evidence below was collected AFTER `b589ce2` unless marked
  pre-fix.
- Working-tree at audit start: clean except untracked
  `docs/Audits/muse-temporal-completion.md` (foreign, parallel session).
- **Foreign/parallel-session changes detected DURING this audit** (not mine, not
  committed, not audited, left untouched): `agents/drive_agent/handler.py`,
  `agents/qa_agent/handler.py`, `agents/scheduler_agent/handler.py`,
  `clients/graph_client.py`, `clients/job_board_client.py`,
  `orchestrator/card_registry.py`, `orchestrator/loop.py`. Any future verdict
  must re-verify anything these touch (notably `loop.py` underpins §13/§17/§19
  claims).
- No stash entries. No interactive rebase. My staged set was limited to the 3
  source files + 2 test files above; foreign files were never added.

## 3. Environment

- OS/python: win32, project venv Python **3.12.13** (`uv run`); system python
  3.14 NOT used. pnpm 9.12.0, node v24.19.0.
- Settings source: root `.env` (non-overriding) + `apps/api/.env` (overriding).
  `DATABASE__URL`/`DATABASE_URL` → Supabase PostgreSQL (pooler, ap-south-1).
  Local `.env` overrides `ALLOWED_ORIGINS` (see §28 P3).
- **Live target DB (read-only catalog evidence, no writes performed):**
  PostgreSQL 17.6, 71 public tables, current_user `postgres`,
  `bypassrls = true`. Roles `vaeloom_app` / `vaeloom_migrator` /
  `vaeloom_readonly` exist with `bypassrls = false` but are NOT the runtime
  role. Connection is via PgBouncer/Supavisor transaction mode (prepared
  statements rejected live; app sets `statement_cache_size = 0`,
  `database.py:8-10`).
- Redis `localhost:6379`: **unreachable**. Temporal `localhost:7233`:
  **unreachable** (all Temporal evidence is test-server based).
- Feature flags (code defaults, `config.py`): `temporal_enabled=false`,
  `langgraph_enabled=false`, `agent_react_enabled=false`,
  `mvp_scope_enforced=true`, `enterprise_routes_enabled=false`. **Default
  runtime = legacy loop (+labeled stubs), NOT the Temporal→Graph→ReAct
  substrate** (§27/§39).
- JWT fail-fast validation present (`config.py:274-339`); revocation store is
  in-process memory (P1, §5).

## 4. Architecture reconstruction

Actual call-path map (verified by grep + tests, not docs):

```text
HTTP/API (routers/*, ~244 endpoints)
  → AuthMiddleware (401 fail-closed; PUBLIC_PATHS explicit, auth.py:9-30)
  → TenantMiddleware (tenant=JWT only, X-Tenant-ID ignored; workspace=header/path
      + DB membership owner-or-member; 403 fail-closed; tenant.py:135-193)
  → get_db (SET LOCAL RLS GUCs, transaction-scoped; database.py:28-46)
  → Router (per-route workspace re-check on hardened paths)
  → router.handle → _run_graph_branch → run_graph_direct  (HTTP, router.py:486-514)
  → DurableAgentRunWorkflow → durable_agent_run activity → _run_graph
      → run_graph_direct  (Temporal, activities.py:601,687-695)
  → run_graph_direct (topology/trust/spend/concurrency gates, runner.py:286-515)
  → compiled LangGraph (12 nodes, §12) → agent_node → _try_react_loop
  → tool ladder (scope→contract→approval→execute_tool, loop.py:1692-1746)
  → execute_tool (SINGLE def, executor.py:2681; workspace/card/scope/
      idempotency/timeout/audit gates)
  → approval single-consume (loop.py:273-285 atomic CONSUMED)
  → checkpoint merge-before-write (state.py:380-398) + terminal short-circuit
```

`Temporal → activity → run_graph_direct → LangGraph → ReAct → canonical executor`
is the ONLY durable substrate path: exactly 2 `run_graph_direct` callers
(router + activity), **zero live `graph.ainvoke` calls**, zero direct
tool/LLM/memory calls from `temporal/` (re-audited §15). Alternate production
path: legacy loop when flags off (§39).

## 5. Entry-point matrix

244 `@router.*` endpoints enumerated. Authenticated surface requires
`get_current_user`; public set = health/metrics/docs/auth-login-signup-refresh/
sso-prefix/scim/gmail-webhook(header-gated)/consent-scopes. Rate limits
concentrated on auth + resumes + connector MCP call; most CRUD routers have **no
rate limit** (P2 hardening gap, no bypass). Temporal workflows (6), activities
(11), 8 queues; 2 queues (`documents`, `memory`) have no worker started
(`worker.py:72-79`) — dead-letter risk if used (P2). Scheduler daemon

- queue worker are process-trust (no HTTP auth) by design. Approval signals
  allowlisted (`decision`, `updateProgress`) with workflow-identity binding +
  actor-from-JWT.

## 6. Security verification (auth/authz)

- Anonymous/malformed/expired/wrong-scheme: **105/105 green**
  (`test_noauth_private.py`; slowness ~3s/test misdiagnosed initially as hang —
  it is app-boot cost, not deadlock).
- JWT tenant authoritative; `X-Tenant-ID` never trusted (mismatch only logged).
  `request.state.workspace_id` never sourced from JWT (always None at middleware
  — dead source, harmless). Missing/malformed context fails closed
  (401/403/400).
- **P1 REMAINS: token revocation is in-process memory**
  (`auth_service.py:150-168`); multi-worker logout/`revoke_all` does not
  propagate (≤TTL window). Same class as documented CSRF Redis fallback.
- XFF spoofing correctly rejected unless peer is a configured trusted proxy
  (FIND-SEC-008; the failing `test_uses_x_forwarded_for` is a STALE test
  predating the hardening — code is right, §28).

## 7. Tenant/workspace verification

- Middleware + memory/agents/chat/cognition verify owner-or-member per request.
  Cross-workspace suites green (`test_memory_workspace_isolation`,
  `test_knowledge_graph_workspace_isolation`, 3-workspace parallel no-leak).
- **P0 FINAL-01 (found, FIXED, re-proven):** `routers/resumes.py`
  `list/master/generate` never called `_verify_workspace_access` → any
  authenticated user could read/generate from foreign `workspace_id` /
  `resume_id`. Combined with §8 (RLS non-enforcing at runtime) this was
  live-exploitable. Fix (`b589ce2`): enforce on all 3 paths; helper upgraded
  owner-only → owner-or-member (consistent with middleware); 5 new regression
  tests green.
- **P1 FINAL-02 (found, FIXED, re-proven):** approval list `workspace_id` filter
  skipped the membership predicate (leak); `request_approval` accepted arbitrary
  `workspace_id` at create. Fix: membership-check the explicit filter
  (fail-closed empty) + bind create to actor's workspaces; 2 new tests green.
- Residual: KG edge/traverse/service methods lack scope (P1 APP-KG-01, §21);
  loop foreign-resume adoption vs graph rejection (P1 LOOP-RESUME-01, §17);
  documents/applications/provider_keys owner-only checks fail closed for members
  (P2 availability inconsistency, no leak).

## 8. Database/RLS verification (LIVE target, read-only)

Measured on the configured Supabase PG 17.6 (NOT a proof DB):

- 71/71 tables have RLS **enabled**. BUT runtime role `postgres` has
  `bypassrls = true` → **RLS is theater for all app traffic through
  `DATABASE__URL`**. `vaeloom_app` (least-privilege, no bypass) exists and is
  unused. → **P1 OP-RLS-01 (operator-owned release blocker): switch runtime to
  `vaeloom_app`.**
- 42 tables have RLS enabled with **ZERO policies** (incl. `workspaces`,
  `tenants`, `tool_idempotency`, `idempotency_records`, `knowledge_nodes`,
  `loop_checkpoints`, `learning_events`): under `vaeloom_app` these fail closed
  (zero rows = outage until policies added); under current role, no effect. → P2
  ops hazard, must be resolved together with OP-RLS-01.
- 29 RLS tables lack FORCE (incl. `tool_idempotency`, `knowledge_*`,
  `learning_events`, `scale_memory_nodes`); table owners are `postgres` (owner
  bypass). Key tables that DO have policies: `agent_approvals`(1),
  `memories`(2), `memory_records`(1), `resumes`(1).
- GUC plumbing is correctly designed (SET LOCAL via `set_config(...,true)`,
  `statement_cache_size=0` for PgBouncer) but `get_db` swallows GUC errors
  (`except: pass`, fail-open at RLS layer) and ~50 non-request sessions
  (executor, activities, daemons, loop) never set GUCs (P2 under current role;
  would be outage-or-reliance-on-service-filters under least privilege).
- RLS live-page tests skip on SQLite CI (4 skips) — accepted; coverage replaced
  by this live catalog evidence + service-layer suites.

## 9. Agent/tool verification

- Single canonical `execute_tool` (1 def, 4 converging callsites: graph node
  - 3 ReAct paths). Offer-time MCP over-inclusion is fail-safe (enforced at
    execution). Executor Card check fail-opens on exception + skips card-less
    agents (P2 coverage gap: card-less agents scope-only, full coverage
    UNVERIFIED).
- Internal bypasses (P2): `_execute_search_jobs_board → greenhouse/lever/jobs`
  direct + `scrape → web_search` direct skip permission/retry/idempotency/ audit
  wrappers (same workspace threaded).
- **P1 MOCK-SUCCESS-01 REMAINS:** `web_search` (fallback mock on
  missing/exception key), `_execute_download_onedrive_file`, `sync_notion_pages`
  return `status: success` with FABRICATED data (labeled via `note`, but agents
  are not forced to honor notes). Reachable via canonical executor from any
  production entrypoint. (Correction of an over-claim: resume-compile "mock
  content" notes are a DEAD branch — `content is None` early-returns error;
  stale label only, P3.)
- Test-only paths correctly gated (`PYTEST_CURRENT_TEST` + opt-outs).

## 10. Approval verification

- Lifecycle create→pause→decide→consume proven; signal binding first-wins +
  forged-signal rejection green (temporal suites).
- **P1 FINAL-03 (found, FIXED, re-proven):** `decide()` read-checked PENDING
  then UPDATEed without `WHERE status='PENDING'` (concurrent approves both won).
  Fix: guarded UPDATE + rowcount→409. Sequential + deterministic stale-reader
  tests green. True same-row live-PG race still UNVERIFIED (harness shares one
  session) → residual P2.
- **P0 FINAL-04 (found, FIXED, code-re-audited):** Temporal
  `execute_approved_action` returned `executed: True` WITHOUT consuming or
  executing — unbounded replay + phantom execution claim. Fix: atomic
  APPROVED→CONSUMED (single winner; mirrors loop path) + truthful docstring.
  Approval workflow/signal/timeout/cancel suites green post-fix; direct live
  replay test not run (would touch live DB) → residual P2.
- Loop/graph consume path (atomic CONSUMED, hash+HMAC binding) green incl.
  `test_approval_single_use_and_swap_rejected`.

## 11. Durability verification

- Checkpoint merge-before-write (cancel/terminal monotonicity) + terminal
  short-circuit (loop + graph) + ReAct resume-without-re-execution green
  (`test_write_then_crash_then_resume_single_effect`,
  `test_stale_copy_cannot_clear_cancel_or_uncomplete`).
- **P1 CAS-DEAD-01 REMAINS:** CAS machinery (Redis Lua/DB/File) correct but ZERO
  prod callers pass `expected_version`; `Composite.save` drops it for fallback;
  concurrent writers rely on best-effort merge (LWW for non-cancel/non-terminal
  fields). Lost-update window proven by code.
- **P1 IDEM-RACE-01 REMAINS:** tool durable idempotency is check-then-act
  (lookup→execute→insert); concurrent duplicates both execute (loser only
  logged). Sequential duplicates suppressed (proven). Needs INSERT-claim.
- **P1 IDEM-SCOPE-01 REMAINS:** HTTP idempotency scope is `(key,path)` with no
  tenant/workspace columns (consent/gdpr/approvals replay cross-tenant on key
  collision).
- Tool idempotency covers only `connector_write`/`memory_write` categories;
  graph `sha256(ws:req:agent:task)` key computed but never checked (dead).

## 12. Temporal verification (test-server; live server unreachable)

- 6 workflows / 11 activities / 8 queues; deterministic IDs with
  REJECT_DUPLICATE; bounded retries + non-retryable taxonomy; heartbeats;
  kill-switch/quota/metric gates; `wf.patched` versioning; secret (20KB +
  SECRET_KEYS) + size guards; `_drive_activity` cancel/re-drive discipline.
- 86/87 green. 1 failure = pre-existing environmental (`connector_sync`
  heartbeat needs seeded PG row; documented in prior phase §42, reproduced
  identically here — activity fail-closed correctly).
- Forged/duplicate/late signals rejected (first-wins + binding + counters).

## 13. LangGraph verification

- 12 nodes / static transitions / reachability / `validate_graph_topology`
  (compiled-object introspection, fail-closed) green; replan ≤2, fanout ≤8,
  depth ≤5, node-updates ≤64, wall-clock 120s, per-class byte caps green incl.
  adversarial topology-injection suite (29 tests with ReAct adversarial).
- `GRAPH_VERSION=v1` double-pinned (activity + runner resume gate).
- Dependency floats (`langgraph>=0.2.39` → locked 1.2.11); runtime drift
  mitigated by topology/version gates (P3 hygiene).

## 14. ReAct verification

- Bounds (rounds/card-max-5, iterations/tools/tokens/cost $0.50/duration Mrs),
  tool ladder (unknown-tool reject, schema/shape/size/binding validation, scope,
  contract, approval gate), durable cancel checks, per-round checkpoint
  (redacted/capped), resume-without-re-execution, fallback single-hop, budget
  re-checks — all green (react e2e + adversarial).
- Cancellation is cooperative (in-flight tool completes; termination at next
  check) — by design, documented.

## 15. Temporal↔LangGraph↔ReAct integration

- Canonical path proven; bypass grep clean (no raw `ainvoke`, no direct
  tool/LLM/memory from temporal). Shadow/legacy-stub paths labeled and
  flag-gated (default-off). No duplicate memory/approval/idempotency
  authorities. I19/I20/I21 PROVEN.

## 16. Routing/fallback verification

- Tier/catalog/provider inference + BYOK precedence (explicit>ws>user>system,
  per-provider isolation) + terminal-vs-retryable taxonomy (no fallback on
  auth/context) + budget re-check per hop + full provenance chain green
  (`test_cross_provider_candidates/chain`, mechanics suites).

## 17. Memory/RAG/KG verification

- Workspace filtering enforced on PG/SQLite paths; SCALE service strictest
  (ws+user). Memory/KG workspace-isolation suites green (66-test batch).
- Gaps: Qdrant branch filters `workspace_id` only (no tenant) + hydrates without
  re-check (P2 conditional — Qdrant not deployed here); base `list/get` rely on
  router post-checks; `_mark_superseded` tenant-only; RRF `rrf_fusion` exists
  but has NO caller in production RAG path (hybrid-ranking quality claims
  UNVERIFIED — isolation ≠ quality); retrieval timeout only on graph path
  (direct `plan_phase` unbounded, P2); RAG 8KB/tool 4KB/state 20KB caps
  enforced.
- **P1 APP-KG-01 REMAINS:** KG service
  `update/delete/list_edges/traverse/ shortest_path` unscoped at service; router
  `_verify_node_scope` compensates node reads only (and skips when scope empty).
  Per-route edge/traverse audit still owed.

## 18. Learning verification

- `consolidate_trajectory` single def; admission (UUID fail-closed, source/ type
  allowlists, caps, 0.65 threshold, instruction-marker reject) + dedup
  (in-batch + `UNIQUE(workspace,event)` claim-first) + scope restriction (never
  policy/auth/tool/topology) green.
- Tenant binding fail-open on unverifiable owner (`unverified_owner`,
  `no_tenant_binding`) — authoritative gate remains middleware/router (P2).
- **Behavioral effect (learning → future behavior) UNVERIFIED** (only wiring to
  preference hints; no proof persisted learning changes outcomes). Security
  correctness ≠ quality: isolation PARTIAL, effect UNVERIFIED.

## 19. Budget verification

- Per-run ceilings + Redis-atomic quota + per-hop fallback re-check +
  terminal-category abort green; failed hops uncharged.
- P2s: spend tracker in-memory/lock-free (`check-then-act` across workers;
  `reset()` clears budgets); loop gate fail-open on tracker/quota errors; quota
  retries double-increment (no idempotency key on pre-act call); `track_usage`
  failures swallowed. Live concurrent-spend atomicity UNVERIFIED.

## 20. Injection verification

- Defense-in-depth green (regex middleware + caps, `sanitize_text`, tool-output
  neutralize+wrap, prompt-compiler UNTRUSTED quarantine, arg binding-keys reject
  ws/tenant/user mismatch, ingestion scan) + adversarial suites
  (`test_injection_quarantined...`, `test_injected_tool_output_never_executes`).
- LLM classifier OFF by default + ambiguous fail-open; `_BINDING_KEYS` covers
  identity only (approval/budget/topology mutation relies on per-tool schemas —
  full schema audit UNVERIFIED); middleware/env flag drift. PARTIAL.

## 21. Bounds verification

- All loop/graph/payload/timeout caps present + enforced + tested (I13 PROVEN).
  Exceptions: stream variant hardcodes `range(3)` independent of `max_iters` (P3
  inconsistency); direct RAG call unbounded time (P2, §17).

## 22. Cancellation/recovery verification

- Durable flag, pre/post checks on all paths, anti-false-cancel (durable-flag
  re-read), cancel-before-start/unknown-run-404, endpoint flow, kill/cancel
  temporal suites green.
- Cooperative limits (no preemption/compensation) + fallback-store resurrection
  hazard (Redis-absent + file-LWW) → P2. No post-cancel NEW effects after next
  check (proven).

## 23. Infrastructure failure verification

- Temporal-client fail-closed, quota/kill-switch, connector retry/classify,
  unavailable-retrieval-never-fabricated (vs error/unavailable taxonomy) green.
  PG-down/Redis-down live chaos, worker-kill live, Temporal-outage 503 proof NOT
  run (no live control plane) → PARTIAL. No success-on-failure found in covered
  paths (FINAL-04 class fixed).

## 24. Observability verification

- `request/correlation/run/workflow/activity` IDs + manifests (strategy,
  fingerprint, budgets, versions) + provider/fallback/approval/retry/terminal
  fields + secret/size validators green incl. history secret-scan (ADV12).
- Log redaction is key-name-only outside ReAct (free-text secret gap, P2);
  `echo=True` SQL logging in local env (P3); single-run live-trace
  reconstruction on LIVE infra not performed → PARTIAL.

## 25. Versioning verification

- Workflow `patched` markers, graph/activity double pin, state-evolution
  validators green on test-server. In-flight mixed-version upgrade, old/new
  worker interop, destructive-migration safety NOT run → UNVERIFIED (live).

## 26. Concurrency verification

- 3-workspace parallel no-leak + perf concurrency lanes green. 4/8/16/50-user
  mixed-tenant runs NOT performed (no harness/infra) → UNVERIFIED. Same-row PG
  race for FINAL-03/04 → UNVERIFIED (documented, §10/§11).

## 27. Performance/load

- In-suite baselines green (loop/retrieval/multistep/tool/depth latencies
  recorded in-test). No SLOs invented. 1→50-user scaling + recovery/queue/DB
  latency under load + production burn-in NOT run → UNVERIFIED (all load
  claims).

## 28. Regression

Fresh runs post-`b589ce2` (serial, `-o addopts=""`):

| Suite                                                     | Result                                 |
| --------------------------------------------------------- | -------------------------------------- |
| approval + idempotency + recheck + FINAL approval (24)    | 24 pass                                |
| temporal/ full dir (87)                                   | 86 pass, 1 pre-existing env fail (§12) |
| temporal approval/cancel/idempotency + FINAL resumes (14) | 14 pass                                |
| muse e2e + react e2e + langgraph e2e (70)                 | 70 pass                                |
| react + langgraph adversarial (29)                        | 29 pass                                |
| memory/KG isolation + service + learning (66)             | 66 pass                                |
| workspaces/tenant/context/react-policy (85)               | 85 pass                                |
| learning-fallback/gate2/closed-loop/scale (25)            | 25 pass                                |
| graph/ full dir (86)                                      | 86 pass                                |
| noauth private (105)                                      | 105 pass                               |
| tenant/sql/xss/prompt-injection security (94)             | 93 pass, 1 stale-test fail (below)     |
| csrf/rate-limit/redteam/privacy (80)                      | 80 pass                                |
| middleware tenant/csrf/rbac (37)                          | 37 pass                                |
| middleware ip/csp/prompt/rate/headers (57)                | 55 pass, 2 stale/env fails (below)     |
| integration + eval + smoke (108)                          | 100 pass, 8 stale-test fails (below)   |
| idempotency-fail-closed + state + db-store + rls-skips    | 7 pass, 4 skip (PG-only)               |
| FINAL new regression (9)                                  | 9 pass                                 |

Failures — ALL reproduced on clean baseline (working tree had zero code edits at
measurement; foreign files untouched), none attributable to this audit's
changes, none fix-requested beyond documentation:

1. `temporal/test_connector_sync` heartbeat — pre-existing environmental (needs
   seeded PG row; fail-closed correct; prior phase §42 agrees).
2. `security/test_tenant_isolation...memories` — stale (setup POST 400s
   fail-closed post-F-03; property covered by
   `test_memory_workspace_isolation`).
3. `middleware/test_ip_filter XFF` — stale (code hardened per FIND-SEC-008; test
   predates; code correct).
4. `middleware/test_security_headers CORS 5173` — local `.env` `ALLOWED_ORIGINS`
   override drift (effective value stricter; P3).
5. `integration/test_memory_api` (6) + `test_workspace_isolation own` (1) —
   stale (no `workspace_id`, 400 fail-closed post-F-03).
6. `integration/test_resume_documents templates==5` — stale pin (registry now
   10).
7. Combined security+middleware run exceeded 10-min timeout once — diagnosed as
   per-test app-boot cost (~3s × 105), not deadlock (§6).

## 29. Skip audit

- `test_rls_isolation` (4), `test_rls_live_*` (PG-gated), Redis/CAS/nonce suites
  (no live Redis), staging suites, `test_security_phase_a` local-PG case — all
  explicit with reasons; none masks a P0 (RLS covered live in §8).
- `test_muse_gate2_resilience` langgraph-unavailable skips; pgvector/SQLite
  skips; OpenAPI-spec-missing skip. No security-critical silent skip found.

## 30. Bypass audit — FINDINGS (non-blocking except via P1s above)

- `execute_tool`: 1 def; internal direct dispatches (search aggregator,
  scrape→websearch) skip wrappers (P2, §9).
- `_assemble_rag_context`: 1 def; 2 production callers (loop + graph node), same
  filtering (safe).
- `consolidate_trajectory`: 1 def; loop + graph callers (safe).
- `save_checkpoint`: 1 def; CAS param dead in prod (P1 CAS-DEAD-01); one
  unawaited `create_task(save_checkpoint)` (lossy, P2).
- `ApprovalManager`: 1 class; dual tables (`agent_approvals` live vs
  `approval_request/scope_claims` revalidation-only) (P2).
- LLM router: singleton-only, clean. Auth: duplicate `require_role`
  (`dependencies` canonical vs `middleware/rbac` dead legacy, zero prod
  importers); `tenant.require_workspace_access` test-only stub, zero prod
  callers (must stay that way — P2 tripwire).
- Memory: `MemoryService` vs `ScaleMemoryService` are parallel tracks, not
  duplicates (safe).

## 31. Phantom audit — FINDINGS

- Default-off Temporal/LangGraph/ReAct → labeled stub/legacy paths (no false
  provenance). Shadow mode must stay non-production (flag-gated, default off).
- `execute_approved_action` phantom fixed (FINAL-04).
- Reachable labeled mock-success (P1 MOCK-SUCCESS-01, §9) + heuristic fallbacks
  (`_mock_jobs`, `_mock_extract`, P2) + billing/SAML stubs (P3).

## 32. Mock/fake audit — FINDINGS

- `PYTEST_CURRENT_TEST`-gated branches strictly test-only (verified with
  opt-outs). `execute_tool` unknown-tool fail-closed (`_execute_mock` error).
- Production-reachable fabrications: see MOCK-SUCCESS-01 (P1). All other hits
  are error-paths, comments, dead code, or safe degradations (§9).

## 33. E2E matrix

173 independent fresh scenarios: 27 muse core (auth→run→retrieval→memory→
learning→injection→isolation→cancel→fallback→budgets→perf) + 43 react/graph
e2e + 29 adversarial + 25 learning/resilience/closed-loop + 40 temporal
productionization/integration + 9 FINAL remediation. Coverage spans §31 items
1–29 except: 50-user load (UNVERIFIED), live-infra failure injection
(UNVERIFIED), cross-workspace resume attack (partially: 404 semantics proven for
cancel; loop-resume P1 remains), budget exhaustion under live concurrency
(UNVERIFIED).

## 34. Trust-invariant matrix

| ID  | Invariant                                    | Verdict                                                              |
| --- | -------------------------------------------- | -------------------------------------------------------------------- |
| I1  | No anonymous privileged execution            | PROVEN                                                               |
| I2  | No cross-tenant access                       | PARTIALLY PROVEN (service proven; DB layer bypassed §8)              |
| I3  | No cross-workspace access                    | PARTIALLY PROVEN (FINAL-01 fixed; KG residual)                       |
| I4  | No AgentCard bypass                          | PARTIALLY PROVEN (exec holds; card-less coverage gap)                |
| I5  | No tool-executor bypass                      | PARTIALLY PROVEN (single def; internal wrapper-skips)                |
| I6  | No approval bypass                           | PARTIALLY PROVEN (FINAL-02/03/04 fixed; live replay race unverified) |
| I7  | No forged approval continuation              | PROVEN                                                               |
| I8  | No duplicate irreversible effect             | PARTIALLY PROVEN (sequential; concurrent P1)                         |
| I9  | No lost durable state                        | PARTIALLY PROVEN (merge; CAS dead P1)                                |
| I10 | No unsafe checkpoint resume                  | PARTIALLY PROVEN (graph rejects; loop adopts P1)                     |
| I11 | No cancellation resurrection                 | PARTIALLY PROVEN (cooperative; fallback hazard P2)                   |
| I12 | No false success after infra failure         | PARTIALLY PROVEN (mock-success P1 remains)                           |
| I13 | No unbounded graph/ReAct execution           | PROVEN                                                               |
| I14 | No topology injection                        | PROVEN                                                               |
| I15 | No budget reset via retry/fallback/resume    | PARTIALLY PROVEN (tracker race P2)                                   |
| I16 | No secret persistence in state/history/trace | PARTIALLY PROVEN (test-server; live history uninspected)             |
| I17 | No production mock/fake execution            | FAILED (bounded: 3 mock-success tools)                               |
| I18 | No phantom capability                        | PARTIALLY PROVEN (labeled defaults; mock P1)                         |
| I19 | No unsafe Temporal→graph bypass              | PROVEN                                                               |
| I20 | No unsafe graph→ReAct bypass                 | PROVEN                                                               |
| I21 | No unsafe ReAct→tool bypass                  | PROVEN                                                               |
| I22 | No tenant/workspace identity mutation        | PROVEN                                                               |
| I23 | No concurrent state contamination            | PARTIALLY PROVEN (3-ws green; 50-user unverified)                    |
| I24 | No version-unsafe durable resume             | PARTIALLY PROVEN (pins green; live upgrade unverified)               |
| I25 | No hidden alternate execution runtime        | PROVEN (9 PROVEN / 15 PARTIAL / 1 FAILED)                            |

## 35. Findings

P0 (all FIXED this audit, §38 evidence in §10/§7):

- FINAL-01 resumes IDOR (live-exploitable pre-fix).
- FINAL-04 temporal approval replay + phantom execution.

P1 REMAINING (release blockers):

| ID              | Finding                                                                                                                                      | Evidence                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| OP-RLS-01       | Runtime DB role (`postgres` via `DATABASE__URL`) has `bypassrls=true`; RLS non-enforcing for all app traffic. 42/71 tables also policy-less. | §8 live catalog; operator-owned                                  |
| AUTH-REV-01     | Token revocation in-process only; multi-worker logout bypass ≤TTL                                                                            | `auth_service.py:150-168`                                        |
| IDEM-RACE-01    | Tool idempotency check-then-act; concurrent duplicate side effects                                                                           | `executor.py:2732-2774,2879-2907`                                |
| IDEM-SCOPE-01   | HTTP idempotency key `(key,path)` lacks tenant/ws scope                                                                                      | `middleware/idempotency.py`, `schema.py:742`                     |
| APP-KG-01       | KG edges/traverse/service writes unscoped (router covers nodes only)                                                                         | `knowledge_graph_service.py`, `routers/knowledge_graph.py:23-46` |
| MOCK-SUCCESS-01 | `web_search`/OneDrive/Notion return success+fabricated data in prod                                                                          | `executor.py:1596-1631,1412,2264`                                |
| LOOP-RESUME-01  | Loop adopts empty/mismatched-ws state; graph rejects (inconsistent)                                                                          | `loop.py:2711-2713` vs `runner.py:374-378`                       |
| CAS-DEAD-01     | Checkpoint CAS never invoked in prod; merge-only concurrency                                                                                 | `state.py:367-437`, zero callers pass `expected_version`         |

P2 (hardening, non-blocking): executor Card fail-open on exception; card-less
coverage; internal dispatch wrapper-skips; unawaited checkpoint task; dual
approval tables; Qdrant tenant filter conditional; retrieval timeout asymmetry;
spend-tracker race + quota double-charge; cancel fallback resurrection; learning
tenant fail-open; `_mark_superseded` tenant-only; documents/apps/ provider-keys
member-404 inconsistency; missing rate limits (most CRUD); `documents`/`memory`
queues without workers; FINAL-03/04 live-race proofs; log redaction key-only;
local SQL echo; `require_workspace_access` stub tripwire; 16/50-user + burn-in +
chaos + upgrade proofs owed. P3 (hygiene): all 8 stale-test/env pins in §28;
resume-compile dead "mock" label; `langgraph` upper-bound float; carried items
below. Carried (still open, unchanged): connector-sync env row, schedules cwd
path, LangGraph-audit memories-400 + ALL_TOOLS pins (per prior phase §42).

## 36. Remediations

`b589ce2` (this audit): FINAL-01 (3 endpoints + helper owner→owner-or-member),
FINAL-02 (list filter + create binding), FINAL-03 (guarded UPDATE + rowcount),
FINAL-04 (atomic consume + truthful contract) + 9 regression tests (all green) +
affected-suite re-runs green (§28). No unrelated files touched; foreign
parallel-session files explicitly excluded.

## 37. Remaining risks

Even after P1 clearance, release should carry: live-PG same-row race proofs,
Qdrant-once-enabled re-audit, learning behavioral-effect proof, RRF caller
wiring (or drop the claim), per-tool schema binding audit for
approval/budget/topology keys, single-run live-trace reconstruction, and a
re-verification pass over the 7 foreign-modified files (§2).

```text
VAELOOM MUSE
FINAL END-TO-END ZERO-TRUST VERIFICATION
=========================================

Baseline:
78d6c54 (audit) + b589ce2 (FINAL-01..04 remediation)

Whole-system production path:
PARTIAL

Authentication:
PASS

Tenant isolation:
PARTIAL

Workspace isolation:
PARTIAL

Database/RLS:
FAIL

AgentCard:
PARTIAL

Tool authorization:
PARTIAL

Approval:
PARTIAL

Idempotency:
PARTIAL

Checkpoint/CAS:
PARTIAL

Cancellation:
PARTIAL

Process recovery:
PARTIAL

Temporal:
PARTIAL

LangGraph:
PARTIAL

ReAct:
PARTIAL

Model routing:
PASS

Cross-provider fallback:
PASS

Memory:
PARTIAL

Retrieval:
PARTIAL

Knowledge graph:
PARTIAL

Learning:
PARTIAL

Budget/quota:
PARTIAL

Prompt/state injection:
PARTIAL

Loop/resource bounds:
PASS

Infrastructure failure:
PARTIAL

Observability:
PARTIAL

Secret protection:
PARTIAL

Versioning:
UNVERIFIED

Concurrency:
PARTIAL

Performance:
PARTIAL

Load:
UNVERIFIED

Regression:
PARTIAL

Bypass audit:
FINDINGS

Phantom audit:
FINDINGS

Mock/fake audit:
FINDINGS

Trust invariants:
9/25 PROVEN, 15/25 PARTIALLY PROVEN, 1/25 FAILED

Independent E2E:
173

P0:
0

P1:
8

P2:
24

P3:
11

Release blockers:
OP-RLS-01, AUTH-REV-01, IDEM-RACE-01, IDEM-SCOPE-01, APP-KG-01, MOCK-SUCCESS-01, LOOP-RESUME-01, CAS-DEAD-01

Remaining unverified claims:
live-PG same-row approval/consume races; 16/50-user mixed-tenant load; production burn-in; live-infra failure injection; in-flight version upgrade; Qdrant-enabled isolation; learning behavioral effect; RRF hybrid ranking; card-less agent coverage; per-tool approval/budget/topology binding audit; live-trace reconstruction; foreign-file re-verification

Remaining non-blocking risks:
P2/P3 items in §35 (spend atomicity, cancel fallback resurrection, missing rate limits, worker-less queues, log redaction scope, stale pins)

FINAL VERDICT:
NOT RELEASE VERIFIED
```
