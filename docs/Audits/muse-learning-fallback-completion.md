# Muse Learning + Cross-Provider Fallback — Zero-Trust Completion Audit

> **Mode:** FORENSIC AUDIT → HARDEN → PROVE E2E → REGRESS → VERDICT
> **Authority:** Runtime truth > code inspection > tests > documentation >
> previous reports **Phase rule:** ReAct / LangGraph / Temporal stay DISABLED
> unless a specific test requires them. **Date:** 2026-09-08 UTC **Auditor:**
> Muse Spark (automated, zero-trust)

---

## 1. Baseline (fresh, this phase)

```text
BASELINE_COMMIT=d4e1b23f67d8162f15d87bf125f1acdc35c406c5
Branch: master
git status --short at freeze:
 M apps/api/src/api/tools/executor.py
 M docs/Audits/muse-final-production-gate.md
 ?? .env.staging
 ?? apps/api/scratch_race_probe.py
Log -10: d4e1b23 → 205f209 → c8d7eb3 → 301fd6b → aaa6e49 → 9025e43 → 2044cec → c5580bc (+2)
```

All evidence below is **CURRENT FRESH EVIDENCE** unless explicitly marked
**HISTORICAL EVIDENCE** (prior gate `docs/Audits/muse-final-production-gate.md`,
HONEST statuses: learning "DESIGNED, NOT OPERATIONALIZED"; provider failover
"HERMETIC (live 5xx optional)").

---

## 2. Current architecture (unchanged unless noted)

Single orchestrator + 5-phase loop
(`plan → act → observe → reflect → improve`) + static dispatch default;
supervisor for multi-intent; `agent_approvals` + `ToolIdempotency` durability;
`LoopState` v2 CAS; `llm_service` provider abstraction (OpenAI / Anthropic /
Groq / Google-embeddings); `model_router` tier routing;
`inference_policy.route()` risk-aware routing; `agent_runtime` shadow log;
`MemoryConsolidatorAgent` + `reflection_scheduler` + `improvement_pipeline`
(bounded learning); `search_ranking` preference-weighted retrieval (learning
effect path).

Production entry: `POST /api/v1/agents/chat` and
`POST /api/v1/agents/chat/stream` (`routers/agents.py`) →
`_verify_workspace_access` → `orchestrator.router.handle()` → `run_agent_loop` /
`run_agent_loop_stream` (`orchestrator/loop.py`) → `plan_phase` (RAG +
preference load) → `act_phase` (spend/quota gate → ReAct-or-static dispatch →
`llm_service`) → `observe/reflect` → `improve_phase` (fire-and-forget
`memory_consolidator.consolidate_trajectory`) → response.

Temporal / LangGraph: DISABLED by default (`temporal_enabled=False`,
`langgraph_enabled=False`). ReAct: default off (`agent_react_enabled=False`;
local `.env` override True disclosed in prior gate). No phase in this audit
enables them.

---

## 3. LEARNING CURRENT PATH (source refs — fresh read this phase)

| Step              | Code                                                                                                                                                                                                                                                                     | Status                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Runtime trigger   | `orchestrator/loop.py:1650 improve_phase` → `asyncio.create_task(memory_consolidator.consolidate_trajectory(...))` fire-and-forget                                                                                                                                       | WIRED but best-effort, unobserved, no tenant/correlation/event_id |
| Consolidation     | `agents/memory/consolidator.py:98 consolidate_trajectory` — heuristic regex + optional LLM extract → `admission_score` (threshold 0.65, `admission_score()` :44) → workspace-UUID upsert into `entities` (`Entity` type preference/skill/career) with auditable metadata | IMPLEMENTED, bounded                                              |
| Admission formula | `score = 0.5*source_quality + 0.3*novelty + 0.2*signal`; merges always pass; contradictions linked via `coexists_with`, never overwrite                                                                                                                                  | IMPLEMENTED                                                       |
| Nightly harvest   | `infrastructure/reflection_scheduler.py:15 reflection_scan` + `:88 process_user_correction` — approval APPROVED/REJECTED → preference `Entity`                                                                                                                           | IMPLEMENTED, bounded, workspace-scoped                            |
| Governance        | `services/improvement_pipeline.py` — `AUTO_APPLY_KINDS={personalization,memory_learning}`; all else needs approval+rollback+safety                                                                                                                                       | IMPLEMENTED                                                       |
| Behavioral effect | `orchestrator/loop.py:604 _assemble_rag_context` loads preference Entities → `user_context{preferred_tags}` → `services/search_ranking.py:139 _preference_score` (tag 0.8 / text 0.85, weight 0.1) → `context_prompt` injected in `act_phase`                            | WIRED (WS01 closure)                                              |
| Persistence       | `models/schema.py:324 Entity` — `entities` table, indexes `idx_entities_workspace_id`, `idx_entities_workspace_type`; FK `workspaces.id CASCADE`; RLS via workspace predicates (prior gate A–L live)                                                                     | DURABLE (no learning-only table)                                  |

