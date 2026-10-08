import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine, select, text

from api.models.schema import RankingWeightProfile
from api.services import ranking_weights as rw
from api.services.search_ranking import SearchRankingService

pytestmark = pytest.mark.asyncio

_CREATE_TABLE = (
    "CREATE TABLE ranking_weight_profiles ("
    "workspace_id TEXT, user_id TEXT, "
    "relevance REAL, recency REAL, importance REAL, user_preference REAL)"
)

_ENV_ALL_FOUR = '{"relevance":0.5,"recency":0.2,"importance":0.2,"user_preference":0.1}'


def _db_returning(row):
    """Mock shaped like the access path production actually uses.

    Production calls db.execute(...) -> .mappings().one_or_none() -> row[key].
    Rows are plain dicts because that is what a RowMapping really behaves like:
    subscriptable by column name, NOT attribute-accessible.
    """
    db = AsyncMock()
    result = MagicMock()
    mappings = MagicMock()
    mappings.one_or_none.return_value = row
    result.mappings.return_value = mappings
    db.execute = AsyncMock(return_value=result)
    return db


def _profile(**over):
    base = {"relevance": 0.4, "recency": 0.3, "importance": 0.2, "user_preference": 0.1}
    return {**base, **over}


class _RealResultDb:
    """Executes production's OWN statement against real SQLite and returns the
    real SQLAlchemy Result.

    This is the test that a reviewer cannot defeat by changing how production
    reads the Result: production's generated SQL really runs, and the real
    driver's Result semantics really apply.
    """

    def __init__(self, rows):
        self.statements: list[str] = []
        self._engine = create_engine("sqlite://")
        with self._engine.begin() as conn:
            conn.execute(text(_CREATE_TABLE))
            for row in rows:
                conn.execute(
                    text(
                        "INSERT INTO ranking_weight_profiles "
                        "(workspace_id, user_id, relevance, recency, importance, user_preference)"
                        " VALUES (:workspace_id, :user_id, :relevance, :recency,"
                        " :importance, :user_preference)"
                    ),
                    {"workspace_id": "ws", "user_id": "u", **row},
                )

    async def execute(self, stmt, params=None):
        self.statements.append(str(stmt))
        with self._engine.connect() as conn:
            return conn.execute(stmt, params or {})


async def test_missing_user_returns_default_weights(monkeypatch):
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = AsyncMock()
    out = await rw.effective_weights(db, "ws", None)
    assert out == rw.DEFAULT_WEIGHTS
    db.execute.assert_not_awaited(), "falsy user_id must skip the DB entirely"


async def test_empty_user_id_also_skips_db(monkeypatch):
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = AsyncMock()
    out = await rw.effective_weights(db, "ws", "")
    assert out == rw.DEFAULT_WEIGHTS
    db.execute.assert_not_awaited()


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
    monkeypatch.setenv("RANKING_WEIGHTS", _ENV_ALL_FOUR)
    assert rw.env_weights() == {
        "relevance": 0.5,
        "recency": 0.2,
        "importance": 0.2,
        "user_preference": 0.1,
    }


async def test_env_weights_used_when_no_db_row(monkeypatch):
    monkeypatch.setenv("RANKING_WEIGHTS", _ENV_ALL_FOUR)
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


async def test_real_result_db_row_is_read(monkeypatch):
    """Proves the DB tier against REAL SQLAlchemy Result semantics.

    A 4-column select read via scalar_one_or_none() yields the first column's
    bare float (or raises), never a row -- this test fails on that bug.
    """
    monkeypatch.setenv(
        "RANKING_WEIGHTS",
        '{"relevance":0.9,"recency":0.2,"importance":0.2,"user_preference":0.1}',
    )
    db = _RealResultDb([_profile()])
    out = await rw.effective_weights(db, "ws", "u")
    assert out == {"relevance": 0.4, "recency": 0.3, "importance": 0.2, "user_preference": 0.1}
    assert out["relevance"] == 0.4, "real DB profile must win over env"


