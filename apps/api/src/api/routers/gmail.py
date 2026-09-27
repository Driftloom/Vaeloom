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
from ..services.gmail_service import gmail_service, hash_channel_token

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
        token_hash = hash_channel_token(x_goog_channel_token)
        # OP-RLS-01: this public endpoint has no auth context. Resolve RLS
        # scope from the verified channel credential (definer fn, no GUCs
        # needed) and establish it before touching scoped tables.
        try:
            scope_res = await db.execute(
                text("SELECT workspace_id, tenant_id FROM app_gmail_watch_scope(:cid, :token)"),  # nosec B608
                {"cid": x_goog_channel_id, "token": token_hash},
            )
            scope_row = scope_res.fetchone()
            if scope_row and scope_row[0]:
                await db.execute(
                    text("SELECT set_config('app.workspace_id', :v, true)"),  # nosec B608
                    {"v": str(scope_row[0])},
                )
                if scope_row[1]:
                    await db.execute(
                        text("SELECT set_config('app.tenant_id', :v, true)"),  # nosec B608
                        {"v": str(scope_row[1])},
                    )
        except Exception:
            pass
        try:
            result = await db.execute(
                text("SELECT id FROM gmail_watches WHERE channel_id = :cid AND channel_token = :token AND status = 'ACTIVE'"),  # nosec B608
                {"cid": x_goog_channel_id, "token": token_hash},
            )
            found = result.fetchone()
        except Exception:
            # Fail closed with 403 semantics (includes RLS denial when the
            # channel cannot be resolved to a scope).
            found = None
        if not found:
            raise HTTPException(403, "Invalid channel token")
    else:
        raise HTTPException(400, "Missing X-Goog-Channel-Token header for verification")
    accepted = await gmail_service.handle_push(x_goog_channel_id, payload.history_id, db)
    if not accepted:
        raise HTTPException(404, "Unknown or inactive watch channel")
    return {"received": True}


def _classify_email_category(subject: str, body: str) -> str:
    text = f"{subject} {body}".lower()
    if any(k in text for k in ["interview", "invitation", "speaking with", "schedule a call", "meet with"]):
        return "INTERVIEW_INVITE"
    if any(k in text for k in ["recruiter", "talent acquisition", "sourcing", "found your profile", "role at"]):
        return "RECRUITER"
    if any(k in text for k in ["status", "application", "next steps", "update on your", "offer"]):
        return "STATUS_UPDATE"
    return "GENERAL"


@router.get("/gmail/messages")
async def list_gmail_messages(
    max_results: int = Query(20, ge=1, le=50),
    query: str | None = Query(None),
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")

    from ..clients.gmail_client import GmailClient

    client = await GmailClient.for_workspace(workspace_id)
    raw_messages = await client.fetch_emails(max_results=max_results, query=query)
    if raw_messages is None:
        raw_messages = []

    classified = []
    for msg in raw_messages:
        subject = msg.get("subject", "")
        body = msg.get("body", "")
        cat = _classify_email_category(subject, body)
        sender = msg.get("sender", "")
        # Extract sender name and clean email
        sender_name = sender
        sender_email = sender
        if "<" in sender and ">" in sender:
            parts = sender.split("<")
            sender_name = parts[0].strip().strip('"')
            sender_email = parts[1].replace(">", "").strip()

        classified.append({
            "id": msg.get("id", ""),
            "subject": subject,
            "senderName": sender_name or "Unknown Sender",
            "senderEmail": sender_email or "unknown@email.com",
            "company": sender_email.split("@")[-1].split(".")[0].capitalize() if "@" in sender_email else "Direct",
            "preview": body[:140] + ("..." if len(body) > 140 else ""),
            "body": body,
            "receivedAt": msg.get("received_at") or "Recently",
            "isRead": True,
            "category": cat,
            "extractedEntities": [
                {
                    "type": "TASK" if cat == "GENERAL" else "INTERVIEW",
                    "label": "Next Step Action",
                    "value": "Review correspondence" if cat != "INTERVIEW_INVITE" else "Prepare interview slot",
                    "confidence": 0.92,
                    "addedToMemory": False,
                }
            ],
        })

    return {
        "messages": classified,
        "count": len(classified),
        "connected": client._configured,
    }


@router.get("/gmail/status")
async def get_gmail_status(
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")

    from ..clients.gmail_client import GmailClient

    client = await GmailClient.for_workspace(workspace_id)
    is_healthy = await client.check_health()
    return {
        "connected": client._configured and is_healthy,
        "provider": "Google Workspace / Gmail",
        "accountEmail": "Connected Account" if is_healthy else ("Configured (Checking)" if client._configured else "Not Connected"),
        "syncHealth": "HEALTHY" if is_healthy else ("DEGRADED" if client._configured else "DISCONNECTED"),
        "configured": client._configured,
    }

