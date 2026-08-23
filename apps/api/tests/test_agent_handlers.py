"""Enterprise-grade unit tests for ALL agent handlers (18 agents)."""

import json
import pytest
from datetime import datetime, timezone
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool


# =============================================================================
# 1. GmailAgent  — 16 tests
# =============================================================================
from api.agents.gmail_agent.handler import GmailAgent, ClassifiedEmail


class TestGmailAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = GmailAgent()
        assert agent.mission == "Classify mail, extract deadlines/tasks, draft responses (never send)"
        assert len(agent.tools) == 2
        assert agent.default_autonomy == "suggest"
        assert agent.memory_scopes.read_types == ["communications"]
        assert agent.memory_scopes.write_types == ["schedule_events", "episodic"]

    @pytest.mark.asyncio
    async def test_get_client_initializes_when_none(self, monkeypatch):
        fake_client = MagicMock()
        monkeypatch.setattr("api.clients.gmail_client.GmailClient", lambda: fake_client)
        agent = GmailAgent()
        agent._client = None
        client = await agent._get_client()
        assert client is fake_client
        assert agent._client is fake_client

    @pytest.mark.asyncio
    async def test_get_client_returns_existing(self, monkeypatch):
        fake_client = MagicMock()
        agent = GmailAgent()
        agent._client = fake_client
        client = await agent._get_client()
        assert client is fake_client

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = GmailAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "gmail"
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.0
        assert "access to your Gmail" in result["result"]["summary"]

    @pytest.mark.parametrize("email,expected_cls,expected_hp", [
        ({"id":"1","subject":"Interview","sender":"a@b.com","body":"Your interview is tomorrow"}, "urgent", True),
        ({"id":"2","subject":"Deadline today","sender":"a@b.com","body":"Submit by EOD"}, "urgent", True),
        ({"id":"3","subject":"URGENT","sender":"a@b.com","body":"Please respond immediately"}, "urgent", True),
        ({"id":"4","subject":"Immediate action","sender":"a@b.com","body":"This requires immediate attention"}, "urgent", True),
        ({"id":"5","subject":"Job Offer","sender":"a@b.com","body":"We are pleased to offer"}, "important", False),
        ({"id":"6","subject":"Project deadline","sender":"a@b.com","body":"The deadline is Friday"}, "important", False),
        ({"id":"7","subject":"Follow up","sender":"a@b.com","body":"Following up on our conversation"}, "important", False),
        ({"id":"8","subject":"Action Required","sender":"a@b.com","body":"Please take action"}, "important", False),
        ({"id":"9","subject":"Newsletter","sender":"a@b.com","body":"Monthly newsletter unsubscribe"}, "low_priority", False),
        ({"id":"10","subject":"Promotion","sender":"a@b.com","body":"Special promotion just for you"}, "low_priority", False),
        ({"id":"11","subject":"Meeting Notes","sender":"a@b.com","body":"Here are the notes"}, "informational", False),
    ])
    def test_keyword_classify(self, email, expected_cls, expected_hp):
        agent = GmailAgent()
        result = agent._keyword_classify(email)
        assert result.classification == expected_cls
        assert result.is_high_priority == expected_hp

    @pytest.mark.parametrize("body,expected", [
        ("Submit your report tomorrow", "tomorrow"),
        ("The deadline is approaching", "deadline_detected"),
        ("Just checking in", None),
    ])
    def test_extract_deadline_keyword(self, body, expected):
        agent = GmailAgent()
        email = {"id":"1","subject":"Test","sender":"a@b.com","body": body}
        assert agent._extract_deadline_keyword(email) == expected

    @pytest.mark.asyncio
    async def test_classify_llm_path(self, monkeypatch):
        agent = GmailAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        async def fake_llm(*args, **kwargs):
            return {"content": '{"classification":"important","is_high_priority":false,"deadline":"next week"}', "role": "assistant"}
        monkeypatch.setattr("api.agents.gmail_agent.handler.llm_service.generate_completion", fake_llm)
        email = {"id":"10","subject":"Review","sender":"a@b.com","body":"Please review"}
        result = await agent._classify(email)
        assert result.classification == "important"
        assert result.is_high_priority is False
        assert result.extracted_deadline == "next week"

    @pytest.mark.asyncio
    async def test_classify_llm_fallback_on_exception(self, monkeypatch):
        agent = GmailAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        email = {"id":"11","subject":"Casual Note","sender":"a@b.com","body":"Just checking in"}
        result = await agent._classify(email)
        assert result.classification == "informational"

    @pytest.mark.asyncio
    async def test_classify_emails_with_data(self):
        agent = GmailAgent()
        emails = [
            {"id":"1","subject":"Hello","sender":"a@b.com","body":"Hi"},
            {"id":"2","subject":"Urgent","sender":"b@c.com","body":"Immediate action needed"},
        ]
        result = await agent.classify_emails(emails)
        assert result["result"]["summary"] == "Classified 2 emails: 1 high-priority."

    @pytest.mark.asyncio
    async def test_classify_emails_empty_fetch_api(self, monkeypatch):
        agent = GmailAgent()
        async def fake_fetch(*a,**kw):
            return [{"id":"1","subject":"Test","sender":"a@b.com","body":"test"}]
        monkeypatch.setattr(agent, "fetch_emails", fake_fetch)
        result = await agent.classify_emails([])
        assert "Classified 1 emails" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_classify_emails_empty_fetch_empty(self, monkeypatch):
        agent = GmailAgent()
        async def fake_fetch(*a,**kw):
            return None
        monkeypatch.setattr(agent, "fetch_emails", fake_fetch)
        result = await agent.classify_emails([])
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.0

    @pytest.mark.asyncio
    async def test_classify_emails_push_high_priority(self):
        agent = GmailAgent()
        emails = [{"id":"1","subject":"Urgent: Interview Tomorrow","sender":"hr@co.com","body":"Interview scheduled"}]
        result = await agent.classify_emails(emails, trigger="push")
        assert result["metadata"]["trigger"] == "push"
        assert result["metadata"]["high_priority_count"] == 1

    @pytest.mark.asyncio
    async def test_classify_emails_push_no_high_priority(self):
        agent = GmailAgent()
        emails = [{"id":"1","subject":"Meeting Notes","sender":"a@b.com","body":"Notes"}]
        result = await agent.classify_emails(emails, trigger="push")
        assert result["metadata"]["trigger"] == "push"
        assert "high_priority_count" not in result["metadata"]

    @pytest.mark.asyncio
    async def test_draft_response(self, monkeypatch):
        agent = GmailAgent()
        mock_client = AsyncMock()
        mock_client.create_draft.return_value = {"id":"draft_1"}
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.draft_response({"sender":"a@b.com","subject":"Hello"},"Thanks")
        assert result == {"id":"draft_1"}
        mock_client.create_draft.assert_called_once_with(to="a@b.com", subject="Re: Hello", body="Thanks")

    @pytest.mark.asyncio
    async def test_fetch_emails(self, monkeypatch):
        agent = GmailAgent()
        mock_client = AsyncMock()
        mock_client.fetch_emails.return_value = [{"id":"1"}]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.fetch_emails(query="test", max_results=10)
        assert result == [{"id":"1"}]
        mock_client.fetch_emails.assert_called_once_with(max_results=10, query="test")

    @pytest.mark.asyncio
    async def test_classify_no_llm_key(self):
        agent = GmailAgent()
        result = await agent._classify({"id":"1","subject":"Urgent","sender":"a@b.com","body":"Immediate"})
        assert result.classification == "urgent"
        assert result.is_high_priority is True


