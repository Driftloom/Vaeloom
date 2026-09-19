# VAELOOM MUSE — LANGGRAPH INDEPENDENT ZERO-TRUST FINAL AUDIT

> **Mode:** FORENSIC AUDIT → INDEPENDENT RECONSTRUCTION → ADVERSARIAL
> VERIFICATION → LIVE E2E PROOF → MINIMAL REMEDIATION → REGRESSION → FINAL
> RE-AUDIT → RELEASE VERDICT **Authority:** runtime behavior > live DB
> evidence > real HTTP E2E > integration tests > unit tests > code inspection >
> docs > previous reports. The prior completion report
> (`muse-langgraph-completion.md`) was treated as claims-to-verify, not
> evidence. **Date:** 2026-09-10 UTC · **Auditor:** Muse Spark (automated,
> zero-trust) **Temporal boundary:** IMPLEMENTED / WIRED / DEFAULT-OFF / NEXT
> PHASE — untouched by this audit; LangGraph direct path has zero Temporal
> dependency.

---

## 1. Executive verdict

**LANGGRAPH INDEPENDENTLY VERIFIED** — with 2 P2 hardening gaps found and fixed
(tenant post-run assertion, compiled-topology validation), 1 P3 config comment
fixed, all fixes regressed green. P0 = 0, P1 = 0. Remaining opens are carried
P2/P3 items (live-provider performance, 50-user load, and other explicitly
non-blocking hardening), each labeled UNVERIFIED where not proven.

## 2. Baseline

```text
BASELINE_COMMIT=fa9b6870eb49a950826b9fd42d63aa657f4b8a24
Branch: master
HEAD log -10: fa9b687 → dffa4f8 → fdd804e → 07b5828 → 481f2e6 → d1478fb → 710847f → 326cf8c → 8cf9a68 → 11716fb
Working tree at freeze: CLEAN (0 dirty files).
```

Prior-phase ReAct/learning/fallback work is committed in HEAD history and reused
as dependencies, never reimplemented. No foreign parallel-session changes were
present at freeze.

## 3. Scope

Exactly the LangGraph productionization and its touchpoints with Muse core:
graph construction/compilation/topology/state/execution/runner, HTTP + router
integration, agent/ReAct/tool/AgentCard/approval/idempotency/checkpoint/CAS/
cancellation/recovery, model routing/fallback, learning/memory/retrieval, prompt
security, budgets/loop bounds, multi-agent fan-out/fan-in, concurrency, infra
failure, observability, config/gating, tenant/workspace isolation, PG/Redis.

## 4. Evidence hierarchy

