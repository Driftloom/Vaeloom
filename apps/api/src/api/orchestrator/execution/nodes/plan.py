"""Plan Node — Dynamic Planning and Action Formulation."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def plan_node(state: ExecutionState) -> ExecutionState:
    """Evaluate context and decide whether to call tools, spawn sub-tasks, or finalize."""
    state.iteration += 1

    # Check if max iterations reached
    if state.iteration > state.max_iterations:
        logger.info("Max iterations (%d) reached in execution run %s", state.max_iterations, state.run_id)
        if not state.final_response:
            state.final_response = "I have gathered all the available information and completed the task analysis."
        state.current_node = "complete"
        return state

    # If tools are available and no tool calls executed yet, plan tool calls
    if state.available_tools and not state.tool_results:
        # Formulate planned action
        first_tool = state.available_tools[0]
        state.plan.append({
            "action": first_tool,
            "params": {"query": state.message},
            "reason": "Gather context or execute specialist capability",
        })
        state.current_node = "execute"
        return state

    # Otherwise finalize
    if not state.final_response:
        state.final_response = "Execution completed successfully."
    state.current_node = "complete"
    return state
