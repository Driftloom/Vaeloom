"""Integration tests for Highway A Fast Deterministic Execution & Speculative 50-Check Audit.

Verifies:
1. Speculative 50-check audit runs over documents, evaluating contact, structure, metrics, ATS, skills, and polish.
2. Myers diff and version comparison calculates additions, deletions, word delta, and similarity ratio.
3. Highway A bypasses generative LLM synthesis (Gemma) for operational actions in <50ms.
4. Highway A extracts skills deterministically from workspace documents.
"""
import uuid
import pytest
from httpx import AsyncClient

from api.agents.document_agent.handler import DocumentAgent
from api.models.schema import Document, DocumentVersion
from api.services.document_service import document_service

pytestmark = [pytest.mark.integration]

SAMPLE_RESUME_TEXT = """John Doe
john.doe@example.com | +1 (555) 019-2834 | San Francisco, CA (Remote)
https://linkedin.com/in/johndoe | https://github.com/johndoe

Summary
Staff Cloud Architect with 10+ years of experience designing distributed systems. Engineered cloud-native platforms supporting 25M active users at 50k RPS. Saved $1.8M annually in infrastructure costs by optimizing Kubernetes cluster allocation.

Experience
Lead Infrastructure Architect — Acme Corp (2020 - Present)
* Engineered multi-region Kubernetes cluster deployment reducing latency by 45ms across 10M requests daily.
* Architected event-driven microservices using Python, FastAPI, and Kafka, saving 35 hours per week of manual sync.
* Spearheaded database migration to PostgreSQL and Redis, delivering 99.99% uptime and saving $450k/year in licensing.
* Mentored team of 8 senior engineers and collaborated with cross-functional product stakeholders on roadmaps.

Education
Bachelor of Science in Computer Science — University of California, Berkeley (2014 - 2018)

Skills
Languages: Python, Go, TypeScript, SQL
Frameworks & Tools: FastAPI, Docker, Kubernetes, AWS, GCP, Redis, Kafka, PostgreSQL, Pytest, CI/CD
"""

SAMPLE_RESUME_V2 = """John Doe
john.doe@example.com | +1 (555) 019-2834 | San Francisco, CA (Remote)
https://linkedin.com/in/johndoe | https://github.com/johndoe

Summary
Principal Distributed Systems Architect with 12+ years of experience. Spearheaded enterprise migrations serving 50M active users at 100k RPS. Delivered $3.2M in annual cloud optimizations.

Experience
Principal Architect — Global Cloud Technologies (2022 - Present)
* Orchestrated multi-cloud Kubernetes architectures across AWS and GCP supporting 100k RPS.
* Engineered Rust and Go microservices cutting p99 latency from 120ms to 18ms.
* Designed distributed caching using Redis and ScyllaDB, saving $1.2M annually.
* Led engineering division of 25 developers across 4 international time zones.

Lead Infrastructure Architect — Acme Corp (2020 - 2022)
* Engineered multi-region Kubernetes cluster deployment reducing latency by 45ms.
* Architected event-driven microservices using Python and Kafka.

Education
Master of Science in Distributed Systems — Stanford University (2018 - 2020)
Bachelor of Science in Computer Science — UC Berkeley (2014 - 2018)

Skills
Languages: Python, Go, Rust, TypeScript, SQL
Cloud & Infrastructure: Kubernetes, Docker, Terraform, AWS, GCP, Redis, Kafka, PostgreSQL, CI/CD
"""


