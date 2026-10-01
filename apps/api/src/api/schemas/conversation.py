import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    agent_name: str | None = Field(default=None, max_length=100)


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class ConversationListItem(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str | None = None
    agent_name: str | None = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(ConversationListItem):
    pass


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    client_id: str
    role: str
    text: str
    status: str
    agent_name: str | None = None
    confidence: float | None = None
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    proposals: list[dict[str, Any]] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    action_chips: list[str] = Field(default_factory=list)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    plan: dict[str, Any] | None = None
    phases: list[dict[str, Any]] = Field(default_factory=list)
    error: dict[str, Any] | None = Field(default=None, validation_alias="error_")
    latency_ms: int | None = None
    highway: str | None = None
    s1_latency_ms: int | None = None
    s2_latency_ms: int | None = None
    workflow_id: str | None = None
    reply_to: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationWithMessages(ConversationResponse):
    messages: list[MessageResponse] = Field(default_factory=list)


class MessageCreate(BaseModel):
    role: Literal["user", "agent"]
    text: str = Field(..., max_length=100000)
    client_id: str = Field(..., min_length=1, max_length=64)
    status: Literal["streaming", "complete", "error", "stopped", "background"] = "complete"
    agent_name: str | None = Field(default=None, max_length=100)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    proposals: list[dict[str, Any]] = Field(default_factory=list)
    questions: list[str] = Field(default_factory=list)
    action_chips: list[str] = Field(default_factory=list)
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    plan: dict[str, Any] | None = None
    phases: list[dict[str, Any]] = Field(default_factory=list)
    error: dict[str, Any] | None = None
    latency_ms: int | None = None
    highway: str | None = Field(default=None, max_length=50)
    s1_latency_ms: int | None = None
    s2_latency_ms: int | None = None
    workflow_id: str | None = Field(default=None, max_length=100)
    reply_to: str | None = Field(default=None, max_length=64)
