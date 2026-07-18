from datetime import datetime
from enum import Enum
from typing import Any, Generic, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, Field


class MemoryType(str, Enum):
    DOCUMENT = "document"
    EMAIL = "email"
    CODE = "code"
    NOTE = "note"
    CONVERSATION = "conversation"
    WEBPAGE = "webpage"
    STRUCTURED = "structured"

class MemoryStatus(str, Enum):
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"
    ARCHIVED = "archived"
    DELETED = "deleted"

class Memory(BaseModel):
    id: UUID
    type: MemoryType
    status: MemoryStatus
    title: str
    summary: Optional[str] = None
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime
    tenant_id: UUID
    user_id: Optional[UUID] = None

class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"
    DISABLED = "disabled"

class Agent(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    category: str
    status: AgentStatus
    version: str
    created_at: datetime

class MemoryQueryFilter(BaseModel):
    types: Optional[list[MemoryType]] = None
    tags: Optional[list[str]] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

class MemoryQuery(BaseModel):
    query: str
    filters: Optional[MemoryQueryFilter] = None
    limit: int = 10
    offset: int = 0
    min_score: float = 0.0

T = TypeVar("T")

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool

class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: PaginationMeta
