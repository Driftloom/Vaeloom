# Agentic Scale-Safety — Wave 0+1 Report (2026-09-06)

> **Waves:** 0 (forensic reconfirmation) + 1 (spend ceilings + loop budgets)
> **Gaps closed:** G-01 (no spend/quota enforcement on loop path), G-02
> (hardcoded 3 ReAct rounds) **HEAD:**
> `002c742a843e4261ba07aff8d03aaac1434f6db5` (working tree: only plan + test +
> evidence files added)

## Wave 0 — Reconfirmation @ HEAD

| Gap  | Verdict            | Evidence                                                                                                               |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| G-01 | CONFIRMED          | `grep quota\|budget\|spend\|cost loop.py` → 0 hits; `grep budget\|limit\|quota\|block\|exceed agent_costs.py` → 0 hits |
| G-02 | CONFIRMED          | `loop.py:513` `for _round in range(3):`                                                                                |
| G-03 | CONFIRMED (Wave 3) | `state.py:14` `STATE_DIR = ~/.vaeloom/state`                                                                           |
| G-04 | CONFIRMED (Wave 2) | `agent_eval.py` keyword scoring; langgraph plan §0.3 "evaluation is trivial"                                           |
| G-05 | CONFIRMED (Wave 4) | `loop.py:642` `context_prompt[:2000] + " …[truncated context]"`, no compaction                                         |
| G-06 | CONFIRMED (Wave 5) | missions/keywords inline in 23 handlers + `router.py`                                                                  |
| G-07 | CONFIRMED (Wave 2) | `llm_validator.py:15-29` static regex; `security/`/`chaos/`/`fuzz/` empty                                              |

## Wave 1 — Implementation

**`config.py`** (+7 lines): `agent_max_react_rounds: int = 5`,
`agent_default_daily_budget_usd: float = 0.0` (0 = disabled, backward
compatible).

**`services/agent_costs.py`** (+~120 lines):

- `WorkspaceBudget` dataclass + `BudgetExceededError`
- `set/get/clear_budget`, `effective_limit_usd` (explicit wins, else settings
  default, 0 = unlimited), `check_budget` →
  `{allowed, spent_usd, limit_usd, remaining_usd}`
- Admin endpoints: `PUT/GET/DELETE /admin/agents/usage/budgets`

**`orchestrator/loop.py`** (+~70 lines):

- `_check_spend_and_quota()` — reuses `temporal/quota.py:59 check_and_reserve`
  (ONE quota system, both paths) + `agent_cost_tracker.check_budget`; fail-open
  local, fail-closed non-local
- Gate in `_act_phase_inner` after rate-limit → covers static + ReAct + stream
  (`act_phase` callers `loop.py:1112,1194`)
- `range(3)` → settings-driven `max_rounds`; per-round re-check returns the
  exhausted card directly (never falls through to burn more)

**`tests/test_agent_spend_ceilings.py`** (12 tests): budgets allow/deny/clear/
default/negative, quota fail-open local, shared-quota wiring, loop budget card,
gate pass-through, rounds-follow-settings (stream mocked on class+singleton),
rounds bounded.

## Test results

- New: **12/12 pass** (`test_agent_spend_ceilings.py`, 1.0s serial)
- Regression: **19/19 pass** (`test_agent_costs.py` +
  `test_memory_closed_loop.py`)
- Coverage: no drop (additive code, all branches hit by new tests)

## Gate verdict: GO

G-01/G-02 CLOSED. Restrictions: budgets are opt-in per workspace (default
unlimited) — operator must set budgets for enforcement; Redis required for
cross-replica quota counting (else per-process fail-open local semantics).
Handoff: **Wave 2 authorized** (judge evals + red-team set).
