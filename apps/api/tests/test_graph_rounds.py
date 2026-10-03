"""The graph execution path must resolve its ReAct budget through the same
resolver the ReAct path uses — an operator's ``config.max_react_rounds`` cannot
be honoured on one path and ignored on the other.

Covers :mod:`api.orchestrator.execution.nodes.understand` against a real SQLite
session (the ``db_session`` fixture), with ``database.scoped_session`` pointed at
that session so the node's own session source is exercised rather than mocked
away.

Every case asserts an EXACT integer, and the validation cases assert equality
with :func:`resolve_agent_max_rounds` called directly on the same inputs — that
equality is the actual claim ("one policy, not two"); the integer alone would
only prove "some plausible number".
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.models.schema import Workspace, WorkspaceCapability
from api.orchestrator.card import AgentCard
from api.orchestrator.execution import ExecutionState
from api.services.capability_runtime_config import (
    MAX_MAX_REACT_ROUNDS,
    MIN_MAX_REACT_ROUNDS,
    resolve_agent_max_rounds,
)

LOGGER = "api.orchestrator.execution.nodes.understand"

# "career" is a registered agent, so `get_agent_card` returns a real card. Every
# registered card inherits AgentCard's default of 5 rounds, so 5 is the value the
# pre-change expression `card.max_react_rounds or 5` produced.
REGISTERED_AGENT = "career"
CARD_ROUNDS = 5

# A card value that is neither the default nor a clamp target, so "the row was
# read" cannot be confused with "it fell through to the card".
ROW_ROUNDS = 9


@pytest.fixture
def no_setting(monkeypatch):
    monkeypatch.delattr(settings, "agent_max_react_rounds", raising=False)
    assert not hasattr(settings, "agent_max_react_rounds")


@pytest.fixture
def scoped_to(monkeypatch, db_session: AsyncSession):
    """Point the node's session source at the test session.

    ``scoped_session`` is imported function-locally inside the node, so replacing
    the attribute on ``api.database`` is what the node actually reads. The
    replacement is a context manager yielding the caller's session: the node only
    ever SELECTs, and it must not commit or close a session it does not own.
    """

    @asynccontextmanager
    async def _fake(workspace_id=None, tenant_id=None, user_id=None, **kwargs):
        yield db_session

    monkeypatch.setattr("api.database.scoped_session", _fake)
    return db_session


@pytest.fixture
def no_sessions(monkeypatch):
    """Record every ``scoped_session`` call so a test can prove one was not made."""
    calls: list[dict[str, Any]] = []

    def _boom(*args: Any, **kwargs: Any):
        calls.append(kwargs)
        raise AssertionError("no session may be opened without a workspace scope")

    monkeypatch.setattr("api.database.scoped_session", _boom)
    return calls


async def _workspace(db: AsyncSession, label: str) -> str:
    ws = Workspace(
        id=uuid.uuid4(), user_id=uuid.uuid4(), name=f"graph-rounds-{label}-{uuid.uuid4().hex[:8]}"
    )
    db.add(ws)
    await db.commit()
    return str(ws.id)


async def _agent_capability(
    db: AsyncSession, workspace_id: str, name: str, config: dict[str, Any]
) -> WorkspaceCapability:
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        category="agent",
        description=f"{name} runtime config",
        version="1.0.0",
        enabled=True,
        config=config,
    )
    db.add(row)
    await db.commit()
    return row


def _state(workspace_id: str | None, message: str = "summarize my documents") -> ExecutionState:
    return ExecutionState(
        agent_name=REGISTERED_AGENT, message=message, workspace_id=workspace_id
    )


async def _understand(
    workspace_id: str | None,
    agent_name: str = REGISTERED_AGENT,
    message: str = "summarize my documents",
):
    from api.orchestrator.execution.nodes.understand import understand_node

    state = _state(workspace_id, message)
    state.agent_name = agent_name
    return await understand_node(state)


# ── 1. the gap: the graph path honours the workspace row ───────────────────


@pytest.mark.asyncio
async def test_graph_path_honours_the_workspace_row(db_session: AsyncSession, scoped_to, caplog):
    """The operator's per-workspace value reaches the graph run.

    Pre-change this node computed ``card.max_react_rounds or 5`` and the row was
    never read, so an operator who set 9 got 5 with no error and no log.
    """
    ws = await _workspace(db_session, "row")
    await _agent_capability(db_session, ws, REGISTERED_AGENT, {"max_react_rounds": ROW_ROUNDS})

    with caplog.at_level("INFO", logger=LOGGER):
        state = await _understand(ws)

    assert state.max_iterations == ROW_ROUNDS
    assert state.max_iterations == 9
    assert f"rounds={ROW_ROUNDS} source=workspace_capability" in caplog.text
    assert f"workspace={ws}" in caplog.text


@pytest.mark.asyncio
async def test_graph_run_completes_with_the_row_budget(db_session: AsyncSession, scoped_to):
    """End-to-end through StateGraph, not just the node in isolation."""
    from api.orchestrator.execution import StateGraph

    ws = await _workspace(db_session, "full")
    await _agent_capability(db_session, ws, REGISTERED_AGENT, {"max_react_rounds": 2})

    final = await StateGraph().run(_state(ws))

    assert final.status == "completed"
    assert final.is_terminal is True
    assert final.max_iterations == 2


# ── 2. no row → byte-identical to the pre-change behaviour ────────────────


@pytest.mark.asyncio
async def test_no_row_keeps_the_card_value(
    db_session: AsyncSession, scoped_to, no_setting, caplog
):
    """Regression guard. Every registered card carries 5, which is exactly what
    ``card.max_react_rounds or 5`` produced, so the no-row case is unchanged."""
    ws = await _workspace(db_session, "norow")

    with caplog.at_level("INFO", logger=LOGGER):
        state = await _understand(ws)

    assert state.max_iterations == CARD_ROUNDS
    assert state.max_iterations == 5
    assert f"rounds={CARD_ROUNDS} source=agent_card" in caplog.text


@pytest.mark.asyncio
async def test_row_without_the_rounds_key_keeps_the_card_value(
    db_session: AsyncSession, scoped_to, no_setting
):
    """A row that exists but says nothing about rounds is not an answer."""
    ws = await _workspace(db_session, "nokey")
    await _agent_capability(db_session, ws, REGISTERED_AGENT, {"temperature": 0.2})

    state = await _understand(ws)

    assert state.max_iterations == CARD_ROUNDS


@pytest.mark.asyncio
async def test_unregistered_agent_without_a_row_uses_the_setting(
    db_session: AsyncSession, scoped_to, monkeypatch
):
    """No card at all: the deployment setting answers, which is the value the
    ``ExecutionState.max_iterations`` default already carried for this case."""
    monkeypatch.setattr(settings, "agent_max_react_rounds", 8)
    ws = await _workspace(db_session, "nocard")

    state = await _understand(ws, agent_name="no_such_registered_agent")

    assert state.max_iterations == 8


@pytest.mark.asyncio
async def test_greeting_fast_path_is_unchanged(db_session: AsyncSession, scoped_to):
    from api.orchestrator.execution import StateGraph

    ws = await _workspace(db_session, "greet")
    await _agent_capability(db_session, ws, REGISTERED_AGENT, {"max_react_rounds": 3})

    state = await _understand(ws, message="hello")

    # The node short-circuits to `complete` and never reaches plan/execute.
    assert state.current_node == "complete"
    assert state.final_response is not None
    assert "Hello!" in state.final_response

    final = await StateGraph().run(_state(ws, "hello"))
    assert final.status == "completed"
    assert final.is_terminal is True
    assert final.max_iterations == 3


# ── 3. invalid values → identical to the ReAct path (ONE policy) ──────────


class _Card:
    def __init__(self, max_react_rounds: Any) -> None:
        self.max_react_rounds = max_react_rounds
        self.tools: list[str] = []
        self.description = "stub card"

    def render_system_prompt(self, context: Any = None) -> str:
        return "stub system prompt"


BAD_ROW_VALUES = [
    pytest.param("abc", id="non-numeric-string"),
    pytest.param(True, id="bool-true"),
    pytest.param(False, id="bool-false"),
    pytest.param(3.7, id="non-integral-float"),
    pytest.param(None, id="explicit-null"),
    pytest.param("", id="empty-string"),
    pytest.param("   ", id="whitespace-only"),
    pytest.param([3], id="list"),
    pytest.param({"n": 3}, id="dict"),
    pytest.param(0, id="zero"),
    pytest.param(-1, id="negative"),
    pytest.param(10**9, id="absurd"),
    pytest.param(13, id="one-over-ceiling"),
]


@pytest.mark.parametrize("bad", BAD_ROW_VALUES)
@pytest.mark.asyncio
async def test_graph_clamps_or_rejects_exactly_as_the_react_path_does(
    db_session: AsyncSession, scoped_to, monkeypatch, bad: Any
):
    """The claim under test is equality with the ReAct path, not a number.

    ``resolve_agent_max_rounds`` is called twice on identical inputs: once
    directly (what the loop does) and once through the graph node. Equal rounds
    and equal clamping behaviour is what "one policy" means; a hand-written
    expected integer would only pin today's coincidence.
    """
    monkeypatch.setattr(
        "api.orchestrator.execution.nodes.understand.get_agent_card", lambda _n: _Card(5)
    )
    ws = await _workspace(db_session, "bad")
    await _agent_capability(db_session, ws, REGISTERED_AGENT, {"max_react_rounds": bad})

    expected, source = await resolve_agent_max_rounds(
        db_session, ws, REGISTERED_AGENT, card=_Card(5)
    )
    state = await _understand(ws)

    assert state.max_iterations == expected
    assert MIN_MAX_REACT_ROUNDS <= state.max_iterations <= MAX_MAX_REACT_ROUNDS
    if isinstance(bad, bool) or not isinstance(bad, (int, float)) or (
        isinstance(bad, float) and not bad.is_integer()
    ):
        assert (state.max_iterations, source) == (5, "agent_card")
    elif bad in (0, -1):
        assert (state.max_iterations, source) == (MIN_MAX_REACT_ROUNDS, "workspace_capability")
    elif bad == 10**9 or bad == 13:
        assert (state.max_iterations, source) == (MAX_MAX_REACT_ROUNDS, "workspace_capability")


@pytest.mark.asyncio
async def test_graph_lenient_parsing_matches_the_react_path(
    db_session: AsyncSession, scoped_to, monkeypatch
):
    """Strings and integral floats are parsed the same way on both paths."""
    monkeypatch.setattr(
        "api.orchestrator.execution.nodes.understand.get_agent_card", lambda _n: _Card(5)
    )
    ws = await _workspace(db_session, "lenient")

    for raw, expected in ((" 3 ", 3), ("3", 3), (3.0, 3), ("3.0", 3), ("12", 12)):
        await _agent_capability(db_session, ws, REGISTERED_AGENT, {"max_react_rounds": raw})
        react_rounds, react_source = await resolve_agent_max_rounds(
            db_session, ws, REGISTERED_AGENT, card=_Card(5)
        )
        graph_state = await _understand(ws)

        assert graph_state.max_iterations == react_rounds == expected
        assert react_source == "workspace_capability"
        # One row per (workspace, name, category): rewrite in place rather than
        # tripping the unique constraint between cases.
        await db_session.delete(
            (
                await db_session.execute(
                    select(WorkspaceCapability).where(
                        WorkspaceCapability.workspace_id == uuid.UUID(ws),
                        WorkspaceCapability.name == REGISTERED_AGENT,
                    )
                )
            )
            .scalar_one()
        )
        await db_session.commit()


@pytest.mark.asyncio
async def test_graph_card_layer_bad_values_match_the_react_path(
    db_session: AsyncSession, scoped_to, monkeypatch
):
    """A bad value on the CARD is validated identically too — the graph node no
    longer applies ``card.max_react_rounds or 5``, which accepted ``True`` as 1
    and passed an absurd ceiling straight through."""
    monkeypatch.setattr(settings, "agent_max_react_rounds", 8)
    ws = await _workspace(db_session, "badcard")

    for bad, expected in ((True, 8), ("abc", 8), (0, MIN_MAX_REACT_ROUNDS), (10**9, MAX_MAX_REACT_ROUNDS)):
        monkeypatch.setattr(
            "api.orchestrator.execution.nodes.understand.get_agent_card", lambda _n, v=bad: _Card(v)
        )
        react_rounds, _ = await resolve_agent_max_rounds(db_session, ws, REGISTERED_AGENT, card=_Card(bad))
        graph_state = await _understand(ws)

        assert graph_state.max_iterations == react_rounds == expected


# ── 4. cross-tenant ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_row_in_another_workspace_is_not_read(
    db_session: AsyncSession, scoped_to, no_setting
):
    """Negative control: workspace B's identical agent configuration must not
    move workspace A's graph budget."""
    mine = await _workspace(db_session, "mine")
    theirs = await _workspace(db_session, "theirs")
    await _agent_capability(db_session, theirs, REGISTERED_AGENT, {"max_react_rounds": 11})

    state = await _understand(mine)

    assert state.max_iterations == CARD_ROUNDS
    assert state.max_iterations == 5