# =============================================================================
# 2. DriveAgent  — 4 tests
# =============================================================================
from api.agents.drive_agent.handler import DriveAgent


class TestDriveAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = DriveAgent()
        assert agent.mission == "Sync Google Drive files, download new/changed content, and ingest into the knowledge base"
        assert len(agent.tools) == 3
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = DriveAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "drive"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_process_unconfigured(self, monkeypatch):
        agent = DriveAgent()
        mock_client = MagicMock()
        mock_client._configured = False
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        result = await agent.process(None)
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_process_with_files(self, monkeypatch):
        agent = DriveAgent()
        mock_client = AsyncMock()
        mock_client._configured = True
        mock_client.list_files.return_value = [
            {"id":"f1","name":"doc.txt","mimeType":"text/plain","modifiedTime":"2024-01-01","size":100}
        ]
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=mock_client))
        monkeypatch.setattr(agent, "_process_file", AsyncMock(return_value={
            "file_id":"f1","name":"doc.txt","mime_type":"text/plain",
            "modified_time":"2024-01-01","size":100,"ingested":True
        }))
        result = await agent.process(None)
        assert result["agent_name"] == "drive"
        assert "Scanned 1 Drive files" in result["result"]["summary"]


# =============================================================================
# 3. JobSearchAgent  — 5 tests
# =============================================================================
from api.agents.job_search_agent.handler import JobSearchAgent


class TestJobSearchAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = JobSearchAgent()
        assert agent.mission == "Search connected platforms, rank against memory, return shortlist"
        assert len(agent.tools) == 6
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = JobSearchAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "job_search"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_search_filters_rejected_jobs(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=MagicMock(_configured=False)))
        result = await agent.search(
            keywords=["python"], user_skills=["python"],
            rejected_job_ids=["job_rejected"], location=None,
        )
        assert result["agent_name"] == "job_search"
        details = result["result"]["details"]
        job_ids = [j["job_id"] for j in details]
        assert "job_rejected" not in job_ids

    @pytest.mark.asyncio
    async def test_search_mock_jobs(self, monkeypatch):
        agent = JobSearchAgent()
        monkeypatch.setattr(agent, "_get_client", AsyncMock(return_value=MagicMock(_configured=False)))
        result = await agent.search(
            keywords=["python"], user_skills=["python"],
            rejected_job_ids=[], location=None,
        )
        assert result["agent_name"] == "job_search"
        assert len(result["result"]["details"]) > 0

    def test_keyword_score_fit_strong(self):
        agent = JobSearchAgent()
        score, reason = agent._keyword_score_fit(
            {"required_skills":["python","django","aws"]},
            ["python","django","aws","react"],
            ["python"]
        )
        assert score >= 0.8
        assert "Strong match" in reason

    def test_keyword_score_fit_weak(self):
        agent = JobSearchAgent()
        score, reason = agent._keyword_score_fit(
            {"required_skills":["python","django","aws","kubernetes"]},
            ["excel"],
            ["python"]
        )
        assert score <= 0.3
        assert "Weak match" in reason


# =============================================================================
# 4. ATSAgent  — 5 tests
# =============================================================================
from api.agents.ats_agent.handler import ATSAgent


class TestATSAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ATSAgent()
        assert agent.mission == "Score resumes against job descriptions (read-only analysis)"
        assert agent.default_autonomy == "read_only"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ATSAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "ats"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_score_empty_input(self):
        agent = ATSAgent()
        result = await agent.score("", "job desc")
        assert result["action"] == "ask_clarification"
        result = await agent.score("resume", "")
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_score_keyword_path(self):
        agent = ATSAgent()
        result = await agent.score(
            "Experienced Python developer with AWS and Docker skills",
            "Looking for Python, AWS, Docker, Kubernetes expert"
        )
        assert result["agent_name"] == "ats"
        assert result["result"]["summary"].startswith("ATS Score:")

    def test_extract_keywords_keyword(self):
        agent = ATSAgent()
        result = agent._extract_keywords_keyword("Python, AWS, Docker, and agile experience")
        assert "python" in result
        assert "aws" in result
        assert "docker" in result
        assert "agile" in result

    def test_check_format_compliance(self):
        agent = ATSAgent()
        score = agent._check_format_compliance("Experience at Acme\nEducation at MIT\nSkills: Python")
        assert score == 1.0
        score = agent._check_format_compliance("Random text without headers")
        assert score == 0.0


