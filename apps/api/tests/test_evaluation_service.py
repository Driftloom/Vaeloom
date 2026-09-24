"""Enterprise Evaluation Service & Golden Dataset Test Suite.

Verifies:
- Objective scoring of tool selection and grounded keyword coverage
- Verdict classification (PASS, WARN, FAIL)
- Golden benchmark dataset coverage across core agent categories
- Persistence of EvaluationEntry in PostgreSQL
"""

import uuid
import pytest
from sqlalchemy import select

from api.models.registries import EvaluationEntry
from api.services.evaluation_service import evaluation_service

pytestmark = pytest.mark.asyncio


async def test_evaluate_output_scoring():
    """Verify accuracy, tool selection, and groundedness score calculations."""
    # Perfect run
    output = "I have optimized your distributed systems experience for AWS cloud roles."
    tools = ["search_documents", "compile_resume_pdf"]
    expected_tools = ["search_documents", "compile_resume_pdf"]
    keywords = ["distributed", "AWS", "experience"]

    scores = evaluation_service.evaluate_output(
        output_text=output,
        selected_tools=tools,
        expected_tools=expected_tools,
        required_keywords=keywords,
    )
    assert scores["tool_selection_score"] == 1.0
    assert scores["groundedness_score"] == 1.0
    assert scores["accuracy_score"] == 1.0

    # Partial run (missing 1 tool, missing 1 keyword)
    partial_scores = evaluation_service.evaluate_output(
        output_text="Updated your experience.",
        selected_tools=["search_documents"],
        expected_tools=["search_documents", "compile_resume_pdf"],
        required_keywords=["experience", "AWS"],
    )
    assert partial_scores["tool_selection_score"] == 0.5
    assert partial_scores["groundedness_score"] == 0.5
    assert partial_scores["accuracy_score"] == 0.5


async def test_golden_benchmark_dataset_coverage():
    """Verify golden dataset contains high-quality benchmark items across domains."""
    items = evaluation_service.get_golden_benchmark()
    assert len(items) >= 8

    agents = {i.expected_agent for i in items}
    assert "resume" in agents
    assert "ats" in agents
    assert "job_search" in agents
    assert "memory" in agents
    assert "organization" in agents
    assert "scheduler" in agents
    assert "research" in agents

    for item in items:
        assert item.prompt
        assert item.expected_agent
        assert len(item.required_keywords) > 0


async def test_record_evaluation_db_persistence(db_session):
    """Verify recording and querying EvaluationEntry from PostgreSQL."""
    entry = await evaluation_service.record_evaluation(
        agent_name="resume",
        intent="career.resume.tailor",
        output_text="Successfully tailored distributed systems experience for AWS.",
        selected_tools=["search_documents", "compile_resume_pdf"],
        latency_ms=180.5,
        token_count=1250,
        cost_usd=0.0035,
        expected_tools=["search_documents", "compile_resume_pdf"],
        required_keywords=["distributed", "AWS"],
        session=db_session,
    )

    assert entry.verdict == "PASS"
    assert entry.accuracy_score == 1.0
    assert entry.latency_ms == 180.5

    # Query back from DB
    stmt = select(EvaluationEntry).where(EvaluationEntry.eval_id == entry.eval_id)
    res = await db_session.execute(stmt)
    persisted = res.scalars().first()
    assert persisted is not None
    assert persisted.agent_name == "resume"
    assert persisted.verdict == "PASS"
    assert persisted.token_count == 1250
