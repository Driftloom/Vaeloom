from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..schemas.gmail import (
    DraftCreateRequest,
    DraftListResponse,
    DraftResponse,
    PushNotificationRequest,
    WatchStartRequest,
    WatchStatusResponse,
)
from ..services.gmail_service import gmail_service

router = APIRouter()


def _workspace_scope(tenant_id: str | None, current_user: dict | None) -> str:
    if tenant_id:
        return tenant_id
    if current_user:
        return str(current_user.get("sub") or current_user.get("user_id") or "default")
    return "default"


@router.post("/gmail/watch", response_model=WatchStatusResponse)
async def start_gmail_watch(
    dto: WatchStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = str(current_user.get("sub") or current_user.get("user_id") or "")
    return await gmail_service.start_watch(dto.topic, _workspace_scope(tenant_id, current_user), user_id, db)


@router.get("/gmail/watch", response_model=WatchStatusResponse)
async def get_gmail_watch(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await gmail_service.get_watch_status(_workspace_scope(tenant_id, current_user), db)


@router.delete("/gmail/watch", response_model=WatchStatusResponse)
async def stop_gmail_watch(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    scope = _workspace_scope(tenant_id, current_user)
    await gmail_service.stop_watch(scope, db)
    return WatchStatusResponse(active=False, workspace_id=scope, status="STOPPED")


@router.post("/gmail/drafts", response_model=DraftResponse, status_code=201)
async def create_gmail_draft(
    dto: DraftCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    if not gmail_service.configured:
        raise HTTPException(503, "Gmail API not configured")
    result = await gmail_service.create_draft(dto, db)
    if not result:
        raise HTTPException(502, "Failed to create Gmail draft")
    return DraftResponse(id=result["id"], message=result.get("message"))


@router.get("/gmail/drafts", response_model=DraftListResponse)
async def list_gmail_drafts(
    max_results: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    if not gmail_service.configured:
        raise HTTPException(503, "Gmail API not configured")
    drafts = await gmail_service.list_drafts(db, max_results=max_results)
    return DraftListResponse(
        items=[DraftResponse(id=d["id"], message=d.get("message")) for d in drafts],
        total=len(drafts),
    )


@router.post("/gmail/webhook", status_code=200)
async def gmail_push_webhook(
    payload: PushNotificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_goog_channel_id: str | None = Header(default=None),
    x_goog_resource_state: str | None = Header(default=None),
    x_goog_channel_token: str | None = Header(default=None),
):
    if not x_goog_channel_id:
        raise HTTPException(400, "Missing X-Goog-Channel-ID header")
    if x_goog_resource_state and x_goog_resource_state not in ("sync", "exists", "update"):
        raise HTTPException(400, "Unsupported resource state")
    if x_goog_channel_token:
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT id FROM gmail_watches WHERE channel_id = :cid AND channel_token = :token AND status = 'ACTIVE'"),  # nosec B608
            {"cid": x_goog_channel_id, "token": x_goog_channel_token},
        )
        if not result.fetchone():
            raise HTTPException(403, "Invalid channel token")
    else:
        raise HTTPException(400, "Missing X-Goog-Channel-Token header for verification")
    accepted = await gmail_service.handle_push(x_goog_channel_id, payload.history_id, db)
    if not accepted:
        raise HTTPException(404, "Unknown or inactive watch channel")
    return {"received": True}