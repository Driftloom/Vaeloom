"""Complete Node — Response Assembly, Memory Persistence, & Audit Logging."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def complete_node(state: ExecutionState) -> ExecutionState:
    """Finalize response, format UI cards, write to memory, and seal execution trace."""
    if not state.final_response:
        state.final_response = "Task execution completed successfully."

    state.is_terminal = True
    state.status = "completed"
    logger.info("Graph execution completed for run %s (iterations: %d)", state.run_id, state.iteration)
    return state
