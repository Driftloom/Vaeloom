import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
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
from ..services.connector_ext_service import connector_ext_service

router = APIRouter()


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


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
    return ConnectorResponse.model_validate(connector)


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
    return [ConnectorResponse.model_validate(c) for c in connectors]


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
    return ConnectorResponse.model_validate(connector)


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
    return ConnectorResponse.model_validate(connector)


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


@router.post("/{connector_id}/sync", response_model=SyncStatusResponse)
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
    return await connector_ext_service.trigger_sync(connector_id, tenant_id, db, workspace_id=workspace_id)


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
    return await connector_ext_service.test_connection(connector_id, tenant_id, db, workspace_id=workspace_id)


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
        return await mcp_client_service.call_tool(
            connector_id, dto.tool_name, dto.arguments, tenant_id, db, workspace_id=workspace_id
        )
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
    except McpTransportError as e:
        raise HTTPException(502, str(e))
    return {
        "connector_id": str(connector_id),
        "registered": registered,
        "bridged_total": len(get_bridge_definitions()),
    }
