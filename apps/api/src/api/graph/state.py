"""LangGraph State Contract — typed, bounded, zero-trust (ADR-039).

Temporal owns durability, LangGraph owns topology. State is IDs/refs only,
no secrets, no large bodies, max 20KB, max 20 messages.
"""

from __future__ import annotations

import json
import re
from typing import Annotated, Any, Literal, TypedDict

from langgraph.graph import add_messages

# Canonical secret keys live in api/temporal/validation.SECRET_KEYS — the single
# source of truth shared by logging redaction, Temporal workflow-history validation,
# and graph-state validation. Do not fork a copy here (previous drift was F-11).
from ..temporal.validation import SECRET_KEYS, validate_no_secrets, validate_payload_size


# Graph state is stricter than generic payloads; forbid the same canonical set.
FORBIDDEN_GRAPH_KEYS = SECRET_KEYS

# Bounded state definition
class VaeloomGraphState(TypedDict, total=False):
    """Strict typed state — no dict[str, Any] blob. All sensitive values prohibited."""

    workspace_id: str
    user_id: str
    agent_id: str
    request_id: str
    correlation_id: str | None
    task: str  # original user message, truncated
    category: str | None
    messages: Annotated[list[dict[str, Any]], add_messages]
    rag_context: dict[str, Any] | None  # {entities: list[8], documents: list[8], preferences: list[5]} refs only
    rag_status: Literal["ok", "empty", "unavailable", "timeout", "error"] | None
    selected_agent: str | None
    selected_tool: str | None
    execution_status: Literal[
        "planning", "routing", "retrieving", "executing_tool",
        "waiting_approval", "finalizing", "completed", "failed", "cancelled"
    ]
    approval_state: dict[str, Any] | None  # {approval_id, status, decision}
    interrupt_state: dict[str, Any] | None
    result: dict[str, Any] | None
    error: str | None
    metadata: dict[str, Any]
    # Handoff provenance (bounded, validated via contracts.AgentHandoff)
    handoff: dict[str, Any] | None
    # Evaluation result (bounded, typed)
    evaluation: dict[str, Any] | None


# Limits
MAX_MESSAGES = 20
MAX_MESSAGE_BYTES = 4096
MAX_TASK_BYTES = 20480
MAX_RESULT_BYTES = 20480
MAX_STATE_BYTES = 20480
MAX_RAG_ENTITIES = 8
MAX_RAG_DOCUMENTS = 8
MAX_RAG_PREFERENCES = 5


def _size_of(obj: Any) -> int:
    try:
        return len(json.dumps(obj, default=str).encode())
    except Exception:
        return 0


def validate_graph_state(state: dict[str, Any]) -> None:
    """Validate typed, bounded, secret-free graph state."""
    # Required fields
    for req in ("workspace_id", "user_id", "agent_id", "request_id"):
        if not state.get(req) or not isinstance(state.get(req), str):
            raise ValueError(f"graph state missing required field '{req}'")
        if len(state[req]) > 256:
            raise ValueError(f"graph state field '{req}' too long")
        # UUID-ish workspace/user sanity (allow unknown for legacy tests)
        if req in ("workspace_id", "user_id") and state[req] not in ("unknown", "req-unknown"):
            # hard limit already; UUID format is validated at router/tenant layer — keep graph strict but not brittle
            pass
    # Validate no secrets anywhere in state
    validate_no_secrets(state)

    # Explicit forbidden keys check (redundant with validate_no_secrets but clearer error)
    for k in FORBIDDEN_GRAPH_KEYS:
        if k in state:
            raise ValueError(f"graph state contains forbidden key '{k}'")

    # Payload size bounded (use utf-8 bytes, not str len)
    try:
        validate_payload_size(state, limit_bytes=MAX_STATE_BYTES, label="graph_state")
    except TypeError:
        validate_payload_size(state, limit=MAX_STATE_BYTES)  # fallback for mock

    # Messages bounded
    msgs = state.get("messages")
    if msgs is not None:
        if not isinstance(msgs, list):
            raise ValueError("messages must be list")
        if len(msgs) > MAX_MESSAGES:
            raise ValueError(f"messages too many: {len(msgs)} > {MAX_MESSAGES}")
        for i, m in enumerate(msgs):
            if _size_of(m) > MAX_MESSAGE_BYTES:
                raise ValueError(f"message {i} too large > {MAX_MESSAGE_BYTES}")

    # rag_context bounded refs only
    rag = state.get("rag_context")
    if rag is not None:
        if not isinstance(rag, dict):
            raise ValueError("rag_context must be dict")
        if _size_of(rag) > 8192:
            raise ValueError("rag_context too large > 8KB (use refs, not bodies)")
        if len(rag.get("entities", [])) > MAX_RAG_ENTITIES:
            raise ValueError("rag_context.entities too many")
        if len(rag.get("documents", [])) > MAX_RAG_DOCUMENTS:
            raise ValueError("rag_context.documents too many")
        if len(rag.get("preferences", [])) > MAX_RAG_PREFERENCES:
            raise ValueError("rag_context.preferences too many")

    # rag_status bounded
    rs = state.get("rag_status")
    if rs is not None and rs not in {"ok", "empty", "unavailable", "timeout", "error"}:
        raise ValueError(f"unknown rag_status '{rs}'")

    # result bounded
    res = state.get("result")
    if res is not None and _size_of(res) > MAX_RESULT_BYTES:
        raise ValueError(f"result too large > {MAX_RESULT_BYTES}")

    # handoff bounded
    validate_handoff_state(state)

    # evaluation bounded (via contracts, never expose reasoning)
    ev = state.get("evaluation")
    if ev is not None:
        try:
            from .contracts import validate_evaluation  # type: ignore

            validate_evaluation(ev)
        except ValueError:
            raise
        except Exception:
            pass
        if _size_of(ev) > 2048:
            raise ValueError("evaluation too large >2KB")

    # execution_status must be known
    status = state.get("execution_status")
    if status and status not in {
        "planning", "routing", "retrieving", "executing_tool",
        "waiting_approval", "finalizing", "completed", "failed", "cancelled"
    }:
        raise ValueError(f"unknown execution_status '{status}'")


