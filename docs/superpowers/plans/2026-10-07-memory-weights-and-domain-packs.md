# Memory Weights + Domain-Pack Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist per-(user, workspace) ranking weights learned from recommendation feedback, and replace the hard-coded memory taxonomy with a domain-pack registry so a second domain is configuration, not a code change.

**Architecture:** Two independent deploys. Deploy 1 adds an additive `ranking_weight_profiles` table with FORCE RLS and teaches `SearchRankingService` to accept resolved weights via `user_context["weights"]`; the async caller in `orchestrator/loop.py` resolves them from the DB. Deploy 2 adds `memory_type_packs`, backfills provenance onto `memories`, drops the `ck_memories_type_valid` CHECK, and generates the frontend union from the pack.

**Tech Stack:** Python 3.12, SQLAlchemy 2.x async, Alembic, Pydantic v2, FastAPI, PostgreSQL + pgvector, pytest + pytest-asyncio, TypeScript (shared-types), ruff.

**Spec:** `docs/superpowers/specs/2026-10-07-memory-weights-and-domain-packs-design.md`

## Global Constraints

- **Never regress workspace/tenant isolation.** Every new table gets `ENABLE` + `FORCE ROW LEVEL SECURITY` plus a scoped policy, or migration `0066`'s schema-wide invariant fails the chain.
- **Migration DDL must use the re-raising `_safe()` helper** from `0062_capability_usage_telemetry.py:48` — savepoint + `raise`, never print-and-continue. The silent-swallow variant is what hid the 2026-09 defects.
- **Migrations are PostgreSQL-only.** Guard with `if bind.dialect.name != "postgresql": return`. SQLite test runs skip DDL.
- **No fabricated scores.** Unknown/absent signal scores `0.0`. Never invent a relevance constant.
- **Retrieval semantics do not change.** Do not modify `memory_service.search_memories`, `context_engine.py`, or `vector_store.py`. This plan is orthogonal to them.
- **Best-effort where specified.** Provenance writes and weight updates never fail the user's primary write.
- **Learned weight bounds:** `user_preference` stays within `[0.05, 0.5]`; movement requires `sample_size >= 10`.
- **Weight resolution order:** DB row > `RANKING_WEIGHTS` env JSON > `DEFAULT_WEIGHTS`. With no DB row, behaviour is byte-identical to today.
- **Frontend union is generated, not hand-maintained.** The drift test is the point of Deploy 2.
- **Git safety:** a concurrent process commits in this repo. Stage explicit paths only; never `git checkout`, `git reset`, or bulk `git add`. Do not touch `stash@{0}` (`wip-verify`) or `stash@{1}` (`lint-staged automatic backup`).
- **Test runner:** the repo's `pytest` default (`-n 4`) is unreliable on Windows (finding 39). Always run `-o addopts=""` serially.

## Review Focus

Five failure modes the spec implies that no single task's tests naturally cover — each has a test assigned below.

1. **No profile row exists yet, but ranking still runs.** A brand-new user/workspace must get today's exact scores, not zeros or a crash. → Task 1, Step 1.
2. **Feedback with no matching profile.** A rating for a user who has never ranked anything must not crash or create a phantom workspace-wide profile. → Task 3, Step 1.
3. **Two users in the same workspace.** Profiles must not bleed across users; `user_preference` learned by user A must not change user B's ranking. → Task 2, Step 1 (`test_two_users_same_workspace_do_not_share_weights`).
4. **`RANKING_WEIGHTS` env var is malformed JSON or missing keys.** Must fall through to defaults, not raise. → Task 1, Step 1 (`test_env_weights_malformed_json_falls_through`, `test_env_weights_missing_key_falls_through`).
5. **A memory is created with a type valid in a *different* pack.** Validation must reject with a message naming the pack, not silently accept. → Task 5, Step 1.

---

## File Structure

**Deploy 1 — learned ranking weights**

| File | Responsibility |
| --- | --- |
| `apps/api/alembic/versions/0067_ranking_weight_profiles.py` | Additive table + forced RLS + policy. Reverts by dropping one table. |
| `apps/api/src/api/models/schema.py` | Add `RankingWeightProfile` ORM model. |
| `apps/api/src/api/services/ranking_weights.py` **(new)** | Resolves weights for `(workspace_id, user_id)`; owns the env-fallback and the learning arithmetic. Single responsibility: no HTTP, no ranking maths. |
| `apps/api/src/api/services/search_ranking.py` | Read `user_context["weights"]` when present; otherwise current env/default path. |
| `apps/api/src/api/services/recommendation_service.py` | Call `ranking_weights.record_feedback_signal` after a feedback insert. |
| `apps/api/tests/test_ranking_weights.py` **(new)** | Unit tests for resolution + learning bounds. |
| `apps/api/tests/test_ranking_weights_rls.py` **(new)** | Live-Postgres isolation tests (skipped without PG). |

**Deploy 2 — domain-pack registry**