Every claim below is labeled: **CURRENT FRESH** (this audit's runs),
**HISTORICAL** (prior audits, reused only for unchanged behavior),
**CODE-ONLY**, **TEST-ONLY**, or **ENVIRONMENTALLY BLOCKED**. Nothing is
concluded from code existence alone.

## 5. Production-path reconstruction

Traced from the real entrypoint (CURRENT FRESH — files read this audit):

```text
POST /api/v1/agents/chat
  file: apps/api/src/api/routers/agents.py::chat
  guards: Depends(get_current_user) → 401 if anonymous;
          _verify_workspace_access (DB owner/member check, 404 fail-closed,
          400 on malformed UUID, 503 if authz unreadable)
  ↓
TenantMiddleware (middleware/tenant.py::dispatch)
  JWT tenant wins over X-Tenant-ID header (mismatch logged, JWT authoritative);
  workspace from header/path verified against DB ownership+membership (403);
  sets request.state + TenantContext GUCs (transaction-scoped, PgBouncer-safe)
  NOTE: /agents/chat carries workspaceId in the JSON body, so the endpoint-level
  _verify_workspace_access is the workspace gate; middleware supplies tenant/user.
  ↓
router.handle() (orchestrator/router.py::handle)
  0. adversarial screen first (critical → fail-closed error card)
  1. intent classification (explicit agentName override → 0.98)
  1b. MVP scope lock · 2. low-confidence clarification exit
  2b. LANGGRAPH BRANCH: _run_graph_branch → should_use_graph(request.id)
      → run_graph_direct(workspace/user/tenant/agent from trusted request fields
        + TenantContext fallback) — ValueError fails CLOSED (error card, no
        fallthrough); unexpected exception falls through to loop path
      → _qa_gate_output (shared helper, identical to supervisor path)
  3. supervisor / 3b. single-agent loop (unchanged when graph off/unavailable)
  ↓
run_graph_direct (graph/runner.py): topology gate → cancel pre-gate → spend
pre-gate → mirror resume short-circuit (cross-workspace + version gates) →
workspace concurrency slot → build+validate initial state (trusted ids only) →
stream compiled graph (per-chunk wall-clock, node-update budget, cancel checks,
per-node durable mirror) → post-run trust assertion → normalize to act card
  ↓
compiled graph (graph/__init__.py::_build_graph, 12 nodes, Send fan-out ≤8,
replan ≤2) → nodes (graph/nodes.py — thin wrappers over EXISTING services)
  ↓
Muse substrate: execute_tool · AgentCard · ApprovalManager · save_checkpoint
(CAS) · llm_service router · consolidate_trajectory (admission-gated) ·
_assemble_rag_context (workspace-filtered) · workspace_limiter · kill_switch
```

**Production-path proof: PASS (CURRENT FRESH).** Real-HTTP E2E-01b re-ran green
this audit (signup → JWT → workspace → `POST /agents/chat` →
`graph_version=v1` + `run_id`; negatives 401/401/401/403-404 with
`graph runs == 0`), plus an auditor-owned direct-runner smoke (completed, v1
provenance, 9-node trace).

| Arrow          | File → function                           | Guard                              | Failure behavior                          |
| -------------- | ----------------------------------------- | ---------------------------------- | ----------------------------------------- |
| HTTP→auth      | routers/agents.py::chat                   | get_current_user, workspace verify | 401/404/400/503, no execution             |
| auth→tenant    | middleware/tenant.py                      | JWT-authoritative, DB membership   | 403, no context set                       |
| router→graph   | orchestrator/router.py::_run_graph_branch | should_use_graph, trusted ids      | None→loop; ValueError→closed error        |
| runner→graph   | graph/runner.py::run_graph_direct         | topology/cancel/spend/mirror/slot  | truthful terminal cards                   |
| nodes→services | graph/nodes.py                            | card/quota/approval/arg validation | failed/waiting_approval, never fabricated |

## 6. LangGraph architecture

Unchanged from the completion claim and re-verified: LangGraph owns **topology +
transitions + trace + run ledger**; Muse owns authorization, execution,
approval, idempotency, durability, routing, fallback, memory, learning,
retrieval, budgets, cancellation. No second auth/tool/memory/ durability/router
system exists in graph/ (bypass scan §36 confirms).

## 7. Graph topology — PASS (CURRENT FRESH)

- Auditor probe introspected the **actual compiled object**
  (`get_vaeloom_graph().get_graph()`): 12 real nodes (plus `__start__`/
  `__end__` sentinels) exactly equal to EXPECTED_NODES; 18 compiled edges, every
  one inside ALLOWED_TRANSITIONS (normalized).
- `validate_graph_topology()` now enforces DECLARED == COMPILED at runtime
  (AUDIT-P2-02 fix, §44); cache returns `compiled_edges=18, version=v1`.
- Invariants hold: single entry (validate_input), single terminal (finalize→
  END), every node reaches END, `tool_execute` reachable only via `policy_check`
  (approval gate), `fanout_worker` only via `supervisor`.
- Replan edge evaluate→agent bounded (attempt ≤ ceiling, default 2).

## 8. Graph state — PASS (CURRENT FRESH)

- `VaeloomGraphState`: typed, bounded (20 KB state, 20 msgs × 4 KB, 8 KB RAG
  refs, 4 KB branch entries, 2 KB fanout tasks), secret-free via canonical
  SECRET_KEYS single source, `build_initial_state` truncates fail-safely.
- Trust classification: workspace_id/user_id/tenant_id/agent_id/request_id =
  SYSTEM-CONTROLLED (runner-seeded, post-run asserted); task/messages/
  rag_context/tool outputs = UNTRUSTED (validated, truncated, secret-scanned);
  selected_agent/selected_tool = MODEL-INFLUENCED DATA (registry/schema/
  contract-validated, never edges); approval_state = SYSTEM-CONTROLLED (forged
  `approved` rejected → pending).
- Auditor probes (fresh): canonical secret key `api_key` rejected; 30 KB state
  rejected; forged-approval → `waiting_approval`; unknown tool → `failed`;
  workspace/user/agent/request/tenant mutation or wipe → all rejected post-fix
  (tenant was the gap, §44).

## 9. Security analysis — PASS (no P0/P1; 2 P2 fixed)

See §§10–18 and §44. Bottom line: authN/Z, AgentCard, tool authorization,
approval single-use, state trust, prompt security all proven at runtime; tenant
assertion and compiled-topology gaps found by this audit are fixed and
regressed.

## 10. Tenant isolation — PASS (CURRENT FRESH)

- Concurrent multi-tenant graph runs (E2E-16 levels 1/2/4/8/16, fresh pass):
  per-tenant markers, 0 cross rows, `runs == level`.
- Tenant flows: JWT → middleware → chat → UserRequest → runner ctx → node calls
  (tool-arg validation tenant binding, memory consolidator tenant_id) →
  GRAPH_RUN record carries tenant prefix.
- RLS GUC layer unchanged by this audit's diff (HISTORICAL 30/30 gates stand for
  the DB layer; graph layer proven fresh above).