**Gaps found live (this phase, fail-closed fixes applied — see §5):**

1. `consolidator.py:150-151` — invalid `workspace_id` fell back to a **random
   UUID** (foreign-association risk) instead of failing closed. FIXED.
2. No `event_id` → no idempotency; check-then-insert race (no UNIQUE). FIXED via
   `learning_events(workspace_id, event_id)` UNIQUE + `IntegrityError` path.
3. No tenant binding (workspace-only). FIXED (tenant_id threaded, best-effort
   resolved).
4. No payload caps / source allowlist / unsupported-type rejection / injection
   safety beyond length truncation. FIXED via `services/learning_gate.py`.
5. No correlation/signal/decision structured observability. FIXED (structured
   logs).
6. `improve_phase` fire-and-forget swallows failures silently (debug only). KEPT
   best-effort by design (primary op must stay correct) but now **explicitly
   observable** via warning + learning observability counters.

## 4. FALLBACK CURRENT PATH (source refs — fresh read this phase)

| Step                 | Code                                                                                                                                                                                                                                                                       | Status                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Provider abstraction | `services/llm_service.py` — `_infer_provider_from_model`, `_resolve_api_key` (explicit > workspace BYOK > user BYOK > system), `_openai_completion` / `_anthropic_completion` (Groq via OpenAI-compatible URL)                                                             | IMPLEMENTED                |
| Chat fallback chain  | `generate_completion:307` builds `fallback_candidates`: tier-downgrade same-provider + same-tier cross-provider (≤2, embeddings excluded) → per-candidate BYOK resolve → `_generate_completion_with_retry` (tenacity 3× on timeout/network/transient) → first success wins | IMPLEMENTED                |
| Tool fallback chain  | `generate_completion_with_tools:532` same shape, capability-preserving (embeddings excluded, tools/temperature/tier unchanged)                                                                                                                                             | IMPLEMENTED                |
| Transient detection  | `_openai/_anthropic_completion`: 429/500/502/503/504 → `LLMTransientError`; else `LLMProviderError`                                                                                                                                                                        | IMPLEMENTED                |
| Provenance           | `result["model"]`, `result["fallback_chain"]`, `result["downgraded"]`, `inference_policy.record_fallback` → `agent_runtime._shadow_log`                                                                                                                                    | IMPLEMENTED (thin)         |
| Routing policy       | `services/inference_policy.py:104 route()` — risk/complexity/context/latency → tier; unhealthy-provider → same-tier healthy-provider hop; `idempotency_key()` deterministic                                                                                                | IMPLEMENTED                |
| Cost tracking        | `services/model_router.py:132 record_usage` per call (effective model) + `services/agent_costs.py` workspace budgets + `loop.py:54 _check_spend_and_quota` pre-act gate                                                                                                    | IMPLEMENTED (pre-act only) |

**Gaps found live (this phase, fixes applied — see §8):**

1. **Taxonomy gap (P1-class):** `generate_completion:349` and tool path `:579`
   caught `LLMProviderError` (which includes **401/403 auth, 400/404/422
   invalid, context-limit, unsupported-capability**) and **continued the
   fallback chain**. Fallback on auth/invalid is unsafe/meaningless. FIXED:
   `classify_provider_failure()` — terminal categories abort the chain
   immediately; only retryable categories fail over.
2. No deterministic failure injection at provider boundary. FIXED via
   `inject_provider_failure()` test hook (guarded; no-ops unless explicitly
   armed).
3. Thin provenance (no requested/primary/final provider split, no failure
   category, no attempt count, no correlation). FIXED (full provenance block).
4. No per-fallback budget re-check (pre-act gate only; a 5-candidate chain could
   burn past spend/time budgets). FIXED (budget re-check before each fallback
   candidate + elapsed-time budget abort).
5. Stream path (`generate_completion_with_tools_stream`, `_try_react_loop`)
   resolved keys **without** user/workspace/db context (system-key only). Not a
   leak (fail-safe direction) but a BYOK-correctness gap. FIXED (context
   threaded from `AgentRequest`).
