"""Capability runtime config — the value an operator types in the Agents UI must
reach the agent runtime, and every way it can fail to must be reportable.

Covers :mod:`api.services.capability_runtime_config` against a real SQLite
session (the ``db_session`` fixture) and the assembly point in
:mod:`api.orchestrator.loop` against a real ``_try_react_loop`` call with the
LLM stream captured at class level.

Nothing here asserts "some plausible value" — every case asserts the exact
rounds and the exact ``source``, because the source is the only thing that
explains a wrong number to whoever is looking at the log.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.models.schema import Workspace, WorkspaceCapability
from api.orchestrator.base import BaseAgent
from api.orchestrator.card import AgentCard
from api.orchestrator.loop import _try_react_loop
from api.services.capability_runtime_config import (
    DEFAULT_MAX_REACT_ROUNDS,
    MAX_MAX_REACT_ROUNDS,
    MIN_MAX_REACT_ROUNDS,
    resolve_agent_max_rounds,
)
from api.services.llm_service import LLMService

LOGGER = "api.services.capability_runtime_config"

# The card value every fall-through case lands on. It is deliberately neither 1
# nor the default 5, so "rejected and fell through" cannot be confused with
# "clamped to the floor" or "silently defaulted".
CARD_ROUNDS = 7


@pytest.fixture
def no_setting(monkeypatch):
    """Remove the deployment default so the ``default`` layer is reachable.

    ``Settings.agent_max_react_rounds`` is typed ``int = 5``, so in a real
    deployment the setting layer always has an answer and reports itself as the
    source. Deleting the attribute is the only way to exercise the compiled-in
    fallback, and it is also what a stub/partial settings object looks like.
    """
    monkeypatch.delattr(settings, "agent_max_react_rounds", raising=False)
    assert not hasattr(settings, "agent_max_react_rounds")


class _Card:
    def __init__(self, max_react_rounds: Any = CARD_ROUNDS) -> None:
        self.max_react_rounds = max_react_rounds


async def _workspace(db: AsyncSession, label: str = "rounds") -> str:
    ws = Workspace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name=f"cap-rounds-{label}-{uuid.uuid4().hex[:8]}"
    )
    db.add(ws)
    await db.commit()
    return str(ws.id)


async def _agent_capability(
    db: AsyncSession,
    workspace_id: str,
    name: str,
    *,
    config: dict[str, Any] | None = None,
    category: str = "agent",
) -> WorkspaceCapability:
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        category=category,
        description=f"{name} runtime config",
        version="1.0.0",
        enabled=True,
        config=config if config is not None else {},
    )
    db.add(row)
    await db.commit()
    return row


# ── 1. precedence ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_nothing_configured_yields_default(db_session: AsyncSession, no_setting):
    """No row, no card, no setting: the compiled-in default, named as such."""
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (5, "default")
    assert rounds == DEFAULT_MAX_REACT_ROUNDS


@pytest.mark.asyncio
async def test_setting_default_is_reported_as_the_setting_layer(db_session: AsyncSession):
    """The deployment default is a *setting*, not a hardcoded fallback — saying
    so is the difference between an operator debugging their env var and one
    chasing a code default."""
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (5, "setting")
    assert rounds == DEFAULT_MAX_REACT_ROUNDS


@pytest.mark.asyncio
async def test_agent_card_supplies_rounds_when_no_row(db_session: AsyncSession):
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


@pytest.mark.asyncio
async def test_workspace_capability_beats_the_agent_card(db_session: AsyncSession):
    """The operator's per-workspace decision is the most specific one."""
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": 9})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (9, "workspace_capability")


@pytest.mark.asyncio
async def test_setting_is_used_when_no_row_and_no_card(
    db_session: AsyncSession, monkeypatch
):
    monkeypatch.setattr(settings, "agent_max_react_rounds", 8)
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (8, "setting")


@pytest.mark.asyncio
async def test_card_beats_setting(db_session: AsyncSession, monkeypatch):
    monkeypatch.setattr(settings, "agent_max_react_rounds", 8)
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


@pytest.mark.asyncio
async def test_row_config_without_the_rounds_key_falls_through(db_session: AsyncSession):
    """A row that exists but says nothing about rounds is not an answer."""
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"temperature": 0.2})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


@pytest.mark.asyncio
async def test_empty_config_dict_on_the_row_falls_through(db_session: AsyncSession):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


# ── 2. validation: rejected values fall through to the next layer ─────────


