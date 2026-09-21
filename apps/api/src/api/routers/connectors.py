import logging
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id, get_workspace_id
from ..middleware.rate_limit import rate_limit
from ..models.schema import Workspace, WorkspaceUser
from ..schemas.connector_ext import (
    ConnectorResponse,
    CreateConnectorRequest,
    McpCallRequest,
    McpToolInfoResponse,
    RollbackConnectorRequest,
    SyncStatusResponse,
    UpdateConnectorRequest,
)
from ..services.audit_service import audit_service
from ..services.connector_ext_service import connector_ext_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


def _mask_connector_response(connector: Any) -> ConnectorResponse:
    cfg = dict(getattr(connector, "config", {}) or {})
    ctype = getattr(connector, "type", "rest")
    masked_cfg = connector_ext_service.mask_sensitive_config(cfg, ctype)
    return ConnectorResponse(
        id=connector.id,
        workspace_id=connector.workspace_id,
        name=connector.name,
        type=connector.type,
        status=connector.status,
        config=masked_cfg,
        config_version=getattr(connector, "config_version", 1) or 1,
        scopes=getattr(connector, "scopes", None),
        last_synced_at=getattr(connector, "last_synced_at", None),
        created_at=connector.created_at,
        updated_at=connector.updated_at,
    )


async def _record_connector_audit(
    db: AsyncSession,
    actor_id: str,
    action: str,
    resource_id: str | None,
    tenant_id: str | None,
    metadata: dict | None = None,
):
    try:
        await audit_service.record_event(
            actor_id=actor_id,
            action=action,
            resource="connector",
            resource_id=resource_id,
            tenant_id=tenant_id,
            metadata=metadata,
            db=db,
        )
        await db.commit()
    except Exception as e:
        logger.warning("Failed to record connector audit event '%s': %s", action, e)


async def check_user_workspace_access(
    db: AsyncSession, user_id: str, workspace_id: str | uuid.UUID
) -> bool:
    """Validate that the user owns or is an active member of the specified workspace."""
    try:
        uid = uuid.UUID(str(user_id))
        wid = uuid.UUID(str(workspace_id))
    except (ValueError, TypeError):
        return False
    r1 = await db.execute(
        select(Workspace.id).where(Workspace.id == wid, Workspace.user_id == uid)
    )
    if r1.scalar_one_or_none() is not None:
        return True
    r2 = await db.execute(
        select(WorkspaceUser.id).where(
            WorkspaceUser.workspace_id == wid, WorkspaceUser.user_id == uid
        )
    )
    return r2.scalar_one_or_none() is not None


async def _get_authorized_connector(
    connector_id: uuid.UUID,
    user_id: str | None,
    tenant_id: str | None,
    workspace_id: str | None,
    db: AsyncSession,
):
    connector = await connector_ext_service.get(connector_id, tenant_id, db, workspace_id=workspace_id)
    if user_id:
        has_access = await check_user_workspace_access(db, user_id, connector.workspace_id)
        if not has_access:
            raise HTTPException(404, "Connector not found")
    return connector


