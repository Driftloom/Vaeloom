from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.resume import ResumeResponse, GenerateResumeRequest
from ..services.resume_service import resume_service

router = APIRouter()


@router.get("", response_model=list[ResumeResponse])
async def list_resumes(
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspace_id is required")
    resumes = await resume_service.list_for_workspace(workspace_id=workspace_id, db=db)
    return [ResumeResponse.model_validate(r) for r in resumes]


@router.get("/master", response_model=ResumeResponse)
async def get_master_resume(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    resume = await resume_service.get_master(workspace_id=workspace_id, db=db)
    if not resume:
        raise HTTPException(status_code=404, detail="Master resume not found")
    return ResumeResponse.model_validate(resume)


@router.post("/{resume_id}/generate", response_model=ResumeResponse)
async def generate_resume(
    resume_id: str,
    dto: GenerateResumeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user.get("sub") or current_user.get("user_id")
    resume = await resume_service.generate_variant(resume_id=resume_id, dto=dto, user_id=user_id, db=db)
    return ResumeResponse.model_validate(resume)
