"""
PIOS Reality Gap Engine.
Detects and quantifies discrepancies between user's stated goals/intentions
(from SCALE memory action commitments) and actual chronological execution patterns
(from AgentAction, Document modifications, and Audit traces).
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

from ..models.schema import AgentAction, Document, ScaleMemoryNode
from ..services.llm_service import llm_service
from .scale_memory_service import ScaleTier

logger = logging.getLogger(__name__)


class CommitmentAudit(BaseModel):
    commitment: str
    status: str  # FULFILLED, PARTIAL, UNFULFILLED
    evidence: str | None = None
    confidence: float = 0.8


class DivergentActivity(BaseModel):
    activity: str
    category: str
    occurrences: int = 1
    significance: str = "MEDIUM"  # LOW, MEDIUM, HIGH


class RealityGapAnalysis(BaseModel):
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    alignment_score: float = Field(..., ge=0.0, le=1.0, description="1.0 = perfect execution alignment")
    discrepancy_score: float = Field(..., ge=0.0, le=1.0, description="1.0 = total divergence from commitments")
    total_commitments: int
    fulfilled_count: int
    commitments: list[CommitmentAudit] = Field(default_factory=list)
    divergent_activities: list[DivergentActivity] = Field(default_factory=list)
    behavioral_insights: list[str] = Field(default_factory=list)
    friction_recommendation: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RealityGapService:
    """Evaluates adherence between intentional commitments and actual activity."""

    async def analyze_gap(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> RealityGapAnalysis:
        """
        Calculates the reality gap for a specific window.
        Defaults to the past 24-48 hours.
        """
        now = datetime.now(UTC)
        p_end = period_end or now
        p_start = period_start or (p_end - timedelta(days=2))

        # 1. Gather commitments from recent SCALE memory nodes
        stmt_mem = (
            select(ScaleMemoryNode)
            .where(
                ScaleMemoryNode.workspace_id == workspace_id,
                ScaleMemoryNode.user_id == user_id,
                ScaleMemoryNode.period_end >= p_start,
                ScaleMemoryNode.period_start <= p_end,
            )
            .order_by(desc(ScaleMemoryNode.period_start))
        )
        mem_res = await db.execute(stmt_mem)
        scale_nodes = list(mem_res.scalars().all())

        commitments_list: list[str] = []
        for node in scale_nodes:
            if node.action_commitments:
                for c in node.action_commitments:
                    if isinstance(c, str) and c.strip() and c not in commitments_list:
                        commitments_list.append(c.strip())

        # 2. Gather actual execution evidence
        # A. Agent actions
        stmt_actions = (
            select(AgentAction)
            .where(
                AgentAction.workspace_id == workspace_id,
                AgentAction.created_at >= p_start,
                AgentAction.created_at <= p_end,
            )
            .order_by(desc(AgentAction.created_at))
            .limit(100)
        )
        act_res = await db.execute(stmt_actions)
        actions = list(act_res.scalars().all())

        # B. Document updates
        stmt_docs = (
            select(Document.path, Document.updated_at)
            .where(
                Document.workspace_id == workspace_id,
                Document.updated_at >= p_start,
                Document.updated_at <= p_end,
            )
            .limit(50)
        )
        doc_res = await db.execute(stmt_docs)
        docs_updated = list(doc_res.all())

        # Summarize actual activity traces
        activity_summaries: list[str] = []
        for a in actions:
            summary_str = f"Agent Action: {a.action_type} - {a.tool_name or ''} ({a.status})"
            if summary_str not in activity_summaries:
                activity_summaries.append(summary_str)

        for d_path, _ in docs_updated:
            doc_str = f"Document updated: {d_path}"
            if doc_str not in activity_summaries:
                activity_summaries.append(doc_str)

        # 3. Match commitments against actual activities
        # If no commitments were stated, establish neutral baseline
        if not commitments_list:
            return RealityGapAnalysis(
                user_id=user_id,
                workspace_id=workspace_id,
                period_start=p_start,
                period_end=p_end,
                alignment_score=1.0,
                discrepancy_score=0.0,
                total_commitments=0,
                fulfilled_count=0,
                commitments=[],
                divergent_activities=[
                    DivergentActivity(
                        activity=act[:120],
                        category="Unplanned Activity",
                        occurrences=1,
                    )
                    for act in activity_summaries[:3]
                ],
                behavioral_insights=["No explicit action commitments recorded for this window. Alignment baseline assumed."],
                friction_recommendation="Define 1-3 key action commitments in your daily log to enable active reality gap tracking.",
            )

        # Synthesize matching via LLM or keyword heuristic
        audited_commitments: list[CommitmentAudit] = []
        fulfilled_count = 0

        try:
            prompt = (
                f"You are the PIOS Reality Gap Engine. Compare the stated commitments against actual observed activities.\n"
                f"Stated Commitments:\n{json.dumps(commitments_list)}\n\n"
                f"Observed Activity Traces:\n{json.dumps(activity_summaries[:30])}\n\n"
                f"Evaluate each commitment. Return valid JSON with keys:\n"
                f"- 'audits': list of objects {{\"commitment\": str, \"status\": \"FULFILLED\"|\"PARTIAL\"|\"UNFULFILLED\", \"evidence\": str}}\n"
                f"- 'divergent_activities': list of strings describing unplanned tasks observed\n"
                f"- 'behavioral_insights': list of 2-3 concise observations\n"
                f"- 'friction_recommendation': 1 actionable recommendation"
            )
            llm_res = await llm_service.generate_completion(
                [
                    {"role": "system", "content": "You analyze reality gaps between intentions and actions."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=700,
            )
            parsed = json.loads(llm_res.get("content", "").replace("```json", "").replace("```", "").strip())

            for a in parsed.get("audits", []):
                status = a.get("status", "UNFULFILLED")
                if status == "FULFILLED":
                    fulfilled_count += 1
                elif status == "PARTIAL":
                    fulfilled_count += 0.5
                audited_commitments.append(
                    CommitmentAudit(
                        commitment=a.get("commitment", ""),
                        status=status,
                        evidence=a.get("evidence"),
                    )
                )

            divergent = [
                DivergentActivity(activity=d, category="Divergent Task")
                for d in parsed.get("divergent_activities", [])[:5]
            ]
            insights = parsed.get("behavioral_insights", [])
            recommendation = parsed.get(
                "friction_recommendation",
                "Align tomorrow's calendar with primary commitments to prevent task drift.",
            )

        except Exception as e:
            logger.warning("LLM Reality Gap analysis fallback used: %s", e)
            # Heuristic keyword matching fallback
            for commit in commitments_list:
                words = [w.lower() for w in commit.split() if len(w) > 3]
                matched_evidence = None
                for act in activity_summaries:
                    if any(w in act.lower() for w in words):
                        matched_evidence = act
                        break
                if matched_evidence:
                    fulfilled_count += 1
                    audited_commitments.append(
                        CommitmentAudit(
                            commitment=commit,
                            status="FULFILLED",
                            evidence=matched_evidence,
                        )
                    )
                else:
                    audited_commitments.append(
                        CommitmentAudit(
                            commitment=commit,
                            status="UNFULFILLED",
                            evidence="No matching execution traces detected.",
                        )
                    )

            divergent = [
                DivergentActivity(activity=act, category="Unplanned Activity")
                for act in activity_summaries[:3]
            ]
            insights = [
                f"Execution progress recorded on {int(fulfilled_count)} out of {len(commitments_list)} commitments.",
                "Attention was distributed across ad-hoc agent requests.",
            ]
            recommendation = "Protect morning focus blocks for stated commitments before attending to ad-hoc requests."

        total = len(commitments_list)
        alignment_score = max(0.0, min(1.0, round(fulfilled_count / total, 2))) if total > 0 else 1.0
        discrepancy_score = round(1.0 - alignment_score, 2)

        return RealityGapAnalysis(
            user_id=user_id,
            workspace_id=workspace_id,
            period_start=p_start,
            period_end=p_end,
            alignment_score=alignment_score,
            discrepancy_score=discrepancy_score,
            total_commitments=total,
            fulfilled_count=int(fulfilled_count),
            commitments=audited_commitments,
            divergent_activities=divergent,
            behavioral_insights=insights,
            friction_recommendation=recommendation,
        )


reality_gap_service = RealityGapService()
