"""
PIOS Cognition and SCALE Memory API Router.
Exposes endpoints for:
- 5-Tier SCALE Multiscale Temporal Memory Hierarchy
- Hierarchical temporal rollups
- Overnight Background Cognition Daemon execution
- Morning Briefings
- Reality Gap diagnostics
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_workspace_id
from ..models.schema import Workspace, WorkspaceUser
from ..services.overnight_cognition_service import MorningBriefing, overnight_cognition_service
from ..services.reality_gap_service import RealityGapAnalysis, reality_gap_service
from ..services.scale_memory_service import (
    ScaleMemoryCreate,
    ScaleMemoryResponse,
    ScaleTier,
    scale_memory_service,
)

router = APIRouter()


async def _verify_workspace_access(
    db: AsyncSession,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> bool:
    """Verifies that the user owns or belongs to the specified workspace."""
    r1 = await db.execute(
        select(Workspace.id).where(Workspace.id == workspace_id, Workspace.user_id == user_id)
    )
    if r1.scalar_one_or_none() is not None:
        return True
    r2 = await db.execute(
        select(WorkspaceUser.id).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == user_id,
        )
    )
    return r2.scalar_one_or_none() is not None


class RollupRequest(BaseModel):
    target_tier: ScaleTier = Field(..., description="Target tier to synthesize into (WEEKLY, MONTHLY)")
    period_start: datetime
    period_end: datetime
    workspace_id: uuid.UUID


class OvernightCycleRequest(BaseModel):
    workspace_id: uuid.UUID
    target_date: datetime | None = None


@router.get("/scale/nodes", response_model=dict[str, Any])
async def list_scale_nodes(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    tier: str | None = Query(None, description="Tier: SUB_DAILY, DAILY, WEEKLY, MONTHLY, ANNUAL, NORTH_STAR"),
    period_start: datetime | None = Query(None),
    period_end: datetime | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Lists SCALE temporal memory nodes scoped to workspace and user."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    nodes, total = await scale_memory_service.list_nodes(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        tier=tier,
        period_start=period_start,
        period_end=period_end,
        limit=limit,
        offset=offset,
    )
    return {
        "nodes": [ScaleMemoryResponse.model_validate(n) for n in nodes],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/scale/nodes", response_model=ScaleMemoryResponse)
async def create_scale_node(
    body: ScaleMemoryCreate,
    workspace_id: uuid.UUID = Query(..., description="Target workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScaleMemoryResponse:
    """Manually ingests or registers a SCALE temporal memory node."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    node = await scale_memory_service.create_node(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        data=body,
    )
    return ScaleMemoryResponse.model_validate(node)


@router.get("/scale/nodes/{node_id}", response_model=ScaleMemoryResponse)
async def get_scale_node(
    node_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScaleMemoryResponse:
    """Retrieves a single SCALE memory node."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    node = await scale_memory_service.get_node(db, node_id, user_id, workspace_id)
    if not node:
        raise HTTPException(status_code=404, detail="Scale memory node not found")
    return ScaleMemoryResponse.model_validate(node)


@router.delete("/scale/nodes/{node_id}", response_model=dict[str, bool])
async def delete_scale_node(
    node_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, bool]:
    """Deletes a SCALE memory node."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    deleted = await scale_memory_service.delete_node(db, node_id, user_id, workspace_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Scale memory node not found")
    return {"deleted": True}


@router.post("/scale/rollup", response_model=ScaleMemoryResponse)
async def execute_scale_rollup(
    body: RollupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ScaleMemoryResponse:
    """Executes hierarchical temporal rollup across memory tiers."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    if body.target_tier == ScaleTier.WEEKLY:
        node = await scale_memory_service.rollup_daily_to_weekly(
            db=db,
            user_id=user_id,
            workspace_id=body.workspace_id,
            week_start=body.period_start,
            week_end=body.period_end,
        )
    elif body.target_tier == ScaleTier.MONTHLY:
        node = await scale_memory_service.rollup_weekly_to_monthly(
            db=db,
            user_id=user_id,
            workspace_id=body.workspace_id,
            month_start=body.period_start,
            month_end=body.period_end,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Rollup target tier {body.target_tier} not supported. Use WEEKLY or MONTHLY.",
        )

    return ScaleMemoryResponse.model_validate(node)


@router.post("/overnight/run", response_model=MorningBriefing)
async def trigger_overnight_cycle(
    body: OvernightCycleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> MorningBriefing:
    """Triggers the overnight background cognition daemon cycle on-demand."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    briefing = await overnight_cognition_service.run_overnight_cycle(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        target_date=body.target_date,
    )
    return briefing


@router.get("/briefing/today", response_model=MorningBriefing)
async def get_today_morning_briefing(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> MorningBriefing:
    """Retrieves or synthesizes today's Morning Briefing."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    briefing = await overnight_cognition_service.get_todays_briefing(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
    )
    return briefing


@router.get("/reality-gap", response_model=RealityGapAnalysis)
async def get_reality_gap(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    period_start: datetime | None = Query(None),
    period_end: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> RealityGapAnalysis:
    """Runs reality gap diagnostics comparing commitments against chronological action traces."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    analysis = await reality_gap_service.analyze_gap(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        period_start=period_start,
        period_end=period_end,
    )
    return analysis
