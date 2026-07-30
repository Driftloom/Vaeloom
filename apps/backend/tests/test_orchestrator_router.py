import pytest
from unittest.mock import AsyncMock

pytestmark = pytest.mark.asyncio


class TestClassifyIntent:
    async def test_empty_message_returns_memory_fallback(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("")
        assert agent == "memory"
        assert confidence == 0.5

    async def test_unmatched_message_returns_memory_fallback(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("xyzzy qwerty asdfgh")
        assert agent == "memory"
        assert confidence == 0.5

    async def test_organize_files_returns_organization(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("organize my files")
        assert agent == "organization"
        assert confidence > 0

    async def test_resume_ats_score_returns_ats(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("resume ats score")
        assert agent == "ats"
        assert confidence > 0

    async def test_build_resume_returns_resume(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("build my resume")
        assert agent == "resume"

    async def test_search_jobs_returns_job_search(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("search jobs")
        assert agent == "job_search"

    async def test_apply_for_job_returns_application(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("apply for job")
        assert agent == "application"

    async def test_check_email_returns_gmail(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("check my email")
        assert agent == "gmail"

    async def test_schedule_meeting_returns_scheduler(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("schedule a meeting")
        assert agent == "scheduler"

    async def test_extract_memory_returns_memory(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("extract memory")
        assert agent == "memory"

    async def test_career_path_skill_course_returns_learning(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("career path skill course")
        assert agent == "learning"

    async def test_career_path_returns_career(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("career path")
        assert agent == "career"

    async def test_research_company_industry_returns_research(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("research company industry")
        assert agent == "research"

    async def test_github_profile_returns_github(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("github profile")
        assert agent == "github"

    async def test_coding_challenge_returns_coding(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("coding challenge")
        assert agent == "coding"

    async def test_reminder_deadline_returns_reminder(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("remind me deadline")
        assert agent == "reminder"

    async def test_analytics_report_returns_analytics(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("analytics report")
        assert agent == "analytics"

    async def test_curate_similar_returns_recommendation(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("curate similar matches")
        assert agent == "recommendation"

    async def test_weekly_summary_returns_reflection(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("weekly summary")
        assert agent == "reflection"

    async def test_security_monitor_returns_security(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("security monitor")
        assert agent == "security"

    async def test_connector_setup_returns_connector(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("connector setup")
        assert agent == "connector"

    async def test_drive_sync_returns_plugin(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("drive sync")
        assert agent == "plugin"

    async def test_multiple_keywords_increase_confidence_proportionally(self):
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("organize file rename folder")
        assert confidence == 1.0

    async def test_category_fallthrough_returns_first_agent(self, monkeypatch):
        from backend.orchestrator.router import classify_intent, CATEGORY_AGENT_MAP
        monkeypatch.setitem(CATEGORY_AGENT_MAP, "test_multi", ["agent_a", "agent_b"])
        monkeypatch.setattr("backend.orchestrator.router.CATEGORY_KEYWORDS", {
            "test_multi": ["customkeyword"],
        })
        from backend.orchestrator.router import classify_intent
        agent, confidence = await classify_intent("customkeyword")
        assert agent == "agent_a"
        assert confidence > 0


class TestHandle:
    async def test_low_confidence_returns_ask_clarification(self, monkeypatch):
        from backend.orchestrator.router import handle, UserRequest
        async def fake_classify(message):
            return "some_agent", 0.5
        monkeypatch.setattr("backend.orchestrator.router.classify_intent", fake_classify)
        request = UserRequest("r1", "hello", "ws1")
        result = await handle(request)
        assert result["agent_name"] == "orchestrator"
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.5

    async def test_unknown_agent_returns_error(self, monkeypatch):
        from backend.orchestrator.router import handle, UserRequest
        async def fake_classify(message):
            return "nonexistent_agent", 0.9
        monkeypatch.setattr("backend.orchestrator.router.classify_intent", fake_classify)
        request = UserRequest("r1", "organize files", "ws1")
        result = await handle(request)
        assert result["agent_name"] == "orchestrator"
        assert result["action"] == "error"
        assert result["confidence"] == 0.0

    async def test_successful_path_qa_approved(self, monkeypatch):
        from backend.orchestrator.router import handle, UserRequest, AGENT_REGISTRY, run_agent_loop, QAAgent
        from backend.orchestrator.loop import AgentResponse
        from backend.agents.qa_agent.handler import QAValidationResult

        class MockAgent:
            pass

        async def fake_classify(message):
            return "test_agent", 0.85

        async def fake_loop(request):
            return AgentResponse(status="success", final_result="Task complete")

        async def fake_validate(self, output):
            return QAValidationResult(decision="approved", issues=[])

        monkeypatch.setattr("backend.orchestrator.router.classify_intent", fake_classify)
        monkeypatch.setitem(AGENT_REGISTRY, "test_agent", MockAgent)
        monkeypatch.setattr("backend.orchestrator.router.run_agent_loop", fake_loop)
        monkeypatch.setattr(QAAgent, "validate", fake_validate)

        request = UserRequest("r1", "organize files", "ws1")
        result = await handle(request)
        assert result["agent_name"] == "test_agent"
        assert result["action"] == "suggest"
        assert result["result"]["summary"] == "Task complete"
        assert "qa_flag" not in result

    async def test_qa_rejection_after_3_retries_returns_best_effort(self, monkeypatch):
        from backend.orchestrator.router import handle, UserRequest, AGENT_REGISTRY, run_agent_loop, QAAgent
        from backend.orchestrator.loop import AgentResponse
        from backend.agents.qa_agent.handler import QAValidationResult

        class MockAgent:
            pass

        async def fake_classify(message):
            return "test_agent", 0.85

        async def fake_loop(request):
            return AgentResponse(status="success", final_result="Task complete")

        async def fake_validate(self, output):
            return QAValidationResult(decision="rejected", issues=["poor quality"])

        monkeypatch.setattr("backend.orchestrator.router.classify_intent", fake_classify)
        monkeypatch.setitem(AGENT_REGISTRY, "test_agent", MockAgent)
        monkeypatch.setattr("backend.orchestrator.router.run_agent_loop", fake_loop)
        monkeypatch.setattr(QAAgent, "validate", fake_validate)

        request = UserRequest("r1", "organize files", "ws1")
        result = await handle(request)
        assert result["agent_name"] == "test_agent"
        assert result["qa_flag"] == "best_effort_after_retries"

    async def test_qa_approval_on_retry(self, monkeypatch):
        from backend.orchestrator.router import handle, UserRequest, AGENT_REGISTRY, run_agent_loop, QAAgent
        from backend.orchestrator.loop import AgentResponse
        from backend.agents.qa_agent.handler import QAValidationResult

        class MockAgent:
            pass

        async def fake_classify(message):
            return "test_agent", 0.85

        async def fake_loop(request):
            return AgentResponse(status="success", final_result="Task complete")

        call_count = 0
        async def fake_validate(self, output):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return QAValidationResult(decision="rejected", issues=["retry needed"])
            return QAValidationResult(decision="approved", issues=[])

        monkeypatch.setattr("backend.orchestrator.router.classify_intent", fake_classify)
        monkeypatch.setitem(AGENT_REGISTRY, "test_agent", MockAgent)
        monkeypatch.setattr("backend.orchestrator.router.run_agent_loop", fake_loop)
        monkeypatch.setattr(QAAgent, "validate", fake_validate)

        request = UserRequest("r1", "organize files", "ws1")
        result = await handle(request)
        assert result["action"] == "suggest"
        assert result["result"]["summary"] == "Task complete"
        assert "qa_flag" not in result
