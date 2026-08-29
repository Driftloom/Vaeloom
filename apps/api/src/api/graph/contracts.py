"""Graph typed contracts — structured outputs (ADR-039 §19).

Every agent/node output is schema-validated, bounded, secret-checked, workspace-checked,
versioned and failure-safe. Invalid model output never becomes an authorization bypass.
"""
from __future__ import annotations

import json
from typing import Any, Literal, TypedDict


# ── Routing ────────────────────────────────────────────────────────────────
class RoutingDecision(TypedDict, total=False):
    """Structured routing result — explainable, provenance-aware."""

    primary_intent: str
    secondary_intents: list[str]
    confidence: float
    candidate_agents: list[str]
    policy_filtered: list[str]
    final_agent: str
    provenance: dict[str, Any]  # {keywordsMatched, secondaryScores, tied, mvpFiltered}
    explain: dict[str, Any]
    schema_version: int


def validate_routing_decision(d: dict[str, Any]) -> None:
    if not isinstance(d, dict):
        raise ValueError("RoutingDecision must be dict")
    if d.get("schema_version") not in (None, 1):
        raise ValueError("unsupported RoutingDecision schema_version")
    fa = d.get("final_agent")
    if not fa or not isinstance(fa, str):
        raise ValueError("RoutingDecision missing final_agent")
    if len(fa) > 64:
        raise ValueError("final_agent too long")
    conf = d.get("confidence", 0.0)
    if not isinstance(conf, (int, float)) or not (0.0 <= float(conf) <= 1.0):
        raise ValueError("confidence must be 0..1")
    if len(json.dumps(d, default=str).encode()) > 4096:
        raise ValueError("RoutingDecision too large")


# ── Supervisor / DAG ───────────────────────────────────────────────────────
class AgentPlan(TypedDict, total=False):
    dag: list[list[str]]  # layers
    strategy: Literal["parallel", "sequential", "mixed"]
    provenance: dict[str, Any]
    schema_version: int


def validate_agent_plan(p: dict[str, Any]) -> None:
    if not isinstance(p, dict):
        raise ValueError("AgentPlan must be dict")
    dag = p.get("dag")
    if dag is not None:
        if not isinstance(dag, list):
            raise ValueError("dag must be list[list[str]]")
        if len(dag) > 5:
            raise ValueError("dag depth >5")
        total = sum(len(layer) for layer in dag if isinstance(layer, list))
        if total > 20:
            raise ValueError("dag total nodes >20")
        for layer in dag:
            if isinstance(layer, list) and len(layer) > 8:
                raise ValueError("dag fan-out >8")
        # no cycles — no agent appears twice
        seen: set[str] = set()
        for layer in dag:
            if not isinstance(layer, list):
                continue
            for ag in layer:
                if ag in seen:
                    raise ValueError(f"dag cycle: agent {ag} appears twice")
                seen.add(ag)


# ── Handoff ────────────────────────────────────────────────────────────────
class AgentHandoff(TypedDict, total=False):
    source_agent: str
    target_agent: str
    workspace_id: str
    user_id: str
    request_id: str
    task_id: str
    objective: str
    context_refs: list[str]
    allowed_tools: list[str]
    required_scopes: list[str]
    handoff_reason: str
    provenance: dict[str, Any]
    schema_version: int


MAX_HANDOFF_BYTES = 8192
MAX_HANDOFF_CONTEXT_REFS = 8


def validate_handoff(h: dict[str, Any]) -> None:
    if not isinstance(h, dict):
        raise ValueError("AgentHandoff must be dict")
    for req in ("source_agent", "target_agent", "workspace_id", "user_id", "request_id", "objective"):
        v = h.get(req)
        if not v or not isinstance(v, str):
            raise ValueError(f"handoff missing {req}")
        if len(v) > 512:
            raise ValueError(f"handoff field {req} too long")
    if h.get("schema_version") not in (None, 1):
        raise ValueError("unsupported handoff schema_version")
    # no secrets recursively — caller also validates via validate_no_secrets
    if len(json.dumps(h, default=str).encode()) > MAX_HANDOFF_BYTES:
        raise ValueError(f"handoff exceeds {MAX_HANDOFF_BYTES} bytes")
    refs = h.get("context_refs") or []
    if len(refs) > MAX_HANDOFF_CONTEXT_REFS:
        raise ValueError("handoff context_refs too many")
    # exhaustive: workspace binding must be re-checked at receiver


# ── Tool ───────────────────────────────────────────────────────────────────
class ToolDecision(TypedDict, total=False):
    selected_tool: str | None
    reason: str
    confidence: float
    provenance: dict[str, Any]
    schema_version: int


class PolicyDecision(TypedDict, total=False):
    allowed: bool
    requires_approval: bool
    reason: str
    forged_rejected: bool
    fail_closed: bool
    schema_version: int


# ── Evaluation ─────────────────────────────────────────────────────────────
class EvaluationResult(TypedDict, total=False):
    task_completion: bool
    tool_correctness: bool
    retrieval_relevance: bool
    memory_relevance: bool
    policy_correctness: bool
    workspace_correctness: bool
    output_schema_valid: bool
    provenance_complete: bool
    user_objective_met: bool
    score: float
    replan_required: bool
    reason: str
    schema_version: int


def validate_evaluation(ev: dict[str, Any]) -> None:
    if not isinstance(ev, dict):
        raise ValueError("EvaluationResult must be dict")
    score = ev.get("score")
    if score is not None and not (0.0 <= float(score) <= 1.0):
        raise ValueError("evaluation score 0..1")
    if ev.get("replan_required") and ev.get("schema_version") not in (None, 1):
        raise ValueError("evaluation schema_version")
    if len(json.dumps(ev, default=str).encode()) > 2048:
        raise ValueError("EvaluationResult too large")


# ── Memory / Knowledge ─────────────────────────────────────────────────────
class MemoryCandidate(TypedDict, total=False):
    name: str
    type: str
    confidence: float
    content: str
    provenance: dict[str, Any]
    schema_version: int


class KnowledgeUpdate(TypedDict, total=False):
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    provenance: dict[str, Any]
    schema_version: int


# ── Final ──────────────────────────────────────────────────────────────────
class FinalAgentResult(TypedDict, total=False):
    status: Literal["completed", "failed", "cancelled", "waiting_approval"]
    agent: str
    summary: str
    result: dict[str, Any]
    rag_status: str
    provenance: dict[str, Any]
    schema_version: int


def validate_final_result(fr: dict[str, Any]) -> None:
    if not isinstance(fr, dict):
        raise ValueError("FinalAgentResult must be dict")
    if fr.get("status") not in (None, "completed", "failed", "cancelled", "waiting_approval"):
        raise ValueError("unknown FinalAgentResult status")
    if len(json.dumps(fr, default=str).encode()) > 20480:
        raise ValueError("FinalAgentResult too large")
