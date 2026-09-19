# Muse ReAct Productionization + Full E2E Closure — Zero-Trust Audit

> **Mode:** FORENSIC AUDIT → HARDEN → PROVE E2E → REGRESS → VERDICT
> **Authority:** Runtime truth > code inspection > tests > documentation >
> previous reports **Phase rule:** LangGraph / Temporal stay UNIMPLEMENTED. No
> new parallel runtime. **Date:** 2026-09-09 UTC **Auditor:** Muse Spark
> (automated, zero-trust)

---

## 1. Baseline (fresh, this phase)

```text
BASELINE_COMMIT=d4e1b23f67d8162f15d87bf125f1acdc35c406c5  (same as closed learning/fallback baseline)
Branch: master
HEAD log -10: d4e1b23 → 205f209 → c8d7eb3 → 301fd6b → aaa6e49 → 9025e43 → 2044cec → c5580bc (+2)
```

Working-tree delta at freeze: prior-phase learning/fallback work (uncommitted,
§2 lineage)

- parallel-session benign work (profile feature: `routers/profile.py`,
  `services/profile_service.py`, web profile pages,
  `config.profile_avatar_max_bytes`, `main.py` mount, conftest mounts; 0029
  migration rewritten to idempotent raw-SQL). Foreign files are NOT this phase's
  scope and were not modified by this phase.

Lineage: learning/fallback phase CLOSED
(`docs/Audits/muse-learning-fallback-completion.md`): Learning COMPLETE,
fallback COMPLETE, P0=0, P1=0. This phase reuses both as integrated dependencies
(no re-implementation).

All evidence below is **CURRENT FRESH EVIDENCE** unless marked **HISTORICAL**.

---

## 2. CURRENT REACT PATH (fresh trace, pre-implementation + deltas)

Entry: `POST /api/v1/agents/chat` (`routers/agents.py::chat`) →
`_verify_workspace_access` → `router.handle()` → `run_agent_loop` /
`run_agent_loop_stream` (`orchestrator/loop.py`) → `act_phase` →
`_act_phase_inner` → `_try_react_loop` (iff `settings.agent_react_enabled`, LLM
key present, message ≥3 chars). `None` return → static dispatch (deliberate
best-effort ladder, now observed per §5).

| #   | Question                       | Answer (source ref)                                                                                                                                                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Where does ReAct enter?        | `loop.py:_act_phase_inner` → `_try_react_loop` (act_path only)                                                                                                                                               |
| 2   | Which API reaches it?          | `POST /agents/chat`, `POST /agents/chat/stream` (both loop variants)                                                                                                                                         |
| 3   | Which orchestrator invokes it? | 5-phase loop (`run_agent_loop`/`run_agent_loop_stream`); supervisor delegates to same loop                                                                                                                   |
| 4   | Which model router?            | `llm_service.generate_completion_with_tools_stream` (single-attempt) + buffered `generate_completion_with_tools` fallback-per-round (this phase); tier routing via `model_router` + `inference_policy.route` |
| 5   | Tool selection?                | Model `tool_calls` proposal → exists? (`get_tool_definition`: static ∪ MCP) → scope → contract → approval → budget → idempotency → `execute_tool`                                                            |
| 6   | Argument generation?           | Model JSON args → parse (malformed → `{}` + self-correct feedback) → **NEW** schema/type/required/binding/size validation (`react_policy.validate_tool_arguments`)                                           |
| 7   | Tool authorization?            | Scope (`check_permission`) + AgentCard (`card_registry` in executor + runtime contract in loop) + workspace tamper check in executor                                                                         |
| 8   | AgentCard enforced?            | Triple: schema-offer least-privilege + executor card check + live contract `check_tool`                                                                                                                      |
| 9   | Approvals?                     | **WAS** refuse-with-message. **NOW** parity with static path: `lookup_approval` consume → execute; else `ApprovalManager.request_approval` + `request_approval` card, durable pause                          |
| 10  | Tool output to model?          | `sanitize_tool_output` (4000 cap, provenance wrap, injection neutralization) + `prompt_compiler.quarantine` + executor 8000 cap                                                                              |
| 11  | Next step?                     | Tool observation appended as `tool` message → next round synthesis; direct text → termination                                                                                                                |
| 12  | Termination detection?         | No-tool-calls + content → answer; structured-output gate; ceiling/error cards; **NEW** explicit `termination_reason` on EVERY return                                                                         |
| 13  | Loop bounds?                   | **WAS** max rounds only (+ per-round spend). **NOW** rounds + total tool calls + wall-clock + token estimate + repeat/cycle + spend, all from run budgets                                                    |
| 14  | State persisted?               | **WAS** none inside ReAct. **NOW** per-tool `react_{n}` phases + run ledger in `LoopState` via `save_checkpoint` (CAS, merge-before-write)                                                                   |
| 15  | Cancellation?                  | **WAS** unchecked. **NOW** durable-flag re-read every round + before each tool exec                                                                                                                          |
| 16  | Idempotency?                   | Executor durable UNIQUE + in-memory LRU (writes) + **NEW** replay-skip on resume (no re-execution of checkpointed rounds)                                                                                    |
| 17  | Failure classification?        | Reuses `llm_service._classify_exc` taxonomy (retryable→buffered fallback round; terminal→static ladder) + tool retryable/replan/terminal mapping                                                             |
| 18  | Fallback × ReAct?              | Stream single-attempt documented; **NEW** per-round buffered failover (Provider A 5xx → B → continue loop) with capability/budget/provenance                                                                 |
| 19  | Learning × ReAct?              | `improve_phase` consolidates every run incl. ReAct; result carries `react` metadata; untrusted observations never enter learning input (user_prompt+summary only + admission gate)                           |
| 20  | Process death?                 | **NEW** resume-from-checkpoint: replay stored rounds (no re-execution), continue; interrupted non-terminal runs never silently complete                                                                      |
| 21  | Provider failure?              | Per-round failover; all-providers-down → terminal `dependency_failure` card (no fabrication)                                                                                                                 |
| 22  | Tool failure?                  | Executor retries (transient) → error observation → model replan; repeat-failure → cycle/no-progress termination                                                                                              |
| 23  | Redis/DB failure?              | Checkpoints best-effort (run continues in-memory, proven historical contract); idempotency lookup fail-open-local per prior gate; approval REQUIRES db (fail-closed refuse when unavailable)                 |
| 24  | Observable?                    | **NEW** `REACT_RUN` structured record + `react_metrics` counters + prompt_manifest + per-round model/provider/latency                                                                                        |
| 25  | Flagged?                       | `agent_react_enabled=False` default (opt-in — deliberate §29 decision, kept)                                                                                                                                 |

