"""Tests for Dynamic Agent Slash Commands API Router."""

import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _auth(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"commands-{uuid.uuid4().hex[:10]}@test.com",
        "password": "Test1234!",
    })
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def test_get_agent_commands_requires_auth(client):
    res = await client.get("/api/v1/agents/commands")
    assert res.status_code == 401


async def test_get_agent_commands_endpoint(client):
    """Verify GET /api/v1/agents/commands returns dynamic discovered commands."""
    headers = await _auth(client)
    res = await client.get("/api/v1/agents/commands", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert "commands" in data
    assert data["count"] >= 20

    commands = data["commands"]
    triggers = {c["trigger"] for c in commands}
    agents = {c["agent"] for c in commands}

    # Check core dynamic commands
    assert "/organize" in triggers
    assert "/remember" in triggers
    assert "/resume" in triggers
    assert "/ats" in triggers
    assert "/jobs" in triggers

    assert "resume" in agents
    assert "ats" in agents
    assert "job_search" in agents

    # Verify command schema structure
    for cmd in commands:
        assert cmd["trigger"].startswith("/")
        assert cmd["agent"]
        assert cmd["desc"]
        assert cmd["color"].startswith("bg-")
