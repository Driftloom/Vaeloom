from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..services.feature_flag_service import (
    FeatureFlagCreate,
    FeatureFlagResponse,
    FeatureFlagUpdate,
    feature_flag_service,
)

router = APIRouter()


@router.get("", response_model=list[FeatureFlagResponse])
async def list_flags(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    flags = await feature_flag_service.list_flags(workspace_id, db)
    return [FeatureFlagResponse(**f) for f in flags]


@router.post("", response_model=FeatureFlagResponse, status_code=201)
async def create_flag(
    dto: FeatureFlagCreate,
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    flag = await feature_flag_service.create_flag(dto, workspace_id, db)
    return FeatureFlagResponse(**flag)


@router.put("/{flag_id}", response_model=FeatureFlagResponse)
async def update_flag(
    flag_id: str,
    dto: FeatureFlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    flag = await feature_flag_service.update_flag(flag_id, dto, db)
    return FeatureFlagResponse(**flag)


@router.post("/{flag_id}/toggle", response_model=FeatureFlagResponse)
async def toggle_flag(
    flag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    flag = await feature_flag_service.toggle_flag(flag_id, db)
    return FeatureFlagResponse(**flag)


@router.delete("/{flag_id}", status_code=204)
async def delete_flag(
    flag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    await feature_flag_service.delete_flag(flag_id, db)
