# Module 05: Cost & Token Budgeting Controls
**Audit Identifier**: `AUD-M05-AI-28`
**Scope**: Token budgeting, USD cost estimation, loop ceilings, and runaway spend protection.

---

## 1. Budgeting Architecture

Implemented in `api/orchestrator/loop_safety.py`:
- `LoopSafetyTracker`: Enforces execution boundaries per agent run:
  - `max_tokens`: Total tokens consumed across tool executions and LLM generation.
  - `max_cost_usd`: Maximum allowable dollar expenditure per run.
  - `detect_cycle()`: Tracks repetitive tool calls to prevent infinite loops.

---

## 2. Hard Limits & Fail-Safe Behavior

When a token or USD budget is exceeded:
- `tracker.check_budgets()` returns `"token_budget"` or `"cost_budget"`.
- The agent loop immediately terminates and returns a safe fallback explanation to the user, preventing unbudgeted billing spikes.

---

## 3. Verification Evidence

- `test_module05_cost.py`:
  - `test_token_budget_enforcement`: Confirms loop stops upon reaching max token cap.
  - `test_cost_budget_enforcement`: Confirms loop stops upon reaching USD cost ceiling.
  - `test_infinite_loop_cycle_detection`: Confirms 3x repetitive calls trip cycle breaker.
