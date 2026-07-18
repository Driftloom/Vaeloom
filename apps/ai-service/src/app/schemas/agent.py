import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    tenant_id: str | None = None
    user_id: str | None = None
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
    started_at: datetime | None = None
    completed_at: datetime | None = None
    tenant_id: str | None = None
    user_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExecutionStatus(BaseModel):
    id: uuid.UUID
    agent_id: uuid.UUID
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
