from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.application import ApplicationCreate, ApplicationUpdateOutcome, ApplicationResponse
from ..services.application_service import application_service

router = APIRouter()


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(
    workspace_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    apps, total = await application_service.find_all(workspace_id, db, page, page_size)
    return [ApplicationResponse.model_validate(a) for a in apps]


@router.post("", response_model=ApplicationResponse, status_code=201)
async def create_application(
    workspace_id: str,
    dto: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    application = await application_service.create(workspace_id, dto, db)
    return ApplicationResponse.model_validate(application)


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    workspace_id: str,
    application_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    application = await application_service.find_one(workspace_id, application_id, db)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApplicationResponse.model_validate(application)


@router.patch("/{application_id}/outcome", response_model=ApplicationResponse)
async def update_application_outcome(
    workspace_id: str,
    application_id: str,
    dto: ApplicationUpdateOutcome,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    application = await application_service.update_outcome(workspace_id, application_id, dto.status, db)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApplicationResponse.model_validate(application)
