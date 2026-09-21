import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    folder_id: uuid.UUID | None = None
    path: str
    type: str
    status: str = "ACTIVE"
    detected_mime_type: str | None = None
    scan_status: str = "CLEAN"
    scan_result: str | None = None
    summary: str | None = None
    raw_storage_key: str | None = None
    metadata: dict[str, Any] | None = Field(None, validation_alias="metadata_")
    expires_at: datetime | None = None
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
    actor_id: uuid.UUID | None = None
    tenant_id: uuid.UUID | None = None
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


# Folder Schemas
class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    name: str
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderTreeItem(BaseModel):
    id: str
    workspace_id: str
    parent_id: str | None = None
    name: str
    created_at: str | None = None
    children: list["FolderTreeItem"] = []


# Version Schemas
class DocumentVersionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    version_number: int
    storage_key: str
    checksum: str | None = None
    size_bytes: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Share Schemas
class DocumentShareCreate(BaseModel):
    target_workspace_id: uuid.UUID
    permission: str = Field("read", description="Permission level: read, edit")
    expires_at: datetime | None = None


class DocumentShareResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    source_workspace_id: uuid.UUID
    target_workspace_id: uuid.UUID
    permission: str
    granted_by: uuid.UUID | None = None
    expires_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Bulk Schemas
class BulkUploadResponse(BaseModel):
    total_attempted: int = 0
    processed: int = 0
    failed: int = 0
    succeeded: list[dict[str, Any]] = []
    items: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []


class BulkDownloadRequest(BaseModel):
    document_ids: list[uuid.UUID]
