"""Intent Envelope Contract — The 27-Field Zero-Trust Routing Envelope.

Carries the full semantic understanding, context signals, active state references,
fenced memory, and execution budget for every user turn.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Any
import uuid

from pydantic import BaseModel, Field, field_validator

from .capability import AutonomyLevel


class EmotionalState(str, Enum):
    """Emotional state detected from context signals (Rogers OARS mapping)."""
    CALM = "calm"
    ANXIOUS = "anxious"
    FRUSTRATED = "frustrated"
    BURNT_OUT = "burnt_out"
    CONFUSED = "confused"
    DETERMINED = "determined"


class OARSTone(str, Enum):
    """Empathetic conversational tone guidance for System 2 generation."""
    SUPPORTIVE_AFFIRMATION = "supportive_affirmation"  # Acknowledge struggle, validate feelings
    REFLECTIVE_INQUIRY = "reflective_inquiry"          # Clarify ambiguous desires gently
    STRUCTURED_DECOMPOSITION = "structured_decomposition"  # Break overwhelming tasks into micro-steps
    DIRECT_EXECUTIVE = "direct_executive"              # Crisp, confident, zero fluff


class ContextSignal(BaseModel):
    """Psychological and urgency signals translated into cognitive parameters."""
    emotional_state: EmotionalState = Field(default=EmotionalState.CALM)
    valence: float = Field(default=0.0, ge=-1.0, le=1.0, description="-1.0 negative, +1.0 positive")
    urgency: float = Field(default=0.3, ge=0.0, le=1.0, description="0.0 relaxed, 1.0 urgent deadline")
    cognitive_load: float = Field(default=0.4, ge=0.0, le=1.0, description="Estimated fatigue/complexity")
    oars_tone: OARSTone = Field(default=OARSTone.DIRECT_EXECUTIVE)
    detected_signals: list[str] = Field(default_factory=list, description="Reasoning flags (e.g. ['high_stress_phrasing'])")


class UserContextFencing(BaseModel):
    """Memory evidence boundaries and provenance tracking."""
    provenance_ids: list[str] = Field(default_factory=list)
    memory_freshness_score: float = Field(default=1.0, ge=0.0, le=1.0)
    sensitivity_level: str = Field(default="standard", description="'standard', 'confidential', 'restricted'")
    quarantined_sources: list[str] = Field(default_factory=list)


class IntentEnvelope(BaseModel):
    """Comprehensive typed Intent Envelope governing all orchestrator phases."""
    envelope_id: str = Field(default_factory=lambda: f"env_{uuid.uuid4().hex[:12]}")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    user_id: str | None = Field(default=None)
    tenant_id: str | None = Field(default=None)
    workspace_id: str = Field(...)

    @field_validator("workspace_id")
    @classmethod
    def validate_workspace_id(cls, v: str) -> str:
        if not v or not str(v).strip():
            raise ValueError("workspace_id cannot be empty")
        try:
            uuid.UUID(str(v).strip())
        except Exception:
            raise ValueError(f"workspace_id must be a valid UUID string, got: {v}")
        return str(v).strip()

    # Raw and Cleaned Text
    raw_query: str = Field(...)
    sanitized_query: str = Field(default="")

    # Core Semantic Intent
    normalized_intent: str = Field(default="unclassified", description="Canonical goal (e.g. 'tailor_resume_for_job')")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    category: str = Field(default="general", description="High-level category domain")
    secondary_categories: list[str] = Field(default_factory=list)

    # Capability Resolution
    required_capabilities: list[str] = Field(default_factory=list, description="Reverse-DNS capabilities needed")
    candidate_agents: list[str] = Field(default_factory=list)
    selected_agent: str = Field(default="")
    routing_method: str = Field(
        default="pending",
        description="'deterministic_safety', 'semantic_candidate', 'jev_system1', 'llm_arbitration'",
    )

    # Multi-Agent Decomposition
    is_complex_goal: bool = Field(default=False)
    subtasks: list[dict[str, Any]] = Field(default_factory=list)

    # Conversational & Emotional Subsystem
    social_intent: str | None = Field(default=None, description="'greeting', 'gratitude', 'farewell', or None")
    context_signal: ContextSignal = Field(default_factory=ContextSignal)

    # State & Context Bindings
    active_artifact_references: list[str] = Field(default_factory=list)
    resolved_entities: dict[str, Any] = Field(default_factory=dict)
    extracted_parameters: dict[str, Any] = Field(default_factory=dict)

    # Budgets & Autonomy
    execution_budget: dict[str, Any] = Field(
        default_factory=lambda: {"max_tokens": 4096, "max_time_s": 45.0, "max_iterations": 5}
    )
    autonomy_granted: AutonomyLevel = Field(default=AutonomyLevel.SUGGEST)

    # Fencing & Provenance
    user_context_fencing: UserContextFencing = Field(default_factory=UserContextFencing)

    # Metrics & Observability
    routing_latency_ms: float = Field(default=0.0)
    audit_signature: str = Field(default="")
