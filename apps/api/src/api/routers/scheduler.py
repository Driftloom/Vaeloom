import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
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


class CreateScheduleEventRequest(BaseModel):
    workspace_id: uuid.UUID
    title: str
    source: str = "calendar"
    type: str = "event"
    date: datetime
    end_date: datetime | None = None
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScheduleEventResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    source: str
    type: str
    date: datetime
    end_date: datetime | None = None
    description: str | None = None
    conflict_flag: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_meta(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        return {
            "id": getattr(data, "id", None),
            "workspace_id": getattr(data, "workspace_id", None),
            "title": getattr(data, "title", None),
            "source": getattr(data, "source", None),
            "type": getattr(data, "type", None),
            "date": getattr(data, "date", None),
            "end_date": getattr(data, "end_date", None),
            "description": getattr(data, "description", None),
            "conflict_flag": getattr(data, "conflict_flag", False),
            "metadata": getattr(data, "metadata_", {}) or {},
            "created_at": getattr(data, "created_at", None),
        }


@router.post("/events", response_model=ScheduleEventResponse)
async def create_schedule_event(
    dto: CreateScheduleEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    from ..models.schema import ScheduleEvent
    ev = ScheduleEvent(
        id=uuid.uuid4(),
        workspace_id=dto.workspace_id,
        source=dto.source,
        title=dto.title,
        description=dto.description,
        date=dto.date,
        end_date=dto.end_date,
        type=dto.type,
        metadata_=dto.metadata,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ScheduleEventResponse.model_validate(ev)


@router.get("/events", response_model=list[ScheduleEventResponse])
async def list_schedule_events(
    workspace_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    from ..models.schema import ScheduleEvent
    res = await db.execute(
        select(ScheduleEvent).where(ScheduleEvent.workspace_id == workspace_id).order_by(ScheduleEvent.date.asc())
    )
    return [ScheduleEventResponse.model_validate(e) for e in res.scalars().all()]

