import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    path: str
    type: str
    summary: str | None = None
    metadata: dict[str, Any] | None = Field(None, validation_alias="metadata_")
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
    page: int = 1
    page_size: int = 20


class DocumentRenameRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=1000)


class DocumentActionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    workspace_id: uuid.UUID
    action_type: str
    old_path: str | None = None
    new_path: str | None = None
    old_deleted_at: datetime | None = None
    new_deleted_at: datetime | None = None
    undone_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentActionListResponse(BaseModel):
    actions: list[DocumentActionResponse]
    total: int
