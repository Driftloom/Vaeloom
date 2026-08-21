import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GenerateRecommendationRequest(BaseModel):
    user_id: str
    tenant_id: str | None = None
    context_tags: list[str] | None = None
    context: dict[str, Any] | None = None
    top_n: int = Field(default=10, ge=1, le=50)
    personalize: bool = False


class FeedbackRequest(BaseModel):
    recommendation_id: str
    useful: bool


class TrendingQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    tenant_id: str | None = None


class IndexRequest(BaseModel):
    user_id: str | None = None
    tenant_id: str | None = None


class RecommendationItem(BaseModel):
    id: str
    type: str
    title: str
    summary: str | None = None
    score: float
    source: str
    metadata: dict[str, Any] | None = None


class RecommendationResponse(BaseModel):
    id: uuid.UUID
    user_id: str
    tenant_id: str
    items: str
    model_version: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}
