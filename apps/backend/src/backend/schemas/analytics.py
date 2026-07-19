from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class UsageTimePoint(BaseModel):
    date: str
    memories_created: int
    agents_run: int
    tokens_used: int


class KpiSummary(BaseModel):
    total_memories: int
    total_agents: int
    active_users: int
    avg_response_time_ms: float


class DashboardPayload(BaseModel):
    kpis: KpiSummary
    usage: list[UsageTimePoint]
    generated_at: datetime


class TrackEventRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    properties: dict[str, Any] | None = None


class AggregateRequest(BaseModel):
    date: str | None = None
