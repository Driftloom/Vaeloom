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
        # Default listing returns active memories
        res = await client.get("/api/v1/memories", headers=auth_headers)
        assert res.status_code == 200
        body = res.json()
        assert "memories" in body
        assert body["total"] >= 2
        titles = {m["title"] for m in body["memories"]}
        assert "Mem A" in titles
        assert "Mem B" in titles

        # Negative control: status=PROCESSING returns 0 for active memories
        res_proc = await client.get(
            "/api/v1/memories?status=PROCESSING", headers=auth_headers
        )
        assert res_proc.status_code == 200
        assert res_proc.json()["total"] == 0

        # Positive control: creating a memory with explicit status=PROCESSING matches PROCESSING query
        proc_created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Processing Mem", "status": "PROCESSING"},
            headers=auth_headers,
        )
        assert proc_created.status_code == 201
        res_proc2 = await client.get(
            "/api/v1/memories?status=PROCESSING", headers=auth_headers
        )
        assert res_proc2.status_code == 200
        assert res_proc2.json()["total"] == 1
        assert res_proc2.json()["memories"][0]["title"] == "Processing Mem"

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
            "/api/v1/memories?page=1&page_size=2", headers=auth_headers
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["memories"]) == 2
        assert body["total"] >= 5
        assert body["page"] == 1
        assert body["page_size"] == 2


class TestMemoryTypeRejectionStatus:
    """An unknown memory type is a 422, never a 500.

    Migration 0068 dropped ``ck_memories_type_valid`` and Task 6 widened
    ``MemoryCreate.type`` from a Pydantic ``Literal`` to ``str``, moving the
    check into ``validate_memory_type``. That removed the 422 the field used to
    produce during request parsing and left the ``ValueError`` uncaught on its
    way to the generic exception handler -- which answers 500, logs an
    exception, and spends a 5xx on a typo in a payload.

    422 is pinned here because it is the code these endpoints returned before
    the schema was widened. Both the create and the update path are covered,
    and both are asserted against that same exact code: a client that gets 422
    on create and 400 (or 500) on update has learned nothing it can act on.
    """

    async def test_create_with_unknown_type_is_422(self, client: AsyncClient, auth_headers: dict):
        res = await client.post(
            "/api/v1/memories",
            json={"type": "not_a_real_type", "title": "Bad Type"},
            headers=auth_headers,
        )
        assert res.status_code == 422
        # The message must survive the translation: it is the only thing telling
        # the caller which value was refused and which pack to take it from.
        assert "not_a_real_type" in str(res.json()["detail"])

    async def test_create_with_valid_type_still_201(self, client: AsyncClient, auth_headers: dict):
        """Negative control: 422 above must track the pack, not the endpoint."""
        res = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Good Type"},
            headers=auth_headers,
        )
        assert res.status_code == 201

    async def test_update_with_unknown_type_is_422(self, client: AsyncClient, auth_headers: dict):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Type Remap Target"},
            headers=auth_headers,
        )
        assert created.status_code == 201
        mid = created.json()["id"]

        res = await client.put(
            f"/api/v1/memories/{mid}",
            json={"type": "not_a_real_type"},
            headers=auth_headers,
        )
        assert res.status_code == 422
        assert "not_a_real_type" in str(res.json()["detail"])

        # The refusal must be a refusal, not a partial write.
        after = await client.get(f"/api/v1/memories/{mid}", headers=auth_headers)
        assert after.status_code == 200
        assert after.json()["type"] == "note"

    async def test_update_with_valid_type_is_200(self, client: AsyncClient, auth_headers: dict):
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Remap Me"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.put(
            f"/api/v1/memories/{mid}",
            json={"type": "insight"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["type"] == "insight"

    async def test_update_omitting_type_still_200(self, client: AsyncClient, auth_headers: dict):
        """A patch that never mentions `type` must not read the registry.

        This is the whole reason the update guard is conditional. If validation
        ran on every patch, a memory whose stored type predates the pack table
        would become uneditable, and the refusal would look like validation
        while actually being the loss of unrelated data.
        """
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Title Before"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.put(
            f"/api/v1/memories/{mid}",
            json={"title": "Title After"},
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.json()["title"] == "Title After"
        assert res.json()["type"] == "note"

    async def test_supersede_with_unknown_type_is_422(self, client: AsyncClient, auth_headers: dict):
        """A supersede writes a successor row and can remap its type."""
        created = await client.post(
            "/api/v1/memories",
            json={"type": "note", "title": "Supersede Target", "content": "v1"},
            headers=auth_headers,
        )
        mid = created.json()["id"]

        res = await client.post(
            f"/api/v1/memories/{mid}/supersede",
            json={"reason": "correcting the type", "type": "not_a_real_type"},
            headers=auth_headers,
        )
        assert res.status_code == 422
        assert "not_a_real_type" in str(res.json()["detail"])

        # Nothing may be half-superseded by the refusal: the original survives.
        after = await client.get(f"/api/v1/memories/{mid}", headers=auth_headers)
        assert after.status_code == 200
        assert after.json()["status"] == "active"
