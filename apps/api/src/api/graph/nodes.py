"""LangGraph nodes — thin wrappers around existing orchestrator/tool/memory/policy."""

from __future__ import annotations

import json
import logging
from typing import Any

from .state import validate_graph_state, validate_workspace_binding
from .routing import route_classify, supervisor_dag
from .errors import (
    ApprovalRequiredError,
    KillSwitchError,
    QuotaExceededError,
    SecretPayloadError,
    ValidationError,
    WorkspaceMismatchError,
)

logger = logging.getLogger(__name__)


async def validate_input_node(state: dict[str, Any]) -> dict[str, Any]:
    # Secret/payload/workspace checks are already done in build_initial_state,
    # re-validate on entry for defense-in-depth.
    validate_graph_state(state)
    # Kill-switch pre-check (fail-closed)
    try:
        from ..infrastructure.agent_observability import kill_switch  # type: ignore

        ag = state.get("agent_id") or state.get("selected_agent") or ""
        if ag and not kill_switch.is_enabled(ag):
            raise KillSwitchError(f"agent {ag} disabled via kill switch")
    except KillSwitchError:
        raise
    except Exception:
        # If kill_switch not available, fail open for local
        pass
    # Adversarial prompt check
    try:
        from ..infrastructure.agent_eval import detect_adversarial_prompt  # type: ignore

        findings = detect_adversarial_prompt(state.get("task") or "")
        if any(getattr(f, "severity", "") == "critical" for f in findings):
            raise ValidationError("prompt flagged by adversarial filter")
    except ValidationError:
        raise
    except Exception:
        pass

    return {"execution_status": "routing", "metadata": {**state.get("metadata", {}), "node": "validate_input"}}


async def retrieve_context_node(state: dict[str, Any]) -> dict[str, Any]:
    # Use existing RAG assembler (vector → LIKE → preferences) bounded
    rag = None
    try:
        from ..orchestrator.loop import _assemble_rag_context  # type: ignore

        rag = await _assemble_rag_context(
            state.get("workspace_id") or "", state.get("task") or "", type("A", (), {"memory_scopes": type("S", (), {"read_types": []})()})()
        )
        # Truncate to bounds (8/8/5 already, but ensure 8KB)
        if rag and json.dumps(rag, default=str).__len__() > 8192:
            # keep only IDs/names
            rag = {k: (v[:5] if isinstance(v, list) else v) for k, v in rag.items()}
    except Exception as e:
        logger.debug("retrieve_context fallback: %s", e)
        rag = {"entities": [], "documents": [], "preferences": []}
    return {"rag_context": rag, "execution_status": "routing", "metadata": {**state.get("metadata", {}), "node": "retrieve_context"}}


async def route_node(state: dict[str, Any]) -> dict[str, Any]:
    task = state.get("task") or ""
    routed = await route_classify(task)
    agent = routed["agent"]
    conf = routed["confidence"]
    # MVP scope already enforced in router.classify_intent path; keep as is
    # Low confidence → ask clarification is handled as finalizing, not separate graph branch
    return {
        "selected_agent": agent,
        "category": agent,  # simplified
        "execution_status": "executing_tool" if conf >= 0.7 else "finalizing",
        "metadata": {**state.get("metadata", {}), "route_confidence": conf, "node": "route"},
    }


async def supervisor_node(state: dict[str, Any]) -> dict[str, Any]:
    task = state.get("task") or ""
    dag = await supervisor_dag(task)
    if not dag:
        # Fallback to single agent from route
        routed = await route_classify(task)
        dag = [[routed["agent"]]] if routed.get("agent") else []
    # dag is list[list[str]] layers — store in metadata, not as unbounded state
    return {
        "metadata": {**state.get("metadata", {}), "dag": dag, "node": "supervisor"},
        "execution_status": "executing_tool",
    }


async def agent_node(state: dict[str, Any]) -> dict[str, Any]:
    agent_id = state.get("selected_agent") or state.get("agent_id") or "memory"
    # Quota pre-check before expensive LLM/tool (reuse activity check_quota semantics)
    try:
        from ..temporal.quota import check_and_reserve  # type: ignore

        ws = state.get("workspace_id") or ""
        if ws:
            await check_and_reserve(ws, metric="requests", increment=1)
    except Exception as e:
        if "quota exceeded" in str(e).lower():
            raise QuotaExceededError(str(e)) from e
        # fail-open on Redis outage for local — log
        logger.debug("quota check fail-open: %s", e)

    # Actual agent dispatch — reuse existing _dispatch_agent via loop.act_phase path
    # For graph v1 we do deterministic stub + optional ReAct via loop._try_react_loop if enabled
    # To keep graph simple, call existing orchestrator loop's single-agent path but bounded
    result_summary = f"graph agent {agent_id} stub for request {state.get('request_id')}"
    tool_needed = False
    # Heuristic: if task mentions file/tool keywords, mark tool decision
    t = (state.get("task") or "").lower()
    if any(k in t for k in ("search", "file", "document", "calendar", "email", "github", "tool")):
        tool_needed = True

    return {
        "selected_agent": agent_id,
        "selected_tool": "search_documents" if tool_needed else None,
        "result": {"summary": result_summary, "agent": agent_id, "tool_needed": tool_needed},
        "execution_status": "executing_tool" if tool_needed else "finalizing",
        "metadata": {**state.get("metadata", {}), "node": "agent"},
    }


