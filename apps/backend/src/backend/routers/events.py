from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.event import EventPublish, EventResponse, SubscriptionCreate, SubscriptionResponse
from ..services.event_service import event_service

router = APIRouter()


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


@router.post("", response_model=EventResponse, status_code=201)
async def publish_event(
    dto: EventPublish,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    event = await event_service.publish(dto, user_id, db)
    return EventResponse.model_validate(event)


@router.get("", response_model=list[EventResponse])
async def list_events(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    events = await event_service.find_all(user_id, db)
    return [EventResponse.model_validate(e) for e in events]


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(
    dto: SubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    sub = await event_service.create_subscription(dto, user_id, db)
    return SubscriptionResponse.model_validate(sub)


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = _get_user_id(current_user)
    subs = await event_service.list_subscriptions(user_id, db)
    return [SubscriptionResponse.model_validate(s) for s in subs]
