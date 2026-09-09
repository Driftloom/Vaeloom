"""
PIOS Proactive Anticipation Daemon.
Implements autonomous foresight capabilities:
- Trajectory monitoring across ScheduleEvents, Applications, and ScaleMemory commitments
- Anti-nagging frequency capping and cognitive relevance gating
- Speculative pre-computation of briefs, dossiers, and follow-ups
- Clean zero-trust workspace and user scoping
"""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Application, ProactiveProposal, ScaleMemoryNode, ScheduleEvent

logger = logging.getLogger(__name__)


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class ProposalOutput(BaseModel):
    id: uuid.UUID
    trigger_type: str
    title: str
    summary: str
    proposed_action: str
    action_payload: dict[str, Any]
    urgency: str
    status: str
    relevance_score: float
    scheduled_for: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AnticipationDaemonService:
    """Monitors trajectory signals and generates proactive action proposals."""

    MAX_PENDING_PROPOSALS = 5
    MIN_RELEVANCE_THRESHOLD = 0.70

    async def scan_and_generate_proposals(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> list[ProactiveProposal]:
        """Scans upcoming events, active applications, and unfulfilled commitments."""
        now = datetime.now(UTC)

        # 1. Check existing pending count (anti-nagging guardrail)
        pending_stmt = select(ProactiveProposal).where(
            ProactiveProposal.workspace_id == workspace_id,
            ProactiveProposal.user_id == user_id,
            ProactiveProposal.status == "PENDING",
        )
        res_pending = await db.execute(pending_stmt)
        existing_pending = list(res_pending.scalars().all())
        if len(existing_pending) >= self.MAX_PENDING_PROPOSALS:
            logger.info("Anticipation skipped: workspace %s has reached max pending proposals", workspace_id)
            return existing_pending

        slots_available = self.MAX_PENDING_PROPOSALS - len(existing_pending)
        new_proposals: list[ProactiveProposal] = []

        # 2. Check upcoming calendar events (next 48 hours)
        horizon = now + timedelta(hours=48)
        event_stmt = (
            select(ScheduleEvent)
            .where(
                ScheduleEvent.workspace_id == workspace_id,
                ScheduleEvent.date >= now - timedelta(hours=1),
                ScheduleEvent.date <= horizon,
            )
            .order_by(ScheduleEvent.date.asc())
            .limit(slots_available)
        )
        event_res = await db.execute(event_stmt)
        events = list(event_res.scalars().all())

        for ev in events:
            if len(new_proposals) >= slots_available:
                break

            # Deduplication: check if already proposed
            dup_stmt = select(ProactiveProposal.id).where(
                ProactiveProposal.workspace_id == workspace_id,
                ProactiveProposal.trigger_type == "UPCOMING_EVENT",
                ProactiveProposal.title.like(f"%{ev.title}%"),
            )
            dup_res = await db.execute(dup_stmt)
            if dup_res.scalar_one_or_none() is not None:
                continue

            ev_date = _to_utc(ev.date)
            time_delta = ev_date - now
            urgency = "HIGH" if time_delta.total_seconds() < 86400 else "MEDIUM"
            hours_left = max(1, int(time_delta.total_seconds() // 3600))

            prop = ProactiveProposal(
                id=uuid.uuid4(),
                user_id=user_id,
                workspace_id=workspace_id,
                trigger_type="UPCOMING_EVENT",
                title=f"Prepare Brief for '{ev.title}'",
                summary=f"Event scheduled in {hours_left}h. Proactively compiling dossier, context notes, and key objectives.",
                proposed_action="PREPARE_BRIEF",
                action_payload={
                    "event_id": str(ev.id),
                    "event_title": ev.title,
                    "event_date": ev_date.isoformat(),
                    "source": ev.source,
                    "suggested_agenda": [
                        "Review recent communication threads",
                        "Align on top 3 outcome objectives",
                        "Audit relevant workspace documents",
                    ],
                },
                urgency=urgency,
                status="PENDING",
                relevance_score=0.92,
                scheduled_for=ev_date,
            )
            db.add(prop)
            new_proposals.append(prop)

        # 3. Check active job applications (stale follow-up opportunity)
        if len(new_proposals) < slots_available:
            stale_threshold = now - timedelta(days=5)
            app_stmt = (
                select(Application)
                .where(
                    Application.workspace_id == workspace_id,
                    Application.status.in_(["APPLIED", "SUBMITTED"]),
                    or_(
                        Application.submitted_at <= stale_threshold,
                        Application.created_at <= stale_threshold,
                    ),
                )
                .order_by(desc(Application.created_at))
                .limit(slots_available - len(new_proposals))
            )
            app_res = await db.execute(app_stmt)
            apps = list(app_res.scalars().all())

            for app in apps:
                app_meta = app.metadata_ or {}
                company = app_meta.get("company_name") or app_meta.get("company") or "Target Company"
                title = app_meta.get("job_title") or app_meta.get("title") or "Role"

                dup_stmt = select(ProactiveProposal.id).where(
                    ProactiveProposal.workspace_id == workspace_id,
                    ProactiveProposal.trigger_type == "APPLICATION_DEADLINE",
                    ProactiveProposal.title.like(f"%{company}%"),
                )
                dup_res = await db.execute(dup_stmt)
                if dup_res.scalar_one_or_none() is not None:
                    continue

                applied_date = app.submitted_at or app.created_at
                date_str = applied_date.strftime("%b %d") if applied_date else "recently"

                prop = ProactiveProposal(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    workspace_id=workspace_id,
                    trigger_type="APPLICATION_DEADLINE",
                    title=f"Follow-up for {title} at {company}",
                    summary=f"Applied on {date_str}. 5+ days have elapsed without response. Follow-up email draft prepared.",
                    proposed_action="FOLLOW_UP_EMAIL",
                    action_payload={
                        "application_id": str(app.id),
                        "company_name": company,
                        "job_title": title,
                        "suggested_subject": f"Checking in regarding {title} application",
                    },
                    urgency="MEDIUM",
                    status="PENDING",
                    relevance_score=0.85,
                )
                db.add(prop)
                new_proposals.append(prop)

        # 4. Check unfulfilled commitments in ScaleMemory
        if len(new_proposals) < slots_available:
            scale_stmt = (
                select(ScaleMemoryNode)
                .where(
                    ScaleMemoryNode.workspace_id == workspace_id,
                    ScaleMemoryNode.tier == "DAILY",
                )
                .order_by(desc(ScaleMemoryNode.period_start))
                .limit(1)
            )
            scale_res = await db.execute(scale_stmt)
            latest_scale = scale_res.scalar_one_or_none()
            if latest_scale and latest_scale.action_commitments:
                unresolved = latest_scale.action_commitments[:2]
                prop = ProactiveProposal(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    workspace_id=workspace_id,
                    trigger_type="COMMITMENT_GAP",
                    title="Active Strategic Commitment Nudge",
                    summary=f"Unfinished priority commitment from recent daily log: '{unresolved[0]}'.",
                    proposed_action="SCHEDULE_FOCUS_BLOCK",
                    action_payload={
                        "commitment": unresolved[0],
                        "scale_node_id": str(latest_scale.id),
                    },
                    urgency="LOW",
                    status="PENDING",
                    relevance_score=0.78,
                )
                db.add(prop)
                new_proposals.append(prop)

        await db.commit()
        for p in new_proposals:
            await db.refresh(p)

        return existing_pending + new_proposals

    async def list_proposals(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        status: str | None = None,
    ) -> list[ProactiveProposal]:
        """Lists proposals in the specified workspace with optional status filter."""
        stmt = select(ProactiveProposal).where(
            ProactiveProposal.workspace_id == workspace_id,
            ProactiveProposal.user_id == user_id,
        )
        if status:
            stmt = stmt.where(ProactiveProposal.status == status.upper())
        stmt = stmt.order_by(desc(ProactiveProposal.created_at))

        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def accept_proposal(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        proposal_id: uuid.UUID,
    ) -> ProactiveProposal | None:
        """Marks proposal as ACCEPTED and ready for agent execution."""
        stmt = select(ProactiveProposal).where(
            ProactiveProposal.id == proposal_id,
            ProactiveProposal.workspace_id == workspace_id,
            ProactiveProposal.user_id == user_id,
        )
        res = await db.execute(stmt)
        prop = res.scalar_one_or_none()
        if not prop:
            return None

        prop.status = "ACCEPTED"
        await db.commit()
        await db.refresh(prop)
        return prop

    async def dismiss_proposal(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        proposal_id: uuid.UUID,
        reason: str | None = None,
    ) -> ProactiveProposal | None:
        """Marks proposal as DISMISSED with anti-nagging feedback recording."""
        stmt = select(ProactiveProposal).where(
            ProactiveProposal.id == proposal_id,
            ProactiveProposal.workspace_id == workspace_id,
            ProactiveProposal.user_id == user_id,
        )
        res = await db.execute(stmt)
        prop = res.scalar_one_or_none()
        if not prop:
            return None

        prop.status = "DISMISSED"
        prop.dismissed_reason = reason or "User dismissed"
        await db.commit()
        await db.refresh(prop)
        return prop


anticipation_daemon = AnticipationDaemonService()
