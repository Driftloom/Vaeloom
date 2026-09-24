"""Enterprise Automated Evaluation Service & Benchmark Pipeline.

Evaluates autonomous agent execution against golden benchmark datasets,
tracking accuracy, groundedness, tool selection correctness, latency, and token cost.
Persists evaluation telemetry to PostgreSQL EvaluationEntry.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.registries import EvaluationEntry

logger = logging.getLogger(__name__)


@dataclass
class GoldenDatasetItem:
    """Benchmark test item with expected outcomes."""
    prompt: str
    expected_agent: str
    expected_tools: list[str] = field(default_factory=list)
    required_keywords: list[str] = field(default_factory=list)
    category: str = "general"


# Curated Golden Benchmark Dataset covering core enterprise career intelligence workflows
GOLDEN_DATASET: list[GoldenDatasetItem] = [
    GoldenDatasetItem(
        prompt="Tailor my master resume for a Senior Distributed Systems Engineer role at AWS",
        expected_agent="resume",
        expected_tools=["search_documents", "compile_resume_pdf"],
        required_keywords=["experience", "skills", "distributed"],
        category="career",
    ),
    GoldenDatasetItem(
        prompt="Run an ATS compatibility check and extract missing keywords for this tech lead job description",
        expected_agent="ats",
        expected_tools=["calculate_semantic_ats_score"],
        required_keywords=["score", "keywords"],
        category="career",
    ),
    GoldenDatasetItem(
        prompt="Search for remote staff platform engineering opportunities with equity in San Francisco",
        expected_agent="job_search",
        expected_tools=["search_jobs"],
        required_keywords=["platform", "engineer"],
        category="job_search",
    ),
    GoldenDatasetItem(
        prompt="Draft an executive cover letter highlighting my Kubernetes migration experience",
        expected_agent="application",
        expected_tools=["search_documents"],
        required_keywords=["cover letter", "kubernetes"],
        category="application",
    ),
    GoldenDatasetItem(
        prompt="Remember that I prefer Go and Rust over Java for backend services",
        expected_agent="memory",
        expected_tools=["store_memory"],
        required_keywords=["preference", "rust", "go"],
        category="memory",
    ),
    GoldenDatasetItem(
        prompt="Organize my career documents into resumes and interview transcripts",
        expected_agent="organization",
        expected_tools=["search_documents"],
        required_keywords=["organized", "documents"],
        category="organization",
    ),
    GoldenDatasetItem(
        prompt="Check my calendar for scheduling conflicts tomorrow afternoon",
        expected_agent="scheduler",
        expected_tools=["check_calendar"],
        required_keywords=["calendar", "schedule"],
        category="productivity",
    ),
    GoldenDatasetItem(
        prompt="Conduct in-depth research on Stripe's engineering culture and infrastructure stack",
        expected_agent="research",
        expected_tools=["search_documents"],
        required_keywords=["stripe", "engineering"],
        category="research",
    ),
]


class EvaluationService:
    """Automated evaluation engine for evaluating agent execution trajectories."""

    def evaluate_output(
        self,
        output_text: str,
        selected_tools: list[str],
        expected_tools: list[str] | None = None,
        required_keywords: list[str] | None = None,
    ) -> dict[str, float]:
        """Compute objective scores for tool selection and grounded accuracy."""
        # 1. Tool selection score
        if not expected_tools:
            tool_score = 1.0
        else:
            tools_called = set(selected_tools)
            exp_set = set(expected_tools)
            overlap = tools_called.intersection(exp_set)
            tool_score = len(overlap) / len(exp_set) if exp_set else 1.0

        # 2. Groundedness & keyword presence score
        if not required_keywords:
            grounded_score = 1.0
        else:
            out_lower = output_text.lower()
            kw_hits = sum(1 for kw in required_keywords if kw.lower() in out_lower)
            grounded_score = kw_hits / len(required_keywords)

        # Composite accuracy
        accuracy_score = round(0.5 * tool_score + 0.5 * grounded_score, 4)

        return {
            "accuracy_score": accuracy_score,
            "tool_selection_score": round(tool_score, 4),
            "groundedness_score": round(grounded_score, 4),
        }

    async def record_evaluation(
        self,
        agent_name: str,
        intent: str,
        output_text: str,
        selected_tools: list[str],
        latency_ms: float = 0.0,
        token_count: int = 0,
        cost_usd: float = 0.0,
        expected_tools: list[str] | None = None,
        required_keywords: list[str] | None = None,
        execution_id: str | None = None,
        workspace_id: uuid.UUID | str | None = None,
        tenant_id: uuid.UUID | str | None = None,
        session: AsyncSession | None = None,
    ) -> EvaluationEntry:
        """Score an execution run and persist audit record in EvaluationEntry."""
        scores = self.evaluate_output(
            output_text=output_text,
            selected_tools=selected_tools,
            expected_tools=expected_tools,
            required_keywords=required_keywords,
        )

        acc = scores["accuracy_score"]
        if acc >= 0.80:
            verdict = "PASS"
        elif acc >= 0.50:
            verdict = "WARN"
        else:
            verdict = "FAIL"

        entry = EvaluationEntry(
            eval_id=f"eval_{uuid.uuid4().hex[:12]}",
            execution_id=execution_id or f"exec_{uuid.uuid4().hex[:12]}",
            agent_name=agent_name,
            intent=intent,
            accuracy_score=scores["accuracy_score"],
            groundedness_score=scores["groundedness_score"],
            tool_selection_score=scores["tool_selection_score"],
            latency_ms=latency_ms,
            token_count=token_count,
            cost_usd=cost_usd,
            verdict=verdict,
            metrics={"tools_called": selected_tools, "scores": scores},
            tenant_id=uuid.UUID(str(tenant_id)) if tenant_id else None,
            workspace_id=uuid.UUID(str(workspace_id)) if workspace_id else None,
        )

        if session:
            try:
                session.add(entry)
                await session.commit()
                await session.refresh(entry)
            except Exception as exc:
                logger.error("Failed to persist EvaluationEntry: %s", exc)

        logger.info(
            "Evaluation for agent=%s: verdict=%s accuracy=%.2f latency=%.1fms",
            agent_name,
            verdict,
            acc,
            latency_ms,
        )
        return entry

    def get_golden_benchmark(self) -> list[GoldenDatasetItem]:
        """Return the immutable golden benchmark dataset."""
        return list(GOLDEN_DATASET)


# Singleton
evaluation_service = EvaluationService()
