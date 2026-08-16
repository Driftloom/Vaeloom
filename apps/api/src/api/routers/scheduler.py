import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..schemas.scheduler import (
    CreateJobRequest,
    JobExecutionResponse,
    JobResponse,
    UpdateJobRequest,
)
from ..services.scheduler_service import scheduler_service

router = APIRouter()


@router.post("/jobs", response_model=JobResponse, status_code=201)
async def create_job(
    dto: CreateJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    job = await scheduler_service.create_job(dto, tenant_id, db)
    return JobResponse.model_validate(job)


@router.get("/jobs", response_model=list[JobResponse])
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = None,
    status: str | None = None,
    name: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    jobs = await scheduler_service.list_jobs(page, page_size, type, status, name, tenant_id, db)
    return [JobResponse.model_validate(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    job = await scheduler_service.get_job(job_id, db)
    return JobResponse.model_validate(job)


@router.patch("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: uuid.UUID,
    dto: UpdateJobRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    job = await scheduler_service.update_job(job_id, dto, db)
    return JobResponse.model_validate(job)


@router.post("/jobs/{job_id}/pause", response_model=JobResponse)
async def pause_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    job = await scheduler_service.pause_job(job_id, db)
    return JobResponse.model_validate(job)


@router.post("/jobs/{job_id}/resume", response_model=JobResponse)
async def resume_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    job = await scheduler_service.resume_job(job_id, db)
    return JobResponse.model_validate(job)


@router.post("/jobs/{job_id}/trigger")
async def trigger_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return await scheduler_service.trigger_job(job_id, db)


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    await scheduler_service.delete_job(job_id, db)


@router.get("/jobs/{job_id}/executions", response_model=list[JobExecutionResponse])
async def list_executions(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    executions = await scheduler_service.list_executions(job_id, db)
    return [JobExecutionResponse.model_validate(e) for e in executions]