| File | Responsibility |
| --- | --- |
| `apps/api/alembic/versions/0068_memory_type_packs.py` | Pack table + service-role policy + seed `career`, backfill `memories`, drop `ck_memories_type_valid`. |
| `apps/api/src/api/models/schema.py` | Add `MemoryTypePack` ORM model; add `type_pack_slug` / `type_pack_version` to `Memory`. |
| `apps/api/src/api/services/memory_type_packs.py` **(new)** | Load active packs; validate a type against them. No schema, no DB session creation. |
| `apps/api/src/api/schemas/memory.py` | `MemoryCreate.type` widens `Literal` → `str`; `ENTERPRISE_MEMORY_TYPES` / `CANONICAL_6` become pack-derived. |
| `apps/api/src/api/services/memory_service.py` | Call pack validation in `create_memory`. |
| `scripts/gen_memory_type_union.py` **(new)** | Reads packs, emits `packages/shared-types/src/types/memory.generated.ts`. |
| `packages/shared-types/src/types/memory.generated.ts` **(new, generated)** | Committed union. Hand edits are drift. |
| `packages/shared-types/src/types/memory.ts` | Re-export from the generated file. |
| `apps/api/tests/test_memory_type_packs.py` **(new)** | Seed snapshot, validation, rejection. |

---

# Deploy 1 — Learned Ranking Weights

### Task 1: Weight resolution service

**Files:**
- Create: `apps/api/src/api/services/ranking_weights.py`
- Test: `apps/api/tests/test_ranking_weights.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `WEIGHT_KEYS: tuple[str, ...]` = `("relevance", "recency", "importance", "user_preference")`
  - `env_weights() -> dict[str, float] | None` — parses `RANKING_WEIGHTS`; returns `None` on malformed JSON or missing any of `WEIGHT_KEYS`.
  - `effective_weights(db: AsyncSession, workspace_id: str, user_id: str | None) -> dict[str, float]` — the precedence chain: DB row, else `env_weights()`, else `DEFAULT_WEIGHTS`. Never raises; a DB error falls through to the env/default pair.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/test_ranking_weights.py`. These are pure-logic tests that mock the DB, so this task is runnable before Task 2's ORM model exists.

```python
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from api.services import ranking_weights as rw

pytestmark = pytest.mark.asyncio


def _db_returning(row):
    db = AsyncMock()
    result = AsyncMock()
    result.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result)
    return db


def _profile(**over):
    base = dict(relevance=0.4, recency=0.3, importance=0.2, user_preference=0.1)
    return SimpleNamespace(**{**base, **over})


async def test_missing_user_returns_default_weights(monkeypatch):
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    out = await rw.effective_weights(AsyncMock(), "ws", None)
    assert out == rw.DEFAULT_WEIGHTS


def test_env_weights_ignored_when_unset(monkeypatch):
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    assert rw.env_weights() is None


def test_env_weights_malformed_json_falls_through(monkeypatch):
    monkeypatch.setenv("RANKING_WEIGHTS", "{not json")
    assert rw.env_weights() is None


def test_env_weights_missing_key_falls_through(monkeypatch):
    monkeypatch.setenv("RANKING_WEIGHTS", '{"relevance": 0.5}')
    assert rw.env_weights() is None


def test_env_weights_valid_returns_all_four(monkeypatch):
    monkeypatch.setenv(
        "RANKING_WEIGHTS",
        '{"relevance":0.5,"recency":0.2,"importance":0.2,"user_preference":0.1}',
    )
    assert rw.env_weights() == {
        "relevance": 0.5,
        "recency": 0.2,
        "importance": 0.2,
        "user_preference": 0.1,
    }


async def test_env_weights_used_when_no_db_row(monkeypatch):
    monkeypatch.setenv(
        "RANKING_WEIGHTS",
        '{"relevance":0.5,"recency":0.2,"importance":0.2,"user_preference":0.1}',
    )
    out = await rw.effective_weights(_db_returning(None), "ws", "u")
    assert out["relevance"] == 0.5


async def test_db_row_beats_env(monkeypatch):
    monkeypatch.setenv(
        "RANKING_WEIGHTS",
        '{"relevance":0.9,"recency":0.2,"importance":0.2,"user_preference":0.1}',
    )
    out = await rw.effective_weights(_db_returning(_profile()), "ws", "u")
    assert out["relevance"] == 0.4, "DB profile must win over env"


async def test_db_error_falls_back_to_defaults(monkeypatch):
    """Review Focus #1: a DB failure must not break ranking."""
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = AsyncMock()
    db.execute = AsyncMock(side_effect=RuntimeError("db down"))
    out = await rw.effective_weights(db, "ws", "u")
    assert out == rw.DEFAULT_WEIGHTS
```

There is deliberately **no** `RowStub` in production code. Task 2's tests use the real `RankingWeightProfile` ORM model against a real session.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py -q -o addopts=""
```
Expected: collection error, `ModuleNotFoundError: No module named 'api.services.ranking_weights'`

- [ ] **Step 3: Create `apps/api/src/api/services/ranking_weights.py`**

Copy `DEFAULT_WEIGHTS` verbatim from `search_ranking.py:7-12` so today's numbers cannot drift. Define:

```python
WEIGHT_KEYS: tuple[str, ...] = ("relevance", "recency", "importance", "user_preference")

def env_weights() -> dict[str, float] | None:
    """RANKING_WEIGHTS JSON, or None when unset/malformed/missing a key.

    Returning None (not a partial dict) is deliberate: a half-specified env var
    must fall through to DEFAULT_WEIGHTS rather than silently zeroing a weight.
    """