@pytest.mark.asyncio
async def test_other_agent_name_in_the_same_workspace_is_not_read(
    db_session: AsyncSession, scoped_to, no_setting
):
    ws = await _workspace(db_session, "otheragent")
    await _agent_capability(db_session, ws, "resume", {"max_react_rounds": 11})

    state = await _understand(ws)

    assert state.max_iterations == CARD_ROUNDS


@pytest.mark.asyncio
async def test_skill_category_row_is_not_read_as_a_round_budget(
    db_session: AsyncSession, scoped_to, no_setting
):
    ws = await _workspace(db_session, "skillcat")
    row = WorkspaceCapability(
        workspace_id=uuid.UUID(ws),
        name=REGISTERED_AGENT,
        category="skill",
        description="same name, wrong category",
        version="1.0.0",
        enabled=True,
        config={"max_react_rounds": 11},
    )
    db_session.add(row)
    await db_session.commit()

    state = await _understand(ws)

    assert state.max_iterations == CARD_ROUNDS


# ── 5. unavailable session / workspace ────────────────────────────────────


@pytest.mark.asyncio
async def test_failing_session_falls_back_to_the_card_and_the_run_continues(
    db_session: AsyncSession, monkeypatch
):
    """A config lookup must never be the reason a run fails."""

    def _boom(*args: Any, **kwargs: Any):
        raise RuntimeError("capability table unreachable")

    monkeypatch.setattr("api.database.scoped_session", _boom)
    ws = await _workspace(db_session, "failopen")

    state = await _understand(ws)

    assert state.max_iterations == CARD_ROUNDS
    assert state.current_node == "plan"