async def test_real_result_no_row_falls_back(monkeypatch):
    monkeypatch.setenv("RANKING_WEIGHTS", _ENV_ALL_FOUR)
    db = _RealResultDb([])
    out = await rw.effective_weights(db, "ws", "u")
    assert out["relevance"] == 0.5, "no real row must fall through to env"


async def test_real_result_workspace_isolation(monkeypatch):
    """A row belonging to another workspace must never be returned."""
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = _RealResultDb([_profile(relevance=0.99, workspace_id="other-ws")])
    out = await rw.effective_weights(db, "ws", "u")
    assert out == rw.DEFAULT_WEIGHTS, "cross-workspace profile must not leak"


async def test_real_result_user_isolation(monkeypatch):
    """A row belonging to another user must never be returned."""
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = _RealResultDb([_profile(relevance=0.99, user_id="someone-else")])
    out = await rw.effective_weights(db, "ws", "u")
    assert out == rw.DEFAULT_WEIGHTS, "cross-user profile must not leak"


async def test_real_result_duplicate_rows_do_not_degrade(monkeypatch):
    """LIMIT 1 keeps a duplicated (workspace_id, user_id) deterministic.

    Without it, one_or_none() raises MultipleResultsFound and the lookup
    silently degrades to the default weights.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = _RealResultDb([_profile(relevance=0.11), _profile(relevance=0.11)])
    out = await rw.effective_weights(db, "ws", "u")
    assert out["relevance"] == 0.11, "duplicate rows must not silently degrade"


async def test_select_is_limited_to_one_row(monkeypatch):
    """Important 4: the SELECT must carry LIMIT 1."""
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    db = _RealResultDb([])
    await rw.effective_weights(db, "ws", "u")
    selects = [s for s in db.statements if s.lstrip().upper().startswith("SELECT")]
    assert len(selects) == 1, f"expected exactly one SELECT, got {db.statements}"
    assert "LIMIT 1" in selects[0].upper()


# ─── provisioning: the learned tier is reachable ──────────────────────────────
#
# Review finding I1: 0067 seeded nothing, nothing else inserted a row, and
# `record_feedback_signal` returns early when no profile exists *by design*. So
# `effective_weights` always took `row is None -> _fallback_weights()`, the DB
# tier was unreachable, and the learner could never move a weight. Deploy 1 was
# inert while its docs claimed SEC-P2-01 resolved. The tests below are the proof
# it is no longer inert: the resolver provisions the caller's own row, and once
# it exists the learner can move it.


async def test_resolution_bootstraps_the_callers_profile(monkeypatch):
    """A user who has never ranked gets a profile on their first rank call.

    Asserted on the row itself, not on the returned weights: provisioning could
    return the right weights while writing nothing, and the returned weights are
    the fallback either way. Only the row makes the learned tier reachable.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    ws, user = uuid.uuid4(), uuid.uuid4()
    db = _RealResultDb([])

    out = await rw.effective_weights(db, "ws", str(user))

    assert out == rw.DEFAULT_WEIGHTS, "the first call must still return the fallback"
    inserts = [s for s in db.statements if s.lstrip().upper().startswith("INSERT")]
    assert len(inserts) == 1, f"expected exactly one INSERT, got {db.statements}"
    assert "ON CONFLICT" in inserts[0].upper(), (
        "provisioning sits on the read path, so a concurrent duplicate must "
        "conflict against the UNIQUE (workspace_id, user_id) constraint"
    )


async def test_provisioning_is_seeded_from_the_resolved_fallback(monkeypatch):
    """The provisioned row must hold the weights that were just served.

    Otherwise provisioning silently reverts the user: with RANKING_WEIGHTS set,
    the first rank call returns the env weights and every call after it returns
    the column defaults (0.4/0.3/0.2/0.1). That is a ranking change with no
    learning behind it, caused by nothing the user did.
    """
    monkeypatch.setenv("RANKING_WEIGHTS", _ENV_ALL_FOUR)
    db = _db_returning(None)

    out = await rw.effective_weights(db, "ws", "u")

    assert out == {
        "relevance": 0.5, "recency": 0.2, "importance": 0.2, "user_preference": 0.1
    }, "precondition: the env weights are what this call served"
    params = db.execute.await_args_list[-1].args[1]
    assert {k: float(params[k]) for k in rw.WEIGHT_KEYS} == out, (
        "the row must be seeded with the same weights the caller was served"
    )


