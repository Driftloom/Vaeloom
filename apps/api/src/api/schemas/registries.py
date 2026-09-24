"""Pydantic DTO Schemas for Enterprise Dynamic Registries."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Tool Registry Schemas ──────────────────────────────────────────

class ToolRegistryCreate(BaseModel):
    tool_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    version: str = Field("1.0.0", max_length=50)
    description: str
    category: str = Field("general", max_length=100)
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    required_permissions: list[str] = Field(default_factory=list)
    data_scopes: list[str] = Field(default_factory=list)
    risk_level: str = Field("LOW", max_length=50)
    side_effects: bool = False
    idempotent: bool = True
    timeout_seconds: int = 30
    retry_policy: dict[str, Any] = Field(default_factory=lambda: {"max_retries": 2, "backoff": "exponential"})
    is_active: bool = True
    tenant_scope: bool = False
    workspace_scope: bool = False
    workspace_id: uuid.UUID | None = None


class ToolRegistryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    input_schema: dict[str, Any] | None = None
    output_schema: dict[str, Any] | None = None
    required_permissions: list[str] | None = None
    risk_level: str | None = None
    is_active: bool | None = None
    timeout_seconds: int | None = None


class ToolRegistryResponse(BaseModel):
    id: uuid.UUID
    tool_id: str
    name: str
    version: str
    description: str
    category: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    required_permissions: list[str]
    data_scopes: list[str]
    risk_level: str
    side_effects: bool
    idempotent: bool
    timeout_seconds: int
    retry_policy: dict[str, Any]
    is_active: bool
    tenant_scope: bool
    workspace_scope: bool
    tenant_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Model Registry Schemas ─────────────────────────────────────────

class ModelProviderCreate(BaseModel):
    model_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(..., min_length=1, max_length=100)
    version: str = Field("latest", max_length=50)
    tier: str = Field("balanced", max_length=50)
    context_window: int = 128000
    cost_per_1k_input: float = 0.001
    cost_per_1k_output: float = 0.002
    capabilities: dict[str, Any] = Field(default_factory=lambda: {"tool_calling": True, "structured_output": True})
    is_active: bool = True
    is_default: bool = False
    health_status: str = Field("healthy", max_length=50)
    latency_p95_ms: float | None = None
    workspace_id: uuid.UUID | None = None


class ModelProviderUpdate(BaseModel):
    name: str | None = None
    tier: str | None = None
    cost_per_1k_input: float | None = None
    cost_per_1k_output: float | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    health_status: str | None = None
    latency_p95_ms: float | None = None


class ModelProviderResponse(BaseModel):
    id: uuid.UUID
    model_id: str
    name: str
    provider: str
    version: str
    tier: str
    context_window: int
    cost_per_1k_input: float
    cost_per_1k_output: float
    capabilities: dict[str, Any]
    is_active: bool
    is_default: bool
    health_status: str
    latency_p95_ms: float | None = None
    tenant_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Policy Registry Schemas ────────────────────────────────────────

class PolicyCreate(BaseModel):
    policy_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    scope: str = Field(..., max_length=50)
    target: str = Field("*", max_length=100)
    rules: dict[str, Any] = Field(default_factory=dict)
    risk_threshold: str = Field("MEDIUM", max_length=50)
    requires_approval: bool = False
    is_active: bool = True
    version: int = 1
    workspace_id: uuid.UUID | None = None


class PolicyResponse(BaseModel):
    id: uuid.UUID
    policy_id: str
    name: str
    scope: str
    target: str
    rules: dict[str, Any]
    risk_threshold: str
    requires_approval: bool
    is_active: bool
    version: int
    tenant_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Prompt Version Schemas ─────────────────────────────────────────

class PromptVersionCreate(BaseModel):
    prompt_id: str = Field(..., min_length=1, max_length=100)
    version: str = Field("1.0.0", max_length=50)
    agent_scope: str = Field("*", max_length=100)
    template: str
    content_hash: str
    variables: list[str] = Field(default_factory=list)
    is_active: bool = True
    canary_percentage: int = 100
    author: str | None = None
    workspace_id: uuid.UUID | None = None


class PromptVersionResponse(BaseModel):
    id: uuid.UUID
    prompt_id: str
    version: str
    agent_scope: str
    template: str
    content_hash: str
    variables: list[str]
    is_active: bool
    canary_percentage: int
    author: str | None = None
    tenant_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Evaluation Schemas ─────────────────────────────────────────────

class EvaluationRecordCreate(BaseModel):
    eval_id: str = Field(..., min_length=1, max_length=100)
    execution_id: str | None = None
    agent_name: str
    intent: str
    accuracy_score: float = 1.0
    groundedness_score: float = 1.0
    tool_selection_score: float = 1.0
    latency_ms: float = 0.0
    token_count: int = 0
    cost_usd: float = 0.0
    verdict: str = "PASS"
    metrics: dict[str, Any] = Field(default_factory=dict)
    workspace_id: uuid.UUID | None = None


class EvaluationRecordResponse(BaseModel):
    id: uuid.UUID
    eval_id: str
    execution_id: str | None = None
    agent_name: str
    intent: str
    accuracy_score: float
    groundedness_score: float
    tool_selection_score: float
    latency_ms: float
    token_count: int
    cost_usd: float
    verdict: str
    metrics: dict[str, Any]
    tenant_id: uuid.UUID | None = None
    workspace_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