# =============================================================================
# 5. ResumeAgent  — 5 tests
# =============================================================================
from api.agents.resume_agent.handler import ResumeAgent


class TestResumeAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = ResumeAgent()
        assert agent.mission == "Build, maintain, and optimize the master resume"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = ResumeAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "resume"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_execute_missing_fields(self):
        agent = ResumeAgent()
        result = await agent.execute(profile={"name":"John"})
        assert result["agent_name"] == "resume"
        assert result["action"] == "ask_clarification"
        assert "missing" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_execute_with_profile(self, monkeypatch):
        agent = ResumeAgent()
        profile = {
            "name": "John", "email": "john@test.com",
            "education": [{"degree":"BS","institution":"MIT"}],
            "experience": [{"role":"Dev","company":"Co","achievements":["Built feature"]}],
            "skills": ["Python"]
        }
        monkeypatch.setattr(agent, "_llm_generate_bullet", AsyncMock(return_value="Built feature at Co as Dev"))
        result = await agent.execute(profile=profile)
        assert result["agent_name"] == "resume"
        assert result["action"] == "suggest"
        assert "bullet points" in result["result"]["summary"]

    def test_check_missing_fields(self):
        agent = ResumeAgent()
        assert agent._check_missing_fields({"name":"a","email":"b","education":[],"experience":[]}) == []
        assert agent._check_missing_fields({"name":"a"}) == ["email","education","experience"]

    @pytest.mark.asyncio
    async def test_llm_generate_bullet_no_api_key(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "")
        agent = ResumeAgent()
        result = await agent._llm_generate_bullet("Built feature", "Dev", "Co")
        assert result == "Built feature at Co as Dev"

    @pytest.mark.asyncio
    async def test_llm_generate_bullet_success(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "key")
        monkeypatch.setattr("api.agents.resume_agent.handler.llm_service.generate_completion", AsyncMock(return_value={"content": "Built amazing feature"}))
        agent = ResumeAgent()
        result = await agent._llm_generate_bullet("Built feature", "Dev", "Co")
        assert result == "Built amazing feature"

    @pytest.mark.asyncio
    async def test_llm_generate_bullet_exception(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "key")
        monkeypatch.setattr("api.agents.resume_agent.handler.llm_service.generate_completion", AsyncMock(side_effect=Exception("LLM down")))
        agent = ResumeAgent()
        result = await agent._llm_generate_bullet("Built feature", "Dev", "Co")
        assert result == "Built feature at Co as Dev"


# =============================================================================
# 6. MemoryAgent  — 3 tests
# =============================================================================
from api.agents.memory_agent.handler import MemoryAgentHandler


class TestMemoryAgentHandler:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = MemoryAgentHandler()
        assert agent.mission == "Extract structured entities from user documents"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = MemoryAgentHandler()
        result = await agent.fallback()
        assert result["agent_name"] == "memory"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_execute(self, monkeypatch):
        from api.agents.memory_agent.extraction import ExtractedFacts, ExtractedEntity, ExtractedRelationship
        agent = MemoryAgentHandler()
        entity = ExtractedEntity(name="John Doe", entity_type="person", confidence=0.95, aliases=["John"])
        rel = ExtractedRelationship(from_entity="John Doe", to_entity="Acme", relation_type="works_at", confidence=0.9)
        facts = ExtractedFacts(entities=[entity], relationships=[rel])

        async def fake_extract(*a, **kw):
            return facts

        async def fake_merge_check(name, aliases, workspace_id, entity_type):
            return MagicMock(action="create", target_id=None, confidence=0.9)

        monkeypatch.setattr("api.agents.memory_agent.handler.extract", fake_extract)
        monkeypatch.setattr("api.agents.memory_agent.handler.merge_check", fake_merge_check)
        result = await agent.execute(content="John works at Acme", source_type="text", source_id="s1", workspace_id="w1")
        assert result["agent_name"] == "memory"
        assert result["action"] == "suggest"
        assert "Extracted 1 entities" in result["result"]["summary"]


