import uuid
from contextvars import ContextVar

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Tenant, Workspace, WorkspaceUser

tenant_context: ContextVar[dict[str, str | None]] = ContextVar("tenant_context", default={})


class TenantContext:
    @staticmethod
    def get() -> dict[str, str | None]:
        return tenant_context.get()

    @staticmethod
    def set(tenant_id: str | None, workspace_id: str | None = None, user_id: str | None = None) -> None:
        tenant_context.set({"tenant_id": tenant_id, "workspace_id": workspace_id, "user_id": user_id})

    @staticmethod
    def clear() -> None:
        tenant_context.set({})

    @staticmethod
    def get_tenant_id() -> str | None:
        return tenant_context.get().get("tenant_id")

    @staticmethod
    def get_workspace_id() -> str | None:
        return tenant_context.get().get("workspace_id")

    @staticmethod
    def get_user_id() -> str | None:
        return tenant_context.get().get("user_id")


async def set_rls_session_vars(db: AsyncSession) -> None:
    """Set PostgreSQL session variables for Row Level Security.

    Must be called on each DB session before queries that require RLS isolation.
    Sets app.tenant_id, app.workspace_id, and app.user_id GUCs used by RLS policies.

    Uses SET LOCAL (transaction-scoped) instead of SET (session-scoped).
    Critical for PgBouncer transaction pooling mode — session-scoped SET
    would leak tenant context to the next client on a reused connection.

    Fail-closed: if tenant_id is missing or invalid, the function returns
    without setting GUCs, causing RLS policies to match zero rows (correct
    behavior for an unset context variable).

    No-op on SQLite (RLS is disabled).
    """
    ctx = TenantContext.get()
    tenant_id = ctx.get("tenant_id")
    workspace_id = ctx.get("workspace_id")
    user_id = ctx.get("user_id")

    if not tenant_id:
        return

    try:
        # SET LOCAL scopes the setting to the current transaction only.
        # This is safe with PgBouncer transaction pooling.
        await db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": tenant_id})
        if workspace_id:
            await db.execute(text("SET LOCAL app.workspace_id = :wid"), {"wid": workspace_id})
        if user_id:
            await db.execute(text("SET LOCAL app.user_id = :uid"), {"uid": user_id})
    except Exception as exc:
        # SQLite or non-PostgreSQL — RLS not applicable, ignore.
        # On PostgreSQL this should never fail; log and continue (fail-closed:
        # unset GUCs cause RLS policies to match zero rows).
        import logging as _log
        _log.getLogger(__name__).debug("set_rls_session_vars skipped: %s", exc)


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        jwt_tenant_id = getattr(request.state, "tenant_id", None)
        jwt_user_id = getattr(request.state, "user_id", None)
        # Workspace_id can come from JWT (if present), X-Workspace-ID header, or path param
        jwt_workspace_id = getattr(request.state, "workspace_id", None)
        header_workspace_id = request.headers.get("X-Workspace-ID", "") or request.headers.get("X-WORKSPACE-ID", "")
        path_workspace_id = request.path_params.get("workspace_id") if hasattr(request, "path_params") and request.path_params else None

        if jwt_tenant_id:
            tenant_id = str(jwt_tenant_id)
            header_tenant_id = request.headers.get("X-Tenant-ID", "")
            if header_tenant_id and header_tenant_id != tenant_id:
                from ..infrastructure.logging import get_logger
                get_logger(__name__).warning(
                    "Tenant header mismatch: JWT=%s header=%s — using JWT value",
                    tenant_id, header_tenant_id,
                )
        else:
            # Never trust user-supplied headers for tenant context.
            # If JWT has no tenant_id, leave tenant_id as None (RLS will match zero rows).
            tenant_id = None

        # Workspace_id: prefer JWT, then path param, then header (validated against ownership via require_workspace_access)
        workspace_id = None
        if jwt_workspace_id:
            workspace_id = str(jwt_workspace_id)
        elif path_workspace_id:
            workspace_id = str(path_workspace_id)
        elif header_workspace_id:
            workspace_id = str(header_workspace_id)

        user_id = str(jwt_user_id) if jwt_user_id else None

        request.state.tenant_id = tenant_id
        request.state.workspace_id = workspace_id
        request.state.user_id = user_id
        TenantContext.set(tenant_id, workspace_id, user_id)

        try:
            response = await call_next(request)
            return response
        finally:
            TenantContext.clear()


async def get_current_tenant(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context is required")

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
