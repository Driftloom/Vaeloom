# Routing Model Structured Contract & IntentEnvelope Specification

**Document Identifier**: `ARCH-MODEL-CONTRACT-01`  
**Version**: `1.0.0`  
**Status**: APPROVED DESIGN SPECIFICATION

---

## 1. Zero Unstructured Text Principle

All LLM calls involved in intent classification, tool planning, and multi-agent
coordination must produce **strictly validated Pydantic JSON schemas**.

Free-form natural language responses, regex parsing of classifications, or
`"if 'resume' in text"` logic are strictly prohibited in enterprise production.

---

## 2. Pydantic Schemas

### 2.1 `IntentEnvelope` (v1.0.0)

```python
class UrgencyLevel(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class EmotionalValence(str, Enum):
    NEUTRAL = "neutral"
    POSITIVE = "positive"
    FRUSTRATED = "frustrated"
    OVERWHELMED = "overwhelmed"
    ANXIOUS = "anxious"
    CONFUSED = "confused"

class IntentEnvelope(BaseModel):
    # Tracing & Provenance
    request_id: str = Field(..., description="Unique request UUIDv4")
    trace_id: str = Field(..., description="OpenTelemetry trace identifier")
    tenant_id: str = Field(..., description="Validated tenant UUIDv4")
    workspace_id: str = Field(..., description="Validated workspace UUIDv4")
    user_id: str = Field(..., description="Validated caller identity")
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Semantic Intent Extraction
    normalized_goal: str = Field(..., description="Synthesized canonical statement of the user's objective")
    raw_query: str = Field(..., description="Original user prompt")
    requested_outcome: str = Field(..., description="Desired deliverable or state mutation")
    entities: dict[str, list[str]] = Field(default_factory=dict, description="Extracted entities: roles, companies, tools, dates")
    constraints: list[str] = Field(default_factory=list, description="User constraints e.g. 'under 1 page', 'remote only'")

    # Emotional & Cognitive Context Signals
    urgency: UrgencyLevel = UrgencyLevel.NORMAL
    emotional_signal: EmotionalValence = EmotionalValence.NEUTRAL
    cognitive_load_state: str = "normal"  # 'overloaded', 'exploratory', 'focused'

    # Capability Requirements
    required_capabilities: list[str] = Field(..., description="List of capability IDs needed (e.g. ['career.resume.tailor'])")
    candidate_agent_types: list[str] = Field(default_factory=list)
    required_tools: list[str] = Field(default_factory=list)
    required_memory_scopes: list[str] = Field(default_factory=list)

    # Risk & Autonomy Evaluation
    estimated_risk_level: str = "low"
    autonomy_requirement: str = "suggest"
    clarification_required: bool = False
    clarification_prompt: str | None = None

    # Confidence & Metadata
    confidence: float = Field(..., ge=0.0, le=1.0)
    ambiguity_score: float = Field(0.0, ge=0.0, le=1.0)
    model_version: str = Field(...)
    routing_version: str = "2.0.0"
```

### 2.2 `RoutingDecision` (v1.0.0)

Output schema returned by the LLM intent arbitrator:

```python
class RoutingDecision(BaseModel):
    selected_capability: str = Field(..., description="Primary capability ID e.g. 'career.resume.tailor'")
    primary_agent: str = Field(..., description="Agent assigned to execute capability")
    secondary_agents: list[str] = Field(default_factory=list, description="Collaborating agents for multi-intent goals")

    confidence: float = Field(..., ge=0.0, le=1.0)
    decision_rationale: str = Field(..., max_length=256, description="Auditable evidence summary; NO internal chain-of-thought")

    needs_clarification: bool = False
    clarification_question: str | None = None

    suggested_action_proposals: list[dict[str, Any]] = Field(default_factory=list)
    safety_flags: list[str] = Field(default_factory=list)
```

---

## 3. Strict Chain-of-Thought Guard

Raw chain-of-thought reasoning tokens must **never** be exposed in API responses
or user-facing logs. Only the structured `decision_rationale` (factual,
auditable evidence summary) is persisted for compliance and debugging.