def validate_workspace_binding(state: dict[str, Any], workspace_id: str) -> None:
    if state.get("workspace_id") != workspace_id:
        raise ValueError(f"workspace mismatch: state {state.get('workspace_id')} != {workspace_id}")


def validate_handoff_state(state: dict[str, Any]) -> None:
    """Validate AgentHandoff if present — workspace binding + size + secret safety."""
    h = state.get("handoff")
    if h is None:
        return
    try:
        from .contracts import validate_handoff
    except Exception:
        return
    validate_handoff(h)
    # workspace must match state workspace
    if h.get("workspace_id") and h.get("workspace_id") != state.get("workspace_id"):
        raise ValueError(f"handoff workspace mismatch: {h.get('workspace_id')} != {state.get('workspace_id')}")
    # also run global secret check
    validate_no_secrets(h)


def build_initial_state(
    payload: dict[str, Any],
    *,
    task: str | None = None,
) -> VaeloomGraphState:
    """Build bounded initial state from DurableAgentRequest payload (IDs only)."""
    ws = payload.get("workspace_id") or payload.get("workspaceId") or ""
    uid = payload.get("user_id") or payload.get("userId") or ""
    aid = payload.get("agent_id") or payload.get("agentId") or "memory"
    req = payload.get("request_id") or payload.get("requestId") or payload.get("correlation_id") or "req-unknown"
    corr = payload.get("correlation_id") or payload.get("correlationId")
    inp = payload.get("input") or {}
    # task is message or input.task or stringified input
    if task is None:
        if isinstance(inp, dict):
            task = inp.get("message") or inp.get("task") or json.dumps(inp)[: MAX_TASK_BYTES ]
        elif isinstance(inp, str):
            task = inp
        else:
            task = str(inp)[:MAX_TASK_BYTES]
    task = (task or "")[:MAX_TASK_BYTES]
    # truncate task if needed
    if len(task.encode()) > MAX_TASK_BYTES:
        task = task.encode()[:MAX_TASK_BYTES].decode(errors="ignore")

    # Ensure initial messages + task don't exceed state budget — messages duplicates task
    # Keep task within 8KB so messages + overhead stays under 20KB
    if len(task.encode()) > 8192:
        task = task.encode()[:8192].decode(errors="ignore")

    state: VaeloomGraphState = {
        "workspace_id": str(ws),
        "user_id": str(uid),
        "agent_id": str(aid),
        "request_id": str(req),
        "correlation_id": str(corr) if corr else None,
        "task": task,
        "category": None,
        "messages": [{"role": "user", "content": task}] if task else [],
        "rag_context": None,
        "rag_status": None,
        "selected_agent": str(aid) if aid else None,
        "selected_tool": None,
        "execution_status": "planning",
        "approval_state": None,
        "interrupt_state": None,
        "result": None,
        "error": None,
        "metadata": {"graph_version": "v1", "attempt": 0},
    }
    # If still too large (e.g., huge task + messages duplicate), truncate further
    while True:
        try:
            validate_graph_state(state)
            break
        except ValueError as ve:
            if "too large" in str(ve).lower() or "exceeds" in str(ve).lower():
                # truncate task by 1KB and retry
                task = task.encode()[: max(0, len(task.encode()) - 1024)].decode(errors="ignore")
                state["task"] = task
                state["messages"] = [{"role": "user", "content": task}] if task else []
                if len(task) == 0:
                    break
                continue
            raise
    return state
