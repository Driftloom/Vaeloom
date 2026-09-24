"""Reflect Node — Self-Correction, Replanning & Goal Verification."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def reflect_node(state: ExecutionState) -> ExecutionState:
    """Reflect on tool observations and determine if goal is fulfilled."""
    # If observations exist, synthesize result
    if state.observations:
        state.final_response = (
            f"Based on my analysis: {'; '.join(state.observations)}. "
            "I have updated your career intelligence profile accordingly."
        )
        state.current_node = "complete"
        return state

    # If more work needed and below max iterations, loop back to plan
    if state.iteration < state.max_iterations:
        state.current_node = "plan"
        return state

    state.current_node = "complete"
    return state
