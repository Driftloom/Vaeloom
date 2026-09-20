from enum import Enum
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class MemoryScope(str, Enum):
    WORKING = "working"
    SEMANTIC_VECTOR = "semantic_vector"
    KNOWLEDGE_GRAPH = "knowledge_graph"


class MemoryAccessType(str, Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"


class MemoryFact(BaseModel):
    fact_id: Optional[UUID] = None
    workspace_id: UUID
    user_id: Optional[UUID] = None
    category: str
    content: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    provenance_source: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemoryQuery(BaseModel):
    workspace_id: UUID
    query_text: str
    scope: MemoryScope = MemoryScope.SEMANTIC_VECTOR
    limit: int = Field(default=5, ge=1, le=50)
    min_similarity: float = Field(default=0.7, ge=0.0, le=1.0)
