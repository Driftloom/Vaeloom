from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.integration import IntegrationCreate, IntegrationResponse, IntegrationUpdate
from ..services.integration_service import integration_service

router = APIRouter()


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    dto: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _get_user_id(current_user)
    integration = await integration_service.create(dto, user_id, db)
    return IntegrationResponse.model_validate(integration)


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _get_user_id(current_user)
    integrations = await integration_service.list_for_user(user_id, db)
    return [IntegrationResponse.model_validate(i) for i in integrations]


@router.put("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: str,
    dto: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _get_user_id(current_user)
    integration = await integration_service.update(integration_id, dto, user_id, db)
    return IntegrationResponse.model_validate(integration)


@router.delete("/{integration_id}", status_code=204)
async def delete_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _get_user_id(current_user)
    await integration_service.delete(integration_id, user_id, db)


@router.post("/{integration_id}/sync")
async def sync_integration(
    integration_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _get_user_id(current_user)
    result = await integration_service.sync(integration_id, user_id, db)
    return result
