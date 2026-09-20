import pytest
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from pydantic import ValidationError

from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    AgentRequest,
    AgentResponse,
    SSEEvent,
    SSEEventType,
    ToolDefinition,
    ToolRiskLevel,
    ApprovalRequest,
    ApprovalStatus,
    ProvenanceRecord,
)


def test_agent_manifest_validation():
    manifest = AgentManifest(
        agent_id="career-agent",
        name="Career Agent",
        version="1.0.0",
        description="Career guide",
        category=AgentCategory.CAREER,
        autonomy_level=AutonomyLevel.FULL,
        tools=["search_jobs", "query_graph"],
    )
    assert manifest.agent_id == "career-agent"
    assert manifest.budget.max_steps_per_turn == 15


def test_agent_request_strictly_requires_non_null_user_id():
    workspace_id = uuid4()
    tenant_id = uuid4()
    session_id = uuid4()

    # Valid non-null IDs
    req = AgentRequest(
        workspace_id=workspace_id,
        tenant_id=tenant_id,
        user_id=uuid4(),
        session_id=session_id,
        agent_name="career-agent",
        input_text="Plan my career",
    )
    assert req.user_id is not None

    # Invalid: missing user_id must raise ValidationError (Remediates SEC-P0-02)
    with pytest.raises(ValidationError):
        AgentRequest(
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            user_id=None,  # type: ignore
            session_id=session_id,
            agent_name="career-agent",
            input_text="Plan my career",
        )


def test_approval_request_lifecycle():
    app_id = uuid4()
    ws_id = uuid4()
    t_id = uuid4()
    exp = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    app = ApprovalRequest(
        approval_id=app_id,
        workspace_id=ws_id,
        tenant_id=t_id,
        requested_by_agent="resume-agent",
        action_name="create_github_pr",
        parameters={"repo": "vaeloom/core", "branch": "fix"},
        summary="Create pull request",
        nonce="test-nonce-1234",
        expires_at=exp,
    )
    assert app.status == ApprovalStatus.PENDING
    assert app.parameters["repo"] == "vaeloom/core"


def test_provenance_hash_chain():
    p = ProvenanceRecord(
        session_id=uuid4(),
        agent_id="career-agent",
        action_type="tool_execution",
        parent_hash="genesis",
        payload_hash="payload-sha256",
    )
    h = p.compute_hash()
    assert len(h) == 64  # SHA-256 length
