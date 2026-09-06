import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

# Canonical 6 memory types per 01-mvp-spec.md + expand-contract 16 additive per CONT-P12 ADR-040..043
# Spec 6 stay valid; enterprise 16 added additively (no rewrite, no guess) per 0027 migration.
# Legacy test compat: "note" and "fact" aliases kept.
MemoryType = Literal[
    "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
]

# Enterprise additive types (16) for expand-contract provenance
ENTERPRISE_MEMORY_TYPES: set[str] = {
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
}
CANONICAL_6: set[str] = {"profile", "document", "career", "episodic", "preference", "working"}


class MemoryCreate(BaseModel):
    type: MemoryType = Field(..., description="One of 22 memory types (6 canonical + 16 enterprise additive per CONT-P12 expand-contract 0027)")
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
    type: str | None = Field(None, min_length=1, max_length=100, description="22 types allowed; see 0027 ck_memories_type_valid")
    taxonomy_version: int | None = Field(None, ge=1, le=2, description="expand-contract version 1=legacy 6, 2=expanded 22")
    lineage: dict[str, Any] | None = Field(None, description="model/prompt/tool/retrieval lineage per CONT-P12-R06")
    confidence: float | None = Field(None, ge=0.0, le=1.0, description="contradiction/confidence per WS-12.2 task 4")
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
