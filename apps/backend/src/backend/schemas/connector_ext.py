import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from enum import Enum

class ConnectorType(str, Enum):
    REST = "rest"
    GRAPHQL = "graphql"
    DATABASE = "database"
    FILE = "file"

class CreateConnectorRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    type: ConnectorType
    config: dict[str, Any]
    tenant_id: str | None = None

class UpdateConnectorRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    config: dict[str, Any] | None = None

class ConnectorResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    type: str
    status: str
    config: dict[str, Any]
    scopes: list[str] | None = None
    last_synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class SyncStatusResponse(BaseModel):
    connector_id: str
    status: str
    error: str | None = None
    synced_at: datetime | None = None
