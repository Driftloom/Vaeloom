import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IntegrationCreate(BaseModel):
    name: str = Field(..., min_length=1)
    provider: str = Field(..., min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)


class IntegrationUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None


class IntegrationResponse(BaseModel):
    id: uuid.UUID
    name: str
    provider: str
    config: dict[str, Any]
    status: str
    user_id: uuid.UUID
    last_sync_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