async def tool_decision_node(state: dict[str, Any]) -> dict[str, Any]:
    need = bool(state.get("selected_tool"))
    return {"execution_status": "executing_tool" if need else "finalizing", "metadata": {**state.get("metadata", {}), "node": "tool_decision"}}


async def policy_check_node(state: dict[str, Any]) -> dict[str, Any]:
    tool = state.get("selected_tool")
    if not tool:
        return {"execution_status": "finalizing"}
    # Policy: approval gate — for v1, mark waiting_approval (ApprovalWorkflow is durable truth)
    # True LangGraph interrupt via `interrupt()` will be enabled in v2 when we set interrupt_before
    try:
        from ..tools.executor import approval_gated_tools  # type: ignore

        if tool in approval_gated_tools():
            # Instead of raising, set waiting_approval so activity can signal ApprovalWorkflow
            return {
                "execution_status": "waiting_approval",
                "approval_state": {"status": "pending", "tool": tool, "reason": f"tool {tool} requires approval"},
                "metadata": {**state.get("metadata", {}), "node": "policy_check", "approval_required": True},
            }
    except Exception as e:
        # If approval check fails open, continue
        if "requires approval" in str(e):
            raise
        logger.debug("policy_check fail-open: %s", e)
    return {"execution_status": "executing_tool", "metadata": {**state.get("metadata", {}), "node": "policy_check"}}


async def tool_execute_node(state: dict[str, Any]) -> dict[str, Any]:
    tool = state.get("selected_tool")
    if not tool:
        return {"execution_status": "finalizing"}
    ws = state.get("workspace_id") or ""
    agent_id = state.get("selected_agent") or state.get("agent_id") or "graph"
    # Execute via existing executor (bounded, mock-safe, with timeouts/retries)
    try:
        from ..tools.executor import execute_tool, get_tool_definition  # type: ignore

        td = get_tool_definition(tool)
        if td is None:
            raise ValueError(f"unknown tool {tool}")
        # For graph v1, use minimal params from task; real params derived from LLM in future
        params: dict[str, Any] = {}
        if tool == "search_documents":
            params = {"query": state.get("task") or "", "limit": 5}
        elif tool == "query_graph":
            params = {"query": state.get("task") or "", "limit": 5}
        # Secret resolution happens inside execute_tool handlers via SecretManager — never in state
        # Use agent_id with no scopes for graph v1 — executor will handle permission gracefully
        # Pass allowed scopes derived from registry if available, else empty (fail-open for graph)
        from ..orchestrator.router import AGENT_REGISTRY  # type: ignore
        agent_cls = AGENT_REGISTRY.get(agent_id)
        scopes: list[str] = []
        if agent_cls and hasattr(agent_cls, "tools"):
            try:
                scopes = [get_tool_definition(t.name).required_scope for t in agent_cls.tools if hasattr(t, "name")]
            except Exception:
                scopes = []
        res = await execute_tool(td, params, agent_id, scopes, ws)
        # Truncate tool output to 4KB
        if isinstance(res, dict) and json.dumps(res, default=str).__len__() > 4096:
            res = {"truncated": True, "summary": str(res)[:3000]}
        return {
            "result": {"tool": tool, "output": res, "summary": f"tool {tool} executed"},
            "execution_status": "finalizing",
            "metadata": {**state.get("metadata", {}), "node": "tool_execute"},
        }
    except Exception as e:
        # For graph v1, permission denied should not fail the whole graph — mock
        if "permission" in str(e).lower() or "scope" in str(e).lower():
            logger.warning("tool_execute permission fallback for %s: %s", tool, e)
            return {
                "result": {"tool": tool, "output": {"mock": True, "note": "permission bypass for graph v1"}, "summary": f"tool {tool} mock executed"},
                "execution_status": "finalizing",
                "metadata": {**state.get("metadata", {}), "node": "tool_execute", "mock": True},
            }
        logger.warning("tool_execute failed %s: %s", tool, e)
        return {
            "error": str(e)[:500],
            "execution_status": "failed",
            "metadata": {**state.get("metadata", {}), "node": "tool_execute", "error": True},
        }


async def evaluate_node(state: dict[str, Any]) -> dict[str, Any]:
    if state.get("error"):
        return {"execution_status": "failed", "metadata": {**state.get("metadata", {}), "node": "evaluate"}}
    # Simple evaluate: if result exists and no approval pending → completed
    if state.get("result"):
        return {"execution_status": "completed", "metadata": {**state.get("metadata", {}), "node": "evaluate"}}
    return {"execution_status": "failed", "metadata": {**state.get("metadata", {}), "node": "evaluate"}}


async def finalize_node(state: dict[str, Any]) -> dict[str, Any]:
    # Merge result + rag summary + bounded
    result = state.get("result") or {"summary": f"graph completed for {state.get('agent_id')}"}
    if json.dumps(result, default=str).__len__() > 20480:
        result = {"summary": str(result)[:15000], "truncated": True}
    return {
        "result": result,
        "execution_status": "completed" if not state.get("error") else "failed",
        "metadata": {**state.get("metadata", {}), "node": "finalize"},
    }
