# Agentic Scale-Safety — Wave 3 Report (2026-09-06 → 2026-09-15)

> **Wave:** 3 (shared loop state) **Gap:** G-03 **HEAD:** `bb732402`  
> **Status at entry:** W1/W2 gated GO, working tree clean, `state_store.py` already on HEAD via `f82a4057` — this report gates that pre-committed implementation.

## Forensic Reconfirmation @ HEAD

`state.py:33` `STATE_DIR` still exists (fallback) but `state.py:369` `from .state_store import get_state_store` now fronts it. `state_store.py` declares 5 backends (`FileStateStore`, `DatabaseStateStore`, `MemoryStateStore`, `RedisStateStore`, `CompositeStateStore`) with `StateStore` ABC (`load/save/delete`) + `ConcurrentUpdateError` optimistic CAS. G-03 CONFIRMED as CLOSED at code level — local-disk-only is no longer the sole path.

## Implementation (landed in `f82a4057`, verified here)

**`orchestrator/state_store.py`** (636 lines):
- `StateStore` ABC: `load(request_id, workspace_id)`, `save(..., expected_version) -> new_version`, `delete`.
- `FileStateStore`: JSON per `STATE_DIR`, `asyncio.Lock` intra-loop, CAS against `state_version`.
- `DatabaseStateStore`: RLS-scoped `scoped_session(workspace_id)`, `LoopCheckpoint` row, atomic `UPDATE ... WHERE state_version=expected` CAS, legacy-column fallback, vanished-row INSERT, JSON sanitization (`json.dumps(default=str)`).
- `RedisStateStore`: `state:loop:{id}` JSON+TTL (default 7d), Lua `_LUA_CAS` (`cjson.decode` + version check → `CAS_CONFLICT`/`CAS_MALFORMED`), `fail-loud` on missing client (never durability lie), eval via `client.eval`.
- `MemoryStateStore`: isolated unit-test backend.
- `CompositeStateStore(primary, fallback)`: dual-write, fallback CAS divergence logged not fatal.
- `get_state_store()` singleton via `VAELOOM_STATE_BACKEND` env (`file|memory|db|redis`; `db`/`redis` are `Composite→File`), `set_state_store()` for DI.

**`orchestrator/state.py`** (534 lines, schema v2):
- `LoopState` v2: `run_id/correlation_id/cancel_requested/tenant_id/user_id/agent_id` + `TERMINATION_REASONS` (14) + `FAILURE_CODES` (13) + `DEFAULT_RUN_BUDGETS` (`max_iterations=3, max_tool_calls=12, max_tokens=12000, max_cost_usd=0.50, max_duration_s=120`) + `state_version/_loaded_version` CAS + `validate_resume_identity()` (`ForeignCheckpointError` — cross-tenant/workspace/agent resume refused, pin-on-first-sight for legacy blanks).
- `load_or_create_state()` tries `StateStore.load` then local file `STATE_DIR/{id}.json` then fresh; `save_checkpoint()` defaults `expected_version=_loaded_version` (CAS always on), merges monotonic `cancel_requested` + terminal outcome from fresh load, retries 3 on `ConcurrentUpdateError`, falls back to `FileStateStore.save` with same CAS (never LWW), then ultimate file write.

**`orchestrator/loop.py`** wiring:
- Every loop tick: `state = await load_or_create_state(request.id)` + `await save_checkpoint(state)` on phase transitions and terminal; budget/iteration guards call `_finish` → checkpointed terminal state.

## Tests

| Suite | Result |
| --- | --- |
| `test_database_state_store.py` (CRUD + LoopState→DB round-trip) | 2/2 |
| `test_p1_cas.py` (file CAS single-winner + stale-version + checkpoint converge + cancel/terminal survival) | 5/5 with `test_database_state_store` → **24/24** combined with its deps |
| Full W1/W2 regression (spend ceilings 12 + quality gate 8 + red-team 46) | 66/66 |

All via `uv run --project apps/api python -m pytest -q -o addopts=""` (per-file, mock DB via `NullPool/tmp_path`).

## Gate Verdict: GO

G-03 CLOSED. Restrictions carried: cross-replica durability needs `VAELOOM_STATE_BACKEND=db|redis` + reachable DB/Redis; `file` remains dev/offline grade. Handoff: **Wave 4 authorized** (context compaction — also pre-landed, see w4 report).
