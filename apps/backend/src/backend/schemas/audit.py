from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RecordAuditEventRequest(BaseModel):
    actor_id: str = Field(..., min_length=1, max_length=120)
    action: str = Field(..., min_length=1, max_length=120)
    resource: str = Field(..., min_length=1, max_length=80)
    resource_id: str | None = Field(None, max_length=120)
    metadata: dict[str, Any] | None = None


class AuditEventResponse(BaseModel):
    id: str
    actor_id: str
    action: str
    resource: str
    resource_id: str | None
    tenant_id: str | None
    metadata: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ComplianceReport(BaseModel):
    by_action: list[dict]
    by_resource: list[dict]
    total: int
    generated_at: datetime