@router.post("", response_model=ConnectorResponse, status_code=201)
async def create_connector(
    dto: CreateConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    if workspace_id and user_id:
        has_access = await check_user_workspace_access(db, user_id, workspace_id)
        if not has_access:
            raise HTTPException(403, "Access denied to workspace")
    if bool((dto.config or {}).get("allow_insecure")) and workspace_id and user_id:
        # Separation of duties: explicit TLS-bypass flags need workspace admin.
        await _require_workspace_admin(str(workspace_id), current_user, db)
    connector = await connector_ext_service.create(dto, user_id, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.create",
        str(connector.id),
        tenant_id,
        {"name": connector.name, "type": connector.type, "workspace_id": str(connector.workspace_id)},
    )
    return _mask_connector_response(connector)


@router.get("", response_model=list[ConnectorResponse])
async def list_connectors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    if workspace_id and user_id:
        has_access = await check_user_workspace_access(db, user_id, workspace_id)
        if not has_access:
            raise HTTPException(403, "Access denied to workspace")
    connectors = await connector_ext_service.list_all(
        page, page_size, type, tenant_id, db, workspace_id=workspace_id, user_id=user_id
    )
    return [_mask_connector_response(c) for c in connectors]



@router.get("/composio/status")
async def get_composio_status(
    current_user: dict = Depends(get_current_user),
):
    """Check if Composio SaaS integration is enabled and list supported apps."""
    from ..services.composio_catalog import COMPOSIO_SUPPORTED_APPS
    from ..services.composio_service import composio_service

    total_count = (
        len(composio_service._toolkits_cache)
        if composio_service._toolkits_cache
        else (1553 if composio_service.is_configured else len(COMPOSIO_SUPPORTED_APPS))
    )
    return {
        "enabled": composio_service.is_enabled,
        "total_apps": total_count,
        "popular_apps": [
            {"id": "slack", "name": "Slack", "description": "Send notifications and query channels"},
            {"id": "notion", "name": "Notion", "description": "Search and create workspace docs"},
            {"id": "github", "name": "GitHub", "description": "Inspect PRs, issues, and repositories"},
            {"id": "linkedin", "name": "LinkedIn", "description": "Post updates and fetch job posts"},
            {"id": "jira", "name": "Jira", "description": "Track issues and create tickets"},
        ],
    }


@router.get("/composio/apps")
async def list_composio_apps(
    category: str | None = None,
    search: str | None = None,
    limit: int = 300,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """List 260+ supported enterprise SaaS applications from the Composio catalog."""
    from ..services.composio_service import composio_service

    return await composio_service.get_apps(
        category=category,
        search=search,
        limit=limit,
        offset=offset,
    )



@router.post("/composio/auth-url")
async def get_composio_auth_url(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Generate an OAuth connect URL for a specific SaaS app."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    app_name = payload.get("app", "")
    wid = str(workspace_id or payload.get("workspace_id", ""))
    if not app_name or not wid:
        raise HTTPException(400, "app and workspace_id are required")

    from ..services.composio_service import composio_service

    auth_url_res = composio_service.get_auth_url(app_name, wid)
    await _record_connector_audit(
        db,
        _get_user_id(current_user) or "system",
        "connector.composio.auth",
        None,
        None,
        {"app": app_name, "workspace_id": wid},
    )
    return auth_url_res


@router.post("/composio/sync")
async def sync_composio_tools(
    payload: dict | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Discover and bridge workspace SaaS tools from Composio into dynamic executor."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    wid = str(workspace_id or (payload or {}).get("workspace_id", ""))
    if not wid:
        raise HTTPException(400, "workspace_id required")

    from ..services.composio_service import composio_service

    registered = composio_service.bridge_workspace_tools(wid)
    await _record_connector_audit(
        db,
        _get_user_id(current_user) or "system",
        "connector.composio.sync",
        None,
        None,
        {"workspace_id": wid, "count": len(registered)},
    )
    return {
        "workspace_id": wid,
        "registered": registered,
        "count": len(registered),
    }


async def _require_workspace_member(workspace_id: str, current_user: dict, db: AsyncSession) -> None:
    """Owner-or-member guard for workspace-scoped Composio actions (IDOR guard).

    Returns 404 (not 403) to avoid workspace existence enumeration.
    """
    try:
        ws_uuid = uuid.UUID(str(workspace_id))
        uid = uuid.UUID(str(current_user.get("sub") or current_user.get("user_id") or current_user.get("id")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    try:
        r1 = await db.execute(select(Workspace).where(Workspace.id == ws_uuid, Workspace.user_id == uid))
        if r1.scalar_one_or_none():
            return
        r2 = await db.execute(
            select(WorkspaceUser).where(WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == uid)
        )
        if r2.scalar_one_or_none():
            return
        raise HTTPException(status_code=404, detail="Workspace not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Authorization check failed")


async def _require_workspace_admin(workspace_id: str, current_user: dict, db: AsyncSession) -> None:
    """Owner-or-admin guard for destructive and insecure connector operations.

    Separation of duties: ordinary members may manage standard connectors, but
    only workspace owners and admins may delete connectors or create ones with
    explicit `allow_insecure` transport flags. Members get 403; outsiders get
    404 via the membership check first (callers must run it before this).
    """
    try:
        ws_uuid = uuid.UUID(str(workspace_id))
        uid = uuid.UUID(str(current_user.get("sub") or current_user.get("user_id") or current_user.get("id")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    try:
        owner = await db.execute(select(Workspace).where(Workspace.id == ws_uuid, Workspace.user_id == uid))
        if owner.scalar_one_or_none():
            return
        role_res = await db.execute(
            select(WorkspaceUser.role).where(
                WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == uid
            )
        )
        if (role_res.scalar_one_or_none() or "").upper() in ("ADMIN", "OWNER"):
            return
        raise HTTPException(status_code=403, detail="Forbidden: workspace admin role required")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Authorization check failed")


@router.post("/composio/disconnect")
@rate_limit(max_requests=10, window_seconds=60)
async def disconnect_composio_app(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Revoke Composio OAuth connections for a SaaS app in this workspace."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    app_name = (payload or {}).get("app", "")
    wid = str(workspace_id or (payload or {}).get("workspace_id", ""))
    if not app_name or not wid:
        raise HTTPException(400, "app and workspace_id are required")
    await _require_workspace_member(wid, current_user, db)

    from ..services.composio_service import composio_service

    res = await composio_service.disconnect_connection(uuid.UUID(wid), app_name)
    await _record_connector_audit(
        db,
        _get_user_id(current_user) or "system",
        "connector.composio.disconnect",
        None,
        None,
        {"app": app_name, "workspace_id": wid, "revoked": res.get("revoked", [])},
    )
    return res


@router.post("/composio/refresh")
@rate_limit(max_requests=10, window_seconds=60)
async def refresh_composio_connection(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Re-verify a Composio connection; re-issue an OAuth link when expired."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    app_name = (payload or {}).get("app", "")
    wid = str(workspace_id or (payload or {}).get("workspace_id", ""))
    if not app_name or not wid:
        raise HTTPException(400, "app and workspace_id are required")
    await _require_workspace_member(wid, current_user, db)

    from ..services.composio_service import composio_service

    res = await composio_service.refresh_connection(uuid.UUID(wid), app_name)
    await _record_connector_audit(
        db,
        _get_user_id(current_user) or "system",
        "connector.composio.refresh",
        None,
        None,
        {"app": app_name, "workspace_id": wid, "connected": res.get("connected")},
    )
    return res


@router.get("/mcp/builtin")
async def get_builtin_mcp_servers(
    current_user: dict = Depends(get_current_user),
):
    """Returns catalog of built-in MCP servers ready to attach to any workspace."""
    import sys

    py_exe = sys.executable
    return {
        "builtin_servers": [
            {
                "id": "job-search-mcp",
                "name": "Public ATS Job Search MCP",
                "description": "Searches live jobs across Greenhouse, Lever, and Ashby boards without API keys",
                "transport": "stdio",
                "config": {
                    "transport": "stdio",
                    "command": py_exe,
                    "args": ["-m", "api.mcp_servers.job_search_mcp"],
                },
                "tools": ["search_public_ats_jobs", "fetch_job_details"],
            },
            {
                "id": "sqlite-memory-mcp",
                "name": "SQLite Memory MCP",
                "description": "Sovereign relational database engine with sandboxed read-only SQL inspection",
                "transport": "stdio",
                "config": {
                    "transport": "stdio",
                    "command": py_exe,
                    "args": ["-m", "api.mcp_servers.sqlite_mcp", "--db-path", "./data/memory.db"],
                },
                "tools": ["list_tables", "describe_table", "query_sql"],
            },
        ]
    }


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    connector = await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    return _mask_connector_response(connector)


@router.put("/{connector_id}", response_model=ConnectorResponse)
async def update_connector(
    connector_id: uuid.UUID,
    dto: UpdateConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    connector = await connector_ext_service.update(connector_id, dto, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.update",
        str(connector.id),
        tenant_id,
        {"name": connector.name, "type": connector.type, "workspace_id": str(connector.workspace_id)},
    )
    return _mask_connector_response(connector)


@router.post("/{connector_id}/rollback", response_model=ConnectorResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def rollback_connector(
    connector_id: uuid.UUID,
    dto: RollbackConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Restore a previous config snapshot. Unknown versions 404; the rollback is versioned."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    connector = await connector_ext_service.rollback_config(
        connector_id, dto.version, tenant_id, db, workspace_id=workspace_id
    )
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.rollback",
        str(connector.id),
        tenant_id,
        {"version": dto.version, "config_version": getattr(connector, "config_version", None)},
    )
    return _mask_connector_response(connector)


@router.delete("/{connector_id}", status_code=204)
async def delete_connector(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    connector = await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    await _require_workspace_admin(str(connector.workspace_id), current_user, db)
    await connector_ext_service.remove(connector_id, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.delete",
        str(connector_id),
        tenant_id,
        {"workspace_id": str(workspace_id) if workspace_id else None},
    )


@router.get("/{connector_id}/usage")
async def get_connector_usage(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Tenant-scoped lifecycle activity rollup for one connector."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    return await connector_ext_service.usage_summary(
        connector_id, tenant_id, db, workspace_id=workspace_id
    )


@router.get("/{connector_id}/health")
async def get_connector_health(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Inspect connector health diagnostics without exposing credentials."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    return await connector_ext_service.get_health(connector_id, tenant_id, db, workspace_id=workspace_id)


@router.post("/{connector_id}/sync", response_model=SyncStatusResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def trigger_sync(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    res = await connector_ext_service.trigger_sync(connector_id, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.sync",
        str(connector_id),
        tenant_id,
        {"status": res.get("status"), "workspace_id": str(workspace_id) if workspace_id else None},
    )
    return res


@router.get("/{connector_id}/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    return await connector_ext_service.get_sync_status(connector_id, tenant_id, db, workspace_id=workspace_id)


@router.post("/{connector_id}/test")
@rate_limit(max_requests=10, window_seconds=60)
async def test_connection(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    res = await connector_ext_service.test_connection(connector_id, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.test",
        str(connector_id),
        tenant_id,
        {"status": res.get("status"), "code": res.get("code")},
    )
    return res


# ── MCP server management (type == "mcp") ────────────────────────────


@router.get("/{connector_id}/mcp/tools", response_model=list[McpToolInfoResponse])
async def list_mcp_tools(
    connector_id: uuid.UUID,
    refresh: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    from ..services.mcp_client_service import McpTransportError, mcp_client_service

    try:
        return await mcp_client_service.list_tools(connector_id, tenant_id, db, refresh=refresh, workspace_id=workspace_id)
    except McpTransportError as e:
        raise HTTPException(502, str(e))


@router.post("/{connector_id}/mcp/tools/refresh", response_model=list[McpToolInfoResponse])
@rate_limit(max_requests=10, window_seconds=60)
async def refresh_mcp_tools(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    from ..services.mcp_client_service import McpTransportError, mcp_client_service

    try:
        return await mcp_client_service.list_tools(connector_id, tenant_id, db, refresh=True, workspace_id=workspace_id)
    except McpTransportError as e:
        raise HTTPException(502, str(e))


@router.post("/{connector_id}/mcp/call")
@rate_limit(max_requests=10, window_seconds=60)
async def call_mcp_tool(
    connector_id: uuid.UUID,
    dto: McpCallRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Direct operator-invoked tool call. Agent-driven calls go through the
    tool executor where non-read-only MCP tools are approval-gated."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    from ..services.mcp_client_service import McpTransportError, mcp_client_service

    try:
        res = await mcp_client_service.call_tool(
            connector_id, dto.tool_name, dto.arguments, tenant_id, db, workspace_id=workspace_id
        )
        await _record_connector_audit(
            db,
            user_id or "system",
            "connector.mcp.call",
            str(connector_id),
            tenant_id,
            {"tool_name": dto.tool_name, "workspace_id": str(workspace_id) if workspace_id else None},
        )
        return res
    except McpTransportError as e:
        raise HTTPException(502, str(e))


@router.post("/{connector_id}/mcp/sync")
async def sync_mcp_bridge(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Discover tools and register them into the agent tool executor."""
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    from ..services.mcp_client_service import (
        McpTransportError,
        get_bridge_definitions,
        mcp_client_service,
    )

    try:
        registered = await mcp_client_service.bridge_connector_tools(connector_id, tenant_id, db, workspace_id=workspace_id)
        await _record_connector_audit(
            db,
            user_id or "system",
            "connector.mcp.sync",
            str(connector_id),
            tenant_id,
            {"registered_count": len(registered), "workspace_id": str(workspace_id) if workspace_id else None},
        )
    except McpTransportError as e:
        raise HTTPException(502, str(e))
    return {
        "connector_id": str(connector_id),
        "registered": registered,
        "bridged_total": len(get_bridge_definitions()),
    }


# ── Inbound Webhook Ingestion ────────────────────────────────────────


class InboundWebhookPayload(BaseModel):
    event: str = Field(default="webhook.event")
    payload: dict = Field(default_factory=dict)
    timestamp: str | None = None


@router.post("/{connector_id}/inbound-webhook")
@rate_limit(max_requests=60, window_seconds=60)
async def receive_inbound_webhook(
    connector_id: uuid.UUID,
    data: InboundWebhookPayload,
    request: Request,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Receive and attribute an inbound webhook to a specific connector instance."""
    connector = await connector_ext_service.get(connector_id, tenant_id, db, workspace_id=workspace_id)
    if not connector:
        raise HTTPException(status_code=404, detail="Connector not found")

    sig_header = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Webhook-Signature")
    raw_token = getattr(connector, "token_ref", None) or ""
    secret = connector_ext_service._decrypt_credential(raw_token) if raw_token else ""
    if not secret:
        cfg = getattr(connector, "config", {}) or {}
        sec_val = cfg.get("webhook_secret") or cfg.get("secret") or cfg.get("apiKey")
        if sec_val:
            try:
                secret = connector_ext_service._decrypt_credential(sec_val)
            except Exception:
                secret = str(sec_val)

    if sig_header:
        if not secret:
            raise HTTPException(status_code=401, detail="No webhook secret configured on connector")
        import hashlib
        import hmac

        body_bytes = await request.body()
        expected = "sha256=" + hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    await _record_connector_audit(
        db,
        "webhook",
        "connector.webhook_received",
        str(connector_id),
        tenant_id,
        {"event": data.event, "workspace_id": str(workspace_id) if workspace_id else None},
    )
    return {
        "status": "received",
        "connector_id": str(connector_id),
        "event": data.event,
        "dispatched": True,
    }