```

`effective_weights` order of operations: if `user_id` is falsy → `env_weights() or DEFAULT_WEIGHTS`. Otherwise `SELECT` the profile with `.scalar_one_or_none()`; on any exception log at debug and return the same fallback; on a row return its four values as floats; on no row return the same fallback.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py -q -o addopts=""
```
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/api/services/ranking_weights.py apps/api/tests/test_ranking_weights.py
git commit -m "feat(ranking): add weight resolution with DB > env > default precedence"
```

### Task 2: Table, forced RLS, ORM model, and isolation tests

**Files:**
- Create: `apps/api/alembic/versions/0067_ranking_weight_profiles.py`
- Modify: `apps/api/src/api/models/schema.py` (append after `MemoryTaxonomyLedger`)
- Test: `apps/api/tests/test_ranking_weights_rls.py`

**Interfaces:**
- Consumes: `ranking_weights.effective_weights` (Task 1).
- Produces: `api.models.schema.RankingWeightProfile` with fields `id, tenant_id, workspace_id, user_id, relevance, recency, importance, user_preference, sample_size, updated_at`. `select(RankingWeightProfile).where(workspace_id == ..., user_id == ...)` returns the row Task 1 expects.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_ranking_weights_rls.py`. Two parts.

Unit part (runs everywhere, uses `db_session`):

```python
import uuid
import pytest
from sqlalchemy import select

from api.models.schema import RankingWeightProfile
from api.services.ranking_weights import effective_weights

pytestmark = pytest.mark.asyncio


async def test_profile_roundtrips_through_session(db_session):
    ws, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(
        RankingWeightProfile(
            tenant_id=tenant, workspace_id=ws, user_id=user,
            relevance=0.4, recency=0.3, importance=0.2, user_preference=0.25,
            sample_size=12,
        )
    )
    await db_session.flush()

    row = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalar_one()
    assert row.user_preference == 0.25

    out = await effective_weights(db_session, str(ws), str(user))
    assert out["user_preference"] == 0.25


async def test_two_users_same_workspace_do_not_share_weights(db_session):
    ws, tenant = uuid.uuid4(), uuid.uuid4()
    a, b = uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=a,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.45, sample_size=30,
    ))
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=b,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.05, sample_size=30,
    ))
    await db_session.flush()

    out_a = await effective_weights(db_session, str(ws), str(a))
    out_b = await effective_weights(db_session, str(ws), str(b))
    assert out_a["user_preference"] == 0.45
    assert out_b["user_preference"] == 0.05, "user A's learned weight must not affect user B"


async def test_other_workspace_profile_not_returned(db_session):
    ws_a, ws_b, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws_b, user_id=user,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.45, sample_size=30,
    ))
    await db_session.flush()

    out = await effective_weights(db_session, str(ws_a), str(user))
    assert out["user_preference"] != 0.45, "must not read another workspace's profile"
```

Live-Postgres part — follow the skip pattern in `apps/api/tests/test_rls_live_pg.py` (skip unless a PG URL is configured):

```python
@pytest.mark.skipif(not os.environ.get("TEST_PG_URL"), reason="requires live PostgreSQL")
async def test_profile_row_invisible_from_other_workspace_guc(...):
    """Set app.workspace_id to B, then assert the A profile is not returned."""
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights_rls.py -q -o addopts=""
```
Expected: `ImportError: cannot import name 'RankingWeightProfile'`

- [ ] **Step 3: Add the migration**

Create `alembic/versions/0067_ranking_weight_profiles.py` with `revision = "0067"`, `down_revision = "0066"`. Copy `_safe()` verbatim from `0062_capability_usage_telemetry.py:48-64`.

`upgrade()`:

```python
if bind.dialect.name != "postgresql":
    return
```

Create table `ranking_weight_profiles` per the spec's column list: `id UUID PK`, `tenant_id UUID NOT NULL`, `workspace_id UUID NOT NULL`, `user_id UUID NOT NULL`, the four weights `NUMERIC(5,4) NOT NULL` with `DEFAULT 0.4 / 0.3 / 0.2 / 0.1`, `sample_size INTEGER NOT NULL DEFAULT 0`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Unique constraint on `(workspace_id, user_id)`; index on `workspace_id`.

Then enable + force RLS and create the policy, copying the `USING (...)` expression from `0062:133-152` verbatim and substituting `ranking_weight_profiles` for `workspace_capabilities`. Use a distinct policy name `p_ranking_weight_profiles_workspace_isolation`.

Reuse 0062's "policy already exists → skip creation" guard (lines 128-133) so re-running is idempotent, but keep `_safe` re-raising.

`downgrade()` drops the table.

- [ ] **Step 4: Add the ORM model**

Append to `apps/api/src/api/models/schema.py` after `MemoryTaxonomyLedger`. Fields matching the migration exactly. `NUMERIC` columns map as `Mapped[float]` using the `Numeric` import already present in that module — check the existing import list before adding one.

- [ ] **Step 5: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights_rls.py tests/test_ranking_weights.py -q -o addopts=""
```
Expected: all pass (PG test skips without `TEST_PG_URL`).

- [ ] **Step 6: Run the migration chain test**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_migration_chain_pg.py -q -o addopts=""
```
Expected: skip without live PG, or pass. This is the gate that `0066`'s schema-wide RLS invariant still holds.

- [ ] **Step 7: Commit**

```bash
git add apps/api/alembic/versions/0067_ranking_weight_profiles.py apps/api/src/api/models/schema.py apps/api/tests/test_ranking_weights_rls.py
git commit -m "feat(ranking): add ranking_weight_profiles table with forced RLS"
```

### Task 3: Learn from recommendation feedback

**Files:**
- Modify: `apps/api/src/api/services/ranking_weights.py`
- Modify: `apps/api/src/api/services/recommendation_service.py:173-194` (`record_feedback`)
- Test: `apps/api/tests/test_ranking_weights.py` (append)

