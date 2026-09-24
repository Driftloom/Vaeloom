"""Execute Node — Tool & Sub-Agent Dispatch."""

from __future__ import annotations

import logging
from ..state import ExecutionState

logger = logging.getLogger(__name__)


async def execute_node(state: ExecutionState) -> ExecutionState:
    """Execute the actions formulated in the plan node."""
    if not state.plan:
        state.current_node = "observe"
        return state

    for step in state.plan:
        tool_name = step.get("action", "")
        params = step.get("params", {})
        state.tool_calls.append({"tool": tool_name, "params": params})

        # Execute mock / real tool
        result_payload = {"status": "ok", "action": tool_name, "data": f"Executed action {tool_name}"}
        state.tool_results.append({
            "tool": tool_name,
            "params": params,
            "result": result_payload,
        })

    # Clear executed plan batch
    state.plan = []
    state.current_node = "observe"
    return state