Nothing above is `IMPLEMENTED BUT NOT REACHABLE`: every listed mechanism is on
the act → ReAct path when the flag is on; unreachable-by-design items
(LangGraph/Temporal) remain disabled and out of scope.

---

## 3. ReAct contract (§5)

`THINK → SELECT → VALIDATE → AUTHORIZE → EXECUTE → OBSERVE → EVALUATE → CONTINUE/STOP`
with structured metadata persisted per step (`react_policy.ReactRunRecord`:
round, tool, arg fingerprint, result status, approval, model/provider, latency —
NEVER raw reasoning, NEVER secrets). Termination reasons reuse the `LoopState`
vocabulary (§12). Per-arrow production evidence:

| Arrow                | Mechanism                                                   | E2E proof                            |
| -------------------- | ----------------------------------------------------------- | ------------------------------------ |
| Auth → tenant/ws     | middleware + `_verify_workspace_access` (unchanged)         | E2E-01 (HTTP 200 through full stack) |
| Agent selection      | router + explicit preferred agent                           | E2E-01                               |
| AgentCard/capability | offer least-privilege + executor card check + live contract | E2E-02/03, ADV-escalate (denied)     |
| Prompt/context       | PromptCompiler manifest + quarantine (unchanged, reused)    | E2E-02 manifest in card              |
| Model routing        | `generate_completion_with_tools_stream` + buffered failover | E2E-05, E2E-15                       |
| ReAct decision       | `_try_react_loop` rounds                                    | all E2E                              |
| Tool authorization   | scope → contract → approval → budget → idempotency          | E2E-02/04/06/10                      |
| Approval             | lookup-consume or request-and-pause (static parity)         | E2E-06a/b/c, ADV-swap                |
| Execution            | `execute_tool` (single canonical boundary)                  | E2E-02/03/06a                        |
| Observation          | sanitize (4000) + quarantine + executor 8000 cap            | E2E-09, ADV-flood                    |
| Reasoning/next       | round synthesis; termination map                            | E2E-02..05                           |
| Bounds               | rounds/tools/wall-clock/tokens/spend/repeat                 | E2E-11, ADV-loop, perf               |
| Evaluation           | reflect + QA gate (unchanged)                               | E2E-01/02 (QA-approved)              |
| Learning             | `improve_phase` + admission gate (closed phase, reused)     | E2E-12/13                            |
| Durable state        | `LoopState` phases + `save_checkpoint` CAS                  | E2E-08, E2E-13                       |

## 4. Implementation deltas (this phase)

