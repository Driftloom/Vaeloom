"""Action Proposal Engine — Dynamic, State-Aware Interactive Proposals.

Synthesizes executable ActionProposal cards and interactive chips by querying
live workspace database state (documents, approvals, resumes, applications)
rather than relying on static hardcoded string arrays.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .capability_registry import capability_registry
from .contracts.capability import AutonomyLevel, RiskClass
from .contracts.intent import ContextSignal, EmotionalState
from .contracts.proposals import ActionProposal, ProposalActionBinding, ProposalType

logger = logging.getLogger(__name__)


class ActionProposalEngine:
    """Generates dynamic, workspace-aware action proposals and UI chips."""

    def __init__(self) -> None:
        self.registry = capability_registry

    async def generate_proposals(
        self,
        query: str,
        workspace_id: str,
        db: AsyncSession | None = None,
        context_signal: ContextSignal | None = None,
        limit: int = 4,
    ) -> list[ActionProposal]:
        proposals: list[ActionProposal] = []

        # 1. State-Aware Intelligence: Query live database entities if session available
        pending_approvals_count = 0
        documents_count = 0
        resumes_count = 0

        if db is not None:
            try:
                from ..models.schema import ApprovalRequest, Document, Resume

                wid = uuid.UUID(str(workspace_id))
                # Pending approvals
                appr_res = await db.execute(
                    select(func.count(ApprovalRequest.id)).where(
                        ApprovalRequest.workspace_id == wid,
                        ApprovalRequest.status == "PENDING",
                    )
                )
                pending_approvals_count = appr_res.scalar() or 0

                # Documents count
                doc_res = await db.execute(
                    select(func.count(Document.id)).where(Document.workspace_id == wid)
                )
                documents_count = doc_res.scalar() or 0

                # Resumes count
                res_res = await db.execute(
                    select(func.count(Resume.id)).where(Resume.workspace_id == wid)
                )
                resumes_count = res_res.scalar() or 0
            except Exception as e:
                logger.debug(f"PROPOSAL_ENGINE: DB inspection skipped: {e}")

        # 2. Priority State Proposals (Pending actions requiring human consent)
        if pending_approvals_count > 0:
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_appr_{uuid.uuid4().hex[:6]}",
                    title=f"⚠️ Review {pending_approvals_count} Pending Approval{'s' if pending_approvals_count > 1 else ''}",
                    description="High-risk actions awaiting your review before execution.",
                    proposal_type=ProposalType.APPROVAL_REQUEST,
                    risk_class=RiskClass.HIGH,
                    requires_approval=True,
                    binding=ProposalActionBinding(
                        tool_name="list_approvals",
                        arguments={"status": "PENDING", "workspace_id": workspace_id},
                        required_scope="workspace.approval.read",
                    ),
                )
            )

        # 3. Contextual Emotional/Cognitive Proposals
        if context_signal and context_signal.emotional_state in (
            EmotionalState.BURNT_OUT,
            EmotionalState.ANXIOUS,
            EmotionalState.FRUSTRATED,
        ):
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_well_{uuid.uuid4().hex[:6]}",
                    title="☕ 10-Minute Cognitive Reset",
                    description="Step back and organize search priorities with a restorative executive check-in.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                    binding=ProposalActionBinding(
                        tool_name="conduct_wellness_checkin",
                        arguments={"duration_minutes": 10},
                        required_scope="executive.wellness",
                    ),
                )
            )
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_prio_{uuid.uuid4().hex[:6]}",
                    title="🎯 Clarify Single Highest-Leverage Goal",
                    description="Isolate one impactful action to avoid cognitive fatigue.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                )
            )

        # 4. State-Driven Functional Proposals
        if resumes_count > 0:
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_ats_{uuid.uuid4().hex[:6]}",
                    title="📊 Run Semantic ATS Audit",
                    description="Score your master resume against competitive market benchmarks.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                    binding=ProposalActionBinding(
                        tool_name="calculate_semantic_ats_score",
                        arguments={"workspace_id": workspace_id},
                        required_scope="career.ats.read",
                    ),
                )
            )
        else:
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_res_{uuid.uuid4().hex[:6]}",
                    title="📄 Upload or Build Master Resume",
                    description="Seed your career knowledge graph with verified work history.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                )
            )

        if documents_count > 3:
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_org_{uuid.uuid4().hex[:6]}",
                    title="🗂️ Auto-Organize Workspace Documents",
                    description=f"Cluster and categorize {documents_count} files into structured folders.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.MEDIUM,
                    binding=ProposalActionBinding(
                        tool_name="categorize_document",
                        arguments={"workspace_id": workspace_id},
                        required_scope="workspace.documents.write",
                        autonomy_level=AutonomyLevel.SUGGEST,
                    ),
                )
            )

        # 5. Semantic Query-Aligned Proposals
        query_lower = query.lower()
        if any(w in query_lower for w in ["job", "role", "search", "hire", "apply", "company"]):
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_job_{uuid.uuid4().hex[:6]}",
                    title="🔍 Discover Verified Senior Roles",
                    description="Search live company career portals and match against your skills.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                    binding=ProposalActionBinding(
                        tool_name="search_jobs",
                        arguments={"query": query},
                        required_scope="career.jobs.read",
                    ),
                )
            )

        if any(w in query_lower for w in ["salary", "comp", "equity", "offer", "negotiat"]):
            proposals.append(
                ActionProposal(
                    proposal_id=f"prop_sal_{uuid.uuid4().hex[:6]}",
                    title="💼 Benchmark Market Compensation (75th Percentile)",
                    description="Analyze base salary and equity ranges for your target level.",
                    proposal_type=ProposalType.ACTION_CHIP,
                    risk_class=RiskClass.LOW,
                )
            )

        # Ensure at least 3 high-leverage default chips if list is short
        fallback_titles = [
            ("🎯 Tailor Resume for a Target Role", "career.resume.write"),
            ("📈 Quantify Career Achievements", "career.resume.write"),
            ("🔍 Discover Remote Roles", "career.jobs.read"),
            ("📅 Schedule Interview Preparation", "workspace.calendar.write"),
        ]
        for title, scope in fallback_titles:
            if len(proposals) >= limit:
                break
            if not any(p.title == title for p in proposals):
                proposals.append(
                    ActionProposal(
                        proposal_id=f"prop_def_{uuid.uuid4().hex[:6]}",
                        title=title,
                        proposal_type=ProposalType.ACTION_CHIP,
                        risk_class=RiskClass.LOW,
                    )
                )

        return proposals[:limit]


# Global singleton
action_proposal_engine = ActionProposalEngine()
