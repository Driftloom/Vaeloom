import pytest
from unittest.mock import AsyncMock, patch
from api.orchestrator.supervisor import (
    run_supervisor,
    _detect_pending_approvals,
)

pytestmark = pytest.mark.asyncio


class TestSupervisor8020CognitiveFusion:
    async def test_supervisor_80_20_synthesis_when_multiple_agents_return_summaries(self):
        """When multiple specialist agents complete subtasks, System 2 (Gemma/LLM)
        synthesizes the 20% conversational narrative grounded in the 80% deterministic findings."""
        fake_summaries = [
            {"agent_name": "resume", "action": "suggest", "confidence": 0.9, "result": {"summary": "Tailored 3 experience bullets with metrics.", "proposals": []}, "status": "success"},
            {"agent_name": "ats", "action": "suggest", "confidence": 0.88, "result": {"summary": "ATS match score calculated at 88%. Missing: Docker, K8s.", "proposals": []}, "status": "success"},
        ]

        with patch("api.orchestrator.supervisor._detect_subtasks", new=AsyncMock(return_value=[("resume", 0.9), ("ats", 0.88)])), \
             patch("api.orchestrator.supervisor._build_dag", return_value=[["resume"], ["ats"]]), \
             patch("api.orchestrator.supervisor._run_single_agent", side_effect=fake_summaries), \
             patch("api.config.settings.llm_api_key", "mock-key"), \
             patch("api.services.llm_service.llm_service.generate_completion", new=AsyncMock(return_value={"content": "Unified synthesis: Resume optimized with metrics and 88% ATS match achieved."})):
            res = await run_supervisor(
                message="optimize my resume and check ats score",
                workspace_id="00000000-0000-0000-0000-000000000001",
                request_id="test-fused-req",
            )
            assert res["status"] == "success"
            assert res["cognitive_fusion"] == "fused_80_20_cognitive"
            assert "Unified synthesis" in res["result"]["summary"]
            assert len(res["result"]["raw_agent_summaries"]) == 2

    async def test_supervisor_system_1_destructive_action_triage_flags_dangerous_proposals(self):
        """Jev System 1 noul automatically scans proposal descriptions and enforces HITL approval for destructive actions."""
        layer_results = [
            {
                "agent_name": "organization",
                "action": "suggest",
                "result": {
                    "summary": "Identified orphaned files",
                    "proposals": [
                        {
                            "title": "Cleanup action",
                            "description": "delete all archived resumes and drop workspace tables",
                            "requires_approval": False,  # Agent forgot to flag it
                        }
                    ],
                },
            }
        ]
        pending = _detect_pending_approvals(layer_results)
        assert len(pending) == 1
        assert pending[0]["agent_name"] == "organization"
        assert pending[0]["proposal"]["requires_approval"] is True
        assert "System 1 flagged potentially destructive operation" in pending[0]["proposal"]["approval_reason"]

    async def test_supervisor_benign_proposals_pass_without_flagging(self):
        """Benign proposals without destructive keywords pass through without triggering approval gates."""
        layer_results = [
            {
                "agent_name": "resume",
                "action": "suggest",
                "result": {
                    "summary": "Tailored bullets",
                    "proposals": [
                        {
                            "title": "Read-only preview",
                            "description": "display preview of tailored bullet points in card",
                            "requires_approval": False,
                        }
                    ],
                },
            }
        ]
        pending = _detect_pending_approvals(layer_results)
        assert len(pending) == 0