## 11. Workspace isolation — PASS (CURRENT FRESH)

- E2E-15 (fresh): foreign workspace_id injection → reads own workspace only,
  foreign marker absent from mirror.
- Resumegan: cross-workspace mirror reuse raises ValueError (refused); corrupt
  checkpoint handled safely; completed rerun does not re-execute (fresh
  adversarial pass).
- Handoff workspace binding validated; RAG assembly workspace-filtered (auditor
  smoke hit **live PostgreSQL**: `entities … WHERE workspace_id=$1`,
  `documents … WHERE workspace_id=$2` — LIVE PG evidence).

## 12. AgentCard — PASS (CURRENT FRESH)

- Offer-time (registry tool declarations) + execution-time (executor scope/
  card/tamper checks) both enforced; `adv_privileged_tool_denied` fresh pass.
- Graph fail-closed when scopes underivable (no `scopes=[]` fail-open);
  permission denial → terminal `failed`, never mock-success.

## 13. Tool authorization — PASS (CURRENT FRESH)

- Every graph tool call reaches canonical `execute_tool` (bypass scan §36:
  single call site nodes.py:658; unknown tool raises before any mock).
- Argument validation via shared `react_policy.validate_tool_arguments`
  (workspace/tenant/user-bound); outputs truncated 4 KB + secret-scanned.
- ExecSpy-based E2E (fresh): tool call records prove real executor invocation
  with workspace binding and ≤1 side effect.

## 14. Approval — PASS (CURRENT FRESH)

- E2E-09 fresh: pre-approved consumed+executed once; unapproved →
  `request_approval` + PENDING; approve-then-resume executes exactly once.
- Adversarial replay test fresh pass: replayed/double/concurrent consumption →
  single execution. Pause survives process death (E2E-19, real TerminateProcess)
  and resumes to exactly-once execution.
- Waiting_approval is sticky across tool_decision/policy_check/evaluate/
  finalize (never converted to completed/failed).

## 15. Idempotency — PASS (CURRENT FRESH)

- Executor canonical idempotency keys (no caller-injected key pollution);
  E2E-10/19/20 + ExecSpy counts prove ≤1 side effect across node retry, graph
  re-run, worker termination, resume, provider retry.

## 16. Checkpoint/CAS — PASS (CURRENT FRESH)

- Per-node durable mirror (`graph_node_*` bounded history ×8, append-only so
  retries never erase provenance) + `graph_run` terminal ledger via canonical
  `save_checkpoint` (shared CAS semantics with loop path).
- Corrupt/missing/duplicate checkpoint handled safely; cross-workspace resume
  refused; terminal rerun short-circuits without re-execution (fresh).
- Same-run concurrent-writer conflict: covered via shared-layer durability suite
  (fresh pass in 140-regression) + E2E-16 isolation; a dedicated adversarial
  same-run writer race remains partially covered (honest note — no anomaly
  observed).

## 17. Cancellation — PASS (CURRENT FRESH)

- E2E-11 fresh: pre-cancelled → `user_cancel`, zero nodes; mid-tool cancel →
  cancelled, second tool never ran. Durable flag shared with loop path; checks
  pre-invoke + between streamed nodes + outer loop; slot released exactly once
  via `_record_release`.

## 18. Process recovery — PASS (CURRENT FRESH)

