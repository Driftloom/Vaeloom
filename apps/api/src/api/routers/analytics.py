from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.analytics import (
    AggregateRequest,
    DashboardPayload,
    KpiSummary,
    TrackEventRequest,
    UsageTimePoint,
)
from ..services.analytics_service import analytics_service

router = APIRouter()


@router.get("", response_model=DashboardPayload)
async def dashboard(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    interval: str = Query("day", pattern="^(hour|day|week|month)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    kpis = await analytics_service.get_metrics(tenant_id=tenant_id, db=db)
    usage = await analytics_service.get_usage(
        tenant_id=tenant_id, date_from=date_from, date_to=date_to, interval=interval, db=db,
    )
    return DashboardPayload(kpis=kpis, usage=usage, generated_at=datetime.now(UTC))


@router.get("/usage", response_model=list[UsageTimePoint])
async def get_usage(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    interval: str = Query("day", pattern="^(hour|day|week|month)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    return await analytics_service.get_usage(tenant_id=tenant_id, date_from=date_from, date_to=date_to, interval=interval, db=db)


@router.get("/metrics", response_model=KpiSummary)
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    return await analytics_service.get_metrics(tenant_id=tenant_id, db=db)


@router.post("/events", status_code=201)
async def track_event(
    dto: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("sub") or current_user.get("user_id")
    event_id = await analytics_service.track_event(
        name=dto.name, properties=dto.properties, tenant_id=tenant_id, user_id=user_id, db=db,
    )
    return {"id": event_id}


@router.post("/aggregate", status_code=201)
async def aggregate(
    dto: AggregateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    await analytics_service.aggregate(date=dto.date, tenant_id=tenant_id, db=db)
    return {"status": "ok"}