**Interfaces:**
- Consumes: `RankingWeightProfile` (Task 2).
- Produces: `record_feedback_signal(db: AsyncSession, *, user_id: str, workspace_id: str | None, useful: bool) -> None` — best-effort, never raises. Also `compute_user_preference(useful_count: int, total_count: int, current: float) -> float` (pure, exported for testing).

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/test_ranking_weights.py`:

```python
# ─── learning arithmetic ───────────────────────────────────────────────────

def test_compute_needs_minimum_sample():
    assert rw.compute_user_preference(9, 10, 0.1) == 0.1, "under 10 samples, no movement"


def test_compute_all_useful_pushes_up_but_bounded():
    v = rw.compute_user_preference(100, 100, 0.1)
    assert v > 0.1
    assert v <= 0.5


def test_compute_all_unhelpful_pushes_down_but_bounded():
    v = rw.compute_user_preference(0, 100, 0.4)
    assert v < 0.4
    assert v >= 0.05


def test_compute_even_rate_holds_steady():
    assert rw.compute_user_preference(5, 10, 0.2) == pytest.approx(0.2)


# ─── signal recording ──────────────────────────────────────────────────────

async def test_record_feedback_without_profile_is_noop(db_session, monkeypatch):
    """Review Focus #2: a rating from a user who never ranked must not create
    a phantom profile."""
    ws = str(uuid.uuid4())
    await rw.record_feedback_signal(
        db_session, user_id=str(uuid.uuid4()), workspace_id=ws, useful=True
    )
    rows = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalars().all()
    assert rows == [], "must not invent a profile for a user with no ranking history"


