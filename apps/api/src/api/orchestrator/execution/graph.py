"""Enterprise StateGraph Execution Engine.

Implements DAG-based execution flow with explicit node transitions,
streaming telemetry, Human-in-the-Loop approval pausing, and self-reflection loops.
"""

from __future__ import annotations

import logging
from typing import Any, AsyncGenerator, Callable, Coroutine

from .nodes.approve import approve_node
from .nodes.complete import complete_node
from .nodes.execute import execute_node
from .nodes.observe import observe_node
from .nodes.plan import plan_node
from .nodes.reflect import reflect_node
from .nodes.understand import understand_node
from .state import ExecutionState
from .state_machine import ExecutionStateMachine

logger = logging.getLogger(__name__)


class StateGraph:
    """StateGraph execution coordinator managing modular node transitions."""

    def __init__(self):
        self._nodes: dict[str, Callable[[ExecutionState], Coroutine[Any, Any, ExecutionState]]] = {
            "understand": understand_node,
            "plan": plan_node,
            "execute": execute_node,
            "observe": observe_node,
            "approve": approve_node,
            "reflect": reflect_node,
            "complete": complete_node,
        }

    async def run(self, initial_state: ExecutionState) -> ExecutionState:
        """Execute state machine until terminal state or approval pause."""
        state = initial_state
        step_count = 0
        max_steps = 30  # Safety circuit breaker to prevent infinite cycles

        while not state.is_terminal and state.status != "waiting_approval":
            step_count += 1
            if step_count > max_steps:
                logger.error("StateGraph safety circuit breaker triggered after %d steps in run %s", max_steps, state.run_id)
                state.status = "failed"
                state.error = "StateGraph execution exceeded maximum step safety ceiling"
                state.is_terminal = True
                break

            current_node_name = state.current_node
            node_fn = self._nodes.get(current_node_name)
            if not node_fn:
                state.status = "failed"
                state.error = f"Node '{current_node_name}' not registered in StateGraph"
                state.is_terminal = True
                break

            # Execute node
            next_state = await node_fn(state)

            # Validate transition
            if not next_state.is_terminal and next_state.status != "waiting_approval":
                ExecutionStateMachine.validate_transition(current_node_name, next_state.current_node)

            state = next_state

        return state

    async def run_stream(self, initial_state: ExecutionState) -> AsyncGenerator[dict[str, Any], None]:
        """Execute graph while streaming progress events for each node transition."""
        state = initial_state
        step_count = 0
        max_steps = 30

        yield {
            "event": "graph_start",
            "run_id": state.run_id,
            "agent": state.agent_name,
            "node": state.current_node,
        }

        while not state.is_terminal and state.status != "waiting_approval":
            step_count += 1
            if step_count > max_steps:
                yield {"event": "error", "error": "Maximum steps exceeded"}
                break

            current_node_name = state.current_node
            node_fn = self._nodes.get(current_node_name)
            if not node_fn:
                yield {"event": "error", "error": f"Unknown node {current_node_name}"}
                break

            yield {
                "event": "node_enter",
                "node": current_node_name,
                "iteration": state.iteration,
            }

            next_state = await node_fn(state)

            yield {
                "event": "node_exit",
                "node": current_node_name,
                "next_node": next_state.current_node,
                "status": next_state.status,
            }

            if not next_state.is_terminal and next_state.status != "waiting_approval":
                ExecutionStateMachine.validate_transition(current_node_name, next_state.current_node)

            state = next_state

        if state.status == "waiting_approval":
            yield {
                "event": "approval_required",
                "run_id": state.run_id,
                "proposal": state.pending_approval,
            }
        elif state.is_terminal and state.status == "completed":
            yield {
                "event": "graph_complete",
                "run_id": state.run_id,
                "final_response": state.final_response,
            }

    async def resume(self, state: ExecutionState, approved: bool) -> ExecutionState:
        """Resume execution from waiting_approval state."""
        if state.status != "waiting_approval":
            raise ValueError(f"Cannot resume execution in status '{state.status}' (expected 'waiting_approval')")

        state.is_approved = approved
        if approved:
            state.status = "running"
            state.current_node = "reflect"
            ExecutionStateMachine.validate_transition("waiting_approval", "reflect")
            return await self.run(state)
        else:
            state.status = "cancelled"
            state.is_terminal = True
            state.final_response = "Action was declined by the user."
            return state


# Singleton
state_graph = StateGraph()
