from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.billing import UsageRecordResponse, SubscriptionResponse, CreateSubscriptionRequest
from ..services.billing_service import billing_service

router = APIRouter()


@router.get("/usage", response_model=list[UsageRecordResponse])
async def get_usage(
    metric: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub") or current_user.get("user_id")
    records = await billing_service.get_usage(user_id=user_id, metric=metric, from_date=from_date, to_date=to_date, db=db)
    return [UsageRecordResponse.model_validate(r) for r in records]


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub") or current_user.get("user_id")
    sub = await billing_service.get_subscription(user_id=user_id, db=db)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return SubscriptionResponse.model_validate(sub)


@router.post("/subscription", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(dto: CreateSubscriptionRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub") or current_user.get("user_id")
    sub = await billing_service.create_subscription(user_id=user_id, plan=dto.plan, db=db)
    return SubscriptionResponse.model_validate(sub)
