import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

# Canonical 6 memory types per 01-mvp-spec.md (spec says 6, prompt says 22 — spec wins for MVP)
# + legacy test compat: "note" and "fact" appear in existing unit tests and are treated as aliases
MemoryType = Literal["profile", "document", "career", "episodic", "preference", "working", "note", "fact"]


class MemoryCreate(BaseModel):
    type: MemoryType = Field(..., description="One of the 6 canonical memory types")
    domain: str | None = Field(None, max_length=100)
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
    supersedes_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_at_least_one_text(self):
        # P14 GO condition: empty content must 422, not 500 via DB IntegrityError
        if not (self.title and self.title.strip()) and not (self.summary and self.summary.strip()) and not (self.content and self.content.strip()):
            raise ValueError("At least one of title, summary, content must be non-empty")
        return self


class MemoryUpdate(BaseModel):
    type: str | None = Field(None, min_length=1, max_length=100)
    domain: str | None = Field(None, max_length=100)
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    status: str | None = None
    supersedes_id: uuid.UUID | None = None


class MemoryResponse(BaseModel):
    id: uuid.UUID
    type: str
    domain: str | None = None
    status: str
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    content_hash: str | None = None
    size: int | None = None
    metadata: dict[str, Any] | None = Field(None, validation_alias="metadata_")
    tags: list[str] | None = None
    tenant_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    source_type: str | None = None
    source_uri: str | None = None
    source_label: str | None = None
    supersedes_id: uuid.UUID | None = None
    deleted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryQuery(BaseModel):
    type: str | None = None
    domain: str | None = None
    status: str | None = "active"
    tags: list[str] | None = None
    workspace_id: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    include_superseded: bool = Field(default=False, description="If true, includes superseded memories in list")


class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1)
    type: str | None = None
    domain: str | None = None
    tags: list[str] | None = None
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float | None = Field(default=0.7, ge=0.0, le=1.0)


class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float
