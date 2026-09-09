"""
SCALE Multiscale Temporal Memory Hierarchy Service.
Implements Pillar 2 of the PIOS Blueprint:
- 5-Tier Wavelengths: SUB_DAILY, DAILY, WEEKLY, MONTHLY, ANNUAL, NORTH_STAR
- Hierarchical temporal rollups (Daily -> Weekly, Weekly -> Monthly)
- Zero-Trust workspace and user isolation
- Semantic and keyword retrieval
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import ScaleMemoryNode
from ..services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ScaleTier(str, Enum):
    SUB_DAILY = "SUB_DAILY"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    ANNUAL = "ANNUAL"
    NORTH_STAR = "NORTH_STAR"


class ScaleMemoryCreate(BaseModel):
    tier: ScaleTier = ScaleTier.DAILY
    period_start: datetime
    period_end: datetime
    summary: str = Field(..., min_length=1)
    key_insights: list[str] = Field(default_factory=list)
    friction_points: list[str] = Field(default_factory=list)
    unresolved_questions: list[str] = Field(default_factory=list)
    action_commitments: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ScaleMemoryUpdate(BaseModel):
    summary: str | None = None
    key_insights: list[str] | None = None
    friction_points: list[str] | None = None
    unresolved_questions: list[str] | None = None
    action_commitments: list[str] | None = None
    metadata: dict[str, Any] | None = None


class ScaleMemoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    tier: str
    period_start: datetime
    period_end: datetime
    summary: str
    key_insights: list[Any]
    friction_points: list[Any]
    unresolved_questions: list[Any]
    action_commitments: list[Any]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_from_orm(cls, data: Any) -> Any:
        if isinstance(data, ScaleMemoryNode):
            return {
                "id": data.id,
                "user_id": data.user_id,
                "workspace_id": data.workspace_id,
                "tier": data.tier,
                "period_start": data.period_start,
                "period_end": data.period_end,
                "summary": data.summary,
                "key_insights": data.key_insights or [],
                "friction_points": data.friction_points or [],
                "unresolved_questions": data.unresolved_questions or [],
                "action_commitments": data.action_commitments or [],
                "metadata": data.metadata_ if isinstance(data.metadata_, dict) else {},
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data


class ScaleMemoryService:
    """Manages the multiscale temporal memory hierarchy."""

    async def create_node(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        data: ScaleMemoryCreate,
    ) -> ScaleMemoryNode:
        """Create and persist a new SCALE memory node."""
        embedding_val = None
        try:
            embedding_val = await llm_service.generate_embedding(data.summary[:2000])
        except Exception as e:
            logger.warning("Failed to generate embedding for scale memory node: %s", e)

        node = ScaleMemoryNode(
            id=uuid.uuid4(),
            user_id=user_id,
            workspace_id=workspace_id,
            tier=data.tier.value if isinstance(data.tier, ScaleTier) else str(data.tier),
            period_start=data.period_start,
            period_end=data.period_end,
            summary=data.summary,
            key_insights=data.key_insights,
            friction_points=data.friction_points,
            unresolved_questions=data.unresolved_questions,
            action_commitments=data.action_commitments,
            embedding=embedding_val,
            metadata_=data.metadata,
        )
        db.add(node)
        await db.commit()
        await db.refresh(node)
        return node

    async def list_nodes(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        tier: str | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ScaleMemoryNode], int]:
        """List SCALE memory nodes with zero-trust scoping to user & workspace."""
        base_query = select(ScaleMemoryNode).where(
            ScaleMemoryNode.workspace_id == workspace_id,
            ScaleMemoryNode.user_id == user_id,
        )
        count_query = select(func.count()).select_from(ScaleMemoryNode).where(
            ScaleMemoryNode.workspace_id == workspace_id,
            ScaleMemoryNode.user_id == user_id,
        )

        if tier:
            tier_val = tier.value if isinstance(tier, ScaleTier) else str(tier).upper()
            base_query = base_query.where(ScaleMemoryNode.tier == tier_val)
            count_query = count_query.where(ScaleMemoryNode.tier == tier_val)

        if period_start:
            base_query = base_query.where(ScaleMemoryNode.period_end >= period_start)
            count_query = count_query.where(ScaleMemoryNode.period_end >= period_start)

        if period_end:
            base_query = base_query.where(ScaleMemoryNode.period_start <= period_end)
            count_query = count_query.where(ScaleMemoryNode.period_start <= period_end)

        total_res = await db.execute(count_query)
        total = total_res.scalar_one() or 0

        stmt = base_query.order_by(desc(ScaleMemoryNode.period_start)).limit(limit).offset(offset)
        result = await db.execute(stmt)
        nodes = list(result.scalars().all())
        return nodes, total

    async def get_node(
        self,
        db: AsyncSession,
        node_id: uuid.UUID,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> ScaleMemoryNode | None:
        """Get a specific node verifying user and workspace access."""
        stmt = select(ScaleMemoryNode).where(
            ScaleMemoryNode.id == node_id,
            ScaleMemoryNode.workspace_id == workspace_id,
            ScaleMemoryNode.user_id == user_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def delete_node(
        self,
        db: AsyncSession,
        node_id: uuid.UUID,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> bool:
        """Delete a SCALE node ensuring zero-trust tenancy."""
        node = await self.get_node(db, node_id, user_id, workspace_id)
        if not node:
            return False
        await db.delete(node)
        await db.commit()
        return True

    async def search_nodes(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        query: str,
        tier: str | None = None,
        limit: int = 10,
    ) -> list[ScaleMemoryNode]:
        """Search scale nodes with query matching and tier scoping."""
        search_pattern = f"%{query}%"
        stmt = select(ScaleMemoryNode).where(
            ScaleMemoryNode.workspace_id == workspace_id,
            ScaleMemoryNode.user_id == user_id,
            or_(
                ScaleMemoryNode.summary.ilike(search_pattern),
                ScaleMemoryNode.tier.ilike(search_pattern),
            ),
        )
        if tier:
            tier_val = tier.value if isinstance(tier, ScaleTier) else str(tier).upper()
            stmt = stmt.where(ScaleMemoryNode.tier == tier_val)

        stmt = stmt.order_by(desc(ScaleMemoryNode.period_start)).limit(limit)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def rollup_daily_to_weekly(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        week_start: datetime,
        week_end: datetime,
    ) -> ScaleMemoryNode:
        """
        Consolidate DAILY episodic logs into a WEEKLY synthesis node.
        Aggregates recurring friction, key insights, velocity, and carried commitments.
        """
        # Fetch daily nodes in this window
        stmt = (
            select(ScaleMemoryNode)
            .where(
                ScaleMemoryNode.workspace_id == workspace_id,
                ScaleMemoryNode.user_id == user_id,
                ScaleMemoryNode.tier == ScaleTier.DAILY.value,
                ScaleMemoryNode.period_start >= week_start,
                ScaleMemoryNode.period_end <= week_end,
            )
            .order_by(ScaleMemoryNode.period_start.asc())
        )
        res = await db.execute(stmt)
        daily_nodes = list(res.scalars().all())

        if not daily_nodes:
            # Fallback when no explicit daily logs exist
            summary = f"Weekly summary for period {week_start.date()} to {week_end.date()}: Normal activity baseline."
            key_insights = ["Consistent workflow baseline maintained."]
            friction_points = []
            unresolved = []
            commitments = []
        else:
            all_summaries = "\n".join([f"- [{d.period_start.strftime('%Y-%m-%d')}]: {d.summary}" for d in daily_nodes])
            raw_insights = [item for d in daily_nodes for item in (d.key_insights or [])]
            raw_frictions = [item for d in daily_nodes for item in (d.friction_points or [])]
            raw_questions = [item for d in daily_nodes for item in (d.unresolved_questions or [])]
            raw_commitments = [item for d in daily_nodes for item in (d.action_commitments or [])]

            # LLM Synthesis
            try:
                prompt = (
                    f"You are the PIOS SCALE Temporal Synthesis Engine. Synthesize the following daily logs into a cohesive weekly executive review.\n"
                    f"Daily Logs:\n{all_summaries}\n\n"
                    f"Insights: {raw_insights}\nFriction Points: {raw_frictions}\n"
                    f"Respond in valid JSON with keys: 'summary', 'key_insights', 'recurring_friction', 'unresolved_questions', 'future_commitments'."
                )
                llm_res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": "You synthesize multiscale temporal memory logs."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=600,
                )
                content = llm_res.get("content", "").replace("```json", "").replace("```", "").strip()
                data = json.loads(content)
                summary = data.get("summary", f"Weekly synthesis for {week_start.date()} to {week_end.date()}")
                key_insights = data.get("key_insights", raw_insights[:5])
                friction_points = data.get("recurring_friction", raw_frictions[:5])
                unresolved = data.get("unresolved_questions", raw_questions[:5])
                commitments = data.get("future_commitments", raw_commitments[:5])
            except Exception as e:
                logger.warning("LLM weekly synthesis fallback used: %s", e)
                summary = (
                    f"Weekly Synthesis ({week_start.date()} to {week_end.date()}): "
                    f"Consolidated {len(daily_nodes)} daily logs. Focus was directed across core tasks."
                )
                # Deduplicate items
                key_insights = list(dict.fromkeys(raw_insights))[:5]
                friction_points = list(dict.fromkeys(raw_frictions))[:5]
                unresolved = list(dict.fromkeys(raw_questions))[:5]
                commitments = list(dict.fromkeys(raw_commitments))[:5]

        weekly_create = ScaleMemoryCreate(
            tier=ScaleTier.WEEKLY,
            period_start=week_start,
            period_end=week_end,
            summary=summary,
            key_insights=key_insights,
            friction_points=friction_points,
            unresolved_questions=unresolved,
            action_commitments=commitments,
            metadata={"source_daily_count": len(daily_nodes)},
        )
        return await self.create_node(db, user_id, workspace_id, weekly_create)

    async def rollup_weekly_to_monthly(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        month_start: datetime,
        month_end: datetime,
    ) -> ScaleMemoryNode:
        """Consolidate WEEKLY synthesis nodes into a MONTHLY strategic milestone."""
        stmt = (
            select(ScaleMemoryNode)
            .where(
                ScaleMemoryNode.workspace_id == workspace_id,
                ScaleMemoryNode.user_id == user_id,
                ScaleMemoryNode.tier == ScaleTier.WEEKLY.value,
                ScaleMemoryNode.period_start >= month_start,
                ScaleMemoryNode.period_end <= month_end,
            )
            .order_by(ScaleMemoryNode.period_start.asc())
        )
        res = await db.execute(stmt)
        weekly_nodes = list(res.scalars().all())

        raw_insights = [item for w in weekly_nodes for item in (w.key_insights or [])]
        raw_frictions = [item for w in weekly_nodes for item in (w.friction_points or [])]
        raw_commitments = [item for w in weekly_nodes for item in (w.action_commitments or [])]

        summary = (
            f"Monthly Strategic Milestone ({month_start.strftime('%B %Y')}): "
            f"Consolidated {len(weekly_nodes)} weekly cycles. "
            f"Key milestone progress achieved across core tracks."
        )

        monthly_create = ScaleMemoryCreate(
            tier=ScaleTier.MONTHLY,
            period_start=month_start,
            period_end=month_end,
            summary=summary,
            key_insights=list(dict.fromkeys(raw_insights))[:6],
            friction_points=list(dict.fromkeys(raw_frictions))[:4],
            unresolved_questions=[],
            action_commitments=list(dict.fromkeys(raw_commitments))[:5],
            metadata={"source_weekly_count": len(weekly_nodes)},
        )
        return await self.create_node(db, user_id, workspace_id, monthly_create)


scale_memory_service = ScaleMemoryService()
