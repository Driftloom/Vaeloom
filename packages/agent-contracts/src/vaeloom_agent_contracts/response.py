from uuid import UUID
from typing import Any, Optional
from pydantic import BaseModel, Field


class AgentUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    execution_time_ms: float = 0.0


class AgentResponse(BaseModel):
    session_id: UUID
    agent_name: str
    action: str = Field(default="complete")
    result: str
    data: dict[str, Any] = Field(default_factory=dict)
    failure_code: Optional[str] = None
    is_success: bool = True
    usage: AgentUsage = Field(default_factory=AgentUsage)
    metadata: dict[str, Any] = Field(default_factory=dict)
