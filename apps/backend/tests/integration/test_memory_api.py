import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestMemoryApi:
    """CRUD integration tests for memory nodes and edges."""

    async def test_create_memory(self, client: AsyncClient, auth_headers: dict):
        res = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Integration Test Note", "content": "Hello world"},
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["type"] == "note"
        assert data["title"] == "Integration Test Note"
        assert data["content"] == "Hello world"
        assert "id" in data

    async def test_create_memory_with_tags(self, client: AsyncClient, auth_headers: dict):
        res = await client.post(
            "/api/v1/memories",
            json={
                "type": "note",
                "title": "Tagged Memory",
                "content": "Has tags",
                "tags": ["important", "integration"],
            },
            headers=auth_headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert "important" in (data.get("tags") or [])
        assert "integration" in (data.get("tags") or [])

    async def test_list_memories(self, client: AsyncClient, auth_headers: dict):
        await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Mem A"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Mem B"},
            headers=auth_headers,
        )
        res = await client.get(
            "/api/v1/memories?status=PROCESSING", headers=auth_headers
        )
        assert res.status_code == 200
        body = res.json()
        assert "memories" in body
        assert body["total"] >= 2

    async def test_get_memory_by_id(self, client: AsyncClient, auth_headers: dict):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Get Me"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.get(f"/api/v1/memories/{mid}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Get Me"

    async def test_get_memory_not_found(self, client: AsyncClient, auth_headers: dict):
        res = await client.get(
            "/api/v1/memories/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert res.status_code == 404

    async def test_update_memory(self, client: AsyncClient, auth_headers: dict):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Before Update"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.put(
            f"/api/v1/memories/{mid}",
            json={"title": "After Update", "content": "Updated content"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["title"] == "After Update"

    async def test_delete_memory(self, client: AsyncClient, auth_headers: dict):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Delete Me"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.delete(f"/api/v1/memories/{mid}", headers=auth_headers)
        assert res.status_code == 204

        get_res = await client.get(f"/api/v1/memories/{mid}", headers=auth_headers)
        assert get_res.status_code == 200
        assert get_res.json()["status"] == "deleted"

    async def test_memory_requires_auth(self, client: AsyncClient):
        res = await client.post(
            "/api/v1/memories", json={"type": "note", "title": "No Auth"}
        )
        assert res.status_code == 401

    async def test_list_memories_pagination(self, client: AsyncClient, auth_headers: dict):
        for i in range(5):
            await client.post(
                "/api/v1/memories",
                json={"type": "note", "title": f"Page Mem {i}"},
                headers=auth_headers,
            )

        res = await client.get(
            "/api/v1/memories?page=1&page_size=2&status=PROCESSING", headers=auth_headers
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["memories"]) <= 2
        assert body["page"] == 1
        assert body["page_size"] == 2
