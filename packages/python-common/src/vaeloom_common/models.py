from datetime import datetime
from enum import StrEnum
from typing import Any, TypeVar
from uuid import UUID, uuid4

from pydantic import BaseModel as PydanticBaseModel
from pydantic import Field


class BaseModel(PydanticBaseModel):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    tenant_id: UUID | None = None
    created_by: UUID | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


T = TypeVar("T")


class PaginatedResponse[T](BaseModel):
    data: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ApiResponse[T](BaseModel):
    success: bool = True
    data: T
    error: dict[str, Any] | None = None
    meta: dict[str, Any] | None = None


class ApiError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class MemoryType(StrEnum):
    DOCUMENT = "document"
    EMAIL = "email"
    CODE = "code"
    NOTE = "note"
    CONVERSATION = "conversation"
    WEBPAGE = "webpage"
    STRUCTURED = "structured"


class MemoryStatus(StrEnum):
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"
    ARCHIVED = "archived"
    DELETED = "deleted"


class MemoryQuery(BaseModel):
    query: str
    filters: dict[str, Any] | None = None
    limit: int = 10
    offset: int = 0
    min_score: float = 0.0


class AgentStatus(StrEnum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"


class AgentConfig(BaseModel):
    name: str
    description: str
    model: str = "claude-sonnet-4-20250514"
    temperature: float = 0.3
    max_tokens: int = 4096
    tools: list[str] = []
    memory_enabled: bool = True
    rate_limit_rpm: int = 60


class TenantContext(BaseModel):
    tenant_id: UUID
    user_id: UUID | None = None
    roles: list[str] = []
    permissions: list[str] = []
    is_system: bool = False
