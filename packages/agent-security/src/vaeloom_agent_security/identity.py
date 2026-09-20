from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class SecurityIsolationError(Exception):
    """Raised when tenant, workspace, or user identity boundaries are violated."""
    pass


class SecurityContext(BaseModel):
    """Strict identity context guaranteeing non-null tenant, workspace, and user."""
    workspace_id: UUID
    tenant_id: UUID
    user_id: UUID  # Non-null! Never Optional!
    roles: list[str] = Field(default_factory=lambda: ["member"])
    is_service_account: bool = False

    @classmethod
    def create(cls, workspace_id: UUID, tenant_id: UUID, user_id: Optional[UUID]) -> "SecurityContext":
        if user_id is None:
            raise SecurityIsolationError("Zero-trust violation: Agent execution requires an authenticated, non-null user_id.")
        return cls(workspace_id=workspace_id, tenant_id=tenant_id, user_id=user_id)
