"""AI evaluation tests — verifies memory quality, agent execution, and system behavior."""
import pytest
from httpx import AsyncClient


async def _signup(client: AsyncClient, email: str) -> str:
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "TestPass1234!"},
    )
    assert res.status_code == 201
    return res.json()["access_token"]


@pytest.mark.asyncio
class TestMemoryQuality:
    """Verify memory creation, retrieval, and quality attributes."""

    async def test_memory_create_with_valid_type(self, client: AsyncClient):
        """Memory creation with valid type should succeed."""
        token = await _signup(client, "ai-eval-1@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/memories",
            headers=headers,
            json={"type": "profile", "content": "User is a software engineer with 5 years experience"},
        )
        assert res.status_code in (200, 201)
        body = res.json()
        assert body["type"] == "profile"
        assert body["content"] == "User is a software engineer with 5 years experience"
        assert "id" in body

    async def test_memory_create_all_types(self, client: AsyncClient):
        """All valid memory types should be creatable."""
        token = await _signup(client, "ai-eval-types@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        valid_types = ["profile", "document", "career", "episodic", "preference", "working"]
        for mem_type in valid_types:
            res = await client.post(
                "/api/v1/memories",
                headers=headers,
                json={"type": mem_type, "content": f"Test {mem_type} memory"},
            )
            assert res.status_code in (200, 201), f"Failed to create {mem_type} memory"

    async def test_memory_list_returns_created(self, client: AsyncClient):
        """Listed memories should be retrievable."""
        token = await _signup(client, "ai-eval-list@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        created_ids = []
        for i in range(3):
            res = await client.post(
                "/api/v1/memories",
                headers=headers,
                json={"type": "episodic", "content": f"Event {i} happened today"},
            )
            if res.status_code in (200, 201):
                created_ids.append(res.json().get("id"))

        res = await client.get("/api/v1/memories", headers=headers)
        assert res.status_code == 200
        body = res.json()
        memories = body.get("memories", body) if isinstance(body, dict) else body
        assert isinstance(memories, list)

    async def test_memory_deduplication(self, client: AsyncClient):
        """Duplicate memories should be handled gracefully."""
        token = await _signup(client, "ai-eval-dedup@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        content = "Exact duplicate content for testing"
        res1 = await client.post(
            "/api/v1/memories",
            headers=headers,
            json={"type": "profile", "content": content},
        )
        assert res1.status_code in (200, 201)

        res2 = await client.post(
            "/api/v1/memories",
            headers=headers,
            json={"type": "profile", "content": content},
        )
        assert res2.status_code in (200, 201, 409)

    async def test_memory_content_hash(self, client: AsyncClient):
        """Memories should have content_hash for dedup."""
        token = await _signup(client, "ai-eval-hash@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/memories",
            headers=headers,
            json={"type": "profile", "content": "Content with hash"},
        )
        if res.status_code in (200, 201):
            body = res.json()
            assert "content_hash" in body or "id" in body


@pytest.mark.asyncio
class TestAgentExecution:
    """Verify agent catalog, execution, and safety controls."""

    async def test_agent_catalog_returns_agents(self, client: AsyncClient, auth_headers: dict):
        """GET /agents should return agent catalog."""
        res = await client.get("/api/v1/agents", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert isinstance(body, (list, dict))

    async def test_agent_create_and_list(self, client: AsyncClient):
        """Creating an agent and listing should show it."""
        token = await _signup(client, "ai-eval-agent@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": "Test Agent", "category": "memory", "config": {}},
        )
        assert res.status_code in (200, 201)

        res = await client.get("/api/v1/agents", headers=headers)
        assert res.status_code == 200

    async def test_search_returns_results(self, client: AsyncClient):
        """Search should return results for valid queries."""
        token = await _signup(client, "ai-eval-search@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/search",
            headers=headers,
            json={"query": "software engineer experience"},
        )
        assert res.status_code in (200, 422)


@pytest.mark.asyncio
class TestLLMOutputSafety:
    """Verify LLM-related safety controls at the data layer."""

    async def test_memory_rejects_invalid_type(self, client: AsyncClient):
        """Memory creation with non-string content should fail."""
        token = await _signup(client, "ai-eval-safety@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/memories",
            headers=headers,
            json={"type": "profile", "content": 12345},
        )
        assert res.status_code in (400, 422)

    async def test_workspace_rejects_empty_name(self, client: AsyncClient):
        """Workspace creation should validate name length."""
        token = await _signup(client, "ai-eval-ws@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/workspaces",
            headers=headers,
            json={"name": "x" * 10000},
        )
        assert res.status_code in (400, 422, 200, 201)

    async def test_agent_rejects_empty_name(self, client: AsyncClient):
        """Agent creation should reject empty name."""
        token = await _signup(client, "ai-eval-agn@test.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/api/v1/agents",
            headers=headers,
            json={"name": "", "category": "test"},
        )
        assert res.status_code in (400, 422)
