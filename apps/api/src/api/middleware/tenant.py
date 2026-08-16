import uuid
from contextvars import ContextVar
from typing import Optional

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Tenant, Workspace, WorkspaceUser

tenant_context: ContextVar[dict[str, str | None]] = ContextVar("tenant_context", default={})


class TenantContext:
    @staticmethod
    def get() -> dict[str, str | None]:
        return tenant_context.get()

    @staticmethod
    def set(tenant_id: str | None, workspace_id: str | None = None) -> None:
        tenant_context.set({"tenant_id": tenant_id, "workspace_id": workspace_id})

    @staticmethod
    def clear() -> None:
        tenant_context.set({})

    @staticmethod
    def get_tenant_id() -> str | None:
        return tenant_context.get().get("tenant_id")

    @staticmethod
    def get_workspace_id() -> str | None:
        return tenant_context.get().get("workspace_id")


async def set_rls_session_vars(db: AsyncSession) -> None:
    """Set PostgreSQL session variables for Row Level Security.

    Must be called on each DB session before queries that require RLS isolation.
    Sets app.tenant_id and app.workspace_id GUCs used by RLS policies.
    No-op on SQLite (RLS is disabled).
    """
    ctx = TenantContext.get()
    tenant_id = ctx.get("tenant_id")
    workspace_id = ctx.get("workspace_id")

    if not tenant_id:
        return

    try:
        await db.execute(text("SET app.tenant_id = :tid"), {"tid": tenant_id})
        if workspace_id:
            await db.execute(text("SET app.workspace_id = :wid"), {"wid": workspace_id})
    except Exception:
        pass  # SQLite or non-PostgreSQL — ignore


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        tenant_id = request.headers.get("X-Tenant-ID", "")
        workspace_id = request.headers.get("X-Workspace-ID", "")

        if tenant_id:
            request.state.tenant_id = tenant_id
        if workspace_id:
            request.state.workspace_id = workspace_id

        TenantContext.set(tenant_id or None, workspace_id or None)

        try:
            response = await call_next(request)
            return response
        finally:
            TenantContext.clear()


async def get_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    tenant_id = request.headers.get("X-Tenant-ID") or getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")

    try:
        tid = uuid.UUID(tenant_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid tenant ID format")

    result = await db.execute(select(Tenant).where(Tenant.id == tid))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status not in ("ACTIVE", "active"):
        raise HTTPException(status_code=403, detail="Tenant is not active")

    return {"id": str(tenant.id), "name": tenant.name, "slug": tenant.slug, "status": tenant.status}


async def require_workspace_access(
    workspace_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
) -> dict:
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        wid = uuid.UUID(workspace_id)
        uid = uuid.UUID(current_user.get("sub") or current_user.get("user_id", ""))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await db.execute(
        select(Workspace).where(
            Workspace.id == wid,
            Workspace.user_id == uid,
        )
    )
    workspace = result.scalar_one_or_none()
    if workspace:
        return {"id": str(workspace.id), "name": workspace.name, "role": "owner"}

    membership = await db.execute(
        select(WorkspaceUser).where(
            WorkspaceUser.workspace_id == wid,
            WorkspaceUser.user_id == uid,
        )
    )
    wu = membership.scalar_one_or_none()
    if wu:
        return {"id": str(wu.workspace_id), "user_id": str(wu.user_id), "role": wu.role}

    raise HTTPException(status_code=403, detail="No access to this workspace")
