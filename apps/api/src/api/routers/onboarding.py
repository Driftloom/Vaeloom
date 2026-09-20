import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.onboarding import (
    CompleteOnboardingRequest,
    OnboardingStateResponse,
    UpdateOnboardingStepRequest,
)
from ..services.onboarding_service import onboarding_service

router = APIRouter()


@router.get("", response_model=OnboardingStateResponse)
async def get_onboarding_state(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    tenant_id_str = current_user.get("tenant_id")
    tenant_id = uuid.UUID(tenant_id_str) if tenant_id_str else None

    return await onboarding_service.get_or_create_state(
        user_id=uuid.UUID(user_id),
        tenant_id=tenant_id,
        db=db,
    )


@router.post("/step", response_model=OnboardingStateResponse)
async def update_onboarding_step(
    dto: UpdateOnboardingStepRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return await onboarding_service.update_step(
        user_id=uuid.UUID(user_id),
        step=dto.step,
        step_data=dto.step_data,
        db=db,
    )


@router.post("/complete", response_model=OnboardingStateResponse)
async def complete_onboarding(
    dto: CompleteOnboardingRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return await onboarding_service.complete(
        user_id=uuid.UUID(user_id),
        final_data=dto.final_data,
        db=db,
    )
