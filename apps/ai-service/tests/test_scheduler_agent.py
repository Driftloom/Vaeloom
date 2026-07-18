"""Tests for Scheduler Agent."""
import pytest
from app.agents.scheduler_agent.handler import SchedulerAgent


@pytest.mark.asyncio
async def test_detects_conflicts():
    agent = SchedulerAgent()
    events = [
        {"id": "e1", "title": "Team Meeting", "start_time": "2026-07-20T10:00:00", "source": "manual"},
        {"id": "e2", "title": "Interview", "start_time": "2026-07-20T10:00:00", "source": "gmail"},
    ]
    result = await agent.check_conflicts(events)
    assert "conflict" in result["result"]["summary"].lower()
    details = result["result"]["details"]
    conflicted = [e for e in details if e["has_conflict"]]
    assert len(conflicted) == 2


@pytest.mark.asyncio
async def test_no_conflicts():
    agent = SchedulerAgent()
    events = [
        {"id": "e1", "title": "Meeting", "start_time": "2026-07-20T10:00:00", "source": "manual"},
        {"id": "e2", "title": "Lunch", "start_time": "2026-07-20T12:00:00", "source": "manual"},
    ]
    result = await agent.check_conflicts(events)
    assert "no conflicts" in result["result"]["summary"].lower()


@pytest.mark.asyncio
async def test_full_autonomy_for_reminders():
    """Scheduler Agent should have full autonomy for notify-only actions."""
    agent = SchedulerAgent()
    assert agent.default_autonomy == "full"

    result = await agent.send_reminder({"title": "Application Deadline", "start_time": "2026-07-20T10:00:00"})
    assert result["action"] == "execute"  # Full autonomy — no approval needed
    assert result["confidence"] == 1.0


@pytest.mark.asyncio
async def test_suggest_for_event_creation():
    """Check_conflicts returns suggest mode (not auto-create events)."""
    agent = SchedulerAgent()
    events = [{"id": "e1", "title": "Meeting", "start_time": "2026-07-20T10:00:00", "source": "manual"}]
    result = await agent.check_conflicts(events)
    assert result["action"] == "suggest"
