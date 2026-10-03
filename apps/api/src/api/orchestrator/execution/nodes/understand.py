"""Understand Node — Intent Understanding & Context Assembly."""

from __future__ import annotations

import logging
from typing import Any

from ...card_registry import get_agent_card
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def _resolve_max_iterations(state: ExecutionState, card: Any) -> int:
    """This run's ReAct round budget, from the one resolver.

    Why the resolver and not ``card.max_react_rounds or 5``: ``orchestrator.loop``
    already resolves the budget through
    ``services.capability_runtime_config.resolve_agent_max_rounds``
    (workspace capability row → agent card → deployment setting → 5) and logs
    which layer decided. Re-deriving it here meant an operator's
    ``config.max_react_rounds`` was honoured on the ReAct path and silently
    ignored on the graph path — one policy written twice, which is how the two
    drift. There is exactly one precedence definition and both paths call it.

    Why this function owns its session: the graph nodes receive only
    ``ExecutionState``, which carries ``workspace_id``/``tenant_id``/``user_id``
    but no session, and ``understand`` is the entry node — no transition returns
    to it (``state_machine.VALID_TRANSITIONS``) — so this costs one lookup per
    graph run, not one per iteration. ``database.scoped_session`` is the repo's
    existing answer for a component that must own its session: it is what
    ``tools.executor._idem_session_cm`` uses for idempotency rows, and it carries
    the workspace/tenant GUCs that RLS reads, so the lookup is scoped by the
    same tenant boundary the run is. What it would take to thread the request
    session down instead is one field on ``ExecutionState`` plus one argument on
    ``StateGraph.run`` and its production call site in ``loop.py:3346`` — not
    available to this change.

    A lookup that cannot run is not a run that cannot proceed: every failure path
    lands on the card/setting layers, which is what this node did before.
    """
    from ....services.capability_runtime_config import resolve_agent_max_rounds

    workspace_id = state.workspace_id
    agent_name = state.agent_name

    if not workspace_id:
        # No workspace means there is no tenant scope to open a scoped session
        # with, and the resolver's row layer is unreachable without one. Not an
        # error — the graph is also constructed without one (internal runs).
        rounds, source = await resolve_agent_max_rounds(
            None, workspace_id, agent_name, card=card
        )
        logger.info(
            "GRAPH_ROUNDS agent=%s rounds=%d source=%s scope=none",
            agent_name,
            rounds,
            source,
        )
        return rounds

    try:
        from ....database import scoped_session

        async with scoped_session(
            workspace_id=workspace_id,
            tenant_id=state.tenant_id,
            user_id=state.user_id,
            require=False,
        ) as session:
            rounds, source = await resolve_agent_max_rounds(
                session, workspace_id, agent_name, card=card
            )
    except Exception as exc:
        rounds, source = await resolve_agent_max_rounds(
            None, workspace_id, agent_name, card=card
        )
        logger.warning(
            "Graph round budget lookup failed (card/setting used): %s", exc
        )

    logger.info(
        "GRAPH_ROUNDS agent=%s workspace=%s rounds=%d source=%s",
        agent_name,
        workspace_id,
        rounds,
        source,
    )
    return rounds


async def understand_node(state: ExecutionState) -> ExecutionState:
    """Analyze intent, load agent card, assemble workspace context and memories."""
    card = get_agent_card(state.agent_name)
    if card:
        state.system_prompt = card.render_system_prompt()
        if not state.available_tools:
            state.available_tools = list(card.tools)

    # Resolved unconditionally, not only when a card exists: an agent with no
    # registered card still has a workspace row an operator can set. With no card
    # and no row the resolver returns the deployment setting, which is the
    # ``ExecutionState.max_iterations`` default this node has always left in
    # place for that case.
    state.max_iterations = await _resolve_max_iterations(state, card)

    # Simple greeting fast-path check
    msg_clean = state.message.strip().lower()
    if msg_clean in {"hi", "hello", "hey", "good morning", "good evening"}:
        state.final_response = f"Hello! I am your {state.agent_name.replace('_', ' ').title()} assistant. How can I help you today?"
        state.current_node = "complete"
        return state

    state.current_node = "plan"
    return state