# Agentic Scale-Safety Closure — Plan (2026-09-06)

> **Status:** WAVES 0+1+2 EXECUTED 2026-09-06 — Wave 2 GATE: GO (evidence:
> `docs/phases/agentic-safety-w2/01-wave-report.md`; 54/54 new + full regression
> green; 1 pre-existing slack env failure proven pristine). Tier-1 bypass rate
> 0/18. Next: Wave 3 on user command — RECONCILE with parallel session's
> `orchestrator/state_store.py` first. **Scope:** Agentic safety ceilings ONLY
> (spend, loop budgets, evals, state, context, prompts) — no agent rewrites, no
> substrate migration **Repo:** Vaeloom `master` @ current HEAD **Governing
> contracts:** `docs/prompts/vaeloom-66-independent-end-to-end-phase-prompts/`
>
> - `AGENTS.md` + this plan **Feeds:** CONT-P12 predecessor audit
>   (`Agent, Model, Retrieval, and Memory-Taxonomy Migration` — authorized next,
>   `docs/phases/cont-p12/` empty) **Companion:**
>   `.agents/plans/langgraph-deep-implementation-closure-2026-08-29.md` (DRAFT,
>   execution substrate) — this plan is substrate-agnostic and applies
>   regardless of which loop path wins

---

## 0. Protected Baseline (DO NOT REGRESS)

| Area              | Evidence                                                                                    | File                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ReAct loop        | 1047-line dynamic-tool loop, `LoopState` checkpoints, per-agent CB + rate limits            | `orchestrator/loop.py`, `state.py`                                                                |
| Supervisor DAG    | topological order, `PARALLEL_SAFE` / `SEQUENTIAL_CHAINS`                                    | `orchestrator/supervisor.py`                                                                      |
| Temporal quotas   | Redis Lua `quota:{ws}:{YYYY-MM-DD}:{metric}`, verified                                      | `temporal/quota.py:51`                                                                            |
| LangGraph seam    | ONLY `activities.py:508` imports `api.graph`; `LANGGRAPH_ENABLED=false` default             | `graph/__init__.py:15`                                                                            |
| Cost tracking     | per-agent/per-workspace `UsageRecord`, router mounted                                       | `services/agent_costs.py`, `main.py`                                                              |
| Injection defense | middleware + classifier + regex validator                                                   | `middleware/prompt_injection.py`, `services/injection_classifier.py`, `services/llm_validator.py` |
| Tenant isolation  | 42/42 RLS fail-closed                                                                       | migration `0020`                                                                                  |
| Evals (keyword)   | `AgentEvaluator`, `tests/eval/` (golden_retrieval, learning_closure, rrf, ws_comprehensive) | `infrastructure/agent_eval.py`                                                                    |

**Known findings this plan resolves:** F-LG-03 (`MemorySaver` process-local,
langgraph plan §0.2) — Wave 3 fixes the general case.

---

## 1. Forensic Gaps (all verified @ HEAD 2026-09-06, evidence hierarchy: grep > read)

| #    | Gap                                                                                                                                                                                                                                                                                     | Severity    | Evidence                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| G-01 | **Default loop path has zero spend/quota enforcement.** `agent_costs.py` contains no budget/limit/quota/block logic; `orchestrator/loop.py` contains no quota/spend/cost reference. Quotas exist ONLY on Temporal/LangGraph path, which frontend bypasses (`POST /agents/chat` direct). | 🔴 Critical | `grep quota\|budget\|spend\|cost loop.py` → 0 hits; `grep budget\|limit\|quota\|block\|exceed agent_costs.py` → 0 hits |
| G-02 | **ReAct depth hardcoded to 3 rounds.** Complex chains cannot complete; no per-task depth/token budget.                                                                                                                                                                                  | 🔴 Critical | `loop.py`: `for _round in range(3)`                                                                                    |
| G-03 | **Loop state is local-disk only.** Dies on restart; unshareable across replicas/workers. General case of F-LG-03.                                                                                                                                                                       | 🔴 Critical | `state.py`: `STATE_DIR = ~/.vaeloom/state`                                                                             |
| G-04 | **Evals are keyword-matching, not quality-judged.** No LLM-judge golden tasks, no quality regression gate in CI. Langgraph plan §0.3 confirms "evaluation is trivial".                                                                                                                  | 🟡 High     | `agent_eval.py`: `expected_keywords` / `forbidden_keywords`, `_score_response` heuristic                               |
| G-05 | **No conversation compaction.** Only crude truncation anywhere in the loop path.                                                                                                                                                                                                        | 🟡 High     | `loop.py`: `context_prompt[:2000] + "[truncated context]"`; no summarize/compact logic                                 |
| G-06 | **Prompts hardcoded, unversioned.** 23 handlers + router keywords inline; no A/B, hot-fix, or rollback without deploy.                                                                                                                                                                  | 🟡 High     | `agents/*/handler.py` mission inline; `router.py` `CATEGORY_KEYWORDS` inline                                           |
| G-07 | **No adversarial testing of the live loop.** `security/` + `chaos/` + `fuzz/` empty; injection defense is static regex, bypassable.                                                                                                                                                     | 🟡 High     | `llm_validator.py:15-29` `INJECTION_PATTERNS`; empty test dirs per AGENTS.md 10.x                                      |

