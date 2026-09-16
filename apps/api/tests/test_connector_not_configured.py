"""F-08 regression: mutating connectors must NOT fake a successful side-effect.

When a connector's backing integration is unconfigured (no client / no token),
the write tools (Slack send, Gmail/Outlook draft, calendar create, GitHub
issue/PR create) previously returned status="success" with a simulated id,
misleading the agent into believing the action happened. They now return
status="not_configured" and perform no action.
"""

import os

import pytest

from api.tools.executor import (
    NOT_CONFIGURED,
    _execute_create_github_issue,
    _execute_create_outlook_calendar_event,
    _execute_draft_outlook_mail,
    _execute_send_slack_message,
)


@pytest.mark.asyncio
async def test_send_slack_message_not_configured_without_token(monkeypatch):
    monkeypatch.delenv("SLACK_BOT_TOKEN", raising=False)
    result = await _execute_send_slack_message(
        {"channel": "C123", "text": "hi"}, "ws-1"
    )
    assert result["status"] == NOT_CONFIGURED
    assert "no action was performed" in result["note"]


@pytest.mark.asyncio
async def test_create_github_issue_not_configured_without_token(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_API_KEY", raising=False)

    async def _no_token(workspace_id=None):
        return ""

    monkeypatch.setattr("api.tools.executor._resolve_github_token", _no_token)
    result = await _execute_create_github_issue(
        {"repo": "o/r", "title": "bug"}, "ws-1"
    )
    assert result["status"] == NOT_CONFIGURED


@pytest.mark.asyncio
async def test_draft_outlook_mail_not_configured(monkeypatch):
    # GraphClient() returns a client whose create_draft returns None when unconfigured
    class MockClient:
        async def create_draft(self, **kwargs):
            return None

    monkeypatch.setattr("api.clients.graph_client.GraphClient", lambda: MockClient())
    result = await _execute_draft_outlook_mail(
        {"to": "a@b.com", "subject": "s", "body": "b"}, "ws-1"
    )
    assert result["status"] == NOT_CONFIGURED


@pytest.mark.asyncio
async def test_create_outlook_calendar_event_not_configured(monkeypatch):
    class MockClient:
        async def create_event(self, **kwargs):
            return None

    monkeypatch.setattr("api.clients.graph_client.GraphClient", lambda: MockClient())
    result = await _execute_create_outlook_calendar_event(
        {"title": "Standup", "start_time": "2025-01-01T09:00:00Z"}, "ws-1"
    )
    assert result["status"] == NOT_CONFIGURED