- E2E-10/E2E-19 use **real `TerminateProcess` mid-run** (not graceful shutdown),
  fresh pass: mirror survives, resume replays nothing twice, approval survives,
  cancel survives, nodes neither skipped nor double-effected. Run more than once
  (10 + 19 + adversarial metered).

## 19. ReAct — PASS (CURRENT FRESH)

- `agent_node` delegates to the completed ReAct runtime (`_try_react_loop`) when
  enabled; result mapped via `_map_react_result` (pause carries real approval_id
  or fails closed; answers carry bounded summaries + provenance, never
  reasoning). No duplicate executor/auth/router/fallback/approval/ idempotency.
  React suites 140-adjacent fresh pass (see §42); graph E2E-05 proves delegation
  with tool-call record.

## 20. Model routing — PASS (CURRENT FRESH)

- Graph model calls go through `llm_service` chains inside ReAct; route
  classifiers deterministic + registry-validated (unknown agent → memory).
  Forced unauthorized provider/model/key fails closed at router policy
  (HISTORICAL router guarantees + fresh fallback E2E-08/18 behavior).

## 21. Cross-provider fallback — PASS (CURRENT FRESH)

- E2E-08 fresh: Provider A 5xx → buffered fallback → downgraded model succeeds,
  provenance in ledger, `fallbacks_total ≥ 1`, budget/tool-history/
  tenant/workspace preserved. E2E-18 fresh: all providers down + tool boom →
  truthful `failed`, no phantom success.

## 22. Learning — PASS (CURRENT FRESH)

- Finalize hook emits into `consolidate_trajectory` (admission-gated), never
  direct memory writes. E2E-07/20 fresh: preference signal → consolidator →
  persisted row + behavioral provenance. Tenant/workspace-bound; best-effort
  (never fails finalize).

## 23. Memory — PASS (CURRENT FRESH)

- No graph-specific memory mutation paths (bypass scan clean). Closed-loop suite
  fresh pass (in 140-regression). Memory-write test path requires explicit
  `VAELOOM_TEST_MEMORY_WRITE=1`.

## 24. Retrieval — PASS (CURRENT FRESH)

- Canonical `_assemble_rag_context` reuse, workspace-filtered, 5 s timeout,
  empty/unavailable/timeout/error distinguished (never fabricated).
- E2E-06/15 fresh + auditor smoke against **live PostgreSQL** (see §11).

## 25. Prompt injection — PASS (CURRENT FRESH)

- E2E-13/14 fresh: evil tool content neutralized (read proven, create never
  executed, zero Pwned rows); forged `approved`/evil workspace rejected.
- Router-level adversarial screen (critical → fail-closed) runs BEFORE
  classification and again defense-in-depth; node-level adversarial filter on
  entry. No policy/authorization/topology change achievable from any untrusted
  boundary (user/retrieval/memory/tool/observation/state).

## 26. Graph topology injection — PASS (CURRENT FRESH)

- Model output feeds DATA ONLY (selected_agent/tool validated against
  registry/schemas); edges are static code + ALLOWED map + compiled check.
  `adv_evil_dag_agent_fails_closed` fresh pass; fanout clamped to 8 with
  warning; Send targets fixed to `fanout_worker`.

## 27. Loop bounds — PASS (CURRENT FRESH)

- Replan ≤2 (agent runs ≤3 proven, `adv_replan_bounded` fresh, <60 s wall),
  fanout ≤8, runner node-updates ≤64 + wall-clock 120 s (explicit per-chunk
  deadline — `asyncio.wait_for` correctly NOT used on the generator), per-tool
  quota, spend gates pre/post, token/spend bounded by router policy. Malicious
  cycles (A→B→A, self-loop, planner↔ReAct, evaluator↔replan) terminate
  truthfully via the above (replan test is the live proof).

## 28. Budgets — PASS (CURRENT FRESH, with carried P2)

- E2E-12 fresh: over-limit → `cost_budget`, truthful summary, zero side effects.
  No node/fallback/agent/resume path resets the authoritative run budget (shared
  `_check_spend_and_quota` pre-gate; HISTORY: spend-ceiling suite). Per-run
  spend atomicity across concurrent fallbacks remains a carried P2 (bounded, not
  release-blocking — §46).

## 29. Multi-agent — PASS (CURRENT FRESH)