1. **NEW `api/orchestrator/react_policy.py`** — pure policy helpers (no runtime
   fork): `validate_tool_arguments`
   (schema/types/required/enum/ranges/binding/size), `redact_secrets`,
   `compact_messages`, `check_react_cancel`, `classify_tool_failure`,
   `ReactRunRecord` + `record_react_run`, `react_metrics` counters,
   `REACT_TERMINATION_MAP`, `build_resume_messages`.
2. **`orchestrator/loop.py`** — `_try_react_loop`: `request_id/state/tenant_id`
   params; per-round cancel + wall-clock/tool/token/spend budgets; arg
   validation gate; approval parity (lookup-consume → execute, else request +
   pause card); per-round buffered provider failover; repeat/cycle detection;
   observation + history caps; per-tool checkpoint + resume-replay; explicit
   termination on every return; run record + metrics.
   `_act_phase_inner`/`act_phase`/`run_agent_loop_stream`: optional `state`
   threading + stream-path cancel check + ceiling short-circuit (truthful
   `cost_budget`/`policy_stop` instead of `no_progress` decay).
   `_check_spend_and_quota` now returns `(message, kind)`; `_ceiling_error_card`
   carries `result._ceiling`.
3. **`infrastructure/agent_limits.py`** — P1 fix: `ConcurrencySlot.release`
   floored at 0; `_act_phase_inner` releases exactly once on ALL post-acquire
   paths (ReAct-success and ceiling early-returns previously leaked a slot each
   — production self-DoS after 5 ReAct acts; found by this phase's perf E2E).
4. **`routers/agents.py`** — `chat_stream`: pass `db/user_id/correlation_id` so
   ReAct approval/BYOK/cancel paths have real context (no behavior change
   otherwise).
5. **Tests**: `test_react_policy.py` (31), `test_muse_react_e2e.py` (18 incl.
   E2E-08 subprocess-terminate), `test_muse_react_adversarial.py` (13); existing
   doubles updated for new kwargs (`act_phase(state=)`, `mock_stream(**kwargs)`,
   `_check_spend_and_quota` tuple, `draft_email` real schema).

## 5. E2E matrix evidence (§32) — CURRENT FRESH, 15/15 PASS

All through real paths (HTTP → handle → run_agent_loop → act → ReAct →
executor); scripted provider transport + deterministic injection; real tools +
sqlite.

| ID  | Scenario                         | Proof                                                                                                                                                     |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01  | Simple reasoning → answer (HTTP) | `POST /agents/chat` 200, summary in body; auth/ws/router/QA all live                                                                                      |
| 02  | Tool → observation → answer      | search_documents executed; observation in round-2 history; checkpoint round ledger                                                                        |
| 03  | Multiple tools                   | 3 tools in order in checkpoint ledger                                                                                                                     |
| 04  | Tool failure → recovery          | `arg_rejected` round then success; termination answered                                                                                                   |
| 05  | Provider A 5xx → B → continue    | `provider_fallbacks≥1`, canned tool round served, answer                                                                                                  |
| 06  | Approval cycle                   | (a) pre-approved consumed+executed (Entity+CONSUMED); (b) unapproved → pause card + PENDING, zero execution; (c) decide → next turn executes exactly once |
| 07  | Cancellation                     | (a) pre-cancelled → cancelled, zero tool msgs; (b) mid-tool cancel → cancelled, second tool never ran                                                     |
| 08  | Process death → recovery         | REAL `TerminateProcess` mid-round → checkpoint survived → resume: Entity count ≤1, terminal card (answer or re-approval, never skip/bypass)               |
| 09  | Injection via tool output        | instruction neutralized (`[filtered…]`), quarantined, no privileged exec, run succeeds                                                                    |
| 10  | Cross-workspace attack           | `workspace_id` smuggle → `arg_rejected/binding mismatch`; own search sees nothing foreign                                                                 |
| 11  | Budget exhaustion                | pre-exhausted spend → `failed/cost_budget`, zero model calls                                                                                              |
| 12  | Learning after task              | preference Entity consolidated post-run                                                                                                                   |
| 13  | Restart persistence              | fresh session re-reads learning; checkpoint file holds react ledger                                                                                       |
| 14  | Concurrent multi-ws ×1/2/4/8/16  | all success; per-ws markers isolated; zero cross-data                                                                                                     |
| 15  | Provider + tool failure          | `_try_react_loop` returns None (claims nothing); run record `provider_down`; no fabrication                                                               |

E2E file: **18/18 PASS** (15 scenarios + 5 concurrency levels in E2E-14 count as
items: 02,03,04,05,06,07,09,10,11,12/13,15,08,01 + 14×5).

## 6. Adversarial results (§28) — CURRENT FRESH, all fail-safe

| Attack                                            | Result                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Privileged tool (`execute_code_sandbox` off-card) | denied (scope/contract), ledgered, run completes via allowed tool |
| Fake tool name                                    | `unknown_tool`, skipped + self-correct feedback, no exec          |
| Infinite loop (same tool forever)                 | `cycle_detected` ≤5 rounds, deterministic stop                    |
| Repeated once-only side effect                    | exactly 1 Entity; 2nd identical request pauses for re-approval    |
| Approval swap (approved-A, propose-B)             | no consume; new PENDING; original APPROVED untouched; zero exec   |
| Context flooding (20KB doc)                       | observation ≤9000 chars; completes                                |
| Malformed tool response (non-dict)                | coerced error observation; replanned; completes                   |
| Secrets in tool output                            | checkpoint contains zero raw secrets (redacted)                   |
| Provider fallback abuse (all down)                | terminal `provider_down`, None claimed                            |
| Budget exhaustion                                 | `cost_budget`, zero calls                                         |
| Concurrent metered runs                           | metrics separate outcomes correctly                               |

File: **13/13 PASS** (+31/31 policy units, 5/5 cards).

## 7. Observability + metrics (§23/§24) — CURRENT FRESH

Every run emits `REACT_RUN`
(correlation/run/agent/ws/tenant/rounds/tools/failures/
approvals/fallbacks/model/termination/duration/tokens/denials/compacted/resumed
— no reasoning, no secrets). `get_react_stats()` aggregates runs/terminations/
iterations/tool calls/failure + fallback rates (asserted in tests). Per-round
model/provider/latency in checkpoint ledger + prompt_manifest on cards. Operator
questions (§23) all answerable — proven by E2E-05/06/07/11 ledger asserts.

## 8. Performance (§30) — CURRENT FRESH (hermetic smoke)

Single-step vs 1-tool full-loop runs over mocked transport (never health
latency): p50/p95 computed per arm, error rate 0.0, `tooled_p50 ≥ single_p50`,
both p95 < 60s. Methodology + thresholds asserted in
`test_adv_performance_smoke` (PASS). Live-provider latency distributions:
UNVERIFIED by design (no live keys) — carried as P2, not a release claim.

## 9. Security regression (§33) — CURRENT FRESH

| Suite                                                                                                                          | Result                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| tenant isolation, memory-ws isolation, noauth, data isolation, approval ×2, idempotency ×2, prompt injection, security phase A | **203 passed, 1 env skip**                                                                                                                                               |
| 1 failure: `test_user_cannot_access_other_users_memories`                                                                      | stash-proven PRE-EXISTING (prior phase §13; stale post without workspace → 400-correct, fails closed)                                                                    |
| learning/fallback close-out suites + LLM + fallback infra                                                                      | **86/86**                                                                                                                                                                |
| orchestrator + streaming/durability + agentic gaps                                                                             | **106 passed**; 3 fails = FOREIGN drift (parallel session added 55th tool `query_notebooklm`; count pins `==54` — not this phase, fails closed, owner: parallel session) |
| orchestrator + agents router + product closure                                                                                 | **94/94**                                                                                                                                                                |
| scale/safety + spend + consolidation                                                                                           | **30/30**                                                                                                                                                                |
| runtime_phase_b + muse scenarios                                                                                               | **65/65**                                                                                                                                                                |
| memory loop + state durability + QA + learning closure                                                                         | **11/11**                                                                                                                                                                |

**P0 = 0. P1 = 0** (the P1 found this phase was FIXED — see §10).

## 10. P1 register — found and closed this phase

| ID          | Finding                                                                                                                                                                                                                                                          | Status                                                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| REACT-P1-01 | Concurrency-slot leak: ReAct-success + ceiling early-returns bypassed `finally: release` → +1 leaked slot per successful ReAct act → agent self-DoS after 5 calls (default concurrency 5). Pre-existing (dormant while flag off); BLOCKING for production ReAct. | **FIXED**: exact-once release helper + floor at 0. Proven: 8 sequential runs, slot pinned 0 (`react_repro2`). Perf E2E passes. |

## 11. Bypass / phantom audit (§34) — CLEAN (with noted items)

- Direct provider invocation: `llm_service.py` canonical boundary only (+ BYOK
  verify + health — legitimate).
- Direct tool invocation: `TOOL_DISPATCH` indexed only inside `execute_tool`;
  all ReAct execs via `execute_tool` alias (2 gated sites); graph path is
  flag-disabled LangGraph (out of scope).
- Flag: single gate (`agent_react_enabled`, default False), 2 check sites; no
  alternate enable path.
- No AgentCard/approval/workspace/idempotency/budget/checkpoint bypass on the
  ReAct path (each proven by a failing-closed E2E).
- `IMPLEMENTED BUT NOT REACHABLE`: none on the ReAct path. LangGraph/Temporal
  remain disabled-by-design (not audited as reachable).
- Foreign drift (parallel session, NOT this phase): 55th tool,
  profile/council/opportunity/notebooklm surfaces, 0029 rewrite. Zero foreign
  hunks in this phase's files (grep-verified). Count-pin failures recorded, not
  "fixed" (foreign owner).

## 12. Skip audit (§36)

Zero skips in this phase's new tests (31+18+13, no skip markers). The 1 skip in
the regression chunk is a pre-existing environment skip (unchanged). No
release-critical ReAct property is unverified: every acceptance criterion maps
to a passing test below.

## 13. RLS (§26) + secrets (§27)

- This phase creates NO new tables (checkpoints reuse `loop_checkpoints` + file
  store; run ledger is log/metrics memory). RLS code paths untouched; workspace
  predicates enforced at executor + RAG + approval layers; isolation proven
  hermetically (E2E-10/14, tenant A/B/C learning carryover). Live PG RLS
  re-proof: HISTORICAL (prior gate A–L; src deltas do not touch RLS).
- Secrets: run records/checkpoints store fingerprints + redacted replays only
  (`redact_secrets` unit + E2E checkpoint asserts); provider keys never enter
  model context beyond the Authorization header at transport (BYOK inheritance
  proven in closed phase; ReAct threads the same context).

## 14. Configuration decision (§29) — KEEP OPT-IN (evidence-backed)

`agent_react_enabled` stays **default False**. Rationale from this phase's
evidence: (1) 1–5 LLM calls per request vs static determinism (cost/latency
multiplier measured in perf smoke); (2) approval-gated tools pause for a human
round-trip and cannot complete synchronously inside one ReAct pass (E2E-06); (3)
streaming is single-attempt by transport design (buffered failover covers, with
added latency); (4) static dispatch remains the deterministic primary with
identical safety gates. Matrix: development opt-in for iteration; staging
mirror-prod flag flips for soak; production enable per-workspace only after
spend/approval SLO review. The mode is production-CAPABLE and
production-PATH-verified; default flip is a product decision, not a safety
blocker. Kill switches (`AgentKillSwitch`, per-agent circuit breakers) remain
armed above it.

## 15. LangGraph / Temporal boundaries (§38/§39) — no implementation

- LangGraph node boundary:
  `_try_react_loop(agent, message, workspace_id, …, request_id, state, …)` is
  already a capability function over an explicit `LoopState` envelope — a future
  node can invoke it with the same state object and the same
  executor/approval/checkpoint substrate. No graph code added.
- Temporal boundary: `LoopState.to_dict/from_dict` + `save_checkpoint` (CAS) +
  phase ledger are the durable workflow surface; Temporal would orchestrate
  AROUND them. No workflow code added. `temporal/` untouched.

## 16. Final verdict

```text
VAELOOM MUSE
REACT PRODUCTIONIZATION
=======================

Baseline:
d4e1b23f67d8162f15d87bf125f1acdc35c406c5

ReAct:
COMPLETE

Production-path proof:
PASS

Tool authorization:
PASS

AgentCard:
PASS

Tenant isolation:
PASS

Workspace isolation:
PASS

Prompt injection:
PASS

Observation quarantine:
PASS

Loop bounds:
PASS

Termination:
PASS

Idempotency:
PASS

Approval:
PASS

Cancellation:
PASS

Checkpointing:
PASS

Process recovery:
PASS

Cross-provider fallback:
PASS

Learning integration:
PASS

Retrieval integration:
PASS

Memory integration:
PASS

Observability:
PASS

Concurrency:
PASS

Performance:
VERIFIED

E2E:
15/15

Security:
PASS

P0:
0

P1:
0

P2:
4

P3:
4

Bypass scan:
CLEAN

Phantom audit:
CLEAN

Remaining blockers:
none for this phase (P2: live-provider latency distributions, 50-user live load,
vector-ranking quality, per-run spend atomicity across concurrent fallbacks —
all bounded carries, none release-blocking; P3: MCP bounded-not-sandboxed, JWT
denylist, OTel noise, foreign parallel-session drift incl. tool-count pins;
Docker build-egress remains infra-owned, out of scope)

LangGraph:
NEXT PHASE

Temporal:
NEXT PHASE

FINAL VERDICT:
REACT COMPLETE
```
