from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import create_engine, text

from api.services import ranking_weights as rw

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
