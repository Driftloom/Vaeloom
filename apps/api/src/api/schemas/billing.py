import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class UsageQuery(BaseModel):
    metric: str | None = None
    from_date: str | None = None
    to_date: str | None = None


class UsageRecordResponse(BaseModel):
    id: uuid.UUID
    metric: str
    value: float
    timestamp: datetime
    tenant_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateSubscriptionRequest(BaseModel):
    plan: str = Field(..., min_length=1)


class InvoiceResponse(BaseModel):
    id: str
    subscription_id: str | None = None
    plan: str
    amount: float
    currency: str = "USD"
    status: str  # paid, pending, draft
    period_start: datetime
    period_end: datetime
    issued_at: datetime
    download_url: str | None = None

    model_config = {"from_attributes": True}
