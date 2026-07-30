"""Targeted tests to push remaining 7 agent handlers to 100% coverage."""

import json
import pytest
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock

from backend.config import settings
from backend.orchestrator.base import BaseAgent, MemoryScopes, Tool


# =============================================================================
# 1. JobSearchAgent — fill coverage gaps
# =============================================================================
from backend.agents.job_search_agent.handler import JobSearchAgent


class TestJobSearchAgentRemaining:
    @pytest.mark.asyncio
    async def test_get_client_creates_client(self, monkeypatch):
        agent = JobSearchAgent()
        assert agent._client is None
        mock_cls = MagicMock()
        monkeypatch.setattr("backend.clients.job_board_client.JobBoardClient", lambda: mock_cls)
        client = await agent._get_client()
        assert client is mock_cls
        assert agent._client is mock_cls

    @pytest.mark.asyncio
    async def test_get_client_reuses_existing(self, monkeypatch):
        agent = JobSearchAgent()
        agent._client = "existing"
        client = await agent._get_client()
        assert client == "existing"

    @pytest.mark.asyncio
    async def test_search_with_configured_client_api_jobs(self, monkeypatch):
        agent = JobSearchAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.search_jobs.return_value = [
            {"id": "api_1", "title": "API Job", "company": "ApiCorp",
             "location": "Remote", "required_skills": ["python"]}
        ]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(agent, "_score_fit", AsyncMock(return_value=(0.9, "Great match")))
        result = await agent.search(
            keywords=["python"], user_skills=["python"],
            rejected_job_ids=[], location="Remote",
        )
        assert result["agent_name"] == "job_search"
        assert len(result["result"]["details"]) == 1
        assert result["result"]["details"][0]["job_id"] == "api_1"
        mock_client.search_jobs.assert_called_once_with(["python"], "Remote")

    @pytest.mark.asyncio
    async def test_search_configured_client_no_api_jobs(self, monkeypatch):
        agent = JobSearchAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.search_jobs.return_value = None
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(agent, "_score_fit", AsyncMock(return_value=(0.5, "OK")))
        result = await agent.search(
            keywords=["python"], user_skills=["python"],
            rejected_job_ids=[], location=None,
        )
        assert len(result["result"]["details"]) > 0

    @pytest.mark.asyncio
    async def test_search_llm_generate_path(self, monkeypatch):
        agent = JobSearchAgent()
        mock_client = AsyncMock()
        mock_client._configured = False
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        monkeypatch.setattr(agent, "_score_fit", AsyncMock(return_value=(0.5, "OK")))
        result = await agent.search(
            keywords=["python"], user_skills=["python"],
            rejected_job_ids=[], location=None,
        )
        assert len(result["result"]["details"]) > 0

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_success(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '[{"id":"job_x","title":"Test Role","company":"TestCo","location":"Remote","required_skills":["python"]}]', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], None)
        assert len(jobs) == 1
        assert jobs[0]["id"] == "job_x"

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_with_location(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '[{"id":"job_y","title":"Dev","company":"Co","location":"NYC","required_skills":[]}]', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], "NYC")
        assert len(jobs) == 1

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_empty_list_response(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": "[]", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], None)
        assert len(jobs) > 0
        assert jobs[0]["id"] == "job_1"

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_exception(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM down")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], None)
        assert len(jobs) > 0

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_invalid_json(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def bad_json(*a, **kw):
            return {"content": "not json", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", bad_json)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], None)
        assert len(jobs) > 0

    @pytest.mark.asyncio
    async def test_llm_generate_jobs_not_a_list(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def obj_json(*a, **kw):
            return {"content": '{"not":"a list"}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", obj_json)
        jobs = await agent._llm_generate_jobs(["python"], ["python"], None)
        assert len(jobs) > 0

    @pytest.mark.asyncio
    async def test_score_fit_llm_path(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '{"score":0.85,"reason":"Great fit"}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        score, reason = await agent._score_fit(
            {"title":"Dev","company":"Co","required_skills":["python"]},
            ["python","aws"], ["python"]
        )
        assert score == 0.85
        assert reason == "Great fit"

    @pytest.mark.asyncio
    async def test_score_fit_llm_exception(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        score, reason = await agent._score_fit(
            {"title":"Dev","company":"Co","required_skills":["python"]},
            ["python"], ["python"]
        )
        assert score > 0

    @pytest.mark.asyncio
    async def test_score_fit_llm_no_skills(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        score, reason = await agent._score_fit(
            {"title":"Dev","company":"Co","required_skills":["python"]},
            [], ["python"]
        )
        assert score == 0.0

    def test_keyword_score_fit_partial(self):
        agent = JobSearchAgent()
        score, reason = agent._keyword_score_fit(
            {"required_skills":["python","django","aws","react"]},
            ["python","django"], ["python"]
        )
        assert 0.5 <= score < 0.8
        assert "Partial match" in reason

    def test_keyword_score_fit_no_skills(self):
        agent = JobSearchAgent()
        score, reason = agent._keyword_score_fit(
            {"required_skills":[]}, [], []
        )
        assert score == 0.0

    def test_mock_jobs_directly(self):
        agent = JobSearchAgent()
        jobs = agent._mock_jobs()
        assert len(jobs) == 4


# =============================================================================
# 2. SchedulerAgent — fill coverage gaps
# =============================================================================
from backend.agents.scheduler_agent.handler import SchedulerAgent, ScheduleEvent


class TestSchedulerAgentRemaining:
    @pytest.mark.asyncio
    async def test_get_client_creates_client(self, monkeypatch):
        agent = SchedulerAgent()
        assert agent._client is None
        mock_cls = MagicMock()
        monkeypatch.setattr("backend.clients.calendar_client.CalendarClient", lambda: mock_cls)
        client = await agent._get_client()
        assert client is mock_cls
        assert agent._client is mock_cls

    @pytest.mark.asyncio
    async def test_get_client_reuses_existing(self, monkeypatch):
        agent = SchedulerAgent()
        agent._client = "existing"
        client = await agent._get_client()
        assert client == "existing"

    @pytest.mark.asyncio
    async def test_fetch_events(self, monkeypatch):
        agent = SchedulerAgent()
        mock_client = AsyncMock()
        mock_client.list_events.return_value = [{"id":"e1","title":"Test","start_time":"2024-01-01T10:00","end_time":"2024-01-01T11:00","source":"cal"}]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.fetch_events(days_ahead=7)
        assert len(result) == 1
        assert result[0]["title"] == "Test"
        mock_client.list_events.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_conflicts_empty_events_fetches(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "fetch_events", AsyncMock(return_value=[
            {"id":"e1","title":"A","start_time":"2024-01-01T10:00","end_time":"2024-01-01T11:00","source":"cal"},
        ]))
        monkeypatch.setattr(agent, "_times_overlap", AsyncMock(return_value=False))
        result = await agent.check_conflicts([])
        assert "No conflicts" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_check_conflicts_empty_events_fetch_empty(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "fetch_events", AsyncMock(return_value=None))
        result = await agent.check_conflicts([])
        assert "No conflicts" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_check_conflicts_multiple_overlaps(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "_times_overlap", AsyncMock(return_value=True))
        events = [
            {"id":"e1","title":"A","start_time":"10:00","end_time":"11:00","source":"cal"},
            {"id":"e2","title":"B","start_time":"10:30","end_time":"11:30","source":"cal"},
            {"id":"e3","title":"C","start_time":"11:00","end_time":"12:00","source":"cal"},
        ]
        result = await agent.check_conflicts(events)
        assert "conflict" in result["result"]["summary"].lower()
        assert len(result["result"]["questions"]) > 0

    @pytest.mark.asyncio
    async def test_create_event(self, monkeypatch):
        agent = SchedulerAgent()
        mock_client = AsyncMock()
        mock_client.create_event.return_value = {"id":"evt_new"}
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.create_event("Test", "2024-01-01T10:00", "2024-01-01T11:00", "desc")
        assert result == {"id":"evt_new"}
        mock_client.create_event.assert_called_once_with(
            summary="Test", start_time="2024-01-01T10:00",
            end_time="2024-01-01T11:00", description="desc"
        )

    @pytest.mark.asyncio
    async def test_times_overlap_missing_time(self):
        agent = SchedulerAgent()
        a = ScheduleEvent(event_id="e1", title="A", start_time="", end_time=None, source="cal")
        b = ScheduleEvent(event_id="e2", title="B", start_time="2024-01-01T10:00", end_time="2024-01-01T11:00", source="cal")
        assert await agent._times_overlap(a, b) is False

    @pytest.mark.asyncio
    async def test_times_overlap_llm_path(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '{"overlap":true,"reason":"Overlapping times"}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        a = ScheduleEvent(event_id="e1", title="A", start_time="10:00", end_time="11:00", source="cal")
        b = ScheduleEvent(event_id="e2", title="B", start_time="10:30", end_time="11:30", source="cal")
        assert await agent._times_overlap(a, b) is True

    @pytest.mark.asyncio
    async def test_times_overlap_llm_exception(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        a = ScheduleEvent(event_id="e1", title="A", start_time="10:00", end_time="11:00", source="cal")
        b = ScheduleEvent(event_id="e2", title="B", start_time="10:00", end_time="11:00", source="cal")
        assert await agent._times_overlap(a, b) is True

    @pytest.mark.asyncio
    async def test_times_overlap_different_times(self):
        agent = SchedulerAgent()
        a = ScheduleEvent(event_id="e1", title="A", start_time="10:00", end_time="11:00", source="cal")
        b = ScheduleEvent(event_id="e2", title="B", start_time="11:00", end_time="12:00", source="cal")
        assert await agent._times_overlap(a, b) is False

    @pytest.mark.asyncio
    async def test_check_conflicts_marks_both_events(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "_times_overlap", AsyncMock(return_value=True))
        events = [
            {"id":"e1","title":"A","start_time":"10:00","end_time":"11:00","source":"cal"},
            {"id":"e2","title":"B","start_time":"10:30","end_time":"11:30","source":"cal"},
        ]
        result = await agent.check_conflicts(events)
        details = {d["event_id"]: d for d in result["result"]["details"]}
        assert details["e1"]["has_conflict"] is True
        assert details["e1"]["conflict_with"] == "e2"
        assert details["e2"]["has_conflict"] is True
        assert details["e2"]["conflict_with"] == "e1"


# =============================================================================
# 3. OrganizationAgent — fill coverage gaps
# =============================================================================
from backend.agents.organization_agent.handler import OrganizationAgent


class TestOrganizationAgentRemaining:
    @pytest.mark.asyncio
    async def test_execute_empty_documents(self):
        agent = OrganizationAgent()
        result = await agent.execute([])
        assert result["action"] == "suggest"
        assert result["confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_classify_document_llm_path_valid(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '{"category":"Cover Letters","confidence":0.92}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        cat, conf = await agent._classify_document("xyz_123_data.pdf")
        assert cat == "Cover Letters"
        assert conf == 0.92

    @pytest.mark.asyncio
    async def test_classify_document_llm_invalid_category(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": '{"category":"Misc","confidence":0.8}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        cat, conf = await agent._classify_document("notes.txt")
        assert cat == "uncategorized"
        assert round(conf, 2) == 0.64

    @pytest.mark.asyncio
    async def test_classify_document_llm_exception(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("API error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        cat, conf = await agent._classify_document("random_file.txt")
        assert cat == "uncategorized"
        assert conf == 0.5

    @pytest.mark.asyncio
    async def test_classify_document_llm_invalid_json(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def bad_json(*a, **kw):
            return {"content": "not json", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", bad_json)
        cat, conf = await agent._classify_document("random.txt")
        assert cat == "uncategorized"
        assert conf == 0.5

    @pytest.mark.asyncio
    async def test_classify_document_no_llm_key_uncategorized(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        cat, conf = await agent._classify_document("random_notes.txt")
        assert cat == "uncategorized"
        assert conf == 0.5

    @pytest.mark.asyncio
    async def test_suggest_filename_full_cleanup(self):
        agent = OrganizationAgent()
        result = agent._suggest_filename("resume_v2_final_draft_copy_new.pdf", "Resumes")
        assert "v2" not in result
        assert "final" not in result
        assert "draft" not in result
        assert "copy" not in result
        assert "new" not in result

    def test_suggest_filename_empty_after_clean(self):
        agent = OrganizationAgent()
        result = agent._suggest_filename("_v1_final_", "Resumes")
        assert result == "_"

    def test_detect_version_chain_no_match(self):
        agent = OrganizationAgent()
        docs = [{"id":"d1","filename":"resume_v1.pdf"}]
        result = agent._detect_version_chain("cover_letter.pdf", docs)
        assert result is None

    @pytest.mark.asyncio
    async def test_classify_document_regex_hit(self):
        agent = OrganizationAgent()
        cat, conf = await agent._classify_document("resume_john.pdf")
        assert cat == "Resumes"
        assert conf == 0.9


# =============================================================================
# 4. ATSAgent — fill coverage gaps
# =============================================================================
from backend.agents.ats_agent.handler import ATSAgent


class TestATSAgentRemaining:
    @pytest.mark.asyncio
    async def test_score_llm_path(self, monkeypatch):
        agent = ATSAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": json.dumps({
                "overall_score": 0.85, "keyword_match_pct": 75.0,
                "format_compliance_pct": 90.0, "matched_keywords": ["python", "aws"],
                "missing_keywords": ["docker"], "recommendations": ["Add docker"]
            }), "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        result = await agent.score("Python AWS experience", "Python AWS Docker required")
        assert result["agent_name"] == "ats"
        assert "ATS Score: 85%" in result["result"]["summary"]
        assert len(result["result"]["details"]["matched_keywords"]) == 2
        assert len(result["result"]["details"]["missing_keywords"]) == 1

    @pytest.mark.asyncio
    async def test_score_llm_path_no_keywords_summary(self, monkeypatch):
        agent = ATSAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": json.dumps({
                "overall_score": 0.5, "keyword_match_pct": 0.0,
                "format_compliance_pct": 50.0, "matched_keywords": [],
                "missing_keywords": [], "recommendations": []
            }), "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        result = await agent.score("Some resume", "Some JD")
        assert "ATS Score: 50%" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_score_llm_exception_fallsback(self, monkeypatch):
        agent = ATSAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.score("Python AWS experience", "Python AWS Docker")
        assert result["agent_name"] == "ats"
        assert "ATS Score" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_score_llm_invalid_json_fallsback(self, monkeypatch):
        agent = ATSAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def bad_json(*a, **kw):
            return {"content": "not json", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", bad_json)
        result = await agent.score("Python AWS", "Python AWS Docker")
        assert result["agent_name"] == "ats"

    def test_keyword_score_no_missing(self):
        agent = ATSAgent()
        result = agent._keyword_score(
            "Python AWS Docker Kubernetes experience with agile methodology",
            "Python AWS Docker"
        )
        assert len(result["result"]["details"]["missing_keywords"]) == 0
        assert result["result"]["details"]["keyword_match_pct"] == 100.0

    def test_keyword_score_format_low_gives_recommendation(self):
        agent = ATSAgent()
        result = agent._keyword_score(
            "Python only",
            "Python AWS"
        )
        assert result["result"]["details"]["format_compliance_pct"] < 80
        assert any("Improve ATS format" in r for r in result["result"]["details"]["recommendations"])


# =============================================================================
# 5. ResearchAgent — fill coverage gaps
# =============================================================================
from backend.agents.research_agent.handler import ResearchAgent


class TestResearchAgentRemaining:
    @pytest.mark.asyncio
    async def test_research_company_with_aspects_llm(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def fake_llm(*a, **kw):
            return {"content": "Detailed research report", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_llm)
        result = await agent.research_company("Acme", ["products", "culture"])
        assert result["confidence"] == 0.85
        assert result["result"]["details"] == "Detailed research report"

    @pytest.mark.asyncio
    async def test_analyze_industry_llm_error_fallback(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("API down")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_industry("Tech")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_spot_trends_llm_error_fallback(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("API down")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.spot_trends("ML")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_analyze_industry_with_focus_llm(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.analyze_industry("Tech", None)
        assert result["confidence"] == 0.85

    def test_fallback_company(self):
        agent = ResearchAgent()
        result = agent._fallback_company("Acme")
        assert result["confidence"] == 0.5
        assert result["result"]["details"]["company"] == "Acme"

    def test_fallback_industry(self):
        agent = ResearchAgent()
        result = agent._fallback_industry("Tech")
        assert result["confidence"] == 0.5
        assert result["result"]["details"]["industry"] == "Tech"

    def test_fallback_trends(self):
        agent = ResearchAgent()
        result = agent._fallback_trends("ML")
        assert result["confidence"] == 0.5
        assert result["result"]["details"]["domain"] == "ML"


# =============================================================================
# 6. DriveAgent — fill coverage gaps
# =============================================================================
from backend.agents.drive_agent.handler import DriveAgent


class TestDriveAgentRemaining:
    @pytest.mark.asyncio
    async def test_get_client_creates_client(self, monkeypatch):
        agent = DriveAgent()
        assert agent._client is None
        mock_cls = MagicMock()
        monkeypatch.setattr("backend.clients.drive_client.DriveClient", lambda: mock_cls)
        client = await agent._get_client()
        assert client is mock_cls
        assert agent._client is mock_cls

    @pytest.mark.asyncio
    async def test_get_client_reuses_existing(self, monkeypatch):
        agent = DriveAgent()
        agent._client = "existing"
        client = await agent._get_client()
        assert client == "existing"

    @pytest.mark.asyncio
    async def test_process_files_none_fallback(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.list_files.return_value = None
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.process(None)
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_process_file_google_workspace_export(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.list_files.return_value = [
            {"id":"gdoc1","name":"My Doc","mimeType":"application/vnd.google-apps.document","modifiedTime":"2024-01-01","size":0}
        ]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(agent, "_process_file", AsyncMock(return_value={
            "file_id":"gdoc1","name":"My Doc","mime_type":"application/vnd.google-apps.document",
            "modified_time":"2024-01-01","size":0,"ingested":True
        }))
        result = await agent.process(None)
        assert result["result"]["summary"].startswith("Scanned 1 Drive files")

    @pytest.mark.asyncio
    async def test_process_file_content_none(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.list_files.return_value = [
            {"id":"f1","name":"doc.txt","mimeType":"text/plain","modifiedTime":"2024-01-01","size":100}
        ]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(agent, "_process_file", AsyncMock(return_value=None))
        result = await agent.process(None)
        assert result["result"]["summary"] == "Scanned 1 Drive files, ingested 0."

    @pytest.mark.asyncio
    async def test_process_file_google_workspace_path(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client.export_file = AsyncMock(return_value=b"exported content")
        mock_client.download_file = AsyncMock(return_value=None)
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent._process_file(mock_client, {
            "id":"gdoc","name":"Doc","mimeType":"application/vnd.google-apps.document","modifiedTime":"t","size":0
        })
        mock_client.export_file.assert_called_once_with("gdoc")
        mock_client.download_file.assert_not_called()

    @pytest.mark.asyncio
    async def test_process_file_download_path(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client.export_file = AsyncMock()
        mock_client.download_file = AsyncMock(return_value=b"downloaded content")
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent._process_file(mock_client, {
            "id":"f1","name":"doc.txt","mimeType":"text/plain","modifiedTime":"t","size":100
        })
        mock_client.download_file.assert_called_once_with("f1")
        mock_client.export_file.assert_not_called()

    @pytest.mark.asyncio
    async def test_process_file_content_none_logs_warning(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client.download_file = AsyncMock(return_value=None)
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent._process_file(mock_client, {
            "id":"f1","name":"doc.txt","mimeType":"text/plain","modifiedTime":"t","size":100
        })
        assert result is None

    @pytest.mark.asyncio
    async def test_ingest_success_path(self, monkeypatch):
        agent = DriveAgent()
        async def fake_pipeline(workspace_id, filename, content):
            return {"status": "success", "doc_id": "doc_1"}
        monkeypatch.setattr("backend.ingestion.pipeline.run_pipeline", fake_pipeline)
        result = await agent._ingest({"name":"doc.txt","id":"f1"}, b"content")
        assert result["status"] == "success"

    @pytest.mark.asyncio
    async def test_ingest_exception_path(self, monkeypatch):
        agent = DriveAgent()
        async def failing_pipeline(*a, **kw):
            raise Exception("Pipeline error")
        monkeypatch.setattr("backend.ingestion.pipeline.run_pipeline", failing_pipeline)
        result = await agent._ingest({"name":"doc.txt"}, b"content")
        assert result is None


# =============================================================================
# 7. ApplicationAgent — fill coverage gaps
# =============================================================================
from backend.agents.application_agent.handler import ApplicationAgent


class TestApplicationAgentRemaining:
    @pytest.mark.asyncio
    async def test_generate_cover_letter_llm_exception(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        letter = await agent._generate_cover_letter(
            {"id":"j1","title":"Engineer","company":"Acme"},
            {"name":"Bob","skills":["Python"]}
        )
        assert "Dear Hiring Manager" in letter
        assert "Bob" in letter

    @pytest.mark.asyncio
    async def test_generate_cover_letter_llm_empty_response(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from backend.services.llm_service import llm_service as llm_inst
        async def empty_llm(*a, **kw):
            return {"content": "", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", empty_llm)
        letter = await agent._generate_cover_letter(
            {"id":"j1","title":"Engineer","company":"Acme"},
            {"name":"Bob","skills":["Python"]}
        )
        assert "Dear Hiring Manager" in letter

    @pytest.mark.asyncio
    async def test_prepare_with_no_skills_profile(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.prepare(
            {"id":"j1","title":"Engineer","company":"Acme"},
            "resume", {"name":"Alice","skills":[]}, has_approval=False
        )
        assert result["action"] == "request_approval"
        assert "relevant skills" in result["result"]["details"]["cover_letter"]

    def test_template_cover_letter_empty_skills(self):
        agent = ApplicationAgent()
        letter = agent._template_cover_letter("Alice", "Engineer", "Acme", [])
        assert "relevant skills" in letter
