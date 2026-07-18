"""Tests for Gmail Agent."""
import pytest
from app.agents.gmail_agent.handler import GmailAgent


@pytest.mark.asyncio
async def test_classifies_urgent_email():
    agent = GmailAgent()
    emails = [
        {"id": "e1", "subject": "Interview Tomorrow", "sender": "hr@company.com",
         "body": "Your interview is scheduled for tomorrow at 10 AM."},
    ]
    result = await agent.classify_emails(emails, trigger="scheduled")
    details = result["result"]["details"]
    assert details[0]["classification"] == "urgent"
    assert details[0]["is_high_priority"] is True


@pytest.mark.asyncio
async def test_push_triggered_fires_on_interview():
    """Push-triggered path should fire immediately on 'interview tomorrow' email."""
    agent = GmailAgent()
    emails = [
        {"id": "e1", "subject": "Interview Tomorrow", "sender": "hr@company.com",
         "body": "Your interview is tomorrow morning."},
    ]
    result = await agent.classify_emails(emails, trigger="push")
    assert "high-priority" in result["result"]["summary"].lower() or "🚨" in result["result"]["summary"]
    assert result["metadata"]["trigger"] == "push"


@pytest.mark.asyncio
async def test_classifies_low_priority():
    agent = GmailAgent()
    emails = [
        {"id": "e2", "subject": "Weekly Newsletter", "sender": "news@example.com",
         "body": "Check out our latest newsletter. Unsubscribe here."},
    ]
    result = await agent.classify_emails(emails, trigger="scheduled")
    details = result["result"]["details"]
    assert details[0]["classification"] == "low_priority"


@pytest.mark.asyncio
async def test_extracts_deadline():
    agent = GmailAgent()
    emails = [
        {"id": "e3", "subject": "Application Deadline", "sender": "admissions@uni.edu",
         "body": "The deadline for your application is tomorrow."},
    ]
    result = await agent.classify_emails(emails, trigger="scheduled")
    details = result["result"]["details"]
    assert details[0]["extracted_deadline"] == "tomorrow"


@pytest.mark.asyncio
async def test_draft_only_autonomy():
    """Gmail Agent should be suggest-mode (draft-only, never sends)."""
    agent = GmailAgent()
    assert agent.default_autonomy == "suggest"
