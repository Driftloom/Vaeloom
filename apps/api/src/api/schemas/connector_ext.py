import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ConnectorType(StrEnum):
    REST = "rest"
    GRAPHQL = "graphql"
    DATABASE = "database"
    FILE = "file"
    MCP = "mcp"

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


class McpToolInfoResponse(BaseModel):
    name: str
    description: str = ""
    input_schema: dict[str, Any] = Field(default_factory=dict)
    read_only_hint: bool = False


class McpCallRequest(BaseModel):
    tool_name: str = Field(..., min_length=1, max_length=200)
    arguments: dict[str, Any] = Field(default_factory=dict)
