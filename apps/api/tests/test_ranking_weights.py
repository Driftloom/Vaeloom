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
    assert len(db.statements) == 1
    assert "LIMIT 1" in db.statements[0].upper()


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