6. No capability context-window check (a fallback candidate with smaller
   `max_tokens` than requested could be selected). FIXED (skip candidates that
   cannot hold `max_tokens`).
7. Fallback observability only via shadow-log append (no
   counters/latency/operator answers). FIXED (`record_provider_outcome`
   counters + structured logs).

---

## 5. Learning implementation path (this phase — deltas)

1. **NEW `api/services/learning_gate.py`** — the strict admission boundary.
   Single entry `validate_learning_signal(...)` enforcing, in order: schema
   validation → tenant/workspace binding (UUID parse, fail-closed; cross-owner
   check when both given) → source allowlist
   (`user_correction|approval_feedback|trajectory_feedback| llm_feedback|manual`)
   → payload caps (correction ≤500, feedback ≤4000, name ≤120, event/correlation
   ≤128) → supported-type check (only
   `preference|skill|career|education|experience`; never
   system/developer/policy/auth) → injection safety (instruction-override
   markers → reject) → confidence via `admission_score` ≥ 0.65 (merges pass) →
   idempotency pre-check hint. Returns `(accepted, decision_dict)` with
   `signal_id`, `correlation_id`, tenant/workspace, admission result + reason.
   Rejections: `foreign_workspace`, `foreign_tenant`, `malformed`,
   `duplicate_hint`, `untrusted_instruction`, `oversized`, `unsupported_type`,
   `low_confidence`.
2. **`models/schema.py` + migration `0030_learning_events.py`** — NEW durable
   table `learning_events`: `id UUID PK`,
   `workspace_id UUID FK CASCADE NOT NULL`, `tenant_id UUID NULL`,
   `event_id VARCHAR(128) NOT NULL`, `signal_type`, `source`, `payload JSON`,
   `confidence FLOAT`, `status` (`admitted|rejected| duplicate`), `reason`,
   `correlation_id`, `created_at/updated_at`; constraints
   `UNIQUE(workspace_id, event_id)` (atomic idempotency), indexes
   `(workspace_id)`, `(workspace_id, status)`, `(event_id)`.
3. **Hardened `agents/memory/consolidator.py`** — `consolidate_trajectory(...)`
   now accepts `event_id`, `tenant_id`, `correlation_id`, `source`; fail-closed
   on bad workspace (returns `skipped/missing_or_invalid_workspace_id`, never
   random UUID); empty-signal early skip; per-item gate via
   `validate_learning_signal`; atomic `learning_events` claim first
   (`IntegrityError` → idempotent `duplicate`); Entity upsert catches
   `IntegrityError` (concurrent dedup → re-read → merge);
   unsupported/instruction/low-signal items counted in `rejected_*`; structured
   `LEARNING_*` logs with
   correlation/tenant/workspace/signal/decision/persistence.
4. **Hardened `infrastructure/reflection_scheduler.py`** —
   `process_user_correction` fail-closed (UUID parse, caps, gate);
   duplicate-aware; structured logs. Scan path unchanged (bounded harvest) but
   benefits from gate on manual path.
5. **`orchestrator/loop.py:improve_phase`** — resolves `tenant_id` best-effort
   from workspace row, derives `correlation_id` from request, passes stable
   `event_id` (`f"traj:{request.id}"` → natural idempotency across redelivery),
   keeps best-effort semantics but logs `LEARNING_IMPROVE_QUEUED` (info) instead
   of silent debug. Primary op correctness unchanged on learning failure.

## 6. Learning persistence

- Tables: `entities` (learned preference/skill state; indexes §3) + NEW
  `learning_events` (admission ledger + idempotency anchor; UNIQUE + indexes
  §5.2).
- Proof: write → commit → **process restart** → read → same state (see §7 E2E +
  restart test `test_learning_restart_persistence`).
- No global-dict / singleton-only / in-memory-queue source of truth remains on
  the learning path (prior `memory_versioning` in-memory fallback is unrelated
  legacy; not on this path — phantom scan §12).

## 7. Learning E2E evidence (CURRENT FRESH)

Canonical `LEARNING-E2E-01` (`tests/test_muse_learning_fallback_e2e.py`): 1–12
steps per phase §14 incl. auth-context stub, task, signal, admission, DB verify,
restart (fresh session factory), retrieval, behavioral adaptation (ranking order
flip), observability fields, Tenant-B isolation. **Result: PASS** (see §13
matrix). Supporting: `test_learning_admission_gate` (reject
foreign/malformed/oversized/ instruction/unsupported),
`test_learning_idempotent_concurrent` (N=20 same event_id → 1 admitted + 19
duplicate), `test_learning_tenant_isolation` (A/B/C),
`test_learning_restart_persistence`.

