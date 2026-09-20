from typing import Optional
from pydantic import BaseModel, Field
from .manifest import AgentCategory, AutonomyLevel


class AgentCard(BaseModel):
    """A2A (Agent-to-Agent) and UI discovery contract."""
    agent_id: str
    name: str
    version: str
    description: str
    category: AgentCategory
    autonomy_level: AutonomyLevel
    capabilities: list[str] = Field(default_factory=list)
    supported_protocols: list[str] = Field(default_factory=lambda: ["messages_api_v1", "sse_stream_v1"])
    icon_svg: Optional[str] = None
