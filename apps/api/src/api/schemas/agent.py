import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = None
    status: str | None = None


class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    category: str | None = None
    status: str
    version: str
    config: dict[str, Any]
    capabilities: list[str] | None = None
    permissions: dict[str, Any] | None = None
    workspace_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    tenant_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AgentExecute(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)
    stream: bool = False


class ExecutionResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    input: dict[str, Any] | None = None
    output: dict[str, Any] | None = None
    error: str | None = None
    tokens_used: int | None = None
    cost: float | None = None
    duration_ms: int | None = None
    duration: int | None = Field(None, validation_alias="duration_ms")
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleRequest(BaseModel):
    cron: str = Field(..., min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class ScheduleResponse(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    cron: str
    input: dict[str, Any] | None = None
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
