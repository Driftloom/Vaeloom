"""Action Proposal Contracts — Dynamic Interactive Capability Chips.

Defines schemas for executable action proposals synthesized from live workspace
state, replacing static string arrays.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
import uuid

from pydantic import BaseModel, Field

from .capability import AutonomyLevel, RiskClass


class ProposalType(str, Enum):
    """Semantic type of proposed action."""
    ACTION_CHIP = "action_chip"                    # Interactive suggestion pill in chat
    DOCUMENT_MUTATION = "document_mutation"        # Proposed file update/generation
    EXTERNAL_INTEGRATION = "external_integration"  # Proposed connector action (e.g. Gmail draft)
    SCHEDULE_EVENT = "schedule_event"              # Proposed calendar booking
    APPROVAL_REQUEST = "approval_request"          # High-risk action awaiting human consent


class ProposalActionBinding(BaseModel):
    """Deterministic tool execution binding attached to an action proposal."""
    tool_name: str = Field(..., description="Target tool to execute if clicked/confirmed")
    arguments: dict[str, Any] = Field(default_factory=dict, description="Pre-computed argument payload")
    required_scope: str = Field(..., description="Scope required to authorize tool execution")
    autonomy_level: AutonomyLevel = Field(default=AutonomyLevel.SUGGEST)
    idempotency_key: str = Field(default_factory=lambda: uuid.uuid4().hex)


class ActionProposal(BaseModel):
    """Dynamic, executable action proposal presented to user or client UI."""
    proposal_id: str = Field(default_factory=lambda: f"prop_{uuid.uuid4().hex[:12]}")
    title: str = Field(..., description="User-facing title (e.g. '📄 Tailor Resume for Google SWE')")
    description: str = Field(default="", description="Contextual rationale for why this is proposed")
    proposal_type: ProposalType = Field(default=ProposalType.ACTION_CHIP)
    risk_class: RiskClass = Field(default=RiskClass.LOW)
    confidence: float = Field(default=0.90, ge=0.0, le=1.0)
    requires_approval: bool = Field(default=False)
    binding: ProposalActionBinding | None = Field(
        default=None,
        description="Executable tool binding. None for pure conversational suggestions.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)