async def test_provisioning_failure_does_not_break_resolution(monkeypatch):
    """A refused provisioning write must still resolve.

    0067's policy has a WITH CHECK, so a session without the right GUCs is
    rejected with SQLSTATE 42501; a pre-0067 database has no table at all.
    Neither is a ranking outage, and neither may escape as an exception --
    `effective_weights` is documented never to raise and both call sites rely on it.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    calls = {"n": 0}

    async def _execute(stmt, params=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return _db_returning(None).execute.return_value
        raise RuntimeError("new row violates row-level security policy")

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=_execute)

    out = await rw.effective_weights(db, "ws", "u")

    assert out == rw.DEFAULT_WEIGHTS
    assert calls["n"] == 2, "the read must still be attempted, and then the write"


async def test_learned_weights_become_reachable_after_provisioning(db_session, monkeypatch):
    """End-to-end: resolve -> rate -> the next resolve sees the learned weight.

    This is the test I1 actually needed and did not have. Every other test in
    this file either seeds the profile by hand (`_seed_profile`) or asserts on
    the fallback, so the whole branch passed while the only thing the feature
    claims to do -- learning something -- was unreachable. Here the row is
    created only by the resolver, and the learner moves it.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    ws, user = str(uuid.uuid4()), str(uuid.uuid4())
    await db_session.execute(text(_feedback_ddl()))

    # 1. First rank call: nothing exists, so the fallback is served and the row
    #    is provisioned for this exact (workspace, user).
    first = await rw.effective_weights(db_session, ws, user)
    assert first == rw.DEFAULT_WEIGHTS

    rows = (await db_session.execute(
        select(RankingWeightProfile).where(
            RankingWeightProfile.workspace_id == ws,
            RankingWeightProfile.user_id == user,
        )
    )).scalars().all()
    assert len(rows) == 1, "the resolver must have provisioned exactly one row"
    assert float(rows[0].user_preference) == rw.DEFAULT_WEIGHTS["user_preference"]

    # 2. Rate everything useful, enough to clear MIN_SAMPLES.
    await _add_feedback(db_session, user, useful=True, count=20)
    await rw.record_feedback_signal(
        db_session, user_id=user, workspace_id=ws, useful=True
    )

    # 3. The next rank call must serve the learned weight, not the default.
    learned = await rw.effective_weights(db_session, ws, user)
    assert learned["user_preference"] > rw.DEFAULT_WEIGHTS["user_preference"], (
        "after 20/20 useful signals the DB tier must win; if this is the "
        "default, provisioning never wrote a row the learner could find"
    )


async def test_repeated_resolution_does_not_duplicate_the_row(db_session, monkeypatch):
    """Second and third rank calls must not add rows.

    Provisioning runs on every cold resolution, so the ON CONFLICT clause is what
    keeps a user's profile count at one. Asserted on the count because the
    weights would be identical either way.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    ws, user = str(uuid.uuid4()), str(uuid.uuid4())
    for _ in range(3):
        await rw.effective_weights(db_session, ws, user)

    count = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalars().all()
    assert len(count) == 1


async def test_provisioning_never_writes_across_workspaces(db_session, monkeypatch):
    """The provisioned row is the caller's own, in the caller's own workspace.

    The key is (workspace_id, user_id), so the same user ranking in two
    workspaces gets two rows rather than one row shared by both. Asserted
    because a narrower key (user_id alone) is the plausible mistake here, and it
    would let one workspace's learned weights steer another's ranking.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    user = str(uuid.uuid4())
    ws_a, ws_b = str(uuid.uuid4()), str(uuid.uuid4())

    await rw.effective_weights(db_session, ws_a, user)
    await rw.effective_weights(db_session, ws_b, user)

    per_ws = (await db_session.execute(
        select(RankingWeightProfile.workspace_id).where(
            RankingWeightProfile.user_id == user
        )
    )).scalars().all()
    assert set(str(w) for w in per_ws) == {ws_a, ws_b}


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


