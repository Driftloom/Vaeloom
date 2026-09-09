"""
Opportunities API Router.
Exposes the PIOS Opportunity Engine (matcher_core) and 'Why You' explainability.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_workspace_id
from ..services.opportunity_matcher import opportunity_matcher, OpportunityMatchResult
from ..services.profile_service import ProfileService

router = APIRouter()
_profile_service = ProfileService()


class OpportunityDTO(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    company: str
    type: str = "job"  # job, hackathon, research, oss, cofounder
    required_skills: list[str] = []
    location: str | None = None
    url: str | None = None
    description: str | None = None


class MatchRequest(BaseModel):
    opportunity: OpportunityDTO
    connected_entities_count: int = 0


class BatchMatchRequest(BaseModel):
    opportunities: list[OpportunityDTO]
    top_k: int = 10


@router.post("/match", response_model=dict[str, Any])
async def match_single_opportunity(
    body: MatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Match a single opportunity against the user's demonstrated capability profile."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = str(current_user.get("sub") or current_user.get("user_id", ""))
    profile = await _profile_service.get_profile(user_id, workspace_id=workspace_id, db=db)
    user_skills = [s.model_dump() for s in (profile.skills if profile else [])]

    result = opportunity_matcher.calculate_match(
        opportunity=body.opportunity.model_dump(),
        user_capabilities=user_skills,
        connected_entities_count=body.connected_entities_count,
    )

    return {
        "opportunity_id": result.opportunity_id,
        "title": result.title,
        "company_or_host": result.company_or_host,
        "match_score": result.match_score,
        "metrics": {
            "cosine_similarity": result.cosine_similarity,
            "graph_proximity_score": result.graph_proximity_score,
            "recency_decay": result.recency_decay,
            "gap_penalty": result.gap_penalty,
        },
        "matching_skills": [
            {
                "name": m.skill_name,
                "tier": m.user_tier,
                "confidence": m.effective_confidence,
                "decay_status": m.decay_status,
            }
            for m in result.matching_skills
        ],
        "missing_skills": [
            {
                "name": m.skill_name,
                "remediation_path": m.remediation_path,
            }
            for m in result.missing_skills
        ],
        "why_you": {
            "headline": result.why_you_headline,
            "rationale": result.why_you_rationale,
            "development_action": result.development_action,
        },
    }


@router.post("/rank", response_model=list[dict[str, Any]])
async def rank_opportunities(
    body: BatchMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Rank a list of candidate opportunities using PIOS matcher_core."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = str(current_user.get("sub") or current_user.get("user_id", ""))
    profile = await _profile_service.get_profile(user_id, workspace_id=workspace_id, db=db)
    user_skills = [s.model_dump() for s in (profile.skills if profile else [])]

    results = opportunity_matcher.rank_opportunities(
        opportunities=[o.model_dump() for o in body.opportunities],
        user_capabilities=user_skills,
        top_k=body.top_k,
    )

    return [
        {
            "opportunity_id": r.opportunity_id,
            "title": r.title,
            "company_or_host": r.company_or_host,
            "match_score": r.match_score,
            "why_you_headline": r.why_you_headline,
            "missing_skills_count": len(r.missing_skills),
        }
        for r in results
    ]
