"""Direct endpoint coverage for the memory feed, history, and chunks routes.

These three endpoints previously had no direct test. Negative controls assert
the exact 403 body, and isolation is cross-user: signups share a single tenant
(auth_service reuses ``Tenant.slug == "default"``), so a cross-tenant 404 is not
reachable over HTTP — the workspace-membership check is the real guard, and a
test that expected 404 would be asserting a fiction.
"""

import uuid
from datetime import datetime, timedelta

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


class TestMemoryExport:
    """F-export-tags-null: export must survive memories created without tags.

    `MemoryExportItem.tags` used to be a non-optional list, so any row whose
    `tags` column is NULL -- the shape every tagless create produces, since
    the service passes `tags=None` straight through and an explicit None
    suppresses the column default -- made the whole export a 500.
    """

    async def test_export_includes_tagless_memories(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        await _create_memory(client, headers, ws, title="Untagged")

        res = await client.get(f"/api/v1/memories/export?workspace_id={ws}", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["total_count"] == 1
        assert body["memories"][0]["title"] == "Untagged"
        assert body["memories"][0]["tags"] == []


class TestMemoryTimestampWireFormat:
    """F-timestamp-skew: wire timestamps must carry an explicit UTC offset.

    SQLite-backed environments (local dev, the e2e launchers) hand SQLAlchemy
    naive datetimes, and a naive ISO string is parsed as *local* time by
    JavaScript -- the chat drawer and memory cards then rendered stored times
    offset by the viewer's UTC offset. The wire contract must be unambiguous
    regardless of which database backend served the request.
    """

    async def test_memory_timestamps_are_utc_on_the_wire(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)

        created = await client.post(
            "/api/v1/memories",
            json={"type": "profile", "title": "Stamped", "content": "c", "workspace_id": ws},
            headers=headers,
        )
        assert created.status_code == 201
        memory_id = created.json()["id"]

        listed = await client.get(f"/api/v1/memories?workspace_id={ws}", headers=headers)
        assert listed.status_code == 200
        listed_memory = next(m for m in listed.json()["memories"] if m["id"] == memory_id)

        detail = await client.get(f"/api/v1/memories/{memory_id}", headers=headers)
        assert detail.status_code == 200

        for payload in (created.json(), listed_memory, detail.json()):
            for field in ("created_at", "updated_at"):
                parsed = datetime.fromisoformat(payload[field])
                assert parsed.tzinfo is not None, (
                    f"{field} must be timezone-explicit on the wire: {payload[field]!r}"
                )
                assert parsed.utcoffset() == timedelta(0), (
                    f"{field} must be UTC on the wire: {payload[field]!r}"
                )

    async def test_export_timestamps_are_utc_on_the_wire(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        await _create_memory(client, headers, ws)

        res = await client.get(f"/api/v1/memories/export?workspace_id={ws}", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["total_count"] == 1

        exported = datetime.fromisoformat(body["exported_at"])
        assert exported.tzinfo is not None and exported.utcoffset() == timedelta(0)

        item = body["memories"][0]
        for field in ("created_at", "updated_at"):
            parsed = datetime.fromisoformat(item[field])
            assert parsed.tzinfo is not None, (
                f"{field} must be timezone-explicit on the wire: {item[field]!r}"
            )
            assert parsed.utcoffset() == timedelta(0), (
                f"{field} must be UTC on the wire: {item[field]!r}"
            )


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


class TestMemoryStatusWrites:
    """Caller-facing status writes are validated and keep ``deleted_at`` honest.

    The status vocabulary is the set the system itself writes
    (``active``/``READY``/``PROCESSING``/``superseded``/``deleted``) plus
    ``archived``, the one status only a user picks (bulk archive on the memory
    page). Membership is exact: ``ACTIVE`` is the documents vocabulary and on a
    memory would render it invisible to every filtered view, whose default
    admits only ``active``/``READY``/``PROCESSING``. And because the grounding
    dossier filters on ``deleted_at`` alone, ``deleted_at`` must be an exact
    function of the status -- set on ``deleted``, cleared on the way back out.
    """

    async def test_create_rejects_unknown_status(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)

        # ``ACTIVE`` is real vocabulary -- for documents. On memories it is a
        # typo that no filter ever matches.
        res = await client.post(
            "/api/v1/memories",
            json={
                "type": "profile",
                "title": "Capitalised status",
                "content": "Would be invisible under ?status=ACTIVE",
                "workspace_id": ws,
                "status": "ACTIVE",
            },
            headers=headers,
        )
        assert res.status_code == 422

        # Positive control: the documented in-flight status stays creatable.
        ok = await client.post(
            "/api/v1/memories",
            json={
                "type": "profile",
                "title": "In-flight import",
                "content": "Still being processed",
                "workspace_id": ws,
                "status": "PROCESSING",
            },
            headers=headers,
        )
        assert ok.status_code == 201

    async def test_update_rejects_unknown_status(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws)

        res = await client.put(
            f"/api/v1/memories/{memory_id}",
            json={"status": "actve"},
            headers=headers,
        )
        assert res.status_code == 422

        # The typo must not have landed: the row is still in the default list.
        listing = await client.get(
            f"/api/v1/memories?workspace_id={ws}", headers=headers
        )
        assert listing.status_code == 200
        assert memory_id in [m["id"] for m in listing.json()["memories"]]

    async def test_bulk_status_rejects_unknown_status(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws)

        res = await client.post(
            "/api/v1/memories/bulk-status",
            json={"memory_ids": [memory_id], "status": "Archived", "workspace_id": ws},
            headers=headers,
        )
        assert res.status_code == 422

        listing = await client.get(
            f"/api/v1/memories?workspace_id={ws}", headers=headers
        )
        assert listing.status_code == 200
        assert memory_id in [m["id"] for m in listing.json()["memories"]]

    async def test_update_delete_stamps_deleted_at(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws)

        res = await client.put(
            f"/api/v1/memories/{memory_id}",
            json={"status": "deleted"},
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["deleted_at"] is not None

        default_list = await client.get(
            f"/api/v1/memories?workspace_id={ws}", headers=headers
        )
        assert memory_id not in [m["id"] for m in default_list.json()["memories"]]

    async def test_restore_clears_deleted_at(self, client: AsyncClient):
        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(client, headers, ws)

        deleted = await client.post(
            "/api/v1/memories/bulk-status",
            json={"memory_ids": [memory_id], "status": "deleted", "workspace_id": ws},
            headers=headers,
        )
        assert deleted.status_code == 200

        restored = await client.post(
            "/api/v1/memories/bulk-status",
            json={"memory_ids": [memory_id], "status": "active", "workspace_id": ws},
            headers=headers,
        )
        assert restored.status_code == 200
        detail = await client.get(f"/api/v1/memories/{memory_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["deleted_at"] is None

    async def test_updated_deleted_memory_no_longer_grounds(
        self, client: AsyncClient, db_session
    ):
        """The grounding dossier filters on ``deleted_at`` alone, so a status
        write of ``deleted`` that skipped the timestamp kept the memory in
        every chat's context (``retrieve_grounding_dossier``)."""
        from api.services.memory_service import retrieve_grounding_dossier

        headers = await _signup(client)
        ws = await _create_workspace(client, headers)
        memory_id = await _create_memory(
            client,
            headers,
            ws,
            title="Quokka migration plan",
            content="Quokka migration rollout schedule",
        )

        _, before = await retrieve_grounding_dossier(
            ws, "quokka migration", db_session
        )
        assert any(item["id"] == memory_id for item in before)

        res = await client.put(
            f"/api/v1/memories/{memory_id}",
            json={"status": "deleted"},
            headers=headers,
        )
        assert res.status_code == 200
        assert res.json()["deleted_at"] is not None

        _, after = await retrieve_grounding_dossier(
            ws, "quokka migration", db_session
        )
        assert all(item["id"] != memory_id for item in after)