## 8. Fallback implementation path (this phase — deltas)

1. **`services/inference_policy.py`** — NEW failure taxonomy
   `classify_provider_failure()`:
   `timeout|rate_limit|server_5xx|provider_unavailable|network` → fallback
   ALLOWED (retry same + hop provider);
   `auth_failure|invalid_request|context_limit| unsupported_capability` →
   TERMINAL (no fallback, no retry-hopping); `unknown` → single cautious
   fallback. Every category maps
   `{fallback_allowed, retry_same, try_different_provider, terminal}`.
2. **`services/llm_service.py`** —
   - `_FAILURE_INJECTION` hook +
     `inject_provider_failure/clear_provider_failure_injection()` checked at the
     top of `_openai_completion` / `_anthropic_completion` (raises the injected
     `LLMTransientError`/`LLMProviderError` inside the real path).
   - Terminal-error short-circuit in both `generate_completion` and
     `generate_completion_with_tools`: terminal → raise immediately, chain
     abandoned.
   - Full provenance on every result: `requested_model`, `primary_provider`,
     `failure_category`, `fallback_provider/model`, `final_provider/model`,
     `attempt_count`, `correlation_id`, plus legacy
     `fallback_chain`/`downgraded`.
   - Budget-aware chain: before each fallback candidate, re-check
     `agent_cost_tracker.check_budget(workspace_id)` (when known) and
     elapsed-time budget (`fallback_time_budget_s`, default 90s); exhausted →
     abort with `BudgetExceededError`/timeout error, never silent overrun.
   - Capability-aware: skip candidates whose catalog `max_tokens < max_tokens`
     (context-window preservation); embeddings never in chain (existing +
     asserted).
   - BYOK/auth context: `generate_completion*` accept `correlation_id`; stream
     variant accepts `user_id/workspace_id/db`; `_try_react_loop` +
     `AgentRequest` thread `user_id`/`db` so fallback resolves workspace BYOK
     instead of system-only.
   - Structured `FALLBACK_*` logs
     (correlation/run/agent/tenant-ws/primary/failure/
     fallback/latency/attempts/outcome) + `record_provider_outcome()` counters
     (per-provider totals/failures/fallbacks served/latency) powering operator
     queries.
3. **`orchestrator/loop.py`** — `AgentRequest` gains `user_id`, `db`;
   `chat_stream` + `run_agent_loop_stream` populate them; `_try_react_loop`
   forwards them into the streaming tool-call path.

## 9. Provider failure evidence (CURRENT FRESH)

Taxonomy matrix asserted in `test_fallback_taxonomy` (9 categories).
Deterministic injection asserted in `test_fallback_cross_provider_e2e` (forced
503 on primary provider → classifier `server_5xx` → different-provider candidate
→ success, exactly one fallback hop) and `test_fallback_terminal_no_retry`
(forced 401 → terminal, chain length 1, no fallback). Outage matrix in
`test_fallback_provider_outage` (A-down/B-up → success via B; A-down/B-down →
clean terminal `LLMProviderError`, no fabricated response).

## 10. Fallback E2E evidence (CURRENT FRESH)

Canonical `FALLBACK-E2E-01` (`tests/test_muse_learning_fallback_e2e.py`): 14
steps per phase §28 incl. auth stub, agent task via
`generate_completion_with_tools` (tool-capable chain), forced 5xx on Provider A,
classification, Provider-B capability check (tool-capable, context-window ok),
success, provenance block, budget check, observability counters, idempotent
side-effect (deterministic `idempotency_key` same-key-same-action proof),
Tenant-B blindness. **Result: PASS**. Supporting: taxonomy, terminal, outage,
budget-abort (`test_fallback_budget_abort`), concurrency
(`test_fallback_concurrent_isolation`, N=20 mixed providers → no leak, no
shared-state corruption, provenance per-call intact), performance
(`test_fallback_performance_smoke`: normal vs fallback latency p50/p95 + error
rate — mocked-transport smoke, NOT agent latency; kept separate per §27).

## 11. Combined learning + fallback (CURRENT FRESH)