async def test_record_feedback_failure_does_not_raise(db_session, monkeypatch):
    """Best-effort: weight update never breaks the feedback write."""
    monkeypatch.setattr(
        rw, "compute_user_preference",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    await rw.record_feedback_signal(
        db_session, user_id=str(uuid.uuid4()), workspace_id=str(uuid.uuid4()), useful=True
    )
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py -q -o addopts="" -k "compute or record_feedback"
```
Expected: `AttributeError: module 'api.services.ranking_weights' has no attribute 'compute_user_preference'`

- [ ] **Step 3: Implement**

Add to `ranking_weights.py`:

```python
MIN_SAMPLES = 10
PREFERENCE_FLOOR = 0.05
PREFERENCE_CEILING = 0.5
PREFERENCE_SPAN = 0.3

def compute_user_preference(useful_count: int, total_count: int, current: float) -> float:
    """Move user_preference by useful-rate. Returns `current` below MIN_SAMPLES."""
```

Arithmetic: if `total_count < MIN_SAMPLES` → `current`. Else
`useful_rate = useful_count / total_count`, target `0.1 + 0.3 * (useful_rate - 0.5)`, then `clamp(target, 0.05, 0.5)`. With an even rate this reproduces `current` only when `current == 0.1`; to hold steady per the `test_compute_even_rate_holds_steady` assertion, blend toward the target instead of jumping:

```python
    target = PREFERENCE_FLOOR + PREFERENCE_SPAN * (useful_rate - 0.5)
    target = max(PREFERENCE_FLOOR, min(PREFERENCE_CEILING, target))
    # An even useful-rate must be a no-op, so move a bounded step toward target
    # rather than snapping to it.
    return current + (target - current) * 0.5
```

Verify the four arithmetic tests pass with this formula; adjust the blend factor if `test_compute_all_useful_pushes_up_but_bounded` or the steady-state test fails, and record the final factor in a comment.

`record_feedback_signal`: guard `if not user_id or not workspace_id: return`. Wrap the whole body in `try/except Exception` logging at debug. `SELECT` the profile; if none, return (do **not** create one). Otherwise `SELECT count(*)` and the useful count from `recommendation_feedback` for that `user_id`, set `sample_size = total`, and write the recomputed weight.

Note for the implementer: `recommendation_feedback` has **no `workspace_id`** (`0002_microservice_tables.py:202-210`). The profile is located by `user_id` + the passed `workspace_id`; the aggregate query filters on `user_id` only. This is the documented cross-workspace imprecision in the spec — implement it as written and do not "fix" it by guessing at a join.

- [ ] **Step 4: Call it from `record_feedback`**

In `recommendation_service.py`, after the `RETURNING` insert succeeds, add a best-effort call. The router (`recommendations.py:62`) does not pass `workspace_id` or `user_id` into `record_feedback` — `FeedbackRequest` only carries `recommendation_id` and `useful`. So the call must resolve the feedback row's `user_id` and take `workspace_id` from `dto` if present, else `None` (which `record_feedback_signal` treats as a no-op). Extend `FeedbackRequest` with optional `workspace_id: str | None = None` and `user_id: str | None = None` if the service needs them; do not change the endpoint's response shape.

- [ ] **Step 5: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/api/services/ranking_weights.py apps/api/src/api/services/recommendation_service.py apps/api/src/api/schemas/recommendation.py apps/api/tests/test_ranking_weights.py
git commit -m "feat(ranking): learn user_preference weight from recommendation feedback"
```

### Task 4: Wire resolved weights into the ranker

**Files:**
- Modify: `apps/api/src/api/services/search_ranking.py:32-48`
- Modify: `apps/api/src/api/orchestrator/loop.py:826-843` (the `_uc` block), and `_assemble_rag_context`'s signature at `:569-574`
- Test: `apps/api/tests/test_ranking_weights.py` (append), `apps/api/tests/test_agent_memory_wiring.py` (append)

**Interfaces:**
- Consumes: `ranking_weights.effective_weights` (Tasks 1-2), `AgentRequest.user_id` / `.workspace_id` (`loop.py:441,437`).
- Produces: `SearchRankingService.calculate_score(result, query, user_context)` and `rank_results(result, query, user_context)` read `user_context["weights"]` when that key is a dict containing all four of `WEIGHT_KEYS`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/tests/test_ranking_weights.py`:

```python
from api.services.search_ranking import SearchRankingService

def _cand(i, score=1.0):
    return {"id": str(i), "text": "alpha", "source": "memory",
            "metadata": {"importance": 1.0}, "score": score}


def test_weights_from_user_context_are_applied():
    svc = SearchRankingService(llm_service=None)
    w = {"relevance": 1.0, "recency": 0.0, "importance": 0.0, "user_preference": 0.0}
    got = svc.calculate_score(_cand(1), "alpha", user_context={"weights": w})
    assert got == pytest.approx(1.0)


def test_default_weights_used_when_user_context_has_no_weights():
    svc = SearchRankingService(llm_service=None)
    plain = svc.calculate_score(_cand(1), "alpha", user_context={"preferred_tags": []})
    absent = svc.calculate_score(_cand(1), "alpha", user_context=None)
    assert plain == pytest.approx(absent), "today's behaviour must be unchanged"


def test_partial_weights_dict_is_ignored():
    """Review Focus #4: a half-specified weights dict must not zero a signal."""
    svc = SearchRankingService(llm_service=None)
    got = svc.calculate_score(_cand(1), "alpha", user_context={"weights": {"relevance": 1.0}})
    default = svc.calculate_score(_cand(1), "alpha", user_context=None)
    assert got == pytest.approx(default)


def test_learning_shifts_ranking_order():
    svc = SearchRankingService(llm_service=None)
    a, b = _cand("a", 1.0), _cand("b", 1.0)
    base = svc.rank_results([a, b], "alpha")
    boosted = svc.rank_results(
        [dict(a), dict(b)], "alpha",
        user_context={"weights": {"relevance": 0.4, "recency": 0.3,
                                  "importance": 0.2, "user_preference": 0.1}},
    )
    assert base == boosted, "identical weights must produce identical scores"
```

And append to `test_agent_memory_wiring.py` a test asserting `_assemble_rag_context` accepts a `user_id` and passes resolved weights into `rank_results` (assert via `monkeypatch` on `search_ranking_service.rank_results` capturing `user_context`).

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py -q -o addopts="" -k "weights"
```
Expected: `test_weights_from_user_context_are_applied` fails — today `calculate_score` ignores a `weights` key.

- [ ] **Step 3: Read weights in the service**

In `calculate_score`, before weighting:

```python
weights = self._resolve_weights(user_context)
```

`_resolve_weights` returns `user_context["weights"]` when it is a dict containing **all four** `WEIGHT_KEYS`, else the existing `self._weights` (env/default). A partial dict is ignored, not merged — a half-specified profile must not silently zero a signal.

Replace the four `self._weights[...]` reads with the local `weights[...]`.

- [ ] **Step 4: Resolve in the async caller**

`_assemble_rag_context` gains a keyword-only `user_id: str | None = None` parameter. At `loop.py:833` pass `request.user_id`. Inside the `_uc` block, after building `_uc`, call:

```python
_uc["weights"] = await ranking_weights.effective_weights(session, workspace_id, user_id)
```

`session` is the already-open RLS-scoped session in that function. Wrap in the existing `try/except` so a failure leaves ranking on defaults.

Note for the implementer: `session` is opened inside the function's session-factory block; confirm the variable name at the point of use rather than assuming.

- [ ] **Step 5: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py tests/test_agent_memory_wiring.py tests/test_orchestrator.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 6: Regression**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_service.py tests/test_memory_vector_correctness.py tests/test_rrf_benchmark.py tests/eval/test_rrf_benchmark.py -q -o addopts=""
```
Expected: all pass. Retrieval semantics must be untouched.

- [ ] **Step 7: Lint and commit**

```bash
cd apps/api && uvx ruff check src/api/services/ranking_weights.py src/api/services/search_ranking.py src/api/orchestrator/loop.py tests/test_ranking_weights.py
git add apps/api/src/api/services/search_ranking.py apps/api/src/api/orchestrator/loop.py apps/api/tests/test_ranking_weights.py apps/api/tests/test_agent_memory_wiring.py
git commit -m "feat(ranking): apply resolved per-user weights in agent RAG ranking"
```

**Deploy 1 done.** Verify before continuing: run the full memory + orchestrator set once (Task 4 Step 6's list plus `tests/test_orchestrator_router.py`). If green, Deploy 1 is complete and independent.

---

# Deploy 2 — Domain-Pack Registry

> Do not start Deploy 2 until Deploy 1 is green and committed. Deploy 2 drops a CHECK constraint on `memories`.

### Task 5: Pack model, service, and seed

**Files:**
- Create: `apps/api/alembic/versions/0068_memory_type_packs.py`
- Create: `apps/api/src/api/services/memory_type_packs.py`
- Modify: `apps/api/src/api/models/schema.py`
- Test: `apps/api/tests/test_memory_type_packs.py`

**Interfaces:**
- Consumes: nothing from Deploy 1.
- Produces:
  - `api.models.schema.MemoryTypePack` with fields `id, slug, version, label, types, is_active, created_at`
  - `CAREER_TYPES: tuple[str, ...]` — the 24 values in source order (below)
  - `load_active_packs(db: AsyncSession) -> list[MemoryTypePack]`
  - `valid_types(db: AsyncSession) -> set[str]` — union of active packs' types
  - `validate_memory_type(db: AsyncSession, value: str) -> str` — returns `value`, or raises `ValueError` naming the pack slug(s) and the offending value.

`CAREER_TYPES` (exact order from `apps/api/src/api/schemas/memory.py:10-14`):

```python
CAREER_TYPES = (
    "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
)
```

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/test_memory_type_packs.py`:

```python
import pytest

from api.services.memory_type_packs import CAREER_TYPES, valid_types, validate_memory_type

pytestmark = pytest.mark.asyncio


def test_career_types_has_exactly_24():
    assert len(CAREER_TYPES) == 24


def test_career_types_matches_source_order():
    """Pins the exact list. A count check would miss a silent rename."""
    assert CAREER_TYPES == (
        "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
        "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
        "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
    )


async def test_seeded_career_pack_matches_constant(db_session):
    """The DB seed must equal CAREER_TYPES exactly — this is the drift guard."""
    from sqlalchemy import select
    from api.models.schema import MemoryTypePack
    packs = (await db_session.execute(
        select(MemoryTypePack).where(MemoryTypePack.slug == "career")
    )).scalars().all()
    assert len(packs) == 1
    assert tuple(packs[0].types) == CAREER_TYPES
    assert packs[0].version == 1
    assert packs[0].is_active is True


async def test_validate_accepts_every_career_type(db_session):
    for t in CAREER_TYPES:
        assert await validate_memory_type(db_session, t) == t


async def test_validate_rejects_unknown_type_naming_the_pack(db_session):
    with pytest.raises(ValueError) as exc:
        await validate_memory_type(db_session, "not_a_type")
    msg = str(exc.value)
    assert "career" in msg, "error must name the pack"
    assert "not_a_type" in msg, "error must name the offending value"


async def test_validate_rejects_type_from_a_different_pack(db_session):
    """Review Focus #5: a type valid elsewhere must be rejected here."""
    with pytest.raises(ValueError) as exc:
        await validate_memory_type(db_session, "person")
    assert "career" in str(exc.value)


async def test_inactive_pack_types_are_not_valid(db_session):
    from sqlalchemy import select
    from api.models.schema import MemoryTypePack
    pack = (await db_session.execute(
        select(MemoryTypePack).where(MemoryTypePack.slug == "career")
    )).scalar_one()
    pack.is_active = False
    await db_session.flush()
    assert "insight" not in await valid_types(db_session)
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py -q -o addopts=""
```
Expected: `ModuleNotFoundError: No module named 'api.services.memory_type_packs'`

- [ ] **Step 3: Migration `0068`**

`revision = "0068"`, `down_revision = "0067"`. Copy `_safe()` from 0062.

`upgrade()`, PostgreSQL-only:

1. Create `memory_type_packs` per the spec's column list.
2. Enable + force RLS. Use the **service-role** policy shape from `0053_rls_scoped_app_policies.py:201-208` (`TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true)`), named `p_memory_type_packs_service` — this is platform configuration, not tenant data, matching how `memory_taxonomy_ledger` is treated.
3. Seed one row: `slug='career'`, `version=1`, `label='Career'`, `types` = the 24 values as a JSON array in order, `is_active=true`. Insert with `ON CONFLICT (slug) DO NOTHING` so re-runs are safe.
4. `ALTER TABLE memories ADD COLUMN IF NOT EXISTS type_pack_slug VARCHAR(64)` and `type_pack_version INTEGER`.
5. Backfill: `UPDATE memories SET type_pack_slug='career', type_pack_version=1 WHERE type_pack_slug IS NULL`.
6. `ALTER TABLE memories DROP CONSTRAINT IF EXISTS ck_memories_type_valid;`

Log the pre-drop row count and the distinct type list before dropping, so a rollback has evidence.

`downgrade()`: re-add the CHECK with the 24 literals (from `0027_memory_taxonomy_expand_contract.py:77-81`), then drop the two columns and the pack table. Rehearse this before calling the migration reversible.

- [ ] **Step 4: ORM models**

`MemoryTypePack` in `schema.py` after `MemoryTaxonomyLedger`. `types` is a JSON/JSONB list — use the same column type as `Memory.metadata_` for consistency.

Add to the existing `Memory` class: `type_pack_slug: Mapped[str | None]` and `type_pack_version: Mapped[int | None]`. Put the `Memory` class's new fields before its `__table_args__`.

- [ ] **Step 5: `memory_type_packs.py`**

```python
CAREER_TYPES: tuple[str, ...] = (...)  # the 24, verbatim
CAREER_PACK_SLUG = "career"

def load_active_packs(db) -> list[MemoryTypePack]:  # SELECT WHERE is_active
async def valid_types(db) -> set[str]:
async def validate_memory_type(db, value: str) -> str:
```

`validate_memory_type` raises `ValueError(f"Invalid memory type {value!r}; valid types come from pack(s): {slugs}")`. If `valid_types` is empty (packs unavailable / DB error), **fall back to `set(CAREER_TYPES)`** and log at debug — an unavailable pack registry must not break memory creation.

- [ ] **Step 6: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/alembic/versions/0068_memory_type_packs.py apps/api/src/api/models/schema.py apps/api/src/api/services/memory_type_packs.py apps/api/tests/test_memory_type_packs.py
git commit -m "feat(memory): add memory_type_packs registry and seed career pack"
```

### Task 6: Validate against packs in the write path

**Files:**
- Modify: `apps/api/src/api/schemas/memory.py:10-21`
- Modify: `apps/api/src/api/services/memory_service.py` (`create_memory`, near line 39-121)
- Test: `apps/api/tests/test_memory_type_packs.py` (append), `apps/api/tests/test_memory_service.py` (append)

**Interfaces:**
- Consumes: `validate_memory_type(db, value)` (Task 5).
- Produces: `api.schemas.memory.enterprise_types_for(types: set[str]) -> set[str]` and `canonical_6_for(types: set[str]) -> set[str]` — pack-derived replacements for the module constants.

- [ ] **Step 1: Write the failing tests**

Append to `test_memory_type_packs.py`:

```python
async def test_create_memory_rejects_unknown_type(db_session):
    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService
    from pydantic import ValidationError
    # Pydantic no longer rejects at construction — the pack does, at write time.
    dto = MemoryCreate(type="totally_invalid", title="t")
    svc = MemoryService()
    with pytest.raises((ValueError, ValidationError)):
        await svc.create_memory(db_session, dto, tenant_id=None, user_id=None)


async def test_create_memory_records_pack_provenance(db_session):
    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService
    dto = MemoryCreate(type="insight", title="t", content="body")
    mem = await MemoryService().create_memory(
        db_session, dto, tenant_id=None, user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    assert mem.type_pack_slug == "career"
    assert mem.type_pack_version == 1
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py -q -o addopts="" -k "create_memory"
```
Expected: fails — `MemoryCreate(type="totally_invalid")` raises at Pydantic construction today (the `Literal` still exists), and `type_pack_slug` is not set.

- [ ] **Step 3: Widen the schema**

In `schemas/memory.py`, change `MemoryType = Literal[...]` to `MemoryType = str` and change `MemoryCreate.type`'s annotation to `str` with `Field(..., min_length=1, max_length=50)`.

Keep `ENTERPRISE_MEMORY_TYPES` and `CANONICAL_6` **defined** (many modules and tests import them) but reimplement them as pack-derived:

```python
ENTERPRISE_MEMORY_TYPES = set(CAREER_TYPES) - CANONICAL_6 - {"note", "fact"}
CANONICAL_6 = {"profile", "document", "career", "episodic", "preference", "working"}
```

Import `CAREER_TYPES` from `services.memory_type_packs`. Verify the resulting `ENTERPRISE_MEMORY_TYPES` still equals the current literal set of 16 — assert it in a test.

Add `model_validator` on `MemoryCreate` only for `min_length`/non-empty; **do not** re-implement the type whitelist here, or validation would happen before the pack lookup and the two would drift again.

- [ ] **Step 4: Validate in `create_memory`**

After the DB is available and before constructing the `Memory` row, call `await validate_memory_type(db, dto.type)`. Set `memory.type_pack_slug = "career"` and `memory.type_pack_version = 1` from the pack that matched — `validate_memory_type` should return the matching pack slug too. Prefer widening it to return a small `PackMatch(slug, version, types)` namedtuple so `create_memory` does not hard-code `career`.

If the returned value is a plain `str` in your implementation, re-query for the slug instead of hard-coding it.

- [ ] **Step 5: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py tests/test_memory_service.py tests/test_memory_types.py tests/test_enterprise_memory.py -q -o addopts=""
```
Expected: all pass. `test_memory_types.py` asserts `len(MemoryType) == 22` on the deprecated `memory_types` module — that module is a separate tombstone enum and is **out of scope**; leave it passing by not touching it.

- [ ] **Step 6: Regression across the codebase**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_filters.py tests/test_memory_workspace_isolation.py tests/test_memory_vector_correctness.py tests/test_agent_memory_wiring.py tests/integration/test_memory_api.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 7: Lint and commit**

```bash
cd apps/api && uvx ruff check src/api/schemas/memory.py src/api/services/memory_service.py src/api/services/memory_type_packs.py tests/test_memory_type_packs.py
git add apps/api/src/api/schemas/memory.py apps/api/src/api/services/memory_service.py apps/api/src/api/services/memory_type_packs.py apps/api/tests/test_memory_type_packs.py
git commit -m "feat(memory): validate memory types against domain packs at write time"
```

### Task 7: Generate the frontend union and guard drift

**Files:**
- Create: `scripts/gen_memory_type_union.py`
- Create: `packages/shared-types/src/types/memory.generated.ts`
- Modify: `packages/shared-types/src/types/memory.ts:15-51`
- Test: `apps/api/tests/test_memory_type_packs.py` (append) — the drift guard

**Interfaces:**
- Consumes: `CAREER_TYPES` and pack rows (Task 5).
- Produces: `packages/shared-types/src/types/memory.generated.ts` exporting `export type GeneratedMemoryType = ...`, and `memory.ts` re-exporting it as `MemoryType`.

- [ ] **Step 1: Write the failing test**

Append to `test_memory_type_packs.py`:

```python
def test_generated_union_matches_career_pack():
    """The drift guard — its absence is why frontend/backend diverged before."""
    import pathlib, re
    repo = pathlib.Path(__file__).resolve().parents[3]
    gen = repo / "packages/shared-types/src/types/memory.generated.ts"
    assert gen.exists(), "generated union file is missing; run scripts/gen_memory_type_union.py"
    text = gen.read_text(encoding="utf-8")
    found = set(re.findall(r"'([a-z_]+)'", text))
    assert found == set(CAREER_TYPES), (
        f"generated union drifted from the career pack: "
        f"only-in-generated={found - set(CAREER_TYPES)} "
        f"only-in-pack={set(CAREER_TYPES) - found}"
    )
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py -q -o addopts="" -k generated
```
Expected: `AssertionError: generated union file is missing`

- [ ] **Step 3: Generator script**

`scripts/gen_memory_type_union.py`:

```python
def render(types: list[str]) -> str:
    """Emit the TS union. Header comment says GENERATED - DO NOT EDIT."""
```

Call `render(list(CAREER_TYPES))`, write to `packages/shared-types/src/types/memory.generated.ts` with `\n` line endings. Add a `--check` flag that exits non-zero when the file on disk differs from the rendered output, so CI can verify freshness without writing.

The script must not import the FastAPI app or require a DB — read `CAREER_TYPES` from `api.services.memory_type_packs` after `sys.path` includes `apps/api/src`.

- [ ] **Step 4: Generate and re-export**

Run it once to create the file. In `memory.ts`, replace the hand-written 24-line union with:

```ts
import type { GeneratedMemoryType } from './memory.generated';
/** GENERATED from the backend domain-pack registry. Do not hand-edit. */
export type MemoryType = GeneratedMemoryType;
```

Keep the existing explanatory comment block above it — it documents a real past incident and should not be deleted.

- [ ] **Step 5: Run to verify it passes**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_memory_type_packs.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 6: Typecheck the frontend**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors. A failure here means some code referenced a union member the pack does not have — fix the call site, do not widen the pack.

- [ ] **Step 7: Commit**

```bash
git add scripts/gen_memory_type_union.py packages/shared-types/src/types/memory.generated.ts packages/shared-types/src/types/memory.ts apps/api/tests/test_memory_type_packs.py
git commit -m "feat(memory): generate TS union from domain packs with drift guard"
```

### Task 8: End-to-end verification and docs

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/verification/memory-audit.md`

- [ ] **Step 1: Whole-suite collection**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests --collect-only -q -o addopts=""
```
Expected: no collection errors. Compare the count against the pre-change baseline.

- [ ] **Step 2: Run the affected areas**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights.py tests/test_ranking_weights_rls.py tests/test_memory_type_packs.py tests/test_memory_vector_correctness.py tests/test_memory_service.py tests/test_memory_filters.py tests/test_memory_workspace_isolation.py tests/test_agent_memory_wiring.py tests/test_orchestrator.py tests/integration/test_memory_api.py tests/security/test_tenant_isolation.py tests/security/test_boundary_zero_trust_gaps.py -q -o addopts=""
```
Expected: all pass.

- [ ] **Step 3: Confirm pre-existing failures are unchanged**

Known-failing before this work, and **not** to be fixed here:

- `tests/eval/test_golden_retrieval.py::test_golden_retrieval_routing` (r15) — router/fixture drift between `b6505c04` and `f8e18c4a`.
- `tests/temporal/test_temporal_productionization.py::test_TE05_provider_fallback`
- `tests/temporal/test_temporal_productionization.py::test_TE25_full_combined`
- `tests/integration/test_profile_api.py::test_public_profile`
- `tests/integration/test_profile_api.py::test_get_avatar_public`
- `tests/test_tools_executor.py::test_execute_tool_permission_denied_during_exec` (only in a specific file ordering)

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/eval/test_golden_retrieval.py tests/temporal/test_temporal_productionization.py tests/integration/test_profile_api.py -q -o addopts=""
```
Expected: exactly those failures, no more. Any new failure is ours.

- [ ] **Step 4: Live-Postgres migration verification (when PG is available)**

```bash
cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_migration_chain_pg.py tests/test_rls_live_pg.py -q -o addopts=""
```
Expected: pass. This proves `0067` and `0068` apply cleanly and `0066`'s schema-wide RLS invariant still holds with the new tables.

- [ ] **Step 5: Lint everything touched**

```bash
cd apps/api && uvx ruff check src/api/services/ranking_weights.py src/api/services/memory_type_packs.py src/api/services/search_ranking.py src/api/services/memory_service.py src/api/services/recommendation_service.py src/api/schemas/memory.py src/api/models/schema.py src/api/orchestrator/loop.py alembic/versions/0067_ranking_weight_profiles.py alembic/versions/0068_memory_type_packs.py tests/test_ranking_weights.py tests/test_ranking_weights_rls.py tests/test_memory_type_packs.py
```
Expected: `All checks passed!`

- [ ] **Step 6: Update docs**

In `AGENTS.md`, add a subsection under the memory headings recording:

- `ranking_weight_profiles` exists, is FORCE RLS'd, and resolves `DB > env > default`.
- The learning signal is **useful-rate only**, because `recommendation_feedback` has no `workspace_id` and `recommendations.items` is opaque JSONB — the original relevance is not recoverable. Record the cross-workspace imprecision and that the fix is to add the column.
- `memory_type_packs` is the taxonomy source of truth; `ck_memories_type_valid` was dropped in `0068`; the frontend union is generated by `scripts/gen_memory_type_union.py` and guarded by a drift test.
- The deprecated `api.schemas.memory_types` tombstone enum (22 values, includes `person`/`education` which the pack does not) is **not** the taxonomy and was left in place for legacy tests.

In `docs/verification/memory-audit.md`, add a row noting the ledger now has a real writer and the CHECK is gone.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md docs/verification/memory-audit.md
git commit -m "docs(memory): record ranking weight profiles and domain-pack registry"
```

---

## Out of Scope

Do not implement any of these under this plan:

- The contract phase (re-adding a CHECK derived from packs) — a separate later deploy.
- Adding `workspace_id` to `recommendation_feedback` — noted as a follow-up in the spec.
- Graph traversal in `_assemble_rag_context`.
- The deprecated `api.schemas.memory_types` tombstone module.
- Any change to `memory_service.search_memories`, `context_engine.py`, `vector_store.py`.
- Adopting or vendoring Cognee.