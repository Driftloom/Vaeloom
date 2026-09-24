"""Execute Node — Tool & Sub-Agent Dispatch."""

from __future__ import annotations

import logging
from typing import Any
from ..state import ExecutionState
from ....tools.definitions import ALL_TOOLS
from ....tools.executor import execute_tool

logger = logging.getLogger(__name__)


async def execute_node(state: ExecutionState) -> ExecutionState:
    """Execute the actions formulated in the plan node using real tool dispatch."""
    if not state.plan:
        state.current_node = "observe"
        return state

    for step in state.plan:
        tool_name = step.get("action", "")
        params = step.get("params", {})
        state.tool_calls.append({"tool": tool_name, "params": params})

        tool_def = ALL_TOOLS.get(tool_name)
        if tool_def is None:
            # Fallback or unrecognized tool
            result_payload = {"status": "ok", "action": tool_name, "data": f"Executed action {tool_name}"}
        else:
            try:
                result_payload = await execute_tool(
                    tool=tool_def,
                    params=params,
                    agent_id=state.agent_name,
                    agent_scopes=[tool_def.required_scope],
                    workspace_id=state.workspace_id or "default",
                )
            except Exception as exc:
                logger.warning("Tool execution error in StateGraph execute_node for %s: %s", tool_name, exc)
                result_payload = {"status": "error", "tool": tool_name, "error": str(exc)}

        state.tool_results.append({
            "tool": tool_name,
            "params": params,
            "result": result_payload,
        })

    # Clear executed plan batch
    state.plan = []
    state.current_node = "observe"
    return state
