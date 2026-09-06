"""Tests for Supervisor Dynamic Conditional Branching and Approval Pause/Resume."""
from __future__ import annotations

import uuid
import pytest

from api.orchestrator.supervisor import (
    _detect_pending_approvals,
    _evaluate_conditional_branches,
    resume_supervisor,
    run_supervisor,
)


def test_evaluate_conditional_branches_injects_rewrite_on_low_ats():
    layer_results = [
        {
            "agent_name": "ats",
            "result": {"ats_score": 62, "summary": "ATS score 62/100. Critical keywords missing."},
        }
    ]
    remaining = [["application"]]
    updated = _evaluate_conditional_branches(layer_results, remaining)
    # Must insert ["resume"] before application
    assert updated[0] == ["resume"]
    assert updated[1] == ["application"]


def test_evaluate_conditional_branches_no_change_on_good_ats():
    layer_results = [
        {
            "agent_name": "ats",
            "result": {"ats_score": 88, "summary": "ATS score 88/100. Excellent match."},
        }
    ]
    remaining = [["application"]]
    updated = _evaluate_conditional_branches(layer_results, remaining)
    assert updated == [["application"]]


def test_detect_pending_approvals():
    layer_results = [
        {
            "agent_name": "organization",
            "action": "request_approval",
            "result": {"summary": "Archive 10 outdated files"},
        },
        {
            "agent_name": "scheduler",
            "result": {
                "summary": "Meeting scheduled",
                "proposals": [
                    {"requires_approval": True, "approval_type": "calendar_create"}
                ],
            },
        },
    ]
    pending = _detect_pending_approvals(layer_results)
    assert len(pending) == 2
    assert pending[0]["agent_name"] == "organization"
    assert pending[1]["action_type"] == "calendar_create"


@pytest.mark.asyncio
async def test_supervisor_approval_pause_and_resume(monkeypatch):
    import api.orchestrator.supervisor as sup_mod

    req_id = f"test_sup_{uuid.uuid4()}"
    ws_id = str(uuid.uuid4())

    async def mock_detect_subtasks(msg):
        # 2 sequential subtasks
        return [("organization", 0.9), ("memory", 0.8)]

    def mock_build_dag(subtasks):
        return [["organization"], ["memory"]]

    step = 0

    async def mock_run_single(agent_name, message, workspace_id, request_id, context=None):
        nonlocal step
        step += 1
        if agent_name == "organization":
            return {
                "agent_name": "organization",
                "action": "request_approval",
                "result": {
                    "summary": "Requires user approval to reorganize files.",
                    "proposals": [{"requires_approval": True, "approval_type": "file_organize"}],
                },
            }
        return {
            "agent_name": "memory",
            "action": "suggest",
            "result": {"summary": "Updated memory with organization preference."},
        }

    async def mock_try_llm(*args, **kwargs):
        return None

    monkeypatch.setattr(sup_mod, "_detect_subtasks", mock_detect_subtasks)
    monkeypatch.setattr(sup_mod, "_build_dag", mock_build_dag)
    monkeypatch.setattr(sup_mod, "_try_llm_planner", mock_try_llm)
    monkeypatch.setattr(sup_mod, "_run_single_agent", mock_run_single)

    # 1. Run supervisor — should pause at layer 1 awaiting approval
    res = await run_supervisor(
        message="organize my files and update my memory",
        workspace_id=ws_id,
        request_id=req_id,
    )

    assert res["status"] == "paused_awaiting_approval"
    assert res["checkpoint_token"] == req_id
    assert len(res["pending_approvals"]) > 0

    # 2. Resume with user rejection — should abort cleanly
    rejection_res = await resume_supervisor(
        request_id=req_id,
        workspace_id=ws_id,
        approval_decision={"decision": "rejected", "reason": "Do not move files"},
    )
    assert rejection_res["status"] == "aborted"
    assert "Do not move files" in rejection_res["result"]["summary"]

    # Re-run supervisor to re-pause for approval test
    step = 0
    res2 = await run_supervisor(
        message="organize my files and update my memory",
        workspace_id=ws_id,
        request_id=req_id,
    )
    assert res2["status"] == "paused_awaiting_approval"

    # 3. Resume with user approval — should execute remaining layer (memory)
    approval_res = await resume_supervisor(
        request_id=req_id,
        workspace_id=ws_id,
        approval_decision={"decision": "approved", "note": "Approved by user"},
    )
    assert approval_res["status"] == "completed"
    assert "Updated memory with organization preference." in approval_res["result"]["summary"]
