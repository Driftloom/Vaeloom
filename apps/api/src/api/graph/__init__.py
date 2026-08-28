"""Vaeloom LangGraph — Temporal owns durability, LangGraph owns topology.

Activities are the boundary: DurableAgentRunActivity is the only place that
imports this package. Workflows never import langgraph.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import StateGraph, START, END  # type: ignore
    from langgraph.checkpoint.memory import MemorySaver  # type: ignore

    HAS_LANGGRAPH = True
except Exception as e:  # pragma: no cover
    StateGraph = None  # type: ignore
    START = END = None  # type: ignore
    MemorySaver = None  # type: ignore
    HAS_LANGGRAPH = False
    _LANGGRAPH_IMPORT_ERROR = str(e)
else:
    _LANGGRAPH_IMPORT_ERROR = ""

from .state import VaeloomGraphState, validate_graph_state

# Singleton compiled graph
_COMPILED = None
_CHECKPOINTER = None


def _build_graph():
    if not HAS_LANGGRAPH:
        raise RuntimeError(f"langgraph not installed: {_LANGGRAPH_IMPORT_ERROR}")

    from .nodes import (
        agent_node,
        evaluate_node,
        finalize_node,
        policy_check_node,
        retrieve_context_node,
        route_node,
        supervisor_node,
        tool_decision_node,
        tool_execute_node,
        validate_input_node,
    )

    # Use MemorySaver for interrupt support; no postgres/redis persistence v1 (Temporal is durable)
    memory = MemorySaver() if MemorySaver else None

    g = StateGraph(VaeloomGraphState)

    g.add_node("validate_input", validate_input_node)
    g.add_node("retrieve_context", retrieve_context_node)
    g.add_node("route", route_node)
    g.add_node("supervisor", supervisor_node)
    g.add_node("agent", agent_node)
    g.add_node("tool_decision", tool_decision_node)
    g.add_node("policy_check", policy_check_node)
    g.add_node("tool_execute", tool_execute_node)
    g.add_node("evaluate", evaluate_node)
    g.add_node("finalize", finalize_node)

    g.add_edge(START, "validate_input")
    g.add_edge("validate_input", "retrieve_context")
    g.add_edge("retrieve_context", "route")

    # Route decides supervisor vs direct agent (multi-agent heuristic via supervisor_dag)
    async def after_route(state: VaeloomGraphState) -> str:
        # Check if task needs multi-agent DAG — compute heuristic
        try:
            from .routing import supervisor_dag

            dag = await supervisor_dag(state.get("task") or "")
            if dag and isinstance(dag, list):
                if len(dag) > 1:
                    return "supervisor"
                if len(dag) == 1 and len(dag[0]) > 1:
                    return "supervisor"
        except Exception:
            pass
        # Also check metadata dag if already computed
        dag2 = state.get("metadata", {}).get("dag")
        if dag2 and isinstance(dag2, list) and len(dag2) > 1:
            return "supervisor"
        return "agent"

    g.add_conditional_edges("route", after_route, {"supervisor": "supervisor", "agent": "agent"})
    g.add_edge("supervisor", "agent")

    g.add_edge("agent", "tool_decision")

    def after_tool_decision(state: VaeloomGraphState) -> str:
        return "policy_check" if state.get("selected_tool") else "evaluate"

    g.add_conditional_edges("tool_decision", after_tool_decision, {"policy_check": "policy_check", "evaluate": "evaluate"})

    def after_policy_check(state: VaeloomGraphState) -> str:
        if state.get("execution_status") == "waiting_approval":
            return "evaluate"
        return "tool_execute"

    g.add_conditional_edges("policy_check", after_policy_check, {"tool_execute": "tool_execute", "evaluate": "evaluate"})
    g.add_edge("tool_execute", "evaluate")

    def after_evaluate(state: VaeloomGraphState) -> str:
        status = state.get("execution_status")
        if status == "completed":
            return "finalize"
        if status == "failed":
            return "finalize"
        if status == "waiting_approval":
            return "finalize"  # approval interrupt handled via graph interrupt (v2)
        return "finalize"

    g.add_conditional_edges("evaluate", after_evaluate, {"finalize": "finalize"})

    g.add_edge("finalize", END)

    compiled = g.compile(checkpointer=memory, interrupt_before=["tool_execute"] if False else None)
    # v1: no interrupt_before; approval interrupt is policy_check raise → handled in evaluate
    # To enable LangGraph interrupt for approval-gated tools, set interrupt_before=["tool_execute"]
    return compiled, memory


def get_vaeloom_graph():
    global _COMPILED, _CHECKPOINTER
    if _COMPILED is not None:
        return _COMPILED
    compiled, memory = _build_graph()
    _COMPILED = compiled
    _CHECKPOINTER = memory
    return _COMPILED


def get_graph_metadata() -> dict[str, Any]:
    return {
        "has_langgraph": HAS_LANGGRAPH,
        "version": "v1",
        "nodes": [
            "validate_input", "retrieve_context", "route", "supervisor",
            "agent", "tool_decision", "policy_check", "tool_execute", "evaluate", "finalize",
        ],
        "checkpointer": "MemorySaver" if HAS_LANGGRAPH else None,
    }