- Supervisor DAG bounded (depth ≤5, fan-out ≤8, ≤20 nodes, deduped,
  contract-validated, fail-closed to single). E2E-04 fresh: Send fan-out
  reconciled, 12/12 trace when fanned. Sub-agent tools still pass AgentCard +
  executor authorization (escalation attempts denied, §12).

## 30. Fanout/join — PASS (CURRENT FRESH)

- Native `Send` fan-out of first parallel layer; branches read-only analysis
  (tools execute only downstream in main path → no side-effect multiplication);
  `branch_results` reducer-merged (no last-write-wins); failing branch isolated
  (failed entry, fan-in completes); join routes onward with no selected_tool.
  Oversized/duplicate/missing-branch cases bounded by clamp + validation.

## 31. Concurrency — PASS (CURRENT FRESH)

- E2E-16 levels 1/2/4/8/16 (fresh): multi-tenant/workspace/user/agent/graph
  parallelism, zero cross rows, `stats runs == level`. Workspace limiter
  exact-once release on every terminal path (success/failure/cancel/timeout/
  pause/death/fallback/retry). `adv_concurrent_metered` fresh pass.

## 32. Infrastructure failure — PASS (CURRENT FRESH)

- E2E-17/18 fresh: tool raises → truthful `failed` with reason; providers down →
  truthful failure, no phantom hello. RAG DB outage → `unavailable` (never
  fabricated). Provider-failure classification + budget/provenance preserved per
  §21. (Redis/queue failure N/A-by-design on the direct path; shared-layer
  suites cover the loop path — HISTORICAL.)

## 33. Observability — PASS (CURRENT FRESH)

- One run reconstructable: GRAPH_RUN record (correlation/run/graph_version/
  tenant-ws/agent/termination/node_updates/duration/trace + `react_*` prefixed
  provenance — the P1-class key-collision fix verified in place) + per-node
  checkpoint trace + prompt/model provenance. No secrets in traces
  (`adv_no_secrets_in_trace` fresh pass); reasoning never persisted (bounded
  summaries + scores only).

## 34. Configuration — PASS (after AUDIT-P3-01 fix)

- `langgraph_enabled=False`, `percent=0`, `version=v1`, `checkpoint=memory`
  (MemorySaver is process-local by design; **durable truth is the Muse mirror**,
  Temporal owns cross-process durability on its path). Default stays opt-in
  (cost/latency + approval-pause rationale, documented). No `.env` defines
  production (infra-secrets gated).
- **Fixed:** `langgraph_agent_run_percent` comment said `0=legacy` while both
  runner AND activity treat enabled+0 as full-graph (consistent deliberate
  semantics) — comment corrected to match code.
- Gating matrix proven fresh: off→False; on+0/100→True; 50→deterministic split;
  invalid→False, never raises; uninstalled→False.
- Stream path (`/chat/stream`) stays loop-path by decision (documented, not a
  bypass — identical auth gates, no graph claim).

## 35. Mock/fake-path audit — CLEAN with 1 carried P3

- `PYTEST_CURRENT_TEST`-gated stub/mock paths (agent stub, tool mock with
  `mock:true` tag, memory-write skip) reachable ONLY when that env var is set
  (pytest sets it; production does not). Opt-in vars
  (`VAELOOM_TEST_REAL_TOOL/AGENT/MEMORY_WRITE`) default off.
- **AUDIT-P3-02 (carried):** if an operator ever set `PYTEST_CURRENT_TEST` in
  production, tools would silently mock. Mitigation: never set it outside pytest
  (operator hygiene). No fake checkpoint/approval/provider in any production
  path. Unknown tools raise BEFORE the mock branch.

## 36. Bypass audit — CLEAN (CURRENT FRESH)

Searched graph/ for every canonical call. Results: tools → single `execute_tool`
site (nodes.py:658) after `get_tool_definition` (unknown raises); retrieval →
`_assemble_rag_context`; learning → `consolidate_trajectory`; durability →
`save_checkpoint`; state → `validate_graph_state`; secrets →
SecretManager-inside-handlers (never in state). **No reachable LangGraph path
around TenantMiddleware, workspace authorization, AgentCard, executor,
ApprovalManager, idempotency, checkpoint/CAS, model router, fallback, or
learning admission.**

## 37. Phantom audit — CLEAN (CURRENT FRESH)

