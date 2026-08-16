import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ResumeResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    variant_type: str
    content: dict[str, Any]
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerateResumeRequest(BaseModel):
    variant_type: str = Field(default="tailored", min_length=1)
    job_description: str | None = None
    target_role: str | None = None
    company: str | None = None
