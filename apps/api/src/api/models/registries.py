"""Enterprise Dynamic Architecture Database Models.

PostgreSQL models for:
- ToolRegistryEntry
- ModelProviderEntry
- PolicyEntry
- PromptVersionEntry
- EvaluationEntry

Includes tenant and workspace scoping, RLS readiness, and versioning.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ToolRegistryEntry(Base):
    """Authoritative Tool Registry table."""
    __tablename__ = "tool_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tool_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), default="1.0.0", nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="general", nullable=False)
    
    # JSON schemas
    input_schema: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_schema: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    
    # Permissions and security
    required_permissions: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    data_scopes: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(50), default="LOW", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    side_effects: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    idempotent: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    timeout_seconds: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    retry_policy: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {"max_retries": 2, "backoff": "exponential"}, nullable=False)
    
    # Scoping
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tenant_scope: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    workspace_scope: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tool_id", "version", "workspace_id", name="uq_tool_registry_id_version_ws"),
        Index("idx_tool_registry_lookup", "tool_id", "is_active", "workspace_id"),
    )


class ModelProviderEntry(Base):
    """Authoritative Model & Provider Registry table."""
    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)  # openai, anthropic, google, groq, ollama
    version: Mapped[str] = mapped_column(String(50), default="latest", nullable=False)
    tier: Mapped[str] = mapped_column(String(50), default="balanced", nullable=False)  # fast, balanced, powerful
    
    context_window: Mapped[int] = mapped_column(Integer, default=128000, nullable=False)
    cost_per_1k_input: Mapped[float] = mapped_column(Float, default=0.001, nullable=False)
    cost_per_1k_output: Mapped[float] = mapped_column(Float, default=0.002, nullable=False)
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSON, default=lambda: {"tool_calling": True, "structured_output": True}, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    health_status: Mapped[str] = mapped_column(String(50), default="healthy", nullable=False)  # healthy, degraded, unhealthy
    latency_p95_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Tenant customization (BYOK / specific endpoints)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("model_id", "provider", "workspace_id", name="uq_model_registry_id_prov_ws"),
        Index("idx_model_registry_lookup", "tier", "health_status", "is_active"),
    )


class PolicyEntry(Base):
    """Authoritative Policy & Guardrails Registry table."""
    __tablename__ = "policy_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    scope: Mapped[str] = mapped_column(String(50), nullable=False)  # agent, tool, model, retrieval, workspace
    target: Mapped[str] = mapped_column(String(100), default="*", nullable=False)
    rules: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    risk_threshold: Mapped[str] = mapped_column(String(50), default="MEDIUM", nullable=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("policy_id", "version", "workspace_id", name="uq_policy_registry_id_ver_ws"),
        Index("idx_policy_registry_scope", "scope", "target", "is_active"),
    )


class PromptVersionEntry(Base):
    """Authoritative Prompt Versioning table."""
    __tablename__ = "prompt_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0.0", nullable=False)
    agent_scope: Mapped[str] = mapped_column(String(100), default="*", nullable=False)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    variables: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    canary_percentage: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("prompt_id", "version", "workspace_id", name="uq_prompt_versions_id_ver_ws"),
        Index("idx_prompt_versions_lookup", "prompt_id", "is_active", "agent_scope"),
    )


class EvaluationEntry(Base):
    """Authoritative Agent Run Evaluation & Telemetry table."""
    __tablename__ = "evaluation_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    eval_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    execution_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    intent: Mapped[str] = mapped_column(String(100), nullable=False)
    
    accuracy_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    groundedness_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    tool_selection_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    verdict: Mapped[str] = mapped_column(String(50), default="PASS", nullable=False)  # PASS, FAIL, WARN
    metrics: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_eval_records_agent_verdict", "agent_name", "verdict", "created_at"),
    )
