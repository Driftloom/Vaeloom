import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from ..services.memory_type_packs import CAREER_TYPES

# Memory types are no longer a frozen literal here. Migration 0027 froze them
# into a CHECK constraint and 0068 moved that constraint into the
# `memory_type_packs` registry; the vocabulary now lives in
# `services.memory_type_packs.CAREER_TYPES` (the built-in fallback pack) and in
# the active packs in the database, and `MemoryService.create_memory` is what
# consults them.
#
# The consequence for this module is deliberate: `MemoryCreate` must NOT
# re-check the type against a list. A schema-side whitelist would reject at
# construction, before the pack lookup ever ran, and the two copies would drift
# again -- which is the defect the registry exists to remove. Only the cheap
# shape rules (present, non-blank, bounded length) live here.
MemoryType = str

# The canonical 6 per 01-mvp-spec.md. "note" and "fact" are legacy test aliases,
# explicitly not taxonomy members, so they are named wherever the partition is
# computed rather than being silently folded into the enterprise remainder.
_CANONICAL_6: frozenset[str] = frozenset(
    {"profile", "document", "career", "episodic", "preference", "working"}
)
_LEGACY_ALIASES: frozenset[str] = frozenset({"note", "fact"})


def canonical_6_for(types: set[str]) -> set[str]:
    """The canonical 6, restricted to the types a pack actually offers."""
    return set(types) & _CANONICAL_6


def enterprise_types_for(types: set[str]) -> set[str]:
    """The additive expand-contract remainder of ``types`` (CONT-P12, 0027).

    Everything that is neither one of the canonical 6 nor a legacy alias. Takes
    the vocabulary as an argument so it stays correct when a second domain pack
    arrives: call it with that pack's types rather than editing a literal.
    """
    return set(types) - _CANONICAL_6 - _LEGACY_ALIASES


# Enterprise additive types (16) for expand-contract provenance. Derived from the
# pack's own vocabulary so the constants cannot drift from what the write path
# will accept; `test_enterprise_memory_types_is_still_the_same_sixteen` pins the
# result to the literal set 0027 introduced.
ENTERPRISE_MEMORY_TYPES: set[str] = enterprise_types_for(set(CAREER_TYPES))
CANONICAL_6: set[str] = canonical_6_for(set(CAREER_TYPES))


class MemoryCreate(BaseModel):
    type: MemoryType = Field(
        ...,
        min_length=1,
        max_length=50,
        description=(
            "A memory type from an active domain pack; validated against "
            "memory_type_packs at write time (0068), not against a literal here"
        ),
    )
    domain: str | None = Field(None, max_length=100)
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    workspace_id: str | uuid.UUID | None = None
    source_type: str | None = None
    source_uri: str | None = None
    source_label: str | None = None
    connector_id: str | None = None
    supersedes_id: uuid.UUID | None = None
    status: str | None = Field(None, max_length=20, description="Optional initial lifecycle status (defaults to active)")

    @model_validator(mode="after")
    def _check_type_is_not_blank(self):
        # Shape only. `min_length=1` admits whitespace, which is in no pack and
        # would reach `memories.type` as a meaningless NOT NULL value.
        if not self.type.strip():
            raise ValueError("type must not be blank")
        return self

    @model_validator(mode="after")
    def _check_at_least_one_text(self):
        # P14 GO condition: empty content must 422, not 500 via DB IntegrityError
        if not (self.title and self.title.strip()) and not (self.summary and self.summary.strip()) and not (self.content and self.content.strip()):
            raise ValueError("At least one of title, summary, content must be non-empty")
        return self


class MemoryUpdate(BaseModel):
    # `max_length` matches `memories.type`'s column width, as `MemoryCreate`'s
    # already did: 100 here admitted a value the column then truncated or
    # rejected, which is a 500 from the driver rather than a 422 from here.
    type: str | None = Field(None, min_length=1, max_length=50, description="A memory type from an active domain pack; validated against memory_type_packs at write time (0068) only when this field is set")
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
    workspace_id: str | uuid.UUID | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    include_superseded: bool = Field(default=False, description="If true, includes superseded memories in list")


class MemorySearch(BaseModel):
    query: str = Field(..., min_length=1)
    workspace_id: str | uuid.UUID | None = None
    type: str | None = None
    domain: str | None = None
    tags: list[str] | None = None
    top_k: int = Field(default=10, ge=1, le=100)
    threshold: float | None = Field(default=0.7, ge=0.0, le=1.0)
    strategy: Literal["hybrid", "vector", "keyword"] = Field(
        default="hybrid",
        description="Retrieval strategy: hybrid (RRF reciprocal rank fusion), vector, or keyword",
    )
    include_superseded: bool = Field(
        default=False,
        description="If true, includes superseded historical memories in search results",
    )


class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float


# Enterprise Memory Schemas (ENT-P12, CONT-P07)


class MemorySupersedeRequest(BaseModel):
    reason: str = Field(..., min_length=2, description="Audit reason for superseding this memory")
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    type: str | None = None
    domain: str | None = None
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None
    confidence: float | None = Field(default=1.0, ge=0.0, le=1.0)


class MemoryExportItem(BaseModel):
    id: uuid.UUID
    type: str
    status: str
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    content_hash: str | None = None
    size: int | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    supersedes_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemoryExportResponse(BaseModel):
    export_version: str = "1.0"
    workspace_id: uuid.UUID
    exported_at: datetime
    total_count: int
    memories: list[MemoryExportItem]


class MemoryImportItem(BaseModel):
    type: str = Field(default="note")
    domain: str | None = None
    title: str | None = None
    summary: str | None = None
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_type: str | None = "import"
    source_label: str | None = None


class MemoryImportBatch(BaseModel):
    workspace_id: uuid.UUID | None = None
    deduplicate_by_hash: bool = True
    memories: list[MemoryImportItem] = Field(..., min_length=1)


class MemoryImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    error_count: int
    imported_ids: list[uuid.UUID]


class MemoryBulkStatusRequest(BaseModel):
    memory_ids: list[uuid.UUID] = Field(..., min_length=1)
    status: str = Field(..., description="Target status, e.g. active, archived, deleted")
    workspace_id: uuid.UUID | None = None


class MemoryBulkTagRequest(BaseModel):
    memory_ids: list[uuid.UUID] = Field(..., min_length=1)
    add_tags: list[str] = Field(default_factory=list)
    remove_tags: list[str] = Field(default_factory=list)
    workspace_id: uuid.UUID | None = None


class MemoryBulkResult(BaseModel):
    success_count: int
    failed_count: int
    affected_ids: list[uuid.UUID]

