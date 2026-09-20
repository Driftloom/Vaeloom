from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class AutonomyLevel(str, Enum):
    FULL = "full"
    APPROVAL_GATED = "approval_gated"
    READ_ONLY = "read_only"


class AgentCategory(str, Enum):
    CAREER = "career"
    PRODUCTIVITY = "productivity"
    SYSTEM = "system"
    MEMORY = "memory"
    DEVELOPER = "developer"


class BudgetConfig(BaseModel):
    max_tokens_per_turn: int = Field(default=8192, ge=1)
    max_steps_per_turn: int = Field(default=15, ge=1)
    max_usd_per_turn: float = Field(default=0.50, ge=0.0)
    timeout_seconds: int = Field(default=60, ge=1)


class MemoryScopeConfig(BaseModel):
    read_scopes: list[str] = Field(default_factory=list)
    write_scopes: list[str] = Field(default_factory=list)
    denied_scopes: list[str] = Field(default_factory=list)


class DelegationPolicy(BaseModel):
    allowed_targets: list[str] = Field(default_factory=list)
    max_depth: int = Field(default=2, ge=0)
    can_delegate: bool = True


class FallbackConfig(BaseModel):
    fallback_agent: Optional[str] = None
    on_timeout: str = "abort"
    on_rate_limit: str = "retry_exponential"


class AgentManifest(BaseModel):
    schema_version: str = Field(default="1.0.0")
    agent_id: str = Field(..., pattern=r"^[a-z0-9_-]+$")
    name: str
    version: str
    description: str
    category: AgentCategory
    autonomy_level: AutonomyLevel = AutonomyLevel.APPROVAL_GATED
    tools: list[str] = Field(default_factory=list)
    gated_tools: list[str] = Field(default_factory=list)
    memory_scopes: MemoryScopeConfig = Field(default_factory=MemoryScopeConfig)
    delegation: DelegationPolicy = Field(default_factory=DelegationPolicy)
    budget: BudgetConfig = Field(default_factory=BudgetConfig)
    fallback: FallbackConfig = Field(default_factory=FallbackConfig)