@pytest.mark.parametrize(
    "bad",
    [
        pytest.param("abc", id="non-numeric-string"),
        pytest.param(True, id="bool-true"),
        pytest.param(False, id="bool-false"),
        pytest.param(3.7, id="non-integral-float"),
        pytest.param(None, id="explicit-null"),
        pytest.param("", id="empty-string"),
        pytest.param("   ", id="whitespace-only"),
        pytest.param([3], id="list"),
        pytest.param({"n": 3}, id="dict"),
    ],
)
@pytest.mark.asyncio
async def test_unusable_row_values_fall_through_to_the_card(
    db_session: AsyncSession, bad: Any
):
    """A value that is not a round count is skipped, never coerced into one.

    The card supplies 7, so an exact (7, "agent_card") proves the row layer
    declined. ``True``/``False`` are the trap this guards: ``int(True) == 1``
    would otherwise produce a one-round agent from a JSON boolean.
    """
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": bad})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


@pytest.mark.parametrize(
    "bad",
    [
        pytest.param(True, id="bool-true"),
        pytest.param(False, id="bool-false"),
        pytest.param(0, id="zero"),
    ],
)
@pytest.mark.asyncio
async def test_bool_and_zero_never_become_one_or_zero_rounds(
    db_session: AsyncSession, bad: Any
):
    """The specific dishonesty: `True` → 1 round, `False`/`0` → 0 rounds.

    ``0`` is a real integer so it clamps up to the floor and stays attributed to
    the row. The booleans are not round counts at all, so they are rejected and
    the card answers instead. Both must never yield 1 or 0 from the row.
    """
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": bad})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    if isinstance(bad, bool):
        assert (rounds, source) == (7, "agent_card")
    else:
        assert (rounds, source) == (1, "workspace_capability")
        assert rounds == MIN_MAX_REACT_ROUNDS


# ── 3. validation: clamped values are honoured, in range, and attributed ──


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param(0, 1, id="zero-clamped-to-floor"),
        pytest.param(-1, 1, id="negative-clamped-to-floor"),
        pytest.param(-999, 1, id="large-negative-clamped-to-floor"),
        pytest.param(10**9, 12, id="absurd-clamped-to-ceiling"),
        pytest.param(13, 12, id="one-over-ceiling"),
    ],
)
@pytest.mark.asyncio
async def test_out_of_range_row_values_are_clamped_and_attributed(
    db_session: AsyncSession, raw: Any, expected: int
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": raw})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (expected, "workspace_capability")
    assert MIN_MAX_REACT_ROUNDS <= rounds <= MAX_MAX_REACT_ROUNDS


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param(" 3 ", 3, id="padded-string"),
        pytest.param("3", 3, id="string"),
        pytest.param(3, 3, id="int"),
        pytest.param(3.0, 3, id="integral-float"),
        pytest.param("3.0", 3, id="integral-float-string"),
        pytest.param("12", 12, id="ceiling-exact"),
        pytest.param(" 1 ", 1, id="floor-exact"),
    ],
)
@pytest.mark.asyncio
async def test_leniently_parsed_row_values_are_honoured(
    db_session: AsyncSession, raw: Any, expected: int
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": raw})

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (expected, "workspace_capability")


# ── 4. bad values in the card and setting layers are also not honoured ─────


@pytest.mark.parametrize(
    ("bad", "expected"),
    [
        pytest.param(True, (8, "setting"), id="bool-true-rejected"),
        pytest.param(False, (8, "setting"), id="bool-false-rejected"),
        pytest.param("abc", (8, "setting"), id="string-rejected"),
        pytest.param(3.7, (8, "setting"), id="float-rejected"),
        pytest.param(0, (1, "agent_card"), id="zero-clamped-not-rejected"),
        pytest.param(-2, (1, "agent_card"), id="negative-clamped-not-rejected"),
        pytest.param(10**9, (12, "agent_card"), id="absurd-clamped"),
    ],
)
@pytest.mark.asyncio
async def test_bad_card_values_are_never_honoured_verbatim(
    db_session: AsyncSession, monkeypatch, bad: Any, expected: tuple[int, str]
):
    """A card value that is not a round count is not passed through: non-numbers
    fall to the setting layer, out-of-range integers are clamped and stay
    attributed to the card."""
    monkeypatch.setattr(settings, "agent_max_react_rounds", 8)
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card(bad)
    )

    assert (rounds, source) == expected


