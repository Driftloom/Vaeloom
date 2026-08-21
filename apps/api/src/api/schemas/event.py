import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EventPublish(BaseModel):
    type: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: str = "NORMAL"
    correlation_id: str | None = None
    workspace_id: str | None = Field(None, description="Workspace to scope event")


class EventResponse(BaseModel):
    id: uuid.UUID
    type: str
    source: str
    category: str
    status: str
    priority: str
    correlation_id: uuid.UUID
    causation_id: uuid.UUID | None = None
    payload: dict[str, Any]
    metadata: dict[str, Any] = Field(validation_alias="metadata_")
    tenant_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime
    published_at: datetime | None = None

    model_config = {"from_attributes": True}


class SubscriptionCreate(BaseModel):
    event_type: str = Field(..., min_length=1)
    handler_id: str = Field(..., min_length=1)
    handler_type: str = "service"
    config: dict[str, Any] = Field(default_factory=dict)
    filters: dict[str, Any] | None = None


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    handler_id: uuid.UUID
    handler_type: str
    config: dict[str, Any]
    filters: dict[str, Any] | None = None
    enabled: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}
