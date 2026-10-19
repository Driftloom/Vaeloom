"""Direct endpoint coverage for the memory feed, history, and chunks routes.

These three endpoints previously had no direct test. Negative controls assert
the exact 403 body, and isolation is cross-user: signups share a single tenant
(auth_service reuses ``Tenant.slug == "default"``), so a cross-tenant 404 is not
reachable over HTTP — the workspace-membership check is the real guard, and a
test that expected 404 would be asserting a fiction.
"""

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient) -> dict:
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": f"memcov-{uuid.uuid4().hex[:8]}@test.com",
            "password": "TestPassword123!",
        },
    )
    assert res.status_code == 201
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _create_workspace(
    client: AsyncClient, headers: dict, name: str = "Memory Coverage WS"
) -> str:
    res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


async def _create_memory(
    client: AsyncClient,
    headers: dict,
    ws_id: str,
    title: str = "Before",
    content: str = "Initial content",
    source_uri: str | None = None,
    source_type: str | None = None,
) -> str:
    payload: dict = {
        "type": "profile",
        "title": title,
        "content": content,
        "workspace_id": ws_id,
    }
    if source_uri is not None:
        payload["source_uri"] = source_uri
    if source_type is not None:
        payload["source_type"] = source_type
    res = await client.post("/api/v1/memories", json=payload, headers=headers)
    assert res.status_code == 201
    return res.json()["id"]


