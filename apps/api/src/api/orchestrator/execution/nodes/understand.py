"""Understand Node — Intent Understanding & Context Assembly."""

from __future__ import annotations

import logging
from ...card_registry import get_agent_card
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def understand_node(state: ExecutionState) -> ExecutionState:
    """Analyze intent, load agent card, assemble workspace context and memories."""
    card = get_agent_card(state.agent_name)
    if card:
        state.system_prompt = card.render_system_prompt()
        if not state.available_tools:
            state.available_tools = list(card.tools)
        state.max_iterations = card.max_react_rounds or 5

    # Simple greeting fast-path check
    msg_clean = state.message.strip().lower()
    if msg_clean in {"hi", "hello", "hey", "good morning", "good evening"}:
        state.final_response = f"Hello! I am your {state.agent_name.replace('_', ' ').title()} assistant. How can I help you today?"
        state.current_node = "complete"
        return state

    state.current_node = "plan"
    return state
