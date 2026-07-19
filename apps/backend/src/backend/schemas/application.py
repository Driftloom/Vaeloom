import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ApplicationCreate(BaseModel):
    job_external_id: str | None = None
    platform: str | None = None
    status: str = "DRAFT"
    metadata: dict[str, Any] = Field(default_factory=dict)


class ApplicationUpdateOutcome(BaseModel):
    status: str = Field(..., min_length=1)


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    job_external_id: str | None = None
    platform: str | None = None
    status: str
    resume_version_id: str | None = None
    cover_letter: str | None = None
    submitted_at: datetime | None = None
    outcome: str | None = None
    outcome_at: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
