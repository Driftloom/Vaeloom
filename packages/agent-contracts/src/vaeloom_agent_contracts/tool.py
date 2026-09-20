from enum import Enum
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ToolRiskLevel(str, Enum):
    READ_ONLY = "read_only"
    MUTATION_OPEN = "mutation_open"
    MUTATION_GATED = "mutation_gated"
    SANDBOX_REQUIRED = "sandbox_required"


class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters_schema: dict[str, Any] = Field(default_factory=dict)
    risk_level: ToolRiskLevel = ToolRiskLevel.READ_ONLY
    timeout_seconds: int = Field(default=30, ge=1)
    category: str = "general"


class ToolInvocation(BaseModel):
    call_id: str
    tool_name: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    workspace_id: UUID
    user_id: UUID


class ToolResult(BaseModel):
    call_id: str
    tool_name: str
    success: bool
    output: Any
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