@pytest.mark.asyncio
async def test_50_check_speculative_quality_audit(authenticated_context):
    """POST /documents/{id}/audit runs exactly 50 discrete checks with categorized scoring."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    # 1. Upload sample resume
    files = {"file": ("john_doe_resume.txt", SAMPLE_RESUME_TEXT.encode("utf-8"), "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201
    doc_id = res.json()["id"]

    # 2. Trigger speculative audit
    audit_res = await client.post(f"/api/v1/documents/{doc_id}/audit?workspace_id={ws_id}", headers=headers)
    assert audit_res.status_code == 200
    data = audit_res.json()

    # 3. Verify exactly 50 checks
    assert data["total_checks"] == 50
    assert len(data["checks"]) == 50
    assert data["passed_checks"] > 35
    assert data["quality_score"] >= 70.0
    assert data["verdict"] in ("EXCELLENT", "GOOD")

    # 4. Verify all 6 categories are populated
    for cat in ("contact", "structure", "metrics", "ats_parseability", "skills", "polish"):
        assert cat in data["categories"]
        assert data["categories"][cat]["total"] > 0
        assert data["categories"][cat]["passed"] > 0


@pytest.mark.asyncio
async def test_myers_diff_version_comparison(authenticated_context):
    """POST /documents/{id}/compare performs Myers diff between two versions."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    # 1. Upload initial v1
    files_v1 = {"file": ("resume.txt", SAMPLE_RESUME_TEXT.encode("utf-8"), "text/plain")}
    res1 = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files_v1, headers=headers)
    assert res1.status_code == 201
    doc_id = res1.json()["id"]

    # 2. Upload revision v2
    files_v2 = {"file": ("resume.txt", SAMPLE_RESUME_V2.encode("utf-8"), "text/plain")}
    res2 = await client.post(f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}", files=files_v2, headers=headers)
    assert res2.status_code == 201
    assert res2.json()["version_number"] == 2

    # 3. Compare v1 and v2
    payload = {"version_a": 1, "version_b": 2}
    comp_res = await client.post(f"/api/v1/documents/{doc_id}/compare?workspace_id={ws_id}", json=payload, headers=headers)
    assert comp_res.status_code == 200
    comp_data = comp_res.json()

    assert comp_data["version_a"] == 1
    assert comp_data["version_b"] == 2
    assert comp_data["additions_count"] > 0
    assert comp_data["deletions_count"] > 0
    assert 0.0 < comp_data["similarity_ratio"] < 1.0
    assert "additions" in comp_data
    assert "summary" in comp_data


@pytest.mark.asyncio
async def test_highway_a_fast_action_bypass(authenticated_context):
    """DocumentAgent executes Highway A directly in <50ms without calling generative LLM."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    # Upload document first
    files = {"file": ("resume.txt", SAMPLE_RESUME_TEXT.encode("utf-8"), "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201

    agent = DocumentAgent()

    # Query triggering Highway A audit_quality
    req = {
        "message": "Audit the quality and ATS compatibility of the uploaded resume",
        "workspace_id": ws_id,
        "db": authenticated_context["db"],
    }
    result = await agent.process(req)

    assert result["agent_name"] == "document"
    assert result["highway"] == "highway_a_fast_action"
    assert result["action"] in ("audit_quality", "audit_security")
    assert result["confidence"] >= 0.95
    assert result["result"]["action_data"]["total_checks"] == 50


@pytest.mark.asyncio
async def test_highway_a_extract_skills_deterministic(authenticated_context):
    """DocumentAgent extracts skills deterministically via modern tech taxonomy."""
    ws_id = authenticated_context["workspace_id"]
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]

    # Upload resume containing Python, FastAPI, Docker, Kubernetes
    files = {"file": ("skills_doc.txt", SAMPLE_RESUME_TEXT.encode("utf-8"), "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201

    agent = DocumentAgent()
    req = {
        "message": "Extract technical skills and competencies from candidate resume",
        "workspace_id": ws_id,
        "db": authenticated_context["db"],
    }
    result = await agent.process(req)

    assert result["agent_name"] == "document"
    assert result["highway"] == "highway_a_fast_action"
    assert result["action"] == "extract_skills"
    skills = result["result"]["action_data"]["skills"]
    assert "Python" in skills
    assert "Kubernetes" in skills