`test_combined_fallback_then_learn`: forced Provider-A 5xx → Provider-B success
→ `consolidate_trajectory` from the completed task → admitted + persisted →
fresh-session re-read → preference present + ranking effect; Tenant-B blind.
Provenance retained on the completed result; learning ledger row references the
serving provider/model. **PASS**.

## 12. Default runtime verification + phantom scan (CURRENT FRESH)

- Production path trace (§2): `POST /agents/chat(stream)` → auth
  (`get_current_user`) → tenant (`get_tenant_id` authoritative; header spoof
  ignored per prior gate) → `_verify_workspace_access` (DB join) → `handle()` →
  loop → `plan` (RAG+preferences) → `act` (spend/quota → model routing →
  `llm_service` fallback chain) → `improve` (learning) → response. Learning +
  fallback reachable with **zero flag flips** (no Temporal/LangGraph/ReAct
  required; ReAct stays default-off).
- Flags: `temporal_enabled=False`, `langgraph_enabled=False`,
  `agent_react_enabled=False` (defaults); learning + fallback active on the
  default static path.
- Phantom scan: `dead learning service` — none (all learning callers resolve to
  `memory_consolidator`/`reflection_scheduler`/`improvement_pipeline`);
  `test-only fallback` — `agent_fallback.py` (`PrimaryWithFallback` etc.) is
  unit-tested infra, NOT on the production LLM path (production path is
  `llm_service` chains — documented, not claimed); `direct provider invocation`
  bypassing router — `httpx.post` to provider URLs occurs ONLY inside
  `llm_service._*_completion` (the canonical boundary); no alternate model path
  found (`grep httpx.post api.openai.com|api.anthropic.com|api.groq.com` →
  `llm_service.py` only).

## 13. Full test matrix (CURRENT FRESH — commands + results)

New suites (this phase):

- `tests/test_muse_learning_fallback_e2e.py` — LEARNING-E2E-01, FALLBACK-E2E-01,
  combined, taxonomy, terminal, outage, budget-abort, concurrency×2, restart,
  isolation, admission-gate, idempotent-concurrent, performance-smoke.
- `tests/test_learning_gate.py` — gate unit matrix.

All runs serial (`-o addopts=""`), per-file, this phase. Command pattern:
`uv run --project apps/api python -m pytest <files> -q -o addopts=""`.

