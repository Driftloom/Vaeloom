import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Workspace name must be non-empty")


class UpdateWorkspaceRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