---

## 2. Waves (strict order — each gates the next; user GO required per wave)

### Wave 0 — Forensic reconfirmation (no code)

Re-run every grep/read in §1 at execution HEAD, record commit hash + line
numbers. **Exit:** §1 table re-signed or amended. No code changes.

### Wave 1 — Spend ceilings + loop budgets (G-01, G-02) — HIGHEST RISK

- Per-workspace **spend budget** in `agent_costs.py`: `set_budget()` /
  `check_budget()` consulted by `loop.py` BEFORE each LLM call and tool round;
  hard-stop with user-facing "budget exhausted" card when exceeded.
- **Unified quota check**: reuse `temporal/quota.py` Redis Lua counters on the
  default loop path (no new quota system — one system, two call sites).
- **Configurable loop budget**: `MAX_REACT_ROUNDS` + `MAX_LOOP_TOKENS` per task
  tier (extend `TASK_MODEL_MAP` tiers in `model_router.py`); replaces hardcoded
  `range(3)`; fail-closed (budget exhausted → graceful fallback, never silent).
- Tests: mock-billing tests (budget set/exceeded/reset), round-limit tests (3→N
  configurable), quota-parity test (loop path == temporal path counters).
- **Exit:** runaway-loop burn test capped; quota counters increment identically
  on both paths; full per-file pytest green.

### Wave 2 — Judge evals + red-team set (G-04, G-07)

- **LLM-judge golden tasks**: extend `AgentEvaluator` with judge scoring
  (rubric: correctness, grounding, safety; mock-safe via `mock_llm` fixture);
  12+ golden cases through the real orchestrator (pattern: MVP-P12's 12 eval
  cases through orchestrator).
- **Quality regression gate**: eval suite runs in CI; score drop > threshold =
  FAIL (not advisory).
- **Red-team set**: 20+ adversarial cases (injection, jailbreak, tool-abuse,
  exfiltration attempts) executed against the LIVE loop; regex defense measured,
  classifier-gated paths verified; results in `tests/security/`.
- **Exit:** judge evals green in CI; red-team set documents bypass rate and
  closes it to 0 on covered classes.

### Wave 3 — Shared loop state (G-03)

- `LoopState` backend abstraction: local-disk (default, dev) + Redis (prod,
  shared across replicas/workers); resolves F-LG-03 general case.
- Migration: expand–contract (dual-write → verify → cutover), resume-after-
  restart drill, cross-replica resume test.
- **Exit:** kill -9 mid-loop → resume from shared state; two replicas share one
  loop.

### Wave 4 — Context compaction (G-05)

- Summarization-based history compaction in `loop.py` (threshold-triggered,
  provenance-preserving: compacted summary cites retained message IDs).
- RAG bundle budget per agent tier instead of flat 2000-char cut.
- **Exit:** 50-turn session stays under token budget with no fact loss on golden
  recall probes.

### Wave 5 — Prompt registry (G-06)

- Versioned prompt store (mission + handler system prompts + router keywords):
  version, author, activation flag, rollback; read-cached, DB-backed.
- A/B support (percent rollout by workspace hash — same pattern as LangGraph
  `percent sha256(request_id)%100`); change log feeds CONT-P12 audit.
- **Exit:** prompt hot-fix without deploy demonstrated; rollback drill passes.

---

## 3. Test Strategy (repo constraints, non-negotiable)

- Full suite hangs under xdist (finding 39) → **per-file runs** or serial
  (`-o addopts=""`); mock backend (`mock_llm`, `mock_connector_test` autouse).
- Every wave: new tests colocated (`tests/` + `tests/security/` for Wave 2);
  coverage must not drop below 94%.
- Zero-trust rule: every claim cites `file:line`; no invented metrics.

## 4. Gate & Handoff (per-wave)

Each wave produces: predecessor re-audit → requirements → tests/security →
weighted gate (GO / CONDITIONAL GO / NO-GO) → handoff authorizing the next wave.
Evidence lands in `docs/phases/agentic-safety-w<N>/`. Wave 5 handoff feeds
**CONT-P12 predecessor audit** directly.

## 5. Non-Goals (explicit)

- No agent rewrites; no prompt-content changes (Wave 5 is plumbing only).
- No Temporal/LangGraph migration decision (companion plan owns it).
- No frontend work except budget-exhausted / approval cards if missing.
- No SAML/RBAC/test-harness fixes (owned by ENT track + finding 39).

---

## 6. Approval Ask

- [ ] Approve Waves 0+1 (recon + spend ceilings) to start on user command
- [ ] Approve full Wave 0→5 sequence
- [ ] Amend (comment what changes)
