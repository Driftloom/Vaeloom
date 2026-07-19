import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..schemas.plugin import (
    RegisterPluginRequest, UpdatePluginRequest, ExecutePluginRequest,
    PluginResponse, ExecutionResponse,
)
from ..services.plugin_service import plugin_service

router = APIRouter()


@router.post("", response_model=PluginResponse, status_code=201)
async def register_plugin(
    dto: RegisterPluginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    plugin = await plugin_service.register(dto, tenant_id, db)
    return PluginResponse.model_validate(plugin)


@router.get("", response_model=dict)
async def list_plugins(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(None),
    tags: list[str] | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    plugins, total = await plugin_service.list_plugins(
        page=page, page_size=page_size, status=status,
        tags=tags, search=search, tenant_id=tenant_id, db=db,
    )
    return {
        "plugins": [PluginResponse.model_validate(p) for p in plugins],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{plugin_id}", response_model=PluginResponse)
async def get_plugin(
    plugin_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    plugin = await plugin_service.get_plugin(plugin_id, db)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return PluginResponse.model_validate(plugin)


@router.put("/{plugin_id}", response_model=PluginResponse)
async def update_plugin(
    plugin_id: uuid.UUID,
    dto: UpdatePluginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    plugin = await plugin_service.update_plugin(plugin_id, dto, db)
    if not plugin:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return PluginResponse.model_validate(plugin)


@router.delete("/{plugin_id}", status_code=204)
async def delete_plugin(
    plugin_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await plugin_service.delete_plugin(plugin_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Plugin not found")


@router.post("/{plugin_id}/execute", response_model=ExecutionResponse)
async def execute_plugin(
    plugin_id: uuid.UUID,
    dto: ExecutePluginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        execution = await plugin_service.execute(plugin_id, dto, db)
        return ExecutionResponse.model_validate(execution)
    except HTTPException:
        raise


@router.get("/{plugin_id}/permissions", response_model=dict)
async def get_plugin_permissions(
    plugin_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    permissions = await plugin_service.get_permissions(plugin_id, db)
    if permissions is None:
        raise HTTPException(status_code=404, detail="Plugin not found")
    return {"permissions": permissions}


@router.get("/{plugin_id}/executions", response_model=dict)
async def list_plugin_executions(
    plugin_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    executions, total = await plugin_service.list_executions(plugin_id, page, page_size, db)
    return {
        "executions": [ExecutionResponse.model_validate(e) for e in executions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
