from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.audit import AuditEventResponse, ComplianceReport, RecordAuditEventRequest
from ..services.audit_service import audit_service

router = APIRouter()


@router.post("/events", status_code=201)
async def record_event(
    dto: RecordAuditEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    actor_id = str(current_user.get("sub") or current_user.get("user_id", ""))
    event_id = await audit_service.record_event(
        actor_id=actor_id,
        action=dto.action,
        resource=dto.resource,
        resource_id=dto.resource_id,
        tenant_id=tenant_id,
        metadata=dto.metadata,
        db=db,
    )
    return {"id": event_id}


@router.get("/events", response_model=dict)
async def query_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor_id: str | None = Query(None),
    action: str | None = Query(None),
    resource: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    filters = {
        "actor_id": actor_id,
        "action": action,
        "resource": resource,
        "tenant_id": tenant_id,
        "date_from": date_from,
        "date_to": date_to,
    }
    filters = {k: v for k, v in filters.items() if v is not None}
    rows, total = await audit_service.query_events(page=page, page_size=page_size, filters=filters, db=db)
    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/events/{event_id}", response_model=AuditEventResponse)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    event = await audit_service.get_event(event_id=event_id, db=db)
    if not event:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return AuditEventResponse(**event)


@router.post("/export")
async def export_events(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    format: str = Query("json"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    content = await audit_service.export_events(date_from=date_from, date_to=date_to, format=format, tenant_id=tenant_id, db=db)
    media_type = "text/csv" if format == "csv" else "application/json"
    return PlainTextResponse(content=content, media_type=media_type)


@router.get("/compliance/report", response_model=ComplianceReport)
async def compliance_report(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    tenant_id = current_user.get("tenant_id")
    report = await audit_service.compliance_report(tenant_id=tenant_id, date_from=date_from, date_to=date_to, db=db)
    return ComplianceReport(**report)