async def test_rank_path_opens_its_session_with_the_resolving_user(db_session, monkeypatch):
    """I2's precondition: ``app.user_id`` is populated on the rank path.

    0067's policy constrains rows by ``app.user_id`` as well as
    ``app.workspace_id``. The policy's user predicate, the resolver's WHERE
    clause and the session GUC therefore all have to be the same identity, or
    the read returns zero rows and the user is silently pinned to defaults --
    which is a worse outcome than the missing predicate that prompted the change.

    The ambient ``TenantContext`` is NOT sufficient. It is populated by
    ``TenantMiddleware`` on request paths only, so a worker, a Temporal activity
    or a background task that calls this with an explicit ``user_id`` and no
    ambient context would have ``app.user_id`` unset and read nothing. So the
    value is forwarded into ``scoped_session`` explicitly, and this asserts it.

    SQLite has no RLS, so nothing here can observe a denial. What it observes is
    the argument, which is the part that is a decision rather than an emergent
    property: reverting the forwarding -- which compiles, passes every other
    test in this file, and is invisible on SQLite -- turns this red.
    """
    from contextlib import asynccontextmanager

    from api import database as db_mod
    from api.orchestrator import loop as loop_mod

    recorded: list[dict] = []
    real_scoped = db_mod.scoped_session

    @asynccontextmanager
    async def _recording_scoped_session(**kwargs):
        recorded.append(kwargs)
        async with real_scoped(workspace_id=None, require=False) as _unused:
            yield db_session

    monkeypatch.setattr(db_mod, "scoped_session", _recording_scoped_session)

    ws, user = str(uuid.uuid4()), str(uuid.uuid4())
    agent = type("A", (), {"memory_scopes": type("S", (), {"read_types": []})()})()
    await loop_mod._assemble_rag_context(ws, "alpha beta gamma", agent, user_id=user)

    assert len(recorded) == 1, f"expected one scoped session, got {recorded}"
    assert recorded[0].get("user_id") == user, (
        "the rank path must open its session with the same user_id it hands to "
        f"effective_weights, or app.user_id rides TenantContext alone and is "
        f"unset off the request path. Got {recorded[0]!r}"
    )
    assert recorded[0].get("workspace_id") == ws


# ─── signal recording ──────────────────────────────────────────────────────


async def test_record_feedback_without_profile_is_noop(db_session, monkeypatch):
    """The *rating* must not create a profile; the *rank* path provisions it.

    Revisited by the whole-branch review rather than deleted. The assertion is
    unchanged and still true, but the reason it was written is no longer the
    whole story: previously this test encoded that nothing anywhere creates a
    profile, which is exactly the defect (I1 -- the learned tier was unreachable
    because of it). Provisioning now happens in `effective_weights`
    (`provision_profile`), so the division of labour is:

      * rank  -> provisions the caller's own `(workspace_id, user_id)` row
      * rating -> only ever updates a row that already exists

    Keeping the learner non-creating is worth pinning: it is what stops a rating
    that arrives with a workspace but no ranking history from minting a profile,
    and it is what keeps the provisioning path the single place a row can
    originate.
    """
    ws = str(uuid.uuid4())
    await rw.record_feedback_signal(
        db_session, user_id=str(uuid.uuid4()), workspace_id=ws, useful=True
    )
    rows = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalars().all()
    assert rows == [], "the rating path must not invent a profile of its own"


