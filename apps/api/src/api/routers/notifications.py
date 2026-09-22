import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.notification import (
    CreateTemplateRequest,
    NotificationResponse,
    SendNotificationRequest,
    SubscribeRequest,
    TemplateResponse,
    WebhookReceiptRequest,
)
from ..services.notification_service import notification_service

router = APIRouter()


@router.post("/send", response_model=NotificationResponse, status_code=201)
async def send_notification(
    dto: SendNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    notification = await notification_service.send(dto, db)
    return NotificationResponse.model_validate(notification)


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    limit: int | None = Query(default=None, ge=1, le=100, description="Standard pagination page size (wins over page/page_size)"),
    offset: int | None = Query(default=None, ge=0, description="Standard pagination rows to skip"),
    channel: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    from ..utils.pagination import resolve_page_params
    page, page_size = resolve_page_params(page, page_size, limit, offset)
    rows, total = await notification_service.list_notifications(page, page_size, channel, db)
    return [NotificationResponse.model_validate(n) for n in rows]


@router.post("/templates", response_model=TemplateResponse, status_code=201)
async def create_template(
    dto: CreateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    template = await notification_service.create_template(dto, db)
    return TemplateResponse.model_validate(template)


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    templates = await notification_service.list_templates(db)
    return [TemplateResponse.model_validate(t) for t in templates]


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    notification = await notification_service.get_notification(notification_id, db)
    return NotificationResponse.model_validate(notification)


@router.post("/subscribe", status_code=201)
async def subscribe(
    dto: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await notification_service.subscribe(dto, db)


@router.post("/webhooks/{notification_id}")
async def webhook_receipt(
    notification_id: uuid.UUID,
    dto: WebhookReceiptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await notification_service.webhook_receipt(notification_id, dto, db)
