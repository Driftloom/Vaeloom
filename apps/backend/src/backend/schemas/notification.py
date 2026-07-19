import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from enum import Enum

class NotificationChannel(str, Enum):
    EMAIL = "email"
    SLACK = "slack"
    PUSH = "push"

class SendNotificationRequest(BaseModel):
    channel: NotificationChannel
    recipient: str
    template: str | None = None
    data: dict[str, Any] | None = None
    subject: str | None = None
    body: str | None = None

class CreateTemplateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    subject: str | None = None
    body: str = Field(..., min_length=1)
    channel: NotificationChannel

class SubscribeRequest(BaseModel):
    url: str = Field(..., min_length=1)
    tenant_id: str | None = None

class WebhookReceiptRequest(BaseModel):
    status: str | None = None
    details: dict[str, Any] | None = None

class NotificationResponse(BaseModel):
    id: uuid.UUID
    channel: str
    recipient: str
    subject: str | None
    body: str
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    subject: str | None
    body: str
    channel: str
    created_at: datetime
    model_config = {"from_attributes": True}