async def test_record_feedback_failure_does_not_raise(db_session, monkeypatch):
    """Best-effort: weight update never breaks the feedback write."""
    monkeypatch.setattr(
        rw, "compute_user_preference",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    await rw.record_feedback_signal(
        db_session, user_id=str(uuid.uuid4()), workspace_id=str(uuid.uuid4()), useful=True
    )


# The two tests above are necessary but not sufficient: both take the
# "no profile -> return" path, so neither actually reaches
# ``compute_user_preference`` or performs a write. A bug in the aggregate, the
# UPDATE, or the arithmetic would leave both green. The tests below close that
# hole on a real session with a real profile row.
#
# They need ``recommendation_feedback``, which 0002 creates in PostgreSQL and
# the SQLite fixture does not, so it is created here from the same column list.


def _feedback_ddl() -> str:
    # IF NOT EXISTS: the profile and recommendation seeders both need this
    # table, and a test that calls both must not fail on the second CREATE.
    return (
        "CREATE TABLE IF NOT EXISTS recommendation_feedback ("
        "id TEXT PRIMARY KEY, recommendation_id TEXT, user_id TEXT, "
        "tenant_id TEXT, useful INTEGER, created_at TIMESTAMP)"
    )


async def _seed_profile(db_session, *, pref: float = 0.1):
    ws, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=user,
        user_preference=pref, sample_size=0,
    ))
    await db_session.execute(text(_feedback_ddl()))
    await db_session.flush()
    return ws, user


async def _add_feedback(db_session, user, useful: bool, count: int):
    for _ in range(count):
        await db_session.execute(
            text(
                "INSERT INTO recommendation_feedback "
                "(id, recommendation_id, user_id, useful) VALUES (:id, :r, :u, :ok)"
            ),
            {"id": str(uuid.uuid4()), "r": str(uuid.uuid4()), "u": str(user),
             "ok": 1 if useful else 0},
        )