@pytest.mark.asyncio
async def test_failing_graph_run_still_completes(db_session: AsyncSession, monkeypatch):
    from api.orchestrator.execution import StateGraph

    def _boom(*args: Any, **kwargs: Any):
        raise RuntimeError("capability table unreachable")

    monkeypatch.setattr("api.database.scoped_session", _boom)
    ws = await _workspace(db_session, "failopenfull")

    final = await StateGraph().run(_state(ws))

    assert final.status == "completed"
    assert final.max_iterations == CARD_ROUNDS


@pytest.mark.asyncio
async def test_no_workspace_opens_no_session_and_uses_the_card(
    db_session: AsyncSession, no_sessions, no_setting, caplog
):
    """Without a workspace there is no tenant scope to scope a session with, so
    the node must not open one at all."""
    with caplog.at_level("INFO", logger=LOGGER):
        state = await _understand(None)

    assert no_sessions == []
    assert state.max_iterations == CARD_ROUNDS
    assert "scope=none" in caplog.text


@pytest.mark.asyncio
async def test_non_uuid_workspace_does_not_raise(db_session: AsyncSession, scoped_to):
    """A malformed workspace id is the resolver's documented no-row case, not a
    crash: it falls through to the card."""
    state = await _understand("ws_not_a_uuid")

    assert state.max_iterations == CARD_ROUNDS


@pytest.mark.asyncio
async def test_execution_state_model_is_unchanged_by_the_fix():
    """The fix reads workspace_id off the state; it must not have quietly added a
    session field to the model the graph is built from."""
    assert "workspace_id" in ExecutionState.model_fields
    assert "db" not in ExecutionState.model_fields
    assert ExecutionState.model_fields["max_iterations"].default == 5


@pytest.mark.asyncio
async def test_registered_cards_carry_the_default_the_regression_guard_assumes():
    """The no-row regression guard asserts 5. That is only meaningful if every
    registered card really is on AgentCard's default, so this pins the premise."""
    from api.orchestrator.card_registry import list_agent_cards

    cards = list_agent_cards()
    assert cards, "card registry is empty"
    assert {card.max_react_rounds for card in cards} == {5}
    assert AgentCard(name="x", description="x").max_react_rounds == 5