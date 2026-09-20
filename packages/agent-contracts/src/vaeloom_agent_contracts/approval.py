from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    CONSUMED = "consumed"


class ApprovalRequest(BaseModel):
    approval_id: UUID = Field(default_factory=uuid4)
    workspace_id: UUID
    tenant_id: UUID
    requested_by_agent: str
    action_name: str
    parameters: dict[str, Any]
    summary: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    nonce: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    decided_by_user_id: Optional[UUID] = None
    decision_reason: Optional[str] = None


class ApprovalVerdict(BaseModel):
    approval_id: UUID
    status: ApprovalStatus
    decided_by_user_id: UUID
    reason: Optional[str] = None
    signature: Optional[str] = None
