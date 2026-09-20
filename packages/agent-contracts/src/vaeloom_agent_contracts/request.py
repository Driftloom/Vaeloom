from uuid import UUID
from typing import Any, Optional
from pydantic import BaseModel, Field


class AgentRequest(BaseModel):
    """Enforces strictly non-null workspace, tenant, and user identity."""
    workspace_id: UUID
    tenant_id: UUID
    user_id: UUID  # STRICTLY NON-NULL! Remediates SEC-P0-02
    session_id: UUID
    agent_name: str
    input_text: str = Field(..., min_length=1)
    context_override: dict[str, Any] = Field(default_factory=dict)
    stream: bool = True
