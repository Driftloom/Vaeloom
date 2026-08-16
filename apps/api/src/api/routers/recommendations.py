from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.recommendation import (
    FeedbackRequest,
    GenerateRecommendationRequest,
    IndexRequest,
    RecommendationItem,
    RecommendationResponse,
    TrendingQuery,
)
from ..services.recommendation_service import recommendation_service

router = APIRouter()


@router.post("", response_model=RecommendationResponse)
async def generate_recommendations(
    dto: GenerateRecommendationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await recommendation_service.generate(dto, db)
    return RecommendationResponse.model_validate(row._mapping)


@router.get("/{user_id}", response_model=list[RecommendationResponse])
async def get_recommendations(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    rows = await recommendation_service.get_by_user(user_id, db)
    return [RecommendationResponse.model_validate(r._mapping) for r in rows]


@router.post("/feedback", response_model=dict)
async def record_feedback(
    dto: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await recommendation_service.record_feedback(dto, db)
    if not row:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {
        "id": str(row[0]),
        "recommendation_id": str(row[1]),
        "useful": bool(row[2]),
        "created_at": row[3].isoformat() if hasattr(row[3], "isoformat") else str(row[3]),
    }


@router.get("/trending", response_model=list[dict])
async def get_trending(
    limit: int = Query(20, ge=1, le=100),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    items = await recommendation_service.get_trending(limit, tenant_id, db)
    return [RecommendationItem.model_validate(it) for it in items]


@router.post("/index", response_model=list[dict])
async def reindex(
    dto: IndexRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    results = await recommendation_service.reindex(dto.user_id, dto.tenant_id, db)
    return results
