"""Approve Node — Human-In-The-Loop (HITL) Gate Evaluation."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def approve_node(state: ExecutionState) -> ExecutionState:
    """Evaluate whether side-effecting operations require human authorization."""
    # Check if proposals or latest actions require approval
    for p in state.proposals:
        if p.get("requires_approval") and not state.is_approved:
            state.pending_approval = p
            state.status = "waiting_approval"
            state.current_node = "waiting_approval"
            logger.info("Execution %s paused for approval: %s", state.run_id, p.get("title"))
            return state

    state.current_node = "reflect"
    return state
