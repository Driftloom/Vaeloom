import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from enum import Enum


class PluginStatus(str, Enum):
    REGISTERED = "REGISTERED"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"
    FAILED = "FAILED"


class PluginPermissions(BaseModel):
    memory: list[str] | None = None
    agents: list[str] | None = None
    events: list[str] | None = None
    storage: list[str] | None = None
    network: list[str] | None = None
    files: list[str] | None = None


class RegisterPluginRequest(BaseModel):
    name: str = Field(..., min_length=1)
    version: str = Field(..., min_length=1)
    author: str = Field(..., min_length=1)
    description: str
    license: str
    min_app_version: str
    tags: list[str] = Field(..., min_length=1)
    permissions: PluginPermissions
    capabilities: list[str] = []
    hooks: list[str] = []
    entry_point: str = Field(..., min_length=1)
    tenant_id: str | None = None
    homepage: str | None = None
    repository: str | None = None
    icon: str | None = None
    config_schema: dict[str, Any] | None = None
    code: str | None = None


class UpdatePluginRequest(BaseModel):
    version: str | None = None
    description: str | None = None
    entry_point: str | None = None
    permissions: PluginPermissions | None = None
    capabilities: list[str] | None = None
    hooks: list[str] | None = None
    tags: list[str] | None = None
    status: PluginStatus | None = None


class ExecutePluginRequest(BaseModel):
    input: dict[str, Any] | None = None
    code: str | None = None
    timeout_ms: int | None = None


class PluginResponse(BaseModel):
    id: uuid.UUID
    name: str
    version: str
    description: str
    author: str
    license: str
    status: str
    permissions: dict[str, Any]
    capabilities: list[str]
    hooks: list[str]
    tags: list[str]
    entry_point: str
    tenant_id: str
    homepage: str | None
    repository: str | None
    icon: str | None
    config_schema: dict[str, Any] | None
    code: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ExecutionResponse(BaseModel):
    id: uuid.UUID
    plugin_id: uuid.UUID
    status: str
    duration_ms: int | None
    output: dict[str, Any] | None
    error_message: str | None
    created_at: datetime
    model_config = {"from_attributes": True}
