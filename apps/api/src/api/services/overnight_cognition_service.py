"""
PIOS Overnight Background Cognition Daemon.
Implements Pillar 4 of the PIOS Blueprint:
- Automated 02:00 AM Consolidation Cycle
- Consolidation of continuous perception stream into DAILY episodic logs
- Weekly rollup automation
- Reality Gap analysis invocation
- Morning Briefing generation (3 Top Priorities + 30-second Micro-Learning Nudge)
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import AgentAction, Memory, ScaleMemoryNode
from ..services.llm_service import llm_service
from .reality_gap_service import RealityGapAnalysis, reality_gap_service
from .scale_memory_service import ScaleMemoryCreate, ScaleTier, scale_memory_service

logger = logging.getLogger(__name__)


class MicroLearningNudge(BaseModel):
    title: str
    concept: str
    actionable_takeaway: str
    estimated_read_seconds: int = 30


class MorningBriefing(BaseModel):
    briefing_date: str  # YYYY-MM-DD
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    top_priorities: list[str] = Field(..., max_length=5, description="3-5 high-leverage focus items for today")
    reality_gap: RealityGapAnalysis
    resolved_friction: list[str] = Field(default_factory=list)
    open_friction: list[str] = Field(default_factory=list)
    micro_learning: MicroLearningNudge
    daily_log_id: uuid.UUID | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class OvernightCognitionService:
    """Orchestrates the overnight synthesis and morning briefing engine."""

    def __init__(self):
        self._briefing_cache: dict[str, MorningBriefing] = {}

    def _cache_key(self, user_id: uuid.UUID, workspace_id: uuid.UUID, date_str: str) -> str:
        return f"{user_id}:{workspace_id}:{date_str}"

    async def run_overnight_cycle(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        target_date: datetime | None = None,
    ) -> MorningBriefing:
        """
        Executes the overnight background cognition pipeline for a given user & workspace.
        """
        now = target_date or datetime.now(UTC)
        yesterday = now - timedelta(days=1)
        start_of_yesterday = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_yesterday = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)

        # 1. Fetch raw events and flat memories recorded during the target window
        stmt_mem = (
            select(Memory)
            .where(
                Memory.workspace_id == workspace_id,
                Memory.created_at >= start_of_yesterday,
                Memory.created_at <= end_of_yesterday,
            )
            .order_by(desc(Memory.created_at))
            .limit(50)
        )
        mem_res = await db.execute(stmt_mem)
        raw_memories = list(mem_res.scalars().all())

        stmt_actions = (
            select(AgentAction)
            .where(
                AgentAction.workspace_id == workspace_id,
                AgentAction.created_at >= start_of_yesterday,
                AgentAction.created_at <= end_of_yesterday,
            )
            .order_by(desc(AgentAction.created_at))
            .limit(50)
        )
        act_res = await db.execute(stmt_actions)
        actions = list(act_res.scalars().all())

        # 2. Synthesize DAILY ScaleMemoryNode
        memory_texts = [f"Memory [{m.type}]: {m.title} - {m.summary or ''}" for m in raw_memories]
        action_texts = [f"Action: {a.action_type} - {a.tool_name or ''}" for a in actions]
        combined_traces = "\n".join((memory_texts + action_texts)[:40])

        daily_summary = f"Daily log for {yesterday.date()}: Normal activity cycle."
        key_insights = ["Consistent workspace progression maintained."]
        friction_points = []
        unresolved = []
        action_commitments = [
            "Review core deliverables and align priority queue.",
            "Consolidate outstanding documentation.",
            "Execute scheduled agent tasks.",
        ]

        if combined_traces:
            try:
                prompt = (
                    f"You are the PIOS Overnight Cognition Engine. Synthesize the following daily event traces into a structured Daily Log.\n"
                    f"Traces:\n{combined_traces}\n\n"
                    f"Output valid JSON with keys:\n"
                    f"- 'summary': 2-3 sentence overview\n"
                    f"- 'key_insights': list of 2-3 key takeaways\n"
                    f"- 'friction_points': list of friction points or blockers encountered\n"
                    f"- 'unresolved_questions': list of open questions\n"
                    f"- 'commitments_for_tomorrow': list of 3 top priorities for tomorrow"
                )
                llm_res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": "You are the PIOS Overnight Cognition Engine."},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=600,
                )
                content = llm_res.get("content", "").replace("```json", "").replace("```", "").strip()
                data = json.loads(content)
                daily_summary = data.get("summary", daily_summary)
                key_insights = data.get("key_insights", key_insights)
                friction_points = data.get("friction_points", friction_points)
                unresolved = data.get("unresolved_questions", unresolved)
                action_commitments = data.get("commitments_for_tomorrow", action_commitments)
            except Exception as e:
                logger.warning("LLM daily consolidation fallback used: %s", e)
                if raw_memories:
                    daily_summary = f"Daily Log ({yesterday.date()}): Processed {len(raw_memories)} memories and {len(actions)} agent operations."
                    key_insights = [m.title for m in raw_memories[:3]]

        # Persist Daily ScaleMemoryNode
        daily_node = await scale_memory_service.create_node(
            db,
            user_id=user_id,
            workspace_id=workspace_id,
            data=ScaleMemoryCreate(
                tier=ScaleTier.DAILY,
                period_start=start_of_yesterday,
                period_end=end_of_yesterday,
                summary=daily_summary,
                key_insights=key_insights,
                friction_points=friction_points,
                unresolved_questions=unresolved,
                action_commitments=action_commitments,
                metadata={"source_memories": len(raw_memories), "source_actions": len(actions)},
            ),
        )

        # 3. Weekly Rollup Trigger Check (if Sunday)
        if yesterday.weekday() == 6:  # Sunday
            week_start = start_of_yesterday - timedelta(days=6)
            try:
                await scale_memory_service.rollup_daily_to_weekly(
                    db, user_id, workspace_id, week_start, end_of_yesterday
                )
            except Exception as e:
                logger.error("Failed auto weekly rollup: %s", e)

        # 4. Run Reality Gap Analysis
        gap_analysis = await reality_gap_service.analyze_gap(
            db, user_id, workspace_id, start_of_yesterday, end_of_yesterday
        )

        # 5. Synthesize 30-Second Micro-Learning Nudge
        nudge = MicroLearningNudge(
            title="Cognitive Momentum & Single-Tasking",
            concept="Context switching between ad-hoc agent requests fragments attention and creates latent reality gaps.",
            actionable_takeaway="Anchor the first 90 minutes of your morning to your #1 priority before triaging inbound queues.",
            estimated_read_seconds=30,
        )

        top_priorities = action_commitments[:3] if action_commitments else [
            "Deep focus on primary project deliverable",
            "Clear open blockers identified in overnight review",
            "Calibrate agent execution constraints",
        ]

        # 6. Package and cache Morning Briefing
        today_str = now.strftime("%Y-%m-%d")
        briefing = MorningBriefing(
            briefing_date=today_str,
            user_id=user_id,
            workspace_id=workspace_id,
            top_priorities=top_priorities,
            reality_gap=gap_analysis,
            resolved_friction=[f"Overnight synthesis indexed {len(raw_memories)} events"],
            open_friction=friction_points[:3],
            micro_learning=nudge,
            daily_log_id=daily_node.id,
            created_at=now,
        )

        cache_k = self._cache_key(user_id, workspace_id, today_str)
        self._briefing_cache[cache_k] = briefing
        return briefing

    async def get_todays_briefing(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> MorningBriefing:
        """
        Retrieves today's Morning Briefing from cache, or runs an on-demand cognition cycle if none exists.
        """
        now = datetime.now(UTC)
        today_str = now.strftime("%Y-%m-%d")
        cache_k = self._cache_key(user_id, workspace_id, today_str)

        if cache_k in self._briefing_cache:
            return self._briefing_cache[cache_k]

        # Generate on-demand
        return await self.run_overnight_cycle(db, user_id, workspace_id, target_date=now)


overnight_cognition_service = OvernightCognitionService()