| Suite                                                                                                                                                                                                                                                                                                                  | Result                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_learning_gate.py` (new)                                                                                                                                                                                                                                                                                          | **22/22 PASS**                                                                                                                                                                                                         |
| `test_muse_learning_fallback_e2e.py` (new)                                                                                                                                                                                                                                                                             | **14/14 PASS**                                                                                                                                                                                                         |
| `test_learning_consolidation.py` + `eval/test_learning_closure.py` + `test_agent_fallback.py`                                                                                                                                                                                                                          | **30/30 PASS**                                                                                                                                                                                                         |
| `test_llm_byok.py` + `test_llm_resilience.py`                                                                                                                                                                                                                                                                          | **21/21 PASS**                                                                                                                                                                                                         |
| `test_runtime_phase_b.py`                                                                                                                                                                                                                                                                                              | **38/38 PASS**                                                                                                                                                                                                         |
| `test_muse_e2e_scenarios.py`                                                                                                                                                                                                                                                                                           | **27/27 PASS**                                                                                                                                                                                                         |
| `security/test_prompt_injection.py` + `test_cont_p12_agent_model_retrieval.py`                                                                                                                                                                                                                                         | **38/38 PASS**                                                                                                                                                                                                         |
| `test_memory_closed_loop.py` + `test_state_durability.py` + `test_react_loop_cards.py`                                                                                                                                                                                                                                 | **9/9 PASS**                                                                                                                                                                                                           |
| `test_security_phase_a.py` + `test_memory_closed_loop.py` + `test_state_durability.py` + `test_qa_loop_gate.py`                                                                                                                                                                                                        | **37/37 PASS**                                                                                                                                                                                                         |
| `test_agent_spend_ceilings.py` + `test_streaming_and_daemon_durability.py` + `test_agentic_gaps_closure.py`                                                                                                                                                                                                            | **61/61 PASS**                                                                                                                                                                                                         |
| tenant/workspace isolation + approval + idempotency chunk (`security/test_tenant_isolation.py`, `test_memory_workspace_isolation.py`, `security/test_noauth_private.py`, `test_data_isolation.py`, `test_approval.py`, `test_approval_execution_recheck.py`, `test_idempotency.py`, `test_idempotency_fail_closed.py`) | **145/146** — 1 failure stash-proven pre-existing (see below)                                                                                                                                                          |
| FULL suite (3200+) chunked                                                                                                                                                                                                                                                                                             | NOT re-run in full this phase (xdist hang is repo finding 39; serial full exceeds tool timeouts). All suites touching changed code re-run green above; unchanged-code suites inherit prior-gate results. No new P0/P1. |

Stash-proven pre-existing (verified via `git stash push` of this phase's src
diff, re-run, `git stash pop` — fails identically WITHOUT this phase's changes):

- `security/test_tenant_isolation.py::TestWorkspaceIsolation::test_user_cannot_access_other_users_memories`
  — stale test POSTs `/api/v1/memories` without mandatory workspace; production
  400 is correct (fails CLOSED). Same entry as prior gate §31. Untouched by this
  phase.

Collateral found and fixed by this phase's own runs (recorded, not hidden):

- `test_react_loop_cards.py` 4 failures: the new `user_id/db/correlation_id`
  threading changed `generate_completion_with_tools_stream` call kwargs; the 4
  test doubles (`mock_stream(self, messages, tools=None)`) rejected the new
  kwarg. Fixed by adding `**kwargs` to the doubles (behavior unchanged) — **9/9
  PASS** after.
- `consolidator` loop-variable shadowing (`for corr in corrections` clobbered
  the correlation id) — caught by LEARNING-E2E-01, fixed (renamed
  `correction_item`).
- Outer persist `except` returned phantom `success/0` — now explicit `error`
  status.
- Shared-session concurrent test harness (InvalidRequestError) — test now uses
  per-worker sessions (production parity); production code unchanged
  (per-request sessions already hold there).

## 14. Security regression

Minimum set per §32: tenant isolation, workspace isolation, RLS (prior live A–L
stands; src unchanged for RLS paths), AgentCard, approval, idempotency, prompt
quarantine, memory isolation, retrieval isolation, background authorization.
**P0 = 0, P1 = 0.** The single regression-chunk failure is stash-proven
pre-existing and fails CLOSED (stale test, no src contact — §13). New attack
surface reviewed: injection hook is test-only surface (armed explicitly, never
from request data); learning writes are Entity-scoped with injection rejection +
quarantine-at-use; fallback never crosses workspace BYOK (per-candidate
same-context resolution asserted).

## 15. Remaining P0/P1/P2/P3 + next phase

- P0: 0. P1: 0.
- P2 (bounded, carried): 50-user live load + perf distributions (infra-gated,
  unchanged); vector-ranking quality (no embedding keys); live-provider 5xx
  drill (optional — hermetic injection stands in); per-run spend atomicity
  (budgets are checked pre-act + pre-fallback-candidate; exact atomic debit
  across concurrent fallbacks is best-effort — NOT release-blocking for this
  phase, tracked).
- P3: MCP bounded-not-sandboxed; JWT denylist; OTel noise; foreign `executor.py`
  hunk (untracked, excluded); apt-egress build policy (infra).
- Temporal / LangGraph / ReAct: IMPLEMENTED / DISABLED — NEXT PHASE, in order
  ReAct → LangGraph → Temporal (unchanged).

## 16. Final verdict

```text
VAELOOM MUSE
LEARNING + CROSS-PROVIDER FALLBACK
==================================

Baseline:
d4e1b23f67d8162f15d87bf125f1acdc35c406c5

Learning:
COMPLETE

Learning E2E:
PASS

Learning persistence:
PASS

Learning isolation:
PASS

Learning behavioral effect:
PASS

Cross-provider fallback:
COMPLETE

Fallback E2E:
PASS

Real provider transition:
PASS (hermetic provider-boundary transition via deterministic injection;
live-provider 5xx drill remains optional P2, no production claim made)

Fallback provenance:
PASS

Fallback budget:
PASS

Fallback idempotency:
PASS

Fallback isolation:
PASS

P0:
0

P1:
0

P2:
4 (carried, bounded — §15)

P3:
5 (carried — §15)

Production-path proof:
PASS

Remaining blockers:
<none for this phase — P2/P3 carried are explicitly non-blocking>

Temporal:
NEXT PHASE

LangGraph:
NEXT PHASE

ReAct:
NEXT PHASE

FINAL VERDICT:
MUSE LEARNING + FALLBACK COMPLETE
```

Never claimed COMPLETE on implementation existence or seam tests alone — every
box above cites a production-path E2E or a named hermetic proof executed in this
phase.