class TestMemoryFeed:
    async def test_feed_scopes_to_workspace_and_paginates(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        created = {
            await _create_memory(client, headers, ws, title=f"Feed Memory {i}")
            for i in range(3)
        }

        first = await client.get(
            f"/api/v1/memories/feed?workspace_id={ws}&page=1&page_size=2",
            headers=headers,
        )
        assert first.status_code == 200
        body = first.json()
        assert body["total"] == 3
        assert body["page"] == 1
        assert body["page_size"] == 2
        assert body["stats"] == {
            "total_memories": 3,
            "superseded": 0,
            "agent_created": 0,
            "recent_actions": 0,
        }
        page1 = [item["memory"]["id"] for item in body["feed"]]
        assert len(page1) == 2

        second = await client.get(
            f"/api/v1/memories/feed?workspace_id={ws}&page=2&page_size=2",
            headers=headers,
        )
        assert second.status_code == 200
        page2 = [item["memory"]["id"] for item in second.json()["feed"]]
        assert len(page2) == 1

        assert set(page1).isdisjoint(page2)
        assert set(page1) | set(page2) == created

    async def test_feed_stats_count_the_corpus_not_the_page_slice(self, client: AsyncClient):
        """F-slice-stats: the header stats describe the workspace, not the page.

        The two newest rows (the slice for ``page_size=2``) are both plain
        active memories, yet the corpus holds one superseded and one
        agent-sourced row. Summing the page slice therefore reports 0/0; a
        corpus count must report 1/1.
        """
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        original_id = await _create_memory(client, headers, ws, title="Slice Stats Original")
        await _create_memory(
            client, headers, ws, title="Slice Stats Agent Note", source_type="agent"
        )
        filler_id = await _create_memory(client, headers, ws, title="Slice Stats Filler")

        superseded = await client.post(
            f"/api/v1/memories/{original_id}/supersede",
            json={"reason": "Correction: the original note was wrong"},
            headers=headers,
        )
        assert superseded.status_code == 201
        successor_id = superseded.json()["id"]

        res = await client.get(
            f"/api/v1/memories/feed?workspace_id={ws}&page=1&page_size=2",
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()

        # Premise: the slice is exactly the two newest rows (active successor +
        # filler), so no superseded or agent-sourced row is on the page.
        slice_ids = [item["memory"]["id"] for item in body["feed"]]
        assert slice_ids == [successor_id, filler_id]

        assert body["stats"] == {
            "total_memories": 4,
            "superseded": 1,
            "agent_created": 1,
            "recent_actions": 0,
        }

    async def test_feed_rejects_foreign_workspace(self, client: AsyncClient):
        """Negative control: user B cannot read a feed scoped to user A's workspace."""
        headers_a = await _signup(client)
        ws_a = await _create_workspace(client, headers_a, name="Feed Owner WS")
        headers_b = await _signup(client)

        res = await client.get(
            f"/api/v1/memories/feed?workspace_id={ws_a}", headers=headers_b
        )
        assert res.status_code == 403
        assert res.json()["detail"] == "Forbidden: Access to specified workspace denied"


class TestMemoryHistory:
    async def test_history_records_title_update_delta(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws, title="Before")

        put = await client.put(
            f"/api/v1/memories/{memory_id}", json={"title": "After"}, headers=headers
        )
        assert put.status_code == 200

        res = await client.get(f"/api/v1/memories/{memory_id}/history", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["memory_id"] == memory_id
        assert body["total"] == 1
        version = body["versions"][0]
        assert version["version_number"] == 1
        assert version["changes"]["title"] == {"from": "Before", "to": "After"}
        assert version["snapshot"]["title"] == "After"

    async def test_history_rejects_foreign_user(self, client: AsyncClient):
        """Negative control: user B cannot read user A's memory history."""
        headers_a = await _signup(client)
        ws_a = await _create_workspace(client, headers_a)
        memory_id = await _create_memory(client, headers_a, ws_a)
        headers_b = await _signup(client)

        res = await client.get(
            f"/api/v1/memories/{memory_id}/history", headers=headers_b
        )
        assert res.status_code == 403
        assert (
            res.json()["detail"]
            == "Forbidden: User does not have access to specified workspace"
        )

    async def test_history_rejects_mismatched_workspace_context(self, client: AsyncClient):
        """A workspace the caller *does* own, but not the memory's, is still a 403."""
        headers = await _signup(client)
        ws_primary = await _create_workspace(client, headers, name="Primary WS")
        ws_other = await _create_workspace(client, headers, name="Other WS")
        memory_id = await _create_memory(client, headers, ws_primary)

        res = await client.get(
            f"/api/v1/memories/{memory_id}/history",
            headers={**headers, "X-Workspace-ID": ws_other},
        )
        assert res.status_code == 403
        assert (
            res.json()["detail"]
            == "Forbidden: Memory does not belong to specified workspace"
        )


class TestMemoryChunks:
    async def test_chunks_are_empty_without_source_document(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws)

        res = await client.get(f"/api/v1/memories/{memory_id}/chunks", headers=headers)
        assert res.status_code == 200
        assert res.json() == {"memory_id": memory_id, "chunks": [], "total": 0}

    async def test_chunks_return_source_document_chunks(
        self, client: AsyncClient, db_session
    ):
        from api.models.schema import Document, DocumentChunk

        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        ws_uuid = uuid.UUID(ws)

        document = Document(
            id=uuid.uuid4(), workspace_id=ws_uuid, path="vault/notes.md", type="markdown"
        )
        db_session.add(document)
        await db_session.flush()
        for index, text in enumerate(["First chunk text", "Second chunk text"]):
            db_session.add(
                DocumentChunk(
                    id=uuid.uuid4(),
                    workspace_id=ws_uuid,
                    document_id=document.id,
                    chunk_index=index,
                    content=text,
                    start_offset=index * 20,
                    end_offset=index * 20 + len(text),
                    token_count=3,
                )
            )
        await db_session.flush()

        memory_id = await _create_memory(
            client, headers, ws, source_uri=str(document.id)
        )
        res = await client.get(f"/api/v1/memories/{memory_id}/chunks", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["memory_id"] == memory_id
        assert body["document_id"] == str(document.id)
        assert body["total"] == 2
        assert [chunk["index"] for chunk in body["chunks"]] == [0, 1]
        assert body["chunks"][0]["content"] == "First chunk text"
        assert body["chunks"][1]["content"] == "Second chunk text"

    async def test_chunks_reject_foreign_user(self, client: AsyncClient):
        """Negative control: user B cannot read user A's chunk provenance."""
        headers_a = await _signup(client)
        ws_a = await _create_workspace(client, headers_a)
        memory_id = await _create_memory(client, headers_a, ws_a)
        headers_b = await _signup(client)

        res = await client.get(
            f"/api/v1/memories/{memory_id}/chunks", headers=headers_b
        )
        assert res.status_code == 403
        assert (
            res.json()["detail"]
            == "Forbidden: User does not have access to specified workspace"
        )
