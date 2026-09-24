"""Enterprise Graph Execution State Definition.

Defines the typed execution state carried across all nodes in the state graph.
"""

from __future__ import annotations

import time
import uuid
from typing import Any
from pydantic import BaseModel, Field


class ExecutionState(BaseModel):
    """Authoritative execution state passed between graph nodes."""
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str
    message: str
    workspace_id: str | None = None
    tenant_id: str | None = None
    user_id: str | None = None
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Graph Traversal State
    current_node: str = "understand"
    iteration: int = 0
    max_iterations: int = 5
    is_terminal: bool = False
    status: str = "running"  # "running", "waiting_approval", "completed", "failed", "cancelled"

    # Context and Memory
    context: dict[str, Any] = Field(default_factory=dict)
    system_prompt: str = ""

    # Plan and Tool Execution
    plan: list[dict[str, Any]] = Field(default_factory=list)
    available_tools: list[str] = Field(default_factory=list)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    tool_results: list[dict[str, Any]] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)

    # Proposals & Approval
    proposals: list[dict[str, Any]] = Field(default_factory=list)
    pending_approval: dict[str, Any] | None = None
    is_approved: bool = False

    # Response & Telemetry
    final_response: str | None = None
    error: str | None = None
    created_at: float = Field(default_factory=time.time)
    tokens_used: int = 0
    cost_usd: float = 0.0
