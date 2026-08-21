import uuid
from datetime import datetime
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..services.webhook_service import webhook_service

router = APIRouter()

BLOCKED_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal", "169.254.169.254"})


def _validate_webhook_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("https",):
        raise ValueError("Webhook URL must use HTTPS")
    hostname = (parsed.hostname or "").lower()
    if hostname in BLOCKED_HOSTS:
        raise ValueError(f"Webhook URL cannot target blocked host: {hostname}")
    if hostname.startswith("10.") or hostname.startswith("192.168.") or hostname.startswith("172."):
        raise ValueError("Webhook URL cannot target private IP ranges")
    return url


class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., max_length=2048)
    secret: str = Field(..., min_length=1, max_length=512)
    events: list[str] = Field(default=["*"])
    active: bool = True
    retry_count: int = Field(default=3, ge=0, le=10)
    timeout_ms: int = Field(default=5000, ge=100, le=30000)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        return _validate_webhook_url(v)


class WebhookUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    url: str | None = Field(None, max_length=2048)
    secret: str | None = Field(None, max_length=512)
    events: list[str] | None = None
    active: bool | None = None
    retry_count: int | None = Field(None, ge=0, le=10)
    timeout_ms: int | None = Field(None, ge=100, le=30000)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_webhook_url(v)
        return v


class WebhookResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    events: list[str]
    active: bool
    retry_count: int
    timeout_ms: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class WebhookDeliveryResponse(BaseModel):
    id: uuid.UUID
    webhook_id: uuid.UUID
    event_type: str
    status: str
    status_code: int | None
    response_body: str | None
    attempt: int
    max_attempts: int
    completed_at: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    dto: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    webhook = await webhook_service.create(
        tenant_id=tenant_id,
        name=dto.name,
        url=dto.url,
        secret=dto.secret,
        events=dto.events,
        db=db,
    )
    return WebhookResponse.model_validate(webhook)


@router.get("", response_model=dict)
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    webhooks = await webhook_service.list(tenant_id, db)
    return {
        "webhooks": [WebhookResponse.model_validate(w) for w in webhooks],
        "total": len(webhooks),
    }


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    webhook = await webhook_service.get(webhook_id, tenant_id, db)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return WebhookResponse.model_validate(webhook)


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    dto: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    updates = dict(dto.model_dump(exclude_none=True).items())
    webhook = await webhook_service.update(webhook_id, tenant_id, updates, db)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return WebhookResponse.model_validate(webhook)


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await webhook_service.delete(webhook_id, tenant_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Webhook not found")


@router.post("/test/{webhook_id}")
async def test_webhook(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    webhook = await webhook_service.get(webhook_id, tenant_id, db)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    deliveries = await webhook_service.dispatch("test.ping", {"message": "Test webhook ping"}, tenant_id, db)
    return {"status": "fired", "delivery_count": len(deliveries)}


@router.get("/{webhook_id}/deliveries", response_model=dict)
async def list_webhook_deliveries(
    webhook_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    webhook = await webhook_service.get(webhook_id, tenant_id, db)
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    deliveries = await webhook_service.list_deliveries(webhook_id, db)
    return {
        "deliveries": [WebhookDeliveryResponse.model_validate(d) for d in deliveries],
        "total": len(deliveries),
    }