# =============================================================================
# 7. OrganizationAgent  — 6 tests
# =============================================================================
from api.agents.organization_agent.handler import OrganizationAgent


class TestOrganizationAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = OrganizationAgent()
        assert agent.mission == "Organize, categorize, and deduplicate workspace documents"
        assert agent.default_autonomy == "suggest"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = OrganizationAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "organization"
        assert result["action"] == "ask_clarification"

    @pytest.mark.asyncio
    async def test_execute_all_high_confidence(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(agent, "_classify_document", AsyncMock(return_value=("Resumes", 0.95)))
        monkeypatch.setattr(agent, "_suggest_filename", lambda n, c: n)
        monkeypatch.setattr(agent, "_detect_version_chain", lambda n, d: None)
        docs = [{"id":"d1","filename":"resume_john.pdf"}, {"id":"d2","filename":"cv_jane.pdf"}]
        result = await agent.execute(docs)
        assert result["action"] == "suggest"
        assert "Organized 2" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_execute_low_confidence(self, monkeypatch):
        agent = OrganizationAgent()
        monkeypatch.setattr(agent, "_classify_document", AsyncMock(return_value=("uncategorized", 0.5)))
        monkeypatch.setattr(agent, "_suggest_filename", lambda n, c: n)
        monkeypatch.setattr(agent, "_detect_version_chain", lambda n, d: None)
        docs = [{"id":"d1","filename":"random.pdf"}]
        result = await agent.execute(docs)
        assert result["action"] == "ask_clarification"
        assert "help categorizing" in result["result"]["summary"]

    @pytest.mark.parametrize("filename,expected", [
        ("resume_john.pdf", "Resumes"),
        ("cv_2024.pdf", "Resumes"),
        ("transcript_mit.pdf", "Transcripts"),
        ("grade_report.pdf", "Transcripts"),
        ("certificate_aws.pdf", "Certificates"),
        ("diploma.pdf", "Certificates"),
        ("cover_letter_acme.pdf", "Cover Letters"),
        ("project_portfolio.pdf", "Projects"),
        ("notes.txt", "uncategorized"),
    ])
    def test_regex_classify(self, filename, expected):
        agent = OrganizationAgent()
        assert agent._regex_classify(filename) == expected

    def test_suggest_filename_removes_versions(self):
        agent = OrganizationAgent()
        result = agent._suggest_filename("resume_v2_final.pdf", "Resumes")
        assert "v2" not in result
        assert "final" not in result
        assert "resume" in result.lower()
        assert agent._suggest_filename("project.pdf", "Projects") == "project.pdf"

    def test_detect_version_chain(self):
        agent = OrganizationAgent()
        docs = [
            {"id":"d1","filename":"resume_v1.pdf"},
            {"id":"d2","filename":"resume_v2_final.pdf"},
            {"id":"d3","filename":"other.pdf"},
        ]
        result = agent._detect_version_chain("resume_v2_final.pdf", docs)
        assert result == "d1"
        assert agent._detect_version_chain("resume_v1.pdf", docs) is None


# =============================================================================
# 8. SchedulerAgent  — 5 tests
# =============================================================================
from api.agents.scheduler_agent.handler import SchedulerAgent, ScheduleEvent


class TestSchedulerAgent:
    @pytest.mark.asyncio
    async def test_instantiation(self):
        agent = SchedulerAgent()
        assert agent.mission == "Maintain deadlines, detect conflicts, manage schedule"
        assert agent.default_autonomy == "full"

    @pytest.mark.asyncio
    async def test_fallback(self):
        agent = SchedulerAgent()
        result = await agent.fallback()
        assert result["agent_name"] == "scheduler"

    @pytest.mark.asyncio
    async def test_check_conflicts_with_overlap(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "_times_overlap", AsyncMock(return_value=True))
        events = [
            {"id":"e1","title":"Meeting A","start_time":"2024-01-01T10:00","end_time":"2024-01-01T11:00","source":"cal"},
            {"id":"e2","title":"Meeting B","start_time":"2024-01-01T10:30","end_time":"2024-01-01T11:30","source":"cal"},
        ]
        result = await agent.check_conflicts(events)
        assert "conflict" in result["result"]["summary"].lower()

    @pytest.mark.asyncio
    async def test_check_conflicts_no_overlap(self, monkeypatch):
        agent = SchedulerAgent()
        monkeypatch.setattr(agent, "_times_overlap", AsyncMock(return_value=False))
        events = [
            {"id":"e1","title":"A","start_time":"2024-01-01T10:00","end_time":"2024-01-01T11:00","source":"cal"},
            {"id":"e2","title":"B","start_time":"2024-01-01T11:00","end_time":"2024-01-01T12:00","source":"cal"},
        ]
        result = await agent.check_conflicts(events)
        assert "No conflicts" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_times_overlap_same_start(self):
        agent = SchedulerAgent()
        a = ScheduleEvent(event_id="e1", title="A", start_time="2024-01-01T10:00", end_time="2024-01-01T11:00", source="cal")
        b = ScheduleEvent(event_id="e2", title="B", start_time="2024-01-01T10:00", end_time="2024-01-01T11:00", source="cal")
        assert await agent._times_overlap(a, b) is True

    @pytest.mark.asyncio
    async def test_send_reminder(self):
        agent = SchedulerAgent()
        result = await agent.send_reminder({"title":"Test Event"})
        assert result["action"] == "execute"
        assert result["confidence"] == 1.0


# =============================================================================
# 9. ReflectionAgent  — 4 tests
# =============================================================================
from api.agents.reflection_agent.handler import ReflectionAgent


class TestReflectionAgent:
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
    async def test_generate_weekly_digest_no_llm_key(self):
        agent = ReflectionAgent()
        result = await agent.generate_weekly_digest(
            [{"action":"applied","date":"2024-01-01"}],
            goals=["Find job"],
        )
        assert result["confidence"] == 0.5
        assert result["result"]["details"]["activities_count"] == 1

    @pytest.mark.asyncio
    async def test_generate_weekly_digest_llm_path(self, monkeypatch):
        agent = ReflectionAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.generate_weekly_digest(
            [{"action":"applied","date":"2024-01-01"}],
            goals=["Find job"],
        )
        assert result["confidence"] == 0.85
        assert result["result"]["summary"] == "Weekly digest generated"


# =============================================================================
# 10. ReminderAgent  — 4 tests
# =============================================================================
from api.agents.reminder_agent.handler import ReminderAgent


class TestReminderAgent:
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
    async def test_check_deadlines_no_llm_key(self):
        agent = ReminderAgent()
        result = await agent.check_deadlines([{"name":"Task1","due_date":"2024-01-01"}])
        assert "Deadline check" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_check_deadlines_llm_path(self, monkeypatch):
        agent = ReminderAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.check_deadlines([{"name":"Task1","due_date":"2024-01-01"}])
        assert "tasks analyzed" in result["result"]["summary"]


# =============================================================================
# 11. SecurityAgent  — 4 tests
# =============================================================================
from api.agents.security_agent.handler import SecurityAgent


class TestSecurityAgent:
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
    async def test_monitor_activity_no_llm_key(self):
        agent = SecurityAgent()
        result = await agent.monitor_activity([{"action":"login","user":"u1","time":"now"}])
        assert result["confidence"] == 0.5
        assert "Monitored" in result["result"]["summary"]

    @pytest.mark.asyncio
    async def test_monitor_activity_llm_path(self, monkeypatch):
        agent = SecurityAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.monitor_activity([{"action":"login","user":"u1","time":"now"}])
        assert result["confidence"] == 0.9


# =============================================================================
# 12. AnalyticsAgent  — 4 tests
# =============================================================================
from api.agents.analytics_agent.handler import AnalyticsAgent


class TestAnalyticsAgent:
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
    async def test_get_activity_trends_no_llm_key(self):
        agent = AnalyticsAgent()
        result = await agent.get_activity_trends(["applications"])
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_get_activity_trends_llm_path(self, monkeypatch):
        agent = AnalyticsAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.get_activity_trends(["applications"])
        assert result["confidence"] == 0.85


# =============================================================================
# 13. ConnectorAgent  — 4 tests
# =============================================================================
from api.agents.connector_agent.handler import ConnectorAgent


class TestConnectorAgent:
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
    async def test_discover_connectors_no_llm_key(self):
        agent = ConnectorAgent()
        result = await agent.discover_connectors(category="Email")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_discover_connectors_llm_path(self, monkeypatch):
        agent = ConnectorAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.discover_connectors(category="Email")
        assert result["confidence"] == 0.85


# =============================================================================
# 14. PluginAgent  — 4 tests
# =============================================================================
from api.agents.plugin_agent.handler import PluginAgent


class TestPluginAgent:
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
    async def test_browse_plugins_no_llm_key(self):
        agent = PluginAgent()
        result = await agent.browse_plugins(category="Analytics")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_browse_plugins_llm_path(self, monkeypatch):
        agent = PluginAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.browse_plugins(category="Analytics")
        assert result["confidence"] == 0.85


# =============================================================================
# 15. CodingAgent  — 4 tests
# =============================================================================
from api.agents.coding_agent.handler import CodingAgent


class TestCodingAgent:
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
    async def test_solve_challenge_no_llm_key(self):
        agent = CodingAgent()
        result = await agent.solve_challenge("Reverse a linked list")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_solve_challenge_llm_path(self, monkeypatch):
        agent = CodingAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.solve_challenge("Reverse a linked list")
        assert result["confidence"] == 0.85


# =============================================================================
# 16. GitHubAgent  — 4 tests
# =============================================================================
from api.agents.github_agent.handler import GitHubAgent


class TestGitHubAgent:
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
    async def test_analyze_profile_no_llm_key(self):
        agent = GitHubAgent()
        result = await agent.analyze_profile("testuser")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_analyze_profile_llm_path(self, monkeypatch):
        agent = GitHubAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.analyze_profile("testuser")
        assert result["confidence"] == 0.85


# =============================================================================
# 17. LearningAgent  — 4 tests
# =============================================================================
from api.agents.learning_agent.handler import LearningAgent


class TestLearningAgent:
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
    async def test_search_courses_no_llm_key(self):
        agent = LearningAgent()
        result = await agent.search_courses("Python", level="beginner")
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_search_courses_llm_path(self, monkeypatch):
        agent = LearningAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.search_courses("Python", level="beginner")
        assert result["confidence"] == 0.85


# =============================================================================
# 18. RecommendationAgent  — 4 tests
# =============================================================================
from api.agents.recommendation_agent.handler import RecommendationAgent


class TestRecommendationAgent:
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
    async def test_match_jobs_no_llm_key(self):
        agent = RecommendationAgent()
        result = await agent.match_jobs({"skills":["Python"]})
        assert result["confidence"] == 0.5

    @pytest.mark.asyncio
    async def test_match_jobs_llm_path(self, monkeypatch):
        agent = RecommendationAgent()
        monkeypatch.setattr(settings, "llm_api_key", "test_key")
        result = await agent.match_jobs({"skills":["Python"]})
        assert result["confidence"] == 0.85
