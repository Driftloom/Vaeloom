from uuid import UUID
from typing import Any, Optional
from pydantic import BaseModel, Field
from vaeloom_agent_security import SecurityContext


class AgentTurnContext(BaseModel):
    """Context state passed into an agent turn."""
    security: SecurityContext
    session_id: UUID
    agent_id: str
    user_prompt: str
    profile_data: dict[str, Any] = Field(default_factory=dict)
    conversation_history: list[dict[str, Any]] = Field(default_factory=list)
    step_count: int = 0
    tokens_consumed: int = 0
    cost_usd: float = 0.0
    is_cancelled: bool = False
