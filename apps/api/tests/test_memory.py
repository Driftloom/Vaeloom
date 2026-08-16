import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestMemory:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "mem@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_memory(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Test Note", "content": "Hello",
        }, headers=headers)
        assert res.status_code == 201
        assert res.json()["type"] == "note"

    async def test_list_memories(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/memories", headers=headers)
        assert res.status_code == 200
        assert "memories" in res.json()

    async def test_get_memory_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(
            "/api/v1/memories/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404

    async def test_create_then_get(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Get Test",
        }, headers=headers)
        assert created.status_code == 201
        mid = created.json()["id"]
        res = await client.get(f"/api/v1/memories/{mid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Get Test"

    async def test_update_memory(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Before",
        }, headers=headers)
        assert created.status_code == 201
        mid = created.json()["id"]
        res = await client.put(f"/api/v1/memories/{mid}", json={
            "title": "After",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "After"

    async def test_delete_memory(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/memories", json={
            "type": "note", "title": "Delete Me",
        }, headers=headers)
        assert created.status_code == 201
        mid = created.json()["id"]
        res = await client.delete(f"/api/v1/memories/{mid}", headers=headers)
        assert res.status_code == 204

    async def test_memory_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/memories", json={"type": "note"})
        assert res.status_code == 401

    async def test_search_memories(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await client.post("/api/v1/memories", json={
            "type": "note", "title": "Searchable", "content": "hello world",
        }, headers=headers)
        res = await client.post("/api/v1/memories/search", json={
            "query": "hello",
        }, headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_search_memories_no_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/memories/search", json={
            "query": "hello",
        })
        assert res.status_code == 401

    async def test_update_memory_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.put(
            "/api/v1/memories/00000000-0000-0000-0000-000000000000",
            json={"title": "Nope"},
            headers=headers,
        )
        assert res.status_code == 404

    async def test_delete_memory_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(
            "/api/v1/memories/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert res.status_code == 404
