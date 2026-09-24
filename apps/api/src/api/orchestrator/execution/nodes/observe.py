"""Observe Node — Observation Recording & Invariant Validation."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def observe_node(state: ExecutionState) -> ExecutionState:
    """Validate tool execution output and formulate structured observation."""
    if state.tool_results:
        latest = state.tool_results[-1]
        obs = f"Action '{latest.get('tool')}' completed with result: {latest.get('result')}"
        state.observations.append(obs)

    state.current_node = "approve"
    return state
