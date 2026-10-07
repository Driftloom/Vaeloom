from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.services import ranking_weights as rw

pytestmark = pytest.mark.asyncio


def _db_returning(row):
    db = AsyncMock()
    # Result is sync even on an AsyncSession, so this must be MagicMock: an
    # AsyncMock here makes scalar_one_or_none() async, which returns an
    # un-awaited coroutine instead of the row.
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    db.execute = AsyncMock(return_value=result)
    return db


def _profile(**over):
    base = {"relevance": 0.4, "recency": 0.3, "importance": 0.2, "user_preference": 0.1}
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