@pytest.mark.asyncio
async def test_bad_setting_value_falls_through_to_the_default(
    db_session: AsyncSession, monkeypatch
):
    monkeypatch.setattr(settings, "agent_max_react_rounds", "not-a-number")
    ws = await _workspace(db_session)

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (5, "default")


# ── 5. session and tenant scoping ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_db_none_falls_through_and_never_raises(no_setting):
    """The loop runs without a session on some paths. That is not an error and
    it must not manufacture a row it cannot see."""
    assert await resolve_agent_max_rounds(None, str(uuid.uuid4()), "career") == (
        5,
        "default",
    )
    assert await resolve_agent_max_rounds(
        None, str(uuid.uuid4()), "career", card=_Card()
    ) == (7, "agent_card")


@pytest.mark.asyncio
async def test_non_uuid_workspace_id_falls_through_without_raising(
    db_session: AsyncSession,
):
    rounds, source = await resolve_agent_max_rounds(
        db_session, "ws_not_a_uuid", "career", card=_Card()
    )
    assert (rounds, source) == (7, "agent_card")


@pytest.mark.asyncio
async def test_unknown_agent_name_falls_through(db_session: AsyncSession, no_setting):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": 9})

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "nonexistent")

    assert (rounds, source) == (5, "default")


@pytest.mark.asyncio
async def test_row_in_another_workspace_is_not_read(
    db_session: AsyncSession, no_setting
):
    """Cross-tenant negative control: the same agent name configured in another
    workspace must not change this workspace's round budget."""
    mine = await _workspace(db_session, "mine")
    theirs = await _workspace(db_session, "theirs")
    await _agent_capability(db_session, theirs, "career", config={"max_react_rounds": 11})

    rounds, source = await resolve_agent_max_rounds(db_session, mine, "career")

    assert (rounds, source) == (5, "default")


@pytest.mark.asyncio
async def test_other_agent_name_in_the_same_workspace_is_not_read(
    db_session: AsyncSession, no_setting
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "resume", config={"max_react_rounds": 11})

    rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (5, "default")


@pytest.mark.asyncio
async def test_same_name_under_a_different_category_is_not_read(
    db_session: AsyncSession,
):
    """The lookup is scoped on ``category == "agent"`` as well as name — a
    ``skill`` row carrying the same key is not an agent round budget."""
    ws = await _workspace(db_session)
    await _agent_capability(
        db_session, ws, "career", config={"max_react_rounds": 11}, category="skill"
    )

    rounds, source = await resolve_agent_max_rounds(
        db_session, ws, "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


@pytest.mark.asyncio
async def test_failing_session_falls_through_instead_of_raising(db_session: AsyncSession):
    class _Broken:
        async def execute(self, *args: Any, **kwargs: Any) -> Any:
            raise RuntimeError("capability table unreachable")

    rounds, source = await resolve_agent_max_rounds(
        _Broken(), str(uuid.uuid4()), "career", card=_Card()
    )

    assert (rounds, source) == (7, "agent_card")


# ── 6. honesty of the log ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rejection_is_logged_with_the_value_and_the_source(
    db_session: AsyncSession, caplog
):
    ws = await _workspace(db_session)
    await _agent_capability(
        db_session, ws, "career", config={"max_react_rounds": "abc"}
    )

    with caplog.at_level("WARNING", logger=LOGGER):
        rounds, source = await resolve_agent_max_rounds(
            db_session, ws, "career", card=_Card()
        )

    assert (rounds, source) == (7, "agent_card")
    text = caplog.text
    assert "'abc'" in text
    assert "workspace_capability" in text
    assert "non-numeric" in text
    assert "falling through" in text


