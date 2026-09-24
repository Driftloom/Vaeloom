"""Capability Manifest Contracts — Declarative Capability Specification.

Defines schemas for Agent and Tool capabilities, risk classes, autonomy tiers,
and authorization boundaries.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RiskClass(str, Enum):
    """Risk classification governing human-in-the-loop approval thresholds."""
    LOW = "low"            # Read-only document retrieval, search, metrics
    MEDIUM = "medium"      # Document drafting, classification, transient staging
    HIGH = "high"          # File reorganization, batch rename, outbound email drafting
    CRITICAL = "critical"  # Account deletion, irreversible credential modification, mass purge


class AutonomyLevel(str, Enum):
    """Autonomy level governing agent execution bounds."""
    READ = "read"          # Passive inspection and analysis only
    SUGGEST = "suggest"    # Proposes action cards; requires explicit user click to execute
    DRAFT = "draft"        # Prepares candidate artifact for human review
    WRITE = "write"        # Modifies workspace resources within quota limits
    ACT = "act"            # Fully autonomous multi-step execution loop


class ToolCapabilityManifest(BaseModel):
    """Declarative capability contract for a system or connector tool."""
    tool_name: str = Field(..., description="Canonical tool identifier (e.g. 'read_document')")
    display_name: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Semantic purpose used for embedding match")
    required_scope: str = Field(..., description="Security scope required for invocation")
    risk_class: RiskClass = Field(default=RiskClass.LOW)
    is_idempotent: bool = Field(default=True)
    has_side_effects: bool = Field(default=False)
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    rate_limit_per_minute: int = Field(default=60)
    timeout_seconds: float = Field(default=30.0)


class AgentCapabilityManifest(BaseModel):
    """Declarative capability manifest published by specialist agents."""
    capability_id: str = Field(
        ...,
        description="Unique reverse-DNS capability identifier (e.g. 'career.resume.tailor')",
    )
    agent_id: str = Field(..., description="Underlying agent identifier (e.g. 'resume')")
    display_name: str = Field(..., description="Human-readable title")
    description: str = Field(
        ...,
        description="Comprehensive semantic description used for centroid vector matching",
    )
    semantic_exemplars: list[str] = Field(
        default_factory=list,
        description="Exemplar user requests representing this capability",
    )

    # Tool Requirements & Boundaries
    required_tools: list[str] = Field(
        default_factory=list,
        description="Tools strictly necessary to satisfy this capability",
    )
    optional_tools: list[str] = Field(
        default_factory=list,
        description="Tools that enhance execution if workspace permissions allow",
    )
    forbidden_tools: list[str] = Field(
        default_factory=list,
        description="Tools that this agent is strictly forbidden from executing",
    )

    # Memory & Context Scopes
    supported_memory_scopes: list[str] = Field(
        default_factory=list,
        description="Memory namespaces this capability interacts with (e.g. ['career', 'skills'])",
    )
    required_context: list[str] = Field(
        default_factory=list,
        description="State requirements (e.g. ['active_resume_id', 'target_role'])",
    )

    # Governance & Safety
    risk_class: RiskClass = Field(default=RiskClass.LOW)
    default_autonomy: AutonomyLevel = Field(default=AutonomyLevel.SUGGEST)
    requires_approval_above: AutonomyLevel = Field(default=AutonomyLevel.SUGGEST)
    rate_limit_per_minute: int = Field(default=30)

    # Classifications
    latency_class: str = Field(
        default="interactive",
        description="'interactive' (<2s), 'standard' (<10s), 'batch' (>30s)",
    )
    cost_class: str = Field(default="standard", description="'low', 'standard', 'high'")
    tier_requirement: str = Field(default="mvp", description="'mvp' vs 'enterprise'")
