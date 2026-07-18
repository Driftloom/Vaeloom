import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class MemoryCreate(BaseModel):
    type: str = Field(..., min_length=1, max_length=100)
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    workspace_id: str | None = None
    source_type: str | None = None
    source_uri: str | None = None
    source_label: str | None = None
    connector_id: str | None = None


class MemoryUpdate(BaseModel):
    type: str | None = Field(None, min_length=1, max_length=100)
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    status: str | None = None


class MemoryResponse(BaseModel):
    id: uuid.UUID
    type: str
    status: str
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    content_hash: str | None = None
    size: int | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    tenant_id: str | None = None
    user_id: str | None = None
    workspace_id: str | None = None
    source_type: str | None = None
    source_uri: str | None = None
    source_label: str | None = None
    connector_id: str | None = None
    vector_id: str | None = None
    graph_node_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryQuery(BaseModel):
    type: str | None = None
    status: str | None = "active"
    tags: list[str] | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1)
    type: str | None = None
    tags: list[str] | None = None
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float | None = Field(default=0.7, ge=0.0, le=1.0)


class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float