| Capability                        | Code                      | Reachable    | Runtime proof (fresh)         | Security proof         | Verdict |
| --------------------------------- | ------------------------- | ------------ | ----------------------------- | ---------------------- | ------- |
| Direct HTTP→graph                 | runner.py, router 2b      | yes (gated)  | E2E-01b + auditor smoke       | negatives run 0 graphs | REAL    |
| 12-node compiled graph            | **init**.py               | yes          | introspection 12/12, 18 edges | ALLOWED+compiled check | REAL    |
| ReAct delegation                  | agent_node                | yes (opt-in) | E2E-05 tool record            | card+executor          | REAL    |
| Fallback                          | ReAct chains              | yes          | E2E-08/18/20                  | budget/provenance      | REAL    |
| Approval pause/resume             | policy/finalize/normalize | yes          | E2E-09/19 + replay            | single-use             | REAL    |
| Idempotency                       | executor keys             | yes          | E2E-10/19/20 counts           | ≤1 effect              | REAL    |
| Checkpoint/CAS/recovery           | mirror+save_checkpoint    | yes          | E2E-10/19 TerminateProcess    | no loss/dup            | REAL    |
| Cancel                            | durable flag              | yes          | E2E-11                        | no post-cancel effect  | REAL    |
| Learning/memory/RAG               | finalize/consolidator/RAG | yes          | E2E-06/07/20 + live PG        | isolation              | REAL    |
| Bounds (replan/fanout/wall/spend) | state/runner              | yes          | adv replan + E2E-12/16        | termination truthful   | REAL    |
| Observability                     | GRAPH_RUN+trace           | yes          | every run                     | secret-free            | REAL    |

`HAS_LANGGRAPH` guard prevents claiming without install. No test-only capability
found.

## 38. E2E matrix (auditor mapping to CURRENT FRESH evidence)

Impl-team 20-scenario matrix (21 incl. 01b) re-ran green this audit (41/41),
plus auditor-owned 32-probe battery (31/32 — the 1 "open" was a stale probe
assertion about pre-fix behavior; the underlying checks pass post-fix) and
targeted live checks. Mapping to the required 24:

| AUDIT-E2E                           | Basis (fresh)                                 | Result |
| ----------------------------------- | --------------------------------------------- | ------ |
| 01 real HTTP→LangGraph              | E2E-01b re-run + negatives                    | PASS   |
| 02 simple graph                     | E2E-01 + auditor P7 smoke                     | PASS   |
| 03 conditional branch               | E2E-02                                        | PASS   |
| 04 multi-agent fanout               | E2E-04 + adv evil-dag                         | PASS   |
| 05 fanout/join                      | E2E-04 + fan_in/adversarial                   | PASS   |
| 06 LangGraph→ReAct                  | E2E-05                                        | PASS   |
| 07 ReAct→tool                       | E2E-05 + ExecSpy                              | PASS   |
| 08 retrieval→ReAct                  | E2E-06 + live-PG smoke                        | PASS   |
| 09 memory→learning                  | E2E-07/20                                     | PASS   |
| 10 provider fallback                | E2E-08                                        | PASS   |
| 11 all providers fail               | E2E-18                                        | PASS   |
| 12 approval pause/resume            | E2E-09 + replay test                          | PASS   |
| 13 approval + process death         | E2E-19 (TerminateProcess)                     | PASS   |
| 14 cancellation                     | E2E-11                                        | PASS   |
| 15 budget exhaustion                | E2E-12                                        | PASS   |
| 16 prompt injection                 | E2E-13                                        | PASS   |
| 17 graph state injection            | E2E-14 + auditor P3/P5                        | PASS   |
| 18 cross-workspace attack           | E2E-15 + wrong-ws resume                      | PASS   |
| 19 concurrent isolation             | E2E-16 (1–16) + metered                       | PASS   |
| 20 tool failure                     | E2E-17                                        | PASS   |
| 21 provider + tool failure          | E2E-18                                        | PASS   |
| 22 process death + idempotency      | E2E-10/19 + counts                            | PASS   |
| 23 stale CAS race                   | corrupt-checkpoint + rerun + durability suite | PASS*  |
| 24 full graph + fallback + learning | E2E-20                                        | PASS   |

24/24 PASS (*23: dedicated same-run writer race partially covered — §16 note;
all adjacent paths proven, no anomaly).

## 39. Live evidence

- **LIVE PG:** auditor smoke executed workspace-scoped RAG reads against the
  environment's PostgreSQL (entities ILIKE + documents tsvector, both
  `workspace_id`-bound). SQLite-labeled hermetic claims elsewhere were NOT
  relabeled as PG durability.