async def _profile_row(db_session, ws):
    return (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalar_one()


async def test_all_useful_signal_raises_weight_and_stores_sample_size(db_session):
    """The load-bearing path: a real profile really does get re-weighted."""
    ws, user = await _seed_profile(db_session, pref=0.1)
    await _add_feedback(db_session, user, useful=True, count=20)

    await rw.record_feedback_signal(
        db_session, user_id=str(user), workspace_id=str(ws), useful=True
    )

    row = await _profile_row(db_session, ws)
    assert row.user_preference > 0.1, "20/20 useful must raise user_preference"
    assert row.user_preference <= rw.PREFERENCE_CEILING
    assert row.sample_size == 20, "sample_size must record the observation count"


async def test_repeated_unhelpful_signals_converge_within_the_check_bounds(db_session):
    """All-unhelpful is the adversarial case for the table's CHECK constraints.

    Migration 0067 puts ``CHECK (... BETWEEN 0 AND 1)`` on every weight column,
    so an out-of-range write is refused with SQLSTATE 23514. Driving the weight
    down over many signals proves the clamp holds at the rail rather than only
    at the single-step values the arithmetic tests check.
    """
    ws, user = await _seed_profile(db_session, pref=0.5)
    await _add_feedback(db_session, user, useful=False, count=50)

    for _ in range(40):
        await rw.record_feedback_signal(
            db_session, user_id=str(user), workspace_id=str(ws), useful=False
        )

    row = await _profile_row(db_session, ws)
    assert row.user_preference < 0.5, "all-unhelpful must lower user_preference"
    assert row.user_preference == pytest.approx(rw.PREFERENCE_FLOOR), (
        "repeated all-unhelpful signals must settle on the floor, not walk past it"
    )
    assert 0.0 <= row.user_preference <= 1.0


def test_computed_weight_stays_inside_check_bounds_for_every_rate():
    """The clamp is the only thing preventing a CHECK violation (SQLSTATE 23514).

    Proved over the whole rate domain from both rails, at several starting
    weights, rather than at the handful of points the four spec tests use.
    """
    for start in (0.0, 0.05, 0.25, 0.5, 0.75, 1.0):
        for total in (11, 50, 10_000):
            for useful in range(0, total + 1, max(1, total // 50)):
                v = rw.compute_user_preference(useful, total, start)
                assert 0.0 <= v <= 1.0, (start, useful, total, v)
                assert rw.PREFERENCE_FLOOR <= v <= rw.PREFERENCE_CEILING, (
                    start, useful, total, v
                )


async def test_missing_workspace_is_a_noop_not_a_cross_workspace_write(db_session):
    """No workspace context must not learn at all.

    Without the workspace the profile cannot be located, and guessing one would
    let an unscoped rating steer whichever profile happened to match the user.
    """
    ws, user = await _seed_profile(db_session, pref=0.1)
    await _add_feedback(db_session, user, useful=True, count=20)

    await rw.record_feedback_signal(
        db_session, user_id=str(user), workspace_id=None, useful=True
    )

    row = await _profile_row(db_session, ws)
    assert row.user_preference == 0.1, "no workspace_id must leave the weight alone"
    assert row.sample_size == 0


async def test_empty_user_id_is_a_noop(db_session):
    ws, user = await _seed_profile(db_session, pref=0.1)
    await rw.record_feedback_signal(
        db_session, user_id="", workspace_id=str(ws), useful=True
    )
    row = await _profile_row(db_session, ws)
    assert row.user_preference == 0.1


# ─── rating ownership ───────────────────────────────────────────────────────
#
# These drive record_feedback end-to-end against a real session rather than
# mocks, because the whole point is that the ownership comparison happens on
# the value read back off the recommendation row. A mock row would let the
# comparison pass without ever touching a database.
#
# Why the check is load-bearing: record_feedback attributes the rating to the
# RECOMMENDATION's owner, so an unauthenticated-as-owner caller who merely knows
# a recommendation UUID could steer a co-worker's user_preference by up to
# +/-0.075 per call until it pinned to a rail.


def _recommendations_ddl() -> str:
    return (
        "CREATE TABLE recommendations ("
        "id TEXT PRIMARY KEY, user_id TEXT, tenant_id TEXT, items TEXT, "
        "model_version TEXT, created_at TIMESTAMP)"
    )


async def _seed_recommendation(db_session, owner: str) -> str:
    """A recommendation owned by ``owner``, plus the tables the path touches."""
    await db_session.execute(text(_recommendations_ddl()))
    await db_session.execute(text(_feedback_ddl()))
    rec_id = str(uuid.uuid4())
    await db_session.execute(
        text(
            "INSERT INTO recommendations (id, user_id, tenant_id, items) "
            "VALUES (:i, :u, :t, '[]')"
        ),
        {"i": rec_id, "u": owner, "t": "tenant-1"},
    )
    return rec_id


def _feedback_dto(rec_id: str, *, useful: bool = True, workspace_id: str | None = None):
    from api.schemas.recommendation import FeedbackRequest

    return FeedbackRequest(
        recommendation_id=rec_id, useful=useful, workspace_id=workspace_id
    )


async def _feedback_rows(db_session) -> list:
    return (
        await db_session.execute(
            text("SELECT user_id FROM recommendation_feedback")
        )
    ).all()


async def test_owner_can_record_feedback_and_learn(db_session):
    """The legitimate owner still gets their rating recorded and their weight
    learned. Guards against the ownership fix over-blocking the happy path."""
    from api.services.recommendation_service import RecommendationService

    ws, user = await _seed_profile(db_session, pref=0.1)
    owner = str(user)
    rec_id = await _seed_recommendation(db_session, owner)
    await _add_feedback(db_session, user, useful=True, count=0)

    svc = RecommendationService()
    for _ in range(12):
        row = await svc.record_feedback(
            _feedback_dto(rec_id, workspace_id=str(ws)), db_session,
            caller_user_id=owner,
        )
        assert row is not None, "the owner must get a feedback row back"

    assert len(await _feedback_rows(db_session)) == 12

    profile = await _profile_row(db_session, ws)
    assert profile.user_preference > 0.1, "the owner's own rating must learn"
    assert profile.sample_size == 12


async def test_stranger_cannot_record_feedback_on_another_users_recommendation(db_session):
    """BLOCKING fix: a forged rating must be refused, not silently learned.

    Asserts all four observable consequences: a 403, no feedback row, and an
    untouched weight. The rating row and the weight are checked separately
    because either one alone leaves the poisoning vector open.
    """
    from fastapi import HTTPException

    from api.services.recommendation_service import RecommendationService

    ws, victim = await _seed_profile(db_session, pref=0.1)
    rec_id = await _seed_recommendation(db_session, str(victim))
    attacker = str(uuid.uuid4())

    svc = RecommendationService()
    with pytest.raises(HTTPException) as exc_info:
        await svc.record_feedback(
            _feedback_dto(rec_id, workspace_id=str(ws)), db_session,
            caller_user_id=attacker,
        )

    assert exc_info.value.status_code == 403, (
        "403, not 404: the caller already proved they hold a token, and the "
        "sibling read endpoint answers 403 for another user's resource"
    )
    assert await _feedback_rows(db_session) == [], (
        "no feedback row may be written for a recommendation the caller does "
        "not own -- otherwise the junk rating still pollutes the victim's "
        "useful-rate aggregate even if the weight write is later skipped"
    )

    profile = await _profile_row(db_session, ws)
    assert profile.user_preference == 0.1, (
        "the victim's learned weight must be untouched by a stranger's rating"
    )
    assert profile.sample_size == 0


async def test_missing_caller_identity_is_refused_not_assumed(db_session):
    """Fail closed: no authenticated identity cannot be shown to match, so the
    rating is refused rather than waved through.

    Without this, a caller that reached the service without an identity (a future
    endpoint, a direct internal call) would be treated as the owner and the
    check would be inert exactly when it mattered most.
    """
    from fastapi import HTTPException

    from api.services.recommendation_service import RecommendationService

    ws, user = await _seed_profile(db_session, pref=0.1)
    rec_id = await _seed_recommendation(db_session, str(user))

    svc = RecommendationService()
    with pytest.raises(HTTPException) as exc_info:
        await svc.record_feedback(
            _feedback_dto(rec_id, workspace_id=str(ws)), db_session,
            caller_user_id=None,
        )
    assert exc_info.value.status_code == 403
    assert await _feedback_rows(db_session) == []


async def test_recommendation_with_no_owner_is_refused(db_session):
    """A recommendation whose owner cannot be resolved is refused.

    ``recommendations.user_id`` is NOT NULL in the migration, so this cannot
    occur in production -- but an unresolvable owner must not compare equal to
    a caller's id by accident, and a NULL would otherwise stringify into the
    attribute check as "None" rather than failing the match.
    """
    from fastapi import HTTPException

    from api.services.recommendation_service import RecommendationService

    await db_session.execute(text(_recommendations_ddl()))
    await db_session.execute(text(_feedback_ddl()))
    rec_id = str(uuid.uuid4())
    await db_session.execute(
        text(
            "INSERT INTO recommendations (id, user_id, tenant_id, items) "
            "VALUES (:i, NULL, :t, '[]')"
        ),
        {"i": rec_id, "t": "tenant-1"},
    )

    svc = RecommendationService()
    with pytest.raises(HTTPException) as exc_info:
        await svc.record_feedback(_feedback_dto(rec_id), db_session, caller_user_id="u")
    assert exc_info.value.status_code == 403
    assert await _feedback_rows(db_session) == []


async def test_feedback_request_has_no_client_supplied_user_id_field():
    """``FeedbackRequest.user_id`` was removed as dead attack surface.

    The rating's owner is read off the recommendation row and compared to the
    caller's token, so a body field could only ever be a spoof trap. Asserted
    rather than left to a code comment, because a future "just pass it through"
    edit is exactly the failure this guards.
    """
    from api.schemas.recommendation import FeedbackRequest

    assert "user_id" not in FeedbackRequest.model_fields, (
        "FeedbackRequest must not accept a client-supplied user_id"
    )
    # Pydantic ignores unknown keys by default, so a body carrying user_id is
    # silently dropped rather than rejected. Asserted because "silently
    # dropped" is the safe behaviour here (the field is not part of the
    # contract) but only while the model has no field for it to land in.
    dto = FeedbackRequest(
        recommendation_id=str(uuid.uuid4()), useful=True, user_id="someone-else"
    )
    assert not hasattr(dto, "user_id"), (
        "a client-supplied user_id must not survive validation as an attribute"
    )


# ─── the ranker consumes the resolved weights ──────────────────────────
#
# These drive ``SearchRankingService`` rather than the resolver: resolution was
# already proven correct above, and a resolver whose result never reaches the
# ranker is the failure that matters -- the weights would be learned correctly
# and then ignored, which reads as "learning is broken" from the outside.
#
# The candidate is shaped so the four factors are individually distinguishable:
# text contains the query verbatim (relevance 1.0), no created_at (recency 0.5),
# metadata importance 1.0, and an empty user context (preference 0.5). So the
# score is 1.0 only when relevance carries the whole weight.


def _cand(i, score: float = 1.0) -> dict:
    return {
        "id": str(i),
        "text": "alpha",
        "source": "memory",
        "metadata": {"importance": 1.0},
        "score": score,
    }


def test_weights_from_user_context_are_applied(monkeypatch):
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    svc = SearchRankingService(llm_service=None)
    w = {"relevance": 1.0, "recency": 0.0, "importance": 0.0, "user_preference": 0.0}
    got = svc.calculate_score(_cand(1), "alpha", user_context={"weights": w})
    assert got == pytest.approx(1.0), (
        "the caller's weight profile must be what multiplies each factor; "
        "reading env/defaults instead scores this 0.8"
    )


def test_default_weights_used_when_user_context_has_no_weights():
    svc = SearchRankingService(llm_service=None)
    plain = svc.calculate_score(_cand(1), "alpha", user_context={"preferred_tags": []})
    absent = svc.calculate_score(_cand(1), "alpha", user_context=None)
    assert plain == pytest.approx(absent), "today's behaviour must be unchanged"


def test_partial_weights_dict_is_ignored():
    """A half-specified weights dict must not zero a signal.

    Not merged, not defaulted per key: the whole dict is rejected and the
    env/default set is used. Merging is the tempting implementation and the
    dangerous one -- ``weights["recency"]`` on a dict missing that key either
    raises or, with a ``.get(k, 0)``, silently drops recency to 0.0 forever.
    """
    svc = SearchRankingService(llm_service=None)
    got = svc.calculate_score(
        _cand(1), "alpha", user_context={"weights": {"relevance": 1.0}}
    )
    default = svc.calculate_score(_cand(1), "alpha", user_context=None)
    assert got == pytest.approx(default)


def test_identical_weights_produce_identical_scores(monkeypatch):
    """Sanity on the ranking path, not on the resolver: same weights in, same
    order out, regardless of whether they arrived via user_context or not.

    Proves *no weighting leak* -- the explicit path and the implicit path agree
    -- rather than "learning shifts order".

    ``delenv`` is load-bearing, not hygiene. ``SearchRankingService.__init__``
    snapshots ``_load_weights()`` from ``RANKING_WEIGHTS``, so with a complete
    env set the implicit arm uses those weights while the explicit arm uses the
    defaults below, and the comparison fails on any machine whose environment
    sets the variable. Take the defaults from ``rw.DEFAULT_WEIGHTS`` rather than a
    literal so the two arms cannot drift apart when that constant changes.
    """
    monkeypatch.delenv("RANKING_WEIGHTS", raising=False)
    svc = SearchRankingService(llm_service=None)
    a, b = _cand("a", 1.0), _cand("b", 1.0)
    base = svc.rank_results([dict(a), dict(b)], "alpha")
    boosted = svc.rank_results(
        [dict(a), dict(b)],
        "alpha",
        user_context={"weights": dict(rw.DEFAULT_WEIGHTS)},
    )
    assert base == boosted, "identical weights must produce identical scores"
