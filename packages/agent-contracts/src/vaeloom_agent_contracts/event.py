from enum import Enum
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class SSEEventType(str, Enum):
    AGENT_START = "agent_start"
    THINKING_STEP = "thinking_step"
    TOOL_INVOCATION = "tool_invocation"
    TOOL_RESULT = "tool_result"
    APPROVAL_REQUIRED = "approval_required"
    DELEGATION_SPAWN = "delegation_spawn"
    DELEGATION_COMPLETE = "delegation_complete"
    AGENT_COMPLETE = "agent_complete"
    AGENT_ERROR = "agent_error"


class SSEEvent(BaseModel):
    event: SSEEventType
    session_id: UUID
    step_index: int = 0
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: float
