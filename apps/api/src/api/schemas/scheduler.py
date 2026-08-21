import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class JobType(StrEnum):
    HTTP = "http"
    EVENT = "event"

class JobStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"

class CreateJobRequest(BaseModel):
    name: str
    type: JobType
    cron: str
    method: str | None = None
    url: str | None = None
    event: str | None = None
    payload: dict[str, Any] | None = None
    headers: dict[str, str] | None = None
    tenant_id: str | None = None

class UpdateJobRequest(BaseModel):
    name: str | None = None
    cron: str | None = None
    method: str | None = None
    url: str | None = None
    event: str | None = None
    payload: dict[str, Any] | None = None
    headers: dict[str, str] | None = None

class JobResponse(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    cron: str
    method: str | None
    url: str | None
    event: str | None
    payload: dict[str, Any] | None
    headers: dict[str, str] | None
    status: str
    last_run_at: datetime | None
    next_run_at: datetime | None
    tenant_id: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class JobExecutionResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    status_code: int | None
    error: str | None
    created_at: datetime
    model_config = {"from_attributes": True}
