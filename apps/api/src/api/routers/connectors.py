import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..schemas.connector_ext import (
    ConnectorResponse,
    CreateConnectorRequest,
    SyncStatusResponse,
    UpdateConnectorRequest,
)
from ..services.connector_ext_service import connector_ext_service

router = APIRouter()


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


@router.post("", response_model=ConnectorResponse, status_code=201)
async def create_connector(
    dto: CreateConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    user_id = _get_user_id(current_user)
    connector = await connector_ext_service.create(dto, user_id, tenant_id, db)
    return ConnectorResponse.model_validate(connector)


@router.get("", response_model=list[ConnectorResponse])
async def list_connectors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    connectors = await connector_ext_service.list_all(page, page_size, type, tenant_id, db)
    return [ConnectorResponse.model_validate(c) for c in connectors]


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    connector = await connector_ext_service.get(connector_id, tenant_id, db)
    return ConnectorResponse.model_validate(connector)


@router.put("/{connector_id}", response_model=ConnectorResponse)
async def update_connector(
    connector_id: uuid.UUID,
    dto: UpdateConnectorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    connector = await connector_ext_service.update(connector_id, dto, tenant_id, db)
    return ConnectorResponse.model_validate(connector)


@router.delete("/{connector_id}", status_code=204)
async def delete_connector(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    await connector_ext_service.remove(connector_id, tenant_id, db)


@router.post("/{connector_id}/sync", response_model=SyncStatusResponse)
async def trigger_sync(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await connector_ext_service.trigger_sync(connector_id, tenant_id, db)


@router.get("/{connector_id}/sync/status", response_model=SyncStatusResponse)
async def get_sync_status(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await connector_ext_service.get_sync_status(connector_id, tenant_id, db)


@router.post("/{connector_id}/test")
async def test_connection(
    connector_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await connector_ext_service.test_connection(connector_id, tenant_id, db)