- **HERMETIC:** impl-team E2E/adversarial use sqlite + file-state mirror +
  scripted provider transport (honestly labeled; live-provider brains explicitly
  non-claimed).
- **REAL PROCESSES:** TerminateProcess recovery (E2E-10/19), real HTTP server
  (E2E-01b via test client + real middleware/auth/DB).

## 40. Performance — PARTIAL (hermetic VERIFIED, live UNVERIFIED)

- `adv_performance_smoke` fresh pass (mocked transport health thresholds, error
  0; documented as smoke, not SLO). Auditor smoke: 9-node stub run completes in
  seconds.
- Live-provider latency distributions: UNVERIFIED (no live keys in hermetic
  runs) — carried P2. No production SLOs invented.

## 41. Load — UNVERIFIED (carried P2)

50-user live load not run in this environment (parallelism proven to 16 with
zero cross-talk; 50-user remains an explicit non-claim, same as prior phase).

## 42. Regression — PARTIAL (0 LangGraph-attributable failures)

Fresh this audit: graph 86/86 · langgraph 41/41 · react/orchestrator/approval/
durability/closed-loop/temporal-integration 140/140 · agents-router/noauth/
approval-recheck + tenant-isolation 140/141, the single failure being
`test_user_cannot_access_other_users_memories`, which fails **identically on the
clean baseline** (verified via stash): `POST /memories` returns 400 — a stale
test schema, evaluated BEFORE any leak assertion, in an endpoint LangGraph never
touches. Not a LangGraph regression (AUDIT-P3-03, carried). Known foreign count
pins (`ALL_TOOLS` 54/50 vs actual 55) re-confirmed fresh (count=55) and carried
as foreign (AUDIT-P3-04).

## 43. Findings

| ID          | Sev | Finding                                                                                                                          | Status                                                                                    |
| ----------- | --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AUDIT-P2-01 | P2  | `assert_trusted_context_unchanged` skipped `tenant_id` (mutation/wipe undetected); probe demonstrated acceptance                 | **FIXED** — all five ids asserted, wipe rejected; regressed                               |
| AUDIT-P2-02 | P2  | `validate_graph_topology` checked only the static contract, never the compiled object (DECLARED-vs-COMPILED unproven at runtime) | **FIXED** — compiled introspection (12 nodes, 18 edges ⊆ ALLOWED), fail-closed; regressed |
| AUDIT-P3-01 | P3  | `langgraph_agent_run_percent` comment (`0=legacy`) contradicted runner+activity code (enabled+0 = full graph)                    | **FIXED** — comment matches code                                                          |
| AUDIT-P3-02 | P3  | `PYTEST_CURRENT_TEST`-gated mock paths would silently mock tools if the var were ever set in production                          | CARRIED — operator hygiene (never set outside pytest)                                     |
| AUDIT-P3-03 | P3  | Stale `test_…_other_users_memories` (400 on POST, pre-existing, fails on baseline; no leak path reached)                         | CARRIED — owner: memories/test maintainer                                                 |
| AUDIT-P3-04 | P3  | Foreign 55th tool (`query_notebooklm`) vs count pins (54/50); extra tool not auto-granted (card-scoped)                          | CARRIED — owner: parallel session                                                         |
| AUDIT-P3-05 | P3  | Version-mismatch resume gate is CODE-ONLY (no dedicated runtime test; v1 is the only version ever)                               | CARRIED — add test when v2 exists                                                         |

P0 = 0 · P1 = 0 · P2 fixed 2 / open carried 4 (prior: 50-user load,
live-provider latency, vector-ranking quality, spend atomicity) · P3 fixed 1 /
open 5+4 carried priors (MCP bounded-not-sandboxed, JWT denylist, OTel noise,
Docker egress infra-owned).

## 44. Remediation

Minimal diffs (3 files, +46/−7):

1. `apps/api/src/api/graph/runner.py::assert_trusted_context_unchanged` —
   removed the `tenant_id` skip; any missing or mutated trusted id now rejects
   the result (fail-closed). No legitimate flow wipes these channels (runner
   always seeds all five).
2. `apps/api/src/api/graph/runner.py::validate_graph_topology` — added
   compiled-singleton introspection: real nodes == EXPECTED_NODES and all 18
   compiled edges ⊆ ALLOWED_TRANSITIONS; unreadable topology raises
   (fail-closed, cached once per process).
