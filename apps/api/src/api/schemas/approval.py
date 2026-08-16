import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ApprovalRequest(BaseModel):
    agent_name: str = Field(..., min_length=1, max_length=100)
    action_type: str = Field(..., min_length=1, max_length=100)
    payload: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None
    workspace_id: uuid.UUID | None = None
    expires_in_minutes: int | None = Field(default=60, ge=1, le=10080)


class ApprovalDecision(BaseModel):
    note: str | None = Field(None, max_length=2000)


class ApprovalResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID | None = None
    agent_name: str
    action_type: str
    payload: dict[str, Any]
    reason: str | None = None
    status: str
    requested_by: uuid.UUID | None = None
    decided_by: uuid.UUID | None = None
    decision_note: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    decided_at: datetime | None = None

    model_config = {"from_attributes": True}


class ApprovalListResponse(BaseModel):
    items: list[ApprovalResponse]
    total: int
    page: int
    page_size: int
