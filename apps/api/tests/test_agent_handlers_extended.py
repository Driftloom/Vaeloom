"""Enterprise-grade extended tests for all agent handlers with <60% coverage + memory_agent extraction."""

import json
import pytest
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool


# =============================================================================
# 1. QAAgent — 8 tests
# =============================================================================
from api.agents.qa_agent.handler import QAAgent, QAValidationResult


class TestQAAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = QAAgent()
        assert agent.mission == "Validate every agent output before delivery to the user"
        assert len(agent.tools) == 0
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback_returns_approved_with_warning(self):
        agent = QAAgent()
        result = await agent.fallback()
        assert result.decision == "approved"
        assert "warning" in result.issues[0]

    @pytest.mark.asyncio
    async def test_validate_dict_with_all_keys_approved(self):
        agent = QAAgent()
        output = {
            "agent_name": "test",
            "action": "suggest",
            "confidence": 0.85,
            "result": {"summary": "OK", "details": "good"},
        }
        result = await agent.validate(output)
        assert result.decision == "approved"
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_validate_missing_required_keys_rejected(self):
        agent = QAAgent()
        output = {"agent_name": "test", "action": "suggest"}
        result = await agent.validate(output)
        assert result.decision == "rejected"
        assert any("Missing required fields" in i for i in result.issues)

    @pytest.mark.asyncio
    async def test_validate_unsourced_claims_rejected(self):
        agent = QAAgent()
        output = {
            "agent_name": "test",
            "action": "suggest",
            "confidence": 0.9,
            "result": {"details": "Some claim [unsourced] here"},
        }
        result = await agent.validate(output)
        assert result.decision == "rejected"
        assert any("unsourced" in i for i in result.issues)

    @pytest.mark.asyncio
    async def test_validate_pii_leak_rejected(self):
        agent = QAAgent()
        output = {
            "agent_name": "test",
            "action": "suggest",
            "confidence": 0.9,
            "result": {"summary": "SSN: 123-45-6789 found"},
        }
        result = await agent.validate(output)
        assert result.decision == "rejected"
        assert any("PII" in i or "SSN" in i for i in result.issues)

    @pytest.mark.asyncio
    async def test_validate_harmful_content_rejected(self):
        agent = QAAgent()
        output = {
            "agent_name": "test",
            "action": "suggest",
            "confidence": 0.9,
            "result": {"summary": "Instructions on how to kill"},
        }
        result = await agent.validate(output)
        assert result.decision == "rejected"
        assert any("harmful" in i for i in result.issues)

    @pytest.mark.asyncio
    async def test_validate_low_confidence_rejected(self):
        agent = QAAgent()
        output = {
            "agent_name": "test",
            "action": "suggest",
            "confidence": 0.29,
            "result": {"summary": "OK"},
        }
        result = await agent.validate(output)
        assert result.decision == "rejected"
        assert any("confidence" in i for i in result.issues)




# =============================================================================
# 2. ResearchAgent — 7 tests
# =============================================================================
from api.agents.research_agent.handler import ResearchAgent


class TestResearchAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ResearchAgent()
        assert agent.mission == "Conduct web research on companies, industries, market trends"
        assert len(agent.tools) >= 3
        assert {t.name for t in agent.tools} >= {"research_company", "web_search"}
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ResearchAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "research"
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_research_company_no_llm_key(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.research_company("Acme Corp", ["products"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_research_company_llm_path(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.research_company("Acme Corp")
        assert result["confidence"] == 0.85
        assert "Research report on Acme Corp" == result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_research_company_llm_error_fallback(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from api.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("API down")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.research_company("Acme Corp")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_industry_no_llm_key(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.analyze_industry("Tech")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_industry_llm_path(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.analyze_industry("Tech", "AI")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_spot_trends_no_llm_key(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.spot_trends("Machine Learning")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_spot_trends_llm_path(self, monkeypatch):
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.spot_trends("ML", "3 months")
        assert result["confidence"] == 0.85
        assert "Trends in ML" in result["result"]["summary"]


# =============================================================================
# 3. CareerAgent — 7 tests
# =============================================================================
from api.agents.career_agent.handler import CareerAgent


class TestCareerAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = CareerAgent()
        assert agent.mission == "Guide users on career paths and skill development"
        assert len(agent.tools) >= 3
        assert {t.name for t in agent.tools} >= {"analyze_career_path", "web_search"}
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = CareerAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "career"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_analyze_career_path_no_llm_key(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.analyze_career_path("Engineer", ["Python"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_analyze_career_path_llm_path(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.analyze_career_path("Engineer", ["Python"], "Senior")
        assert result["confidence"] == 0.85
        assert "Career path analysis" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_identify_skill_gaps_llm_path(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.identify_skill_gaps(["Python"], "Data Scientist")
        assert result["confidence"] == 0.85
        assert "Skill gap analysis" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_identify_skill_gaps_no_llm_key(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.identify_skill_gaps(["Python"], "Data Scientist")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_recommend_courses_llm_path(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.recommend_courses(["Python", "ML"], budget="free")
        assert result["confidence"] == 0.85
        assert "course recommendations" in result["result"]["summary"].lower()

    @pytest.mark.asyncio
    async def test_recommend_courses_no_llm_key(self, monkeypatch):
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.recommend_courses(["Python"])
        assert result["confidence"] == 0.5


# =============================================================================
# 4. ApplicationAgent — 6 tests
# =============================================================================
from api.agents.application_agent.handler import ApplicationAgent


class TestApplicationAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ApplicationAgent()
        assert agent.mission == "Tailor documents and submit/hand-off applications"
        assert len(agent.tools) == 4
        assert agent.default_autonomy == "approval_gated"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ApplicationAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "application"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_prepare_without_approval(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        job = {"id": "j1", "title": "Engineer", "company": "Acme"}
        resume = "resume text"
        profile = {"name": "Alice", "skills": ["Python"]}
        result = await agent.prepare(job, resume, profile, has_approval=False)
        assert result["action"] == "request_approval"
        assert result["confidence"] == 0.9
        assert result["result"]["details"]["status"] == "drafted"

    @pytest.mark.asyncio
    async def test_prepare_with_approval(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        job = {"id": "j1", "title": "Engineer", "company": "Acme"}
        resume = "resume text"
        profile = {"name": "Alice", "skills": ["Python"]}
        result = await agent.prepare(job, resume, profile, has_approval=True)
        assert result["action"] == "execute"
        assert result["confidence"] == 0.95
        assert result["result"]["details"]["status"] == "submitted"

    @pytest.mark.asyncio
    async def test_prepare_llm_cover_letter(self, monkeypatch):
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        job = {"id": "j1", "title": "Engineer", "company": "Acme"}
        resume = "resume text"
        profile = {"name": "Alice", "skills": ["Python", "AWS"]}
        result = await agent.prepare(job, resume, profile, has_approval=False)
        assert result["result"]["details"]["status"] == "drafted"
        assert len(result["result"]["details"]["cover_letter"]) > 0

    @pytest.mark.asyncio
    async def test_template_cover_letter(self):
        agent = ApplicationAgent()
        letter = agent._template_cover_letter("Alice", "Engineer", "Acme", ["Python"])
        assert "Dear Hiring Manager" in letter
        assert "Alice" in letter
        assert "Engineer" in letter
        assert "Acme" in letter
        assert "Python" in letter


# =============================================================================
# 5. AnalyticsAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.analytics_agent.handler import AnalyticsAgent


class TestAnalyticsAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = AnalyticsAgent()
        assert agent.mission == "Provide insights on user activity, job search metrics, platform usage"
        assert agent.default_autonomy == "read_only"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = AnalyticsAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "analytics"

    @pytest.mark.asyncio
    async def test_get_activity_trends_no_llm_key(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.get_activity_trends(["applications"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_get_activity_trends_llm_path(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.get_activity_trends(["applications"], period="7d")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_analyze_applications_no_llm_key(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        apps = [{"role": "Dev", "company": "Co", "status": "applied"}]
        result = await agent.analyze_applications(apps)
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_applications_llm_path(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        apps = [{"role": "Dev", "company": "Co", "status": "applied"}]
        result = await agent.analyze_applications(apps)
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_generate_report_no_llm_key(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.generate_report("Monthly", ["users"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_generate_report_llm_path(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.generate_report("Monthly", ["users"])
        assert result["confidence"] == 0.85
        assert "report generated" in result["result"]["summary"]


# =============================================================================
# 6. ConnectorAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.connector_agent.handler import ConnectorAgent


class TestConnectorAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ConnectorAgent()
        assert agent.mission == "Help users discover and configure new integrations"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ConnectorAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "connector"

    @pytest.mark.asyncio
    async def test_discover_connectors_no_llm_key(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.discover_connectors(category="Email")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_discover_connectors_llm_path(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.discover_connectors(category="Email")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_guide_setup_no_llm_key(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.guide_setup("Gmail")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_guide_setup_llm_path(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.guide_setup("Gmail", {"scope": "read"})
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_monitor_health_no_llm_key(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        conns = [{"name": "Gmail", "status": "ok"}]
        result = await agent.monitor_health(conns)
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_monitor_health_llm_path(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        conns = [{"name": "Gmail", "status": "ok"}]
        result = await agent.monitor_health(conns)
        assert result["confidence"] == 0.85


# =============================================================================
# 7. PluginAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.plugin_agent.handler import PluginAgent


class TestPluginAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = PluginAgent()
        assert agent.mission == "Manage plugins, recommend extensions, handle updates"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = PluginAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "plugin"

    @pytest.mark.asyncio
    async def test_browse_plugins_no_llm_key(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.browse_plugins(category="Analytics")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_browse_plugins_llm_path(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.browse_plugins(category="Analytics", sort_by="downloads")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_check_compatibility_no_llm_key(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.check_compatibility("test-plugin", "1.0", {"os": "linux"})
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_check_compatibility_llm_path(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.check_compatibility("test", "1.0", {"os": "linux"})
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_manage_updates_no_llm_key(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.manage_updates([{"name": "p1", "version": "1.0"}])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_manage_updates_llm_path(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.manage_updates([{"name": "p1", "version": "1.0"}], action="update")
        assert result["confidence"] == 0.85


# =============================================================================
# 8. ReflectionAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.reflection_agent.handler import ReflectionAgent


class TestReflectionAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ReflectionAgent()
        assert agent.mission == "Weekly/monthly summaries and self-improvement insights"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ReflectionAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "reflection"

    @pytest.mark.asyncio
    async def test_generate_weekly_digest_no_llm_key(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.generate_weekly_digest([{"action": "applied", "date": "2024-01-01"}], goals=["Find job"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_generate_weekly_digest_llm_path(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.generate_weekly_digest([{"action": "applied", "date": "2024-01-01"}], goals=["Find job"])
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_monthly_review_no_llm_key(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.monthly_review({"applications": 5})
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_monthly_review_llm_path(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.monthly_review({"applications": 5}, focus_areas=["coding"])
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_track_goals_no_llm_key(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.track_goals([{"name": "Learn Python", "progress": 50}])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_track_goals_llm_path(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.track_goals([{"name": "Learn Python", "progress": 50}])
        assert result["confidence"] == 0.85


# =============================================================================
# 9. ReminderAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.reminder_agent.handler import ReminderAgent


class TestReminderAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ReminderAgent()
        assert agent.mission == "Manage deadlines, follow-ups, and task reminders"
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ReminderAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "reminder"

    @pytest.mark.asyncio
    async def test_check_deadlines_no_llm_key(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.check_deadlines([{"name": "Task1", "due_date": "2024-01-01"}])
        assert result["confidence"] == 0.5
        assert "Deadline check" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_check_deadlines_llm_path(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.check_deadlines([{"name": "Task1", "due_date": "2024-01-01", "priority": "high"}])
        assert result["confidence"] == 0.9
        assert "tasks analyzed" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_schedule_followup_no_llm_key(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.schedule_followup("Follow up on interview")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_schedule_followup_llm_path(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.schedule_followup("Follow up", proposed_time="tomorrow")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_sort_by_priority_no_llm_key(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.sort_by_priority([{"name": "Task1", "due_date": "2024-01-01"}])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_sort_by_priority_llm_path(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.sort_by_priority([{"name": "Task1", "due_date": "2024-01-01"}], criteria="deadline")
        assert result["confidence"] == 0.85


# =============================================================================
# 10. SecurityAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.security_agent.handler import SecurityAgent


class TestSecurityAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = SecurityAgent()
        assert agent.mission == "Monitor for suspicious activity, PII leaks, access anomalies"
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = SecurityAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "security"

    @pytest.mark.asyncio
    async def test_monitor_activity_no_llm_key(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.monitor_activity([{"action": "login", "user": "u1", "time": "now"}])
        assert result["confidence"] == 0.5
        assert "Monitored" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_monitor_activity_llm_path(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.monitor_activity([{"action": "login", "user": "u1", "time": "now"}])
        assert result["confidence"] == 0.9

    @pytest.mark.asyncio
    async def test_scan_for_pii_no_llm_key(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.scan_for_pii("Some content with email@test.com")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_scan_for_pii_llm_path(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.scan_for_pii("Some content", content_type="email")
        assert result["confidence"] == 0.9

    @pytest.mark.asyncio
    async def test_analyze_access_logs_no_llm_key(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        logs = [{"user": "u1", "resource": "file", "ip": "1.2.3.4", "time": "now"}]
        result = await agent.analyze_access_logs(logs)
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_access_logs_llm_path(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        logs = [{"user": "u1", "resource": "file", "ip": "1.2.3.4", "time": "now"}]
        result = await agent.analyze_access_logs(logs, baseline_period="7d")
        assert result["confidence"] == 0.9


# =============================================================================
# 11. CodingAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.coding_agent.handler import CodingAgent


class TestCodingAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = CodingAgent()
        assert agent.mission == "Assist with coding challenges, technical interview prep"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = CodingAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "coding"

    @pytest.mark.asyncio
    async def test_solve_challenge_no_llm_key(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.solve_challenge("Reverse a linked list")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_solve_challenge_llm_path(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.solve_challenge("Reverse a linked list", language="python")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_review_code_no_llm_key(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.review_code("def foo(): pass")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_review_code_llm_path(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.review_code("def foo(): pass", language="python", focus="style")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_generate_practice_no_llm_key(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.generate_practice(["arrays"], difficulty="medium")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_generate_practice_llm_path(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.generate_practice(["arrays", "strings"], difficulty="hard", language="python")
        assert result["confidence"] == 0.85
        assert "Practice problems" in result["result"]["summary"]


# =============================================================================
# 12. GitHubAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.github_agent.handler import GitHubAgent


class TestGitHubAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = GitHubAgent()
        assert agent.mission == "Analyze GitHub profiles and repositories for skill assessment"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = GitHubAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "github"

    @pytest.mark.asyncio
    async def test_analyze_profile_no_llm_key(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.analyze_profile("testuser")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_profile_llm_path(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.analyze_profile("testuser")
        assert result["confidence"] == 0.85
        assert "Profile analysis for testuser" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_get_repo_stats_no_llm_key(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.get_repo_stats("user/repo")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_get_repo_stats_llm_path(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.get_repo_stats("user/repo")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_assess_skills_no_llm_key(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.assess_skills("testuser")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_assess_skills_llm_path(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.assess_skills("testuser", target_role="Backend")
        assert result["confidence"] == 0.85


# =============================================================================
# 13. LearningAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.learning_agent.handler import LearningAgent


class TestLearningAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = LearningAgent()
        assert agent.mission == "Curate personalized learning resources"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = LearningAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "learning"

    @pytest.mark.asyncio
    async def test_search_courses_no_llm_key(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.search_courses("Python", level="beginner")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_search_courses_llm_path(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.search_courses("Python", level="beginner", format="video")
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_recommend_materials_no_llm_key(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.recommend_materials("Python")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_recommend_materials_llm_path(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.recommend_materials("Python", goal="Become expert", preferred_formats=["video"])
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_track_progress_no_llm_key(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.track_progress(["Course 1"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_track_progress_llm_path(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.track_progress(["Course 1"], current_goal="Master Python", time_spent_hours=10.0)
        assert result["confidence"] == 0.85


# =============================================================================
# 14. RecommendationAgent — 6 tests (existing file has 4)
# =============================================================================
from api.agents.recommendation_agent.handler import RecommendationAgent


class TestRecommendationAgentExtended:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = RecommendationAgent()
        assert agent.mission == "Suggest jobs, connections, content based on user profile"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = RecommendationAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "recommendation"

    @pytest.mark.asyncio
    async def test_match_jobs_no_llm_key(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.match_jobs({"skills": ["Python"]})
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_match_jobs_llm_path(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.match_jobs({"skills": ["Python"], "experience": "3 years"})
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_suggest_connections_no_llm_key(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.suggest_connections({"title": "Dev", "industry": "Tech"})
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_suggest_connections_llm_path(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.suggest_connections({"title": "Dev", "industry": "Tech"}, industry="AI", goals=["grow"])
        assert result["confidence"] == 0.85

    @pytest.mark.asyncio
    async def test_curate_content_no_llm_key(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "")
        result = await agent.curate_content(["Python"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_curate_content_llm_path(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.curate_content(["Python", "ML"], content_type="articles", depth="deep")
        assert result["confidence"] == 0.85
        assert "Curated content" in result["result"]["summary"]


# =============================================================================
# 15. Memory Agent Extraction — 6 tests
# =============================================================================
from api.agents.memory_agent.extraction import (
    extract,
    _mock_extract,
    ExtractedFacts,
    ExtractedEntity,
    ExtractedRelationship,
)


class TestMemoryExtraction:
    @pytest.mark.asyncio
    async def test_extract_empty_content(self):
        facts = await extract("", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 0
        assert len(facts.relationships) == 0

    @pytest.mark.asyncio
    async def test_extract_whitespace_only(self):
        facts = await extract("   ", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 0
        assert len(facts.relationships) == 0

    @pytest.mark.asyncio
    async def test_extract_no_llm_key_uses_mock(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "")
        facts = await extract("React is a UI library", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 1
        assert facts.entities[0].name == "React"
        assert facts.entities[0].entity_type == "Skill"

    @pytest.mark.asyncio
    async def test_extract_llm_path_parses_response(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from api.services.llm_service import llm_service as llm_inst
        async def fake_completion(*a, **kw):
            return {"content": '{"entities": [{"name": "Python", "entity_type": "Skill", "confidence": 0.95, "aliases": []}], "relationships": [{"from_entity": "Python", "to_entity": "Django", "relation_type": "used_in", "confidence": 0.9}]}', "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", fake_completion)
        facts = await extract("Python is used in Django", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 1
        assert facts.entities[0].name == "Python"
        assert facts.entities[0].entity_type == "Skill"
        assert len(facts.relationships) == 1
        assert facts.relationships[0].relation_type == "used_in"

    @pytest.mark.asyncio
    async def test_extract_llm_error_fallsback_to_mock(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from api.services.llm_service import llm_service as llm_inst
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        facts = await extract("React is great", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 1
        assert facts.entities[0].name == "React"

    @pytest.mark.asyncio
    async def test_extract_llm_invalid_json_fallsback(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        from api.services.llm_service import llm_service as llm_inst
        async def bad_json(*a, **kw):
            return {"content": "not valid json at all", "role": "assistant"}
        monkeypatch.setattr(llm_inst, "generate_completion", bad_json)
        facts = await extract("React is great", source_type="text", source_id="s1", workspace_id="w1")
        assert len(facts.entities) == 1
        assert facts.entities[0].name == "React"

    def test_mock_extract_react_returns_react_entity(self):
        facts = _mock_extract("I love React and React.js")
        assert len(facts.entities) == 1
        assert facts.entities[0].name == "React"
        assert facts.entities[0].entity_type == "Skill"
        assert facts.entities[0].confidence == 0.9
        assert "React.js" in facts.entities[0].aliases

    def test_mock_extract_other_content_returns_empty(self):
        facts = _mock_extract("Some random text about Angular and Vue")
        assert len(facts.entities) == 0
        assert len(facts.relationships) == 0


# =============================================================================
# 16. QAAgent — error path (cover line 41: non-dict input)
# =============================================================================
class TestQAAgentErrorPath:
    @pytest.mark.asyncio
    async def test_validate_non_dict_rejected(self):
        agent = QAAgent()
        with pytest.raises(AttributeError):
            await agent.validate("not a dict")


# =============================================================================
# 17. CodingAgent — LLM error paths (cover lines 68-70, 96-98, 124-126)
# =============================================================================
class TestCodingAgentErrorPath:
    @pytest.mark.asyncio
    async def test_solve_challenge_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.solve_challenge("Reverse a linked list")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_review_code_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.review_code("def foo(): pass")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_generate_practice_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.generate_practice(["arrays"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 18. GitHubAgent — LLM error paths (cover lines 63-65, 89-91, 116-118)
# =============================================================================
class TestGitHubAgentErrorPath:
    @pytest.mark.asyncio
    async def test_analyze_profile_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_profile("testuser")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_get_repo_stats_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.get_repo_stats("user/repo")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_assess_skills_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.assess_skills("testuser")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 19. LearningAgent — LLM error paths (cover lines 68-70, 96-98, 124-126)
# =============================================================================
class TestLearningAgentErrorPath:
    @pytest.mark.asyncio
    async def test_search_courses_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.search_courses("Python")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_recommend_materials_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.recommend_materials("Python")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_track_progress_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.track_progress(["Course 1"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 20. RecommendationAgent — LLM error paths (cover lines 68-70, 96-98, 124-126)
# =============================================================================
class TestRecommendationAgentErrorPath:
    @pytest.mark.asyncio
    async def test_match_jobs_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.match_jobs({"skills": ["Python"]})
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_suggest_connections_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.suggest_connections({"title": "Dev"})
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_curate_content_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.curate_content(["Python"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 21. AnalyticsAgent — LLM error paths (cover lines 68-70, 95-97, 123-125)
# =============================================================================
class TestAnalyticsAgentErrorPath:
    @pytest.mark.asyncio
    async def test_get_activity_trends_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.get_activity_trends(["applications"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_analyze_applications_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_applications([{"role": "Dev", "company": "Co"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_generate_report_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.generate_report("Monthly", ["users"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 22. ConnectorAgent — LLM error paths (cover lines 67-69, 94-96, 121-123)
# =============================================================================
class TestConnectorAgentErrorPath:
    @pytest.mark.asyncio
    async def test_discover_connectors_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.discover_connectors()
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_guide_setup_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.guide_setup("Gmail")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_monitor_health_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.monitor_health([{"name": "Gmail", "status": "ok"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 23. PluginAgent — LLM error paths (cover lines 68-70, 96-98, 124-126)
# =============================================================================
class TestPluginAgentErrorPath:
    @pytest.mark.asyncio
    async def test_browse_plugins_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.browse_plugins()
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_check_compatibility_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.check_compatibility("test-plugin", "1.0", {"os": "linux"})
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_manage_updates_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.manage_updates([{"name": "p1", "version": "1.0"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 24. CareerAgent — LLM error paths (cover lines 72-74, 99-101, 127-129)
# =============================================================================
class TestCareerAgentErrorPath:
    @pytest.mark.asyncio
    async def test_analyze_career_path_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_career_path("Engineer", ["Python"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_identify_skill_gaps_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.identify_skill_gaps(["Python"], "Data Scientist")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_recommend_courses_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = CareerAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.recommend_courses(["Python"])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 25. ReflectionAgent — LLM error paths (cover lines 68-70, 95-97, 122-124)
# =============================================================================
class TestReflectionAgentErrorPath:
    @pytest.mark.asyncio
    async def test_generate_weekly_digest_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.generate_weekly_digest([{"action": "applied", "date": "2024-01-01"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_monthly_review_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.monthly_review({"applications": 5})
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_track_goals_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.track_goals([{"name": "Learn Python", "progress": 50}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 26. ReminderAgent — LLM error paths (cover lines 67-69, 95-97, 123-125)
# =============================================================================
class TestReminderAgentErrorPath:
    @pytest.mark.asyncio
    async def test_check_deadlines_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.check_deadlines([{"name": "Task1", "due_date": "2024-01-01"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_schedule_followup_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.schedule_followup("Follow up on interview")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_sort_by_priority_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.sort_by_priority([{"name": "Task1", "due_date": "2024-01-01"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 27. SecurityAgent — LLM error paths (cover lines 65-67, 92-94, 120-122)
# =============================================================================
class TestSecurityAgentErrorPath:
    @pytest.mark.asyncio
    async def test_monitor_activity_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.monitor_activity([{"action": "login", "user": "u1", "time": "now"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_scan_for_pii_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.scan_for_pii("content")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_analyze_access_logs_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_access_logs([{"user": "u1", "resource": "file", "ip": "1.2.3.4", "time": "now"}])
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 28. ResearchAgent — LLM error paths (cover lines 94-96, 121-123)
# =============================================================================
from api.agents.research_agent.handler import ResearchAgent


class TestResearchAgentErrorPath:
    @pytest.mark.asyncio
    async def test_research_company_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.research_company("Acme Corp")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_analyze_industry_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.analyze_industry("Tech")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]

    @pytest.mark.asyncio
    async def test_spot_trends_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ResearchAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        result = await agent.spot_trends("ML")
        assert result["confidence"] == 0.5
        assert "LLM API key" in result["result"]["details"]["note"]


# =============================================================================
# 29. ApplicationAgent — LLM error path (cover lines 112-115)
# =============================================================================
from api.agents.application_agent.handler import ApplicationAgent


class TestApplicationAgentErrorPath:
    @pytest.mark.asyncio
    async def test_prepare_cover_letter_llm_error(self, monkeypatch):
        from api.services.llm_service import llm_service as llm_inst
        agent = ApplicationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def failing_llm(*a, **kw):
            raise Exception("LLM error")
        monkeypatch.setattr(llm_inst, "generate_completion", failing_llm)
        job = {"id": "j1", "title": "Engineer", "company": "Acme"}
        resume = "resume text"
        profile = {"name": "Alice", "skills": ["Python"]}
        result = await agent.prepare(job, resume, profile, has_approval=False)
        assert result["result"]["details"]["status"] == "drafted"
        assert "Dear Hiring Manager" in result["result"]["details"]["cover_letter"]
