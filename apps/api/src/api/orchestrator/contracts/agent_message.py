"""Enterprise Typed Agent-to-Agent Message Protocol Contracts.

Provides immutable typed message schemas for:
- Main-to-sub-agent delegation
- Sub-agent to main-agent result reporting
- Multi-agent peer message routing
- Zero-trust authentication and permission bounds
"""

from __future__ import annotations

import enum
import time
import uuid
from typing import Any
from pydantic import BaseModel, Field


class MessageType(str, enum.Enum):
    TASK_DELEGATION = "task_delegation"
    TASK_RESULT = "task_result"
    SUB_TASK_SPAWN = "sub_task_spawn"
    SUB_TASK_RESULT = "sub_task_result"
    STATUS_UPDATE = "status_update"
    CANCEL = "cancel"
    HEARTBEAT = "heartbeat"
    ERROR = "error"


class MessagePriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class AgentMessage(BaseModel):
    """Authoritative typed message sent between agents across the system bus."""
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    parent_run_id: str | None = None
    parent_agent: str | None = None
    
    sender_agent: str
    recipient_agent: str
    message_type: MessageType = MessageType.TASK_DELEGATION
    priority: MessagePriority = MessagePriority.NORMAL
    
    # Security and multi-tenancy context
    tenant_id: str | None = None
    workspace_id: str | None = None
    user_id: str | None = None
    
    # Execution intent
    capability: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    
    # Delegated security permissions (Least Privilege)
    permissions: list[str] = Field(default_factory=list)
    allow_side_effects: bool = False
    
    # Execution constraints
    timeout_seconds: float = 30.0
    created_at: float = Field(default_factory=time.time)


class AgentResponseEnvelope(BaseModel):
    """Authoritative typed response returned from an agent or sub-agent."""
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_id: str
    source_agent: str
    recipient_agent: str | None = None
    parent_run_id: str | None = None
    
    status: TaskStatus = TaskStatus.SUCCESS
    data: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = None
    
    # Execution metrics
    execution_time_ms: float = 0.0
    tokens_used: int = 0
    cost_usd: float = 0.0
    
    # Sub-agent hierarchy results
    sub_agent_results: list[dict[str, Any]] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)
