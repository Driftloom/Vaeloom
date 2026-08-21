import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

CANONICAL = {"organization", "memory", "resume", "ats", "job_search", "application", "gmail", "scheduler", "planning", "research"}


async def _auth(client: AsyncClient) -> dict:
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"catalog-{uuid.uuid4().hex[:10]}@test.com", "password": "Test1234!",
    })
    assert res.status_code in (200, 201), res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


class TestAgentCatalog:
    async def test_requires_auth(self, client):
        res = await client.get("/api/v1/agents/catalog")
        assert res.status_code == 401

    async def test_catalog_returns_canonical_agents(self, client):
        headers = await _auth(client)
        res = await client.get("/api/v1/agents/catalog", headers=headers)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["canonical_count"] == 10
        names = {a["name"] for a in body["agents"]}
        assert CANONICAL <= names
        assert body["total"] == len(body["agents"])
        assert body["total"] >= 8

    async def test_canonical_agents_have_skills_and_tools(self, client):
        headers = await _auth(client)
        res = await client.get("/api/v1/agents/catalog", headers=headers)
        body = res.json()
        for agent in body["agents"]:
            if agent["is_canonical"]:
                assert agent["skills"], f"{agent['name']} missing skills"
                assert "memory_scopes" in agent
                assert agent["category"] == "canonical"
                assert agent["default_autonomy"] in ("suggest", "autonomous", "supervised", "approval", "approval_gated", "read_only", "full")

    async def test_tool_definitions_exposed(self, client):
        headers = await _auth(client)
        res = await client.get("/api/v1/agents/catalog", headers=headers)
        body = res.json()
        assert "tool_definitions" in body
        assert len(body["tool_definitions"]) > 0
        for name, td in body["tool_definitions"].items():
            assert "description" in td
            assert "required_scope" in td

    async def test_catalog_works_without_persisted_agents(self, client):
        headers = await _auth(client)
        res = await client.get("/api/v1/agents/catalog", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] > 0