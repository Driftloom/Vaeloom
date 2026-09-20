import logging
import uuid
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
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
    from ..services.composio_service import composio_service

    return {
        "enabled": composio_service.is_enabled,
        "popular_apps": [
            {"id": "slack", "name": "Slack", "description": "Send notifications and query channels"},
            {"id": "notion", "name": "Notion", "description": "Search and create workspace docs"},
            {"id": "github", "name": "GitHub", "description": "Inspect PRs, issues, and repositories"},
            {"id": "linkedin", "name": "LinkedIn", "description": "Post updates and fetch job posts"},
            {"id": "jira", "name": "Jira", "description": "Track issues and create tickets"},
        ],
    }


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
    await _get_authorized_connector(connector_id, user_id, tenant_id, workspace_id, db)
    await connector_ext_service.remove(connector_id, tenant_id, db, workspace_id=workspace_id)
    await _record_connector_audit(
        db,
        user_id or "system",
        "connector.delete",
        str(connector_id),
        tenant_id,
        {"workspace_id": str(workspace_id) if workspace_id else None},
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