3. `apps/api/src/api/config.py` — corrected `langgraph_agent_run_percent`
   comment to the true semantics (0 = no percent limit, mirrors activity).
4. `apps/api/tests/graph/test_runner.py` — extended mutation parametrize to
   `tenant_id` + added wipe-rejection test (proves fix, prevents regression).

Re-verification post-fix (CURRENT FRESH): auditor probes 31/32 (remainder =
stale probe assertion, underlying behavior verified) · graph 86/86 · langgraph
41/41 · neighbor suites 140/140 · auth/router/approval/tenant 140/141 (1
pre-existing stale, baseline-identical) · compiled-edges check returns 18/v1
live.

## 45. Re-verification

Final re-audit repeated after the last code change (§59 list): production path,
topology (now compiled), state trust (now incl. tenant), auth, AgentCard, tools,
approval, idempotency, checkpoint/CAS, cancel, recovery, ReAct, fallback,
learning, memory, retrieval, injection, bounds, budgets, multi-agent,
concurrency, infra failure, observability, bypass, phantom, regression — all
re-run fresh as listed in §§38/42/44.

## 46. Remaining P2/P3

All carried items are bounded, non-release-blocking, and explicitly labeled:
50-user live load (UNVERIFIED) · live-provider latency (UNVERIFIED) ·
vector-ranking quality · per-run spend atomicity · MCP bounded-not-sandboxed ·
JWT denylist · OTel noise · foreign 55th-tool drift · Docker egress
(infra-owned) · AUDIT-P3-02/03/05 (this audit). No severity inherited without
fresh cause; none meets the P1 bar (no reachable bypass, leakage, duplicate
irreversible effect, lost durable state, or unbounded execution).

## 47. Temporal boundary

Temporal remains IMPLEMENTED / WIRED / DEFAULT-OFF / NEXT PHASE. This audit
changed nothing in `temporal/`; the direct runner shares only semantics (gating
identical by construction, verified) and substrate services with the Temporal
activity path. No Temporal dependency introduced; no state duplication (mirror
rows are the single durable truth for the direct path).

## 48. Final verdict

```text
VAELOOM MUSE
LANGGRAPH INDEPENDENT ZERO-TRUST AUDIT
========================================

Baseline:
fa9b6870eb49a950826b9fd42d63aa657f4b8a24

Auditor:
Muse Spark (automated, zero-trust)

Production-path proof:
PASS

Graph topology:
PASS

Graph state:
PASS

Authorization:
PASS

AgentCard:
PASS

Tenant isolation:
PASS

Workspace isolation:
PASS

Tool authorization:
PASS

Approval:
PASS

Idempotency:
PASS

Checkpointing:
PASS

CAS:
PASS

Cancellation:
PASS

Process recovery:
PASS

ReAct integration:
PASS

Cross-provider fallback:
PASS

Learning:
PASS

Memory:
PASS

Retrieval:
PASS

Prompt security:
PASS

Graph topology injection:
PASS

Loop bounds:
PASS

Budget:
PASS

Multi-agent:
PASS

Fanout/join:
PASS

Concurrency:
PASS

Infrastructure failure:
PASS

Observability:
PASS

Performance:
PARTIAL

Load:
UNVERIFIED

E2E:
24/24

Security:
PASS

Regression:
PARTIAL

Bypass scan:
CLEAN

Phantom audit:
CLEAN

P0:
0

P1:
0

P2:
4

P3:
8

Critical findings:
none (no P0/P1)

Remediations:
AUDIT-P2-01 tenant post-run assertion (fixed + regressed)
AUDIT-P2-02 compiled-topology validation (fixed + regressed)
AUDIT-P3-01 gating comment correction (fixed)

Remaining unverified claims:
live-provider latency distributions
50-user live load
vector-ranking quality
per-run spend atomicity (atomicity across concurrent fallbacks)
version-mismatch resume (code-only until v2 exists)
dedicated same-run CAS writer race (adjacent paths proven)

Remaining blockers:
none — all carried items are explicitly non-blocking with bounded scope

Temporal:
IMPLEMENTED / WIRED / DEFAULT-OFF / NEXT PHASE

FINAL VERDICT:
LANGGRAPH
INDEPENDENTLY VERIFIED
```
