import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class NodeType(StrEnum):
    CONCEPT = "concept"
    ENTITY = "entity"
    DOCUMENT = "document"
    TOPIC = "topic"
    PERSON = "person"
    ORGANIZATION = "organization"
    EVENT = "event"
    PROJECT = "project"


class CreateNodeRequest(BaseModel):
    label: str
    type: NodeType = NodeType.CONCEPT
    description: str | None = None
    importance: float | None = Field(None, ge=0, le=1)
    properties: dict[str, Any] | None = None
    tenant_id: str | None = None


class UpdateNodeRequest(BaseModel):
    label: str | None = None
    type: NodeType | None = None
    description: str | None = None
    importance: float | None = Field(None, ge=0, le=1)
    properties: dict[str, Any] | None = None


class CreateEdgeRequest(BaseModel):
    target_id: str
    relationship: str
    weight: float | None = Field(None, ge=0, le=1)
    properties: dict[str, Any] | None = None


class TraverseRequest(BaseModel):
    start_id: str
    depth: int = Field(default=3, ge=1, le=10)
    mode: str = "bfs"


class ShortestPathRequest(BaseModel):
    from_id: str
    to_id: str
    max_depth: int = Field(default=5, ge=1, le=20)


class NodeResponse(BaseModel):
    id: uuid.UUID
    label: str
    type: str
    description: str | None
    importance: float
    properties: dict[str, Any]
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    edge_count: int | None = None
    model_config = {"from_attributes": True}


class EdgeResponse(BaseModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    relationship: str
    weight: float
    properties: dict[str, Any]
    created_at: datetime
    source: dict | None = None
    target: dict | None = None
    model_config = {"from_attributes": True}
