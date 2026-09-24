"""Decision & Execution Plan Contracts — Structured Outputs for Arbitration.

Enforces strict JSON schema validation for LLM arbitration outputs,
eliminating unverified free-text generation and chain-of-thought leakage.
"""

from __future__ import annotations

from typing import Any
import uuid

from pydantic import BaseModel, Field

from .capability import AutonomyLevel


class SubtaskNode(BaseModel):
    """Individual node in a multi-agent execution DAG."""
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:8]}")
    title: str = Field(..., description="Actionable title for the subtask")
    capability_required: str = Field(..., description="Reverse-DNS capability required")
    agent_assigned: str = Field(..., description="Target specialist agent assigned to execute")
    parameters: dict[str, Any] = Field(default_factory=dict)
    dependencies: list[str] = Field(default_factory=list, description="IDs of tasks that must finish before this runs")
    autonomy_level: AutonomyLevel = Field(default=AutonomyLevel.SUGGEST)


class ExecutionPlan(BaseModel):
    """Supervisor execution plan organizing dependencies across agents."""
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:10]}")
    goal_summary: str = Field(...)
    subtasks: list[SubtaskNode] = Field(default_factory=list)
    is_sequential: bool = Field(default=True)
    estimated_latency_ms: float = Field(default=1000.0)
    requires_human_approval: bool = Field(default=False)
    approval_reasons: list[str] = Field(default_factory=list)


class RoutingDecision(BaseModel):
    """Structured Pydantic contract produced by Layer C Semantic Arbitration."""
    primary_capability: str = Field(
        ...,
        description="The resolved reverse-DNS capability identifier (e.g. 'career.resume.tailor')",
    )
    selected_agent: str = Field(..., description="Agent designated for execution")
    confidence: float = Field(..., ge=0.0, le=1.0)
    social_intent: str | None = Field(default=None, description="'greeting', 'gratitude', 'farewell', or None")
    is_complex_goal: bool = Field(default=False)
    subtasks: list[SubtaskNode] = Field(default_factory=list)
    candidate_ranking: list[str] = Field(default_factory=list)
    parameters: dict[str, Any] = Field(default_factory=dict)
    auditable_summary: str = Field(
        ...,
        description="Concise rationale for routing decision. Zero chain-of-thought exposure.",
    )