@pytest.mark.asyncio
async def test_bool_rejection_says_why_bool_is_not_a_round_count(
    db_session: AsyncSession, caplog
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": True})

    with caplog.at_level("WARNING", logger=LOGGER):
        await resolve_agent_max_rounds(db_session, ws, "career", card=_Card())

    assert "bool" in caplog.text
    assert "int subclass" in caplog.text


@pytest.mark.asyncio
async def test_low_clamp_is_logged_with_both_values(
    db_session: AsyncSession, caplog
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": 0})

    with caplog.at_level("WARNING", logger=LOGGER):
        rounds, source = await resolve_agent_max_rounds(
            db_session, ws, "career", card=_Card()
        )

    assert (rounds, source) == (1, "workspace_capability")
    assert "clamped up" in caplog.text
    assert "minimum 1" in caplog.text


@pytest.mark.asyncio
async def test_high_clamp_is_logged_with_both_values(
    db_session: AsyncSession, caplog
):
    ws = await _workspace(db_session)
    await _agent_capability(
        db_session, ws, "career", config={"max_react_rounds": 10**9}
    )

    with caplog.at_level("WARNING", logger=LOGGER):
        rounds, source = await resolve_agent_max_rounds(
            db_session, ws, "career", card=_Card()
        )

    assert (rounds, source) == (12, "workspace_capability")
    text = caplog.text
    assert "clamped down" in text
    assert "1000000000" in text
    assert "ceiling 12" in text


@pytest.mark.asyncio
async def test_a_healthy_row_value_logs_no_warning(
    db_session: AsyncSession, caplog
):
    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "career", config={"max_react_rounds": 4})

    with caplog.at_level("WARNING", logger=LOGGER):
        rounds, source = await resolve_agent_max_rounds(db_session, ws, "career")

    assert (rounds, source) == (4, "workspace_capability")
    assert caplog.text == ""


# ── 7. the loop assembly point ────────────────────────────────────────────


class _RoundsAgent(BaseAgent):
    mission = "A simple agent for testing ReAct round budget resolution"
    tools = []
    card = AgentCard(
        name="dummy",
        version="1.0.0",
        description="Dummy agent for round budget assertions",
        tools=["search_documents"],
        max_react_rounds=5,
        output_schema={
            "type": "object",
            "properties": {"summary": {"type": "string"}},
            "required": ["summary"],
        },
    )

    async def fallback(self) -> Any:
        return {"agent_name": "dummy", "action": "fallback", "result": {"summary": "fallback"}}


def _capture_loop(monkeypatch) -> None:
    async def mock_stream(self, messages, tools=None, **kwargs):
        yield {"type": "text_delta", "text": json.dumps({"summary": "ok"})}
        yield {"type": "done"}

    monkeypatch.setattr(LLMService, "generate_completion_with_tools_stream", mock_stream)


async def _run_loop(db: AsyncSession | None, workspace_id: str) -> dict[str, Any] | None:
    return await _try_react_loop(
        agent=_RoundsAgent(),
        message="summarize my documents",
        workspace_id=workspace_id,
        agent_name="dummy",
        db=db,
        request_id=f"req-rounds-{uuid.uuid4().hex[:8]}",
    )


@pytest.mark.asyncio
async def test_loop_uses_the_workspace_capability_rounds(monkeypatch, db_session, caplog):
    """End-to-end: the value stored by the Agents UI is the budget the real
    ReAct loop runs with, and the log names the layer that supplied it."""
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    ws = await _workspace(db_session)
    await _agent_capability(db_session, ws, "dummy", config={"max_react_rounds": 4})

    with caplog.at_level("INFO", logger="api.orchestrator.loop"):
        result = await _run_loop(db_session, ws)

    assert result is not None
    assert "REACT_ROUNDS agent=dummy" in caplog.text
    assert f"workspace={ws}" in caplog.text
    assert "rounds=4 source=workspace_capability" in caplog.text


@pytest.mark.asyncio
async def test_loop_without_a_row_keeps_the_card_value(monkeypatch, db_session, caplog):
    """No capability rows → unchanged behaviour: the card's 5, attributed to
    the card. This is the no-existing-test-change guarantee."""
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    ws = await _workspace(db_session)

    with caplog.at_level("INFO", logger="api.orchestrator.loop"):
        result = await _run_loop(db_session, ws)

    assert result is not None
    assert "rounds=5 source=agent_card" in caplog.text


@pytest.mark.asyncio
async def test_loop_survives_a_failing_round_budget_lookup(monkeypatch, db_session):
    """A config lookup must never take down an agent run."""
    import api.services.capability_runtime_config as crc

    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    async def boom(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("resolution exploded")

    monkeypatch.setattr(crc, "resolve_agent_max_rounds", boom)

    ws = await _workspace(db_session)
    result = await _run_loop(db_session, ws)

    assert result is not None


@pytest.mark.asyncio
async def test_loop_without_a_session_runs_on_the_card_budget(
    monkeypatch, db_session, caplog
):
    monkeypatch.setattr(settings, "agent_react_enabled", True)
    monkeypatch.setattr(settings, "llm_api_key", "mock-test-key")
    _capture_loop(monkeypatch)

    with caplog.at_level("INFO", logger="api.orchestrator.loop"):
        result = await _run_loop(None, str(uuid.uuid4()))

    assert result is not None
    assert "rounds=5 source=agent_card" in caplog.text
