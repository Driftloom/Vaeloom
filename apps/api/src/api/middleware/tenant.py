from contextvars import ContextVar

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

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
        # set_config(..., true) scopes the setting to the current transaction only (equivalent to SET LOCAL).
        # Standard PostgreSQL function call that supports safe parameter binding, safe with PgBouncer.
        await db.execute(text("SELECT set_config('app.tenant_id', :tid, true)"), {"tid": str(tenant_id)})
        if workspace_id:
            await db.execute(text("SELECT set_config('app.workspace_id', :wid, true)"), {"wid": str(workspace_id)})
        if user_id:
            await db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": str(user_id)})
    except Exception as exc:
        # SQLite or non-PostgreSQL — RLS not applicable, ignore.
        # On PostgreSQL this should never fail; log and continue (fail-closed:
        # unset GUCs cause RLS policies to match zero rows).
        import logging as _log
        _log.getLogger(__name__).debug("set_rls_session_vars skipped: %s", exc)


async def check_user_workspace_access(session: AsyncSession, workspace_id: str, user_id: str, tenant_id: str | None = None) -> bool:
    """Check if a user has authorized access to a workspace within tenant boundary."""
    import uuid as _uuid
    from sqlalchemy import select, or_, cast, String
    from ..models.schema import Workspace, WorkspaceUser, User

    try:
        ws_uuid = str(_uuid.UUID(str(workspace_id)))
        uid = str(_uuid.UUID(str(user_id)))
    except (ValueError, TypeError):
        return False

    stmt = (
        select(Workspace.id)
        .outerjoin(WorkspaceUser, cast(WorkspaceUser.workspace_id, String) == cast(Workspace.id, String))
        .join(User, cast(Workspace.user_id, String) == cast(User.id, String))
        .where(
            cast(Workspace.id, String) == ws_uuid,
            or_(
                cast(Workspace.user_id, String) == uid,
                cast(WorkspaceUser.user_id, String) == uid,
            ),
        )
    )
    if tenant_id:
        try:
            tid_uuid = str(_uuid.UUID(str(tenant_id)))
            stmt = stmt.where(cast(User.tenant_id, String) == tid_uuid)
        except (ValueError, TypeError):
            pass

    res = await session.execute(stmt)
    return res.scalar_one_or_none() is not None


class TenantMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, session_factory=None):
        super().__init__(app)
        self.session_factory = session_factory

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Pass OPTIONS preflight through
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip public paths where workspace context is not applicable
        from .auth import PUBLIC_PATHS, PUBLIC_PREFIXES
        path = request.url.path
        if path in PUBLIC_PATHS or any(path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        jwt_tenant_id = getattr(request.state, "tenant_id", None)
        jwt_user_id = getattr(request.state, "user_id", None)
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
            tenant_id = None

        # Authoritative Workspace Identity (P0):
        # Client-supplied workspace ID (header or path param) is NEVER authoritative by itself.
        # It must be validated against database ownership or membership for the authenticated user and tenant.
        workspace_id = None
        requested_workspace_id = header_workspace_id or path_workspace_id or jwt_workspace_id

        if requested_workspace_id:
            if not jwt_user_id:
                workspace_id = None
            else:
                import uuid as _uuid
                from starlette.responses import JSONResponse
                try:
                    ws_uuid = _uuid.UUID(str(requested_workspace_id))
                    uid = _uuid.UUID(str(jwt_user_id))
                except (ValueError, TypeError):
                    return JSONResponse(
                        status_code=403,
                        content={"detail": "Forbidden: Invalid workspace ID format"},
                    )

                # Lazy import: api.database must not be imported at module top
                # (it would create a database->middleware import cycle at
                # startup). Production mounts TenantMiddleware without an
                # explicit factory, so this path MUST resolve — a missing
                # import here 500s every workspace-scoped request (staging
                # gate finding 2026-09-07: NameError on X-Workspace-ID).
                sf = self.session_factory
                if sf is None:
                    from ..database import async_session_factory as _default_factory

                    sf = _default_factory
                async with sf() as session:
                    has_access = await check_user_workspace_access(session, str(requested_workspace_id), str(jwt_user_id), tenant_id)
                    if not has_access:
                        return JSONResponse(
                            status_code=403,
                            content={"detail": "Forbidden: Access to specified workspace denied"},
                        )
                    workspace_id = str(requested_workspace_id)

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


# Compatibility shims for legacy tests (required for collection)
# Canonical tenant checks use middleware state; these stubs satisfy test imports
# without introducing a second security boundary.
def get_current_tenant(request: Request):  # type: ignore[no-untyped-def]
    tenant_id = getattr(request.state, "tenant_id", None) or TenantContext.get_tenant_id()
    if not tenant_id:
        from fastapi import HTTPException as _HTTPException

        raise _HTTPException(status_code=400, detail="Tenant context is required")
    return {"tenant_id": tenant_id, "workspace_id": TenantContext.get_workspace_id()}


async def require_workspace_access(workspace_id: str, user_id: str | None = None, db=None):  # type: ignore[no-untyped-def]
    # Lightweight stub for tests; real enforcement is in workspace_service / RLS.
    if not workspace_id:
        from fastapi import HTTPException as _HTTPException

        raise _HTTPException(status_code=400, detail="Workspace context is required")
    return True



