import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from ..database import get_db
from ..dependencies import get_current_user
from ..infrastructure.metrics import audit_log_total as AUDIT_LOG_TOTAL


class AuditLogEntry(BaseModel):
    id: str
    tenant_id: str | None = None
    workspace_id: str | None = None
    user_id: str | None = None
    action: str
    resource_type: str
    resource_id: str | None = None
    details: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime | None = None

    model_config = {"from_attributes": True, "extra": "ignore"}


class AuditLogger:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def log(
        self,
        action: str,
        resource_type: str,
        resource_id: str | None = None,
        details: dict | None = None,
        tenant_id: str | None = None,
        workspace_id: str | None = None,
        user_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> str:
        entry_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        await self.db.execute(
            text("""
                INSERT INTO audit_events (
                    id, actor_id, action, resource, resource_id,
                    tenant_id, metadata, created_at
                ) VALUES (
                    :id, :actor_id, :action, :resource, :resource_id,
                    :tenant_id, :metadata, :created_at
                )
            """),
            {
                "id": entry_id,
                "actor_id": user_id or "",
                "action": action,
                "resource": resource_type,
                "resource_id": resource_id or "",
                "tenant_id": tenant_id,
                "metadata": json.dumps({
                    **(details or {}),
                    "workspace_id": workspace_id,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                }),
                "created_at": now,
            },
        )
        AUDIT_LOG_TOTAL.inc()
        return entry_id

    async def query(
        self,
        page: int = 1,
        page_size: int = 20,
        tenant_id: str | None = None,
        action: str | None = None,
        resource_type: str | None = None,
    ) -> tuple[list[AuditLogEntry], int]:
        conditions: list[str] = []
        params: dict = {}
        if tenant_id:
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id
        if action:
            conditions.append("action = :action")
            params["action"] = action
        if resource_type:
            conditions.append("resource = :resource")
            params["resource"] = resource_type
        where = " AND ".join(conditions) if conditions else "TRUE"
        offset = (page - 1) * page_size

        count_result = await self.db.execute(
            text(f"SELECT COUNT(*) FROM audit_events WHERE {where}"), params
        )
        total = count_result.scalar_one() or 0

        rows_result = await self.db.execute(
            text(f"""
                SELECT id, actor_id, action, resource, resource_id,
                       tenant_id, metadata, created_at
                FROM audit_events
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": offset},
        )
        rows = rows_result.fetchall()
        items: list[AuditLogEntry] = []
        for r in rows:
            meta_raw = r[6]
            if isinstance(meta_raw, str):
                try:
                    meta_raw = json.loads(meta_raw)
                except (json.JSONDecodeError, TypeError):
                    meta_raw = {}
            workspace_id = (meta_raw or {}).get("workspace_id") if isinstance(meta_raw, dict) else None
            items.append(AuditLogEntry(
                id=r[0],
                user_id=r[1] or None,
                action=r[2],
                resource_type=r[3],
                resource_id=r[4] or None,
                tenant_id=r[5],
                details=meta_raw if isinstance(meta_raw, dict) else {},
                workspace_id=workspace_id,
                timestamp=r[7],
            ))
        return items, total


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            response = await call_next(request)
            if response.status_code < 400:
                import asyncio
                try:
                    asyncio.ensure_future(self._log_request(request, response))
                except Exception:
                    pass
            return response
        return await call_next(request)

    async def _log_request(self, request: Request, response: Response) -> None:
        from ..database import async_session_factory

        async with async_session_factory() as db:
            logger = AuditLogger(db)
            user_id = getattr(request.state, "user_id", None)
            tenant_id = getattr(request.state, "tenant_id", None)
            workspace_id = getattr(request.state, "workspace_id", None)
            await logger.log(
                action=f"{request.method}:{response.status_code}",
                resource_type=request.url.path,
                resource_id=None,
                details={"path": str(request.url.path), "query": str(request.url.query)},
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                user_id=user_id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent", ""),
            )
            await db.commit()


audit_router = APIRouter()


@audit_router.get("/audit")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
) -> dict:
    if not current_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
    if "admin" not in user_roles:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")

    logger = AuditLogger(db)
    items, total = await logger.query(
        page=page, page_size=page_size,
        tenant_id=current_user.get("tenant_id"),
        action=action, resource_type=resource_type,
    )
    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
