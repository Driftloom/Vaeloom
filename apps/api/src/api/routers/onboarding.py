import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.onboarding import (
    CompleteOnboardingRequest,
    JoinWorkspaceRequest,
    OnboardingStateResponse,
    ResumeUploadResponse,
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


@router.post("/reset", response_model=OnboardingStateResponse)
async def reset_onboarding(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return await onboarding_service.reset(
        user_id=uuid.UUID(user_id),
        db=db,
    )


@router.post("/resume", response_model=ResumeUploadResponse)
async def upload_onboarding_resume(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return await onboarding_service.process_resume_upload(
        user_id=uuid.UUID(user_id),
        file=file,
        db=db,
    )


@router.post("/join", response_model=OnboardingStateResponse)
async def join_onboarding_workspace(
    dto: JoinWorkspaceRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return await onboarding_service.join_workspace(
        user_id=uuid.UUID(user_id),
        workspace_id=dto.workspace_id,
        db=db,
    )



