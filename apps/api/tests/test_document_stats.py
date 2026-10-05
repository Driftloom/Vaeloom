"""`GET /documents/stats` — workspace-wide aggregates.

The documents list header used to derive storage and scan counts from the rows of
the CURRENT PAGE while taking the document total from the server, so the two
numbers had different denominators and no client-side source existed for the
"Active Shares" card at all.

Each field is asserted as an exact integer against rows this module inserted, and
the cases that historically broke are called out individually: mixed-case
`scan_status`, a row with no `metadata.size`, a row whose `metadata.size` is not a
number, and a share whose `expires_at` has already passed.
"""
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from api.models.schema import Document, DocumentShare, Folder

pytestmark = pytest.mark.asyncio


async def _auth(client: AsyncClient, email: str) -> dict:
    res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "Stats1234!"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _workspace(client: AsyncClient, headers: dict, name: str = "Stats WS") -> str:
    res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _doc(
    ws_id: str,
    path: str,
    *,
    scan_status: str = "CLEAN",
    size: object = None,
    metadata: dict | None = None,
    deleted: bool = False,
) -> Document:
    meta = dict(metadata or {})
    if size is not None:
        meta["size"] = size
    return Document(
        id=uuid.uuid4(),
        workspace_id=uuid.UUID(ws_id),
        path=path,
        type="text",
        scan_status=scan_status,
        metadata_=meta,
        deleted_at=datetime.now(UTC) if deleted else None,
    )


async def _stats(client: AsyncClient, headers: dict, ws_id: str) -> dict:
    res = await client.get(f"/api/v1/documents/stats?workspace_id={ws_id}", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


class TestDocumentStats:
    async def test_every_field_on_a_seeded_workspace(self, client: AsyncClient, db_session):
        headers = await _auth(client, "stats_full@vaeloom.test")
        ws_id = await _workspace(client, headers)

        db_session.add_all(
            [
                _doc(ws_id, "a.txt", scan_status="CLEAN", size=100),
                # Lowercase: tools/executor.py:437,489 writes lowercase while the
                # upload path writes uppercase, so a case-sensitive COUNT misses it.
                _doc(ws_id, "b.txt", scan_status="clean", size=250),
                _doc(ws_id, "c.txt", scan_status="QUARANTINED", size=50),
                _doc(ws_id, "d.txt", scan_status="quarantined"),
                _doc(ws_id, "e.txt", scan_status="Scanning"),
                # No metadata.size at all — must not break the SUM.
                _doc(ws_id, "f.txt"),
                _doc(ws_id, "archived.txt", deleted=True, size=7),
            ]
        )
        db_session.add_all(
            [
                Folder(id=uuid.uuid4(), workspace_id=uuid.UUID(ws_id), name="Finance"),
                Folder(id=uuid.uuid4(), workspace_id=uuid.UUID(ws_id), name="Legal"),
            ]
        )
        await db_session.commit()

        body = await _stats(client, headers, ws_id)
        assert body == {
            "total_documents": 6,  # the archived row is counted separately
            "archived_documents": 1,
            "total_bytes": 407,  # 100 + 250 + 50 + 7; absent sizes contribute nothing
            # a, b, f (default CLEAN) and the archived row: scan_status is not
            # filtered on deleted_at, so the scan counts cover the whole workspace.
            "clean_count": 4,
            "quarantined_count": 2,
            "scanning_count": 1,
            "folder_count": 2,
            "active_share_count": 0,
        }

    async def test_stats_exclude_other_workspaces(self, client: AsyncClient, db_session):
        """A workspace's numbers must not include its neighbours' rows."""
        headers_a = await _auth(client, "stats_iso_a@vaeloom.test")
        headers_b = await _auth(client, "stats_iso_b@vaeloom.test")
        ws_a = await _workspace(client, headers_a, "Stats A")
        ws_b = await _workspace(client, headers_b, "Stats B")

        db_session.add_all(
            [
                _doc(ws_a, "a_only.txt", size=10),
                _doc(ws_b, "b_one.txt", size=999),
                _doc(ws_b, "b_two.txt", size=1, scan_status="QUARANTINED"),
                Folder(id=uuid.uuid4(), workspace_id=uuid.UUID(ws_b), name="B folder"),
            ]
        )
        await db_session.commit()

        body_a = await _stats(client, headers_a, ws_a)
        assert body_a["total_documents"] == 1
        assert body_a["total_bytes"] == 10
        assert body_a["quarantined_count"] == 0
        assert body_a["folder_count"] == 0

        body_b = await _stats(client, headers_b, ws_b)
        assert body_b["total_documents"] == 2
        assert body_b["total_bytes"] == 1000
        assert body_b["quarantined_count"] == 1
        assert body_b["folder_count"] == 1

    async def test_lapsed_share_is_not_counted(self, client: AsyncClient, db_session):
        """active_share_count must mean live, not merely present.

        A share that expired yesterday is still a row; counting it would report an
        access grant the workspace no longer has.
        """
        headers = await _auth(client, "stats_share@vaeloom.test")
        ws_id = await _workspace(client, headers)
        target = await _workspace(client, headers, "Stats Share Target")

        live_doc = _doc(ws_id, "live_shared.txt")
        dead_doc = _doc(ws_id, "lapsed_shared.txt")
        incoming = _doc(ws_id, "shared_elsewhere.txt")
        db_session.add_all([live_doc, dead_doc, incoming])
        await db_session.commit()

        now = datetime.now(UTC)
        db_session.add_all(
            [
                DocumentShare(
                    id=uuid.uuid4(),
                    document_id=live_doc.id,
                    source_workspace_id=uuid.UUID(ws_id),
                    target_workspace_id=uuid.UUID(target),
                    permission="read",
                ),
                DocumentShare(
                    id=uuid.uuid4(),
                    document_id=dead_doc.id,
                    source_workspace_id=uuid.UUID(ws_id),
                    target_workspace_id=uuid.UUID(target),
                    permission="read",
                    expires_at=now - timedelta(days=1),
                ),
                # Granted BY the target workspace, not by this one: not this
                # workspace's exposure, so it must not be counted here.
                DocumentShare(
                    id=uuid.uuid4(),
                    document_id=incoming.id,
                    source_workspace_id=uuid.UUID(target),
                    target_workspace_id=uuid.UUID(ws_id),
                    permission="read",
                ),
            ]
        )
        await db_session.commit()

        body = await _stats(client, headers, ws_id)
        assert body["active_share_count"] == 1

    async def test_share_expiring_in_the_future_still_counts(self, client: AsyncClient, db_session):
        headers = await _auth(client, "stats_future@vaeloom.test")
        ws_id = await _workspace(client, headers)
        target = await _workspace(client, headers, "Stats Future Target")

        doc = _doc(ws_id, "future_shared.txt")
        db_session.add(doc)
        await db_session.commit()
        db_session.add(
            DocumentShare(
                id=uuid.uuid4(),
                document_id=doc.id,
                source_workspace_id=uuid.UUID(ws_id),
                target_workspace_id=uuid.UUID(target),
                permission="write",
                expires_at=datetime.now(UTC) + timedelta(days=7),
            )
        )
        await db_session.commit()

        assert (await _stats(client, headers, ws_id))["active_share_count"] == 1

    async def test_non_numeric_size_is_ignored_not_summed(self, client: AsyncClient, db_session):
        """A garbage `size` must contribute 0 rather than aborting the aggregate.

        SQLite's CAST would silently turn "unknown" into 0; PostgreSQL raises on the
        cast, so the numeric guard is what keeps the two dialects in agreement.
        """
        headers = await _auth(client, "stats_garbage@vaeloom.test")
        ws_id = await _workspace(client, headers)

        db_session.add_all(
            [
                _doc(ws_id, "ok.txt", size=42),
                _doc(ws_id, "garbage.txt", size="not-a-number"),
                _doc(ws_id, "empty_string.txt", size=""),
            ]
        )
        await db_session.commit()

        assert (await _stats(client, headers, ws_id))["total_bytes"] == 42

    async def test_empty_workspace_reports_zeros_not_nulls(self, client: AsyncClient):
        headers = await _auth(client, "stats_empty@vaeloom.test")
        ws_id = await _workspace(client, headers)

        assert await _stats(client, headers, ws_id) == {
            "total_documents": 0,
            "archived_documents": 0,
            "total_bytes": 0,
            "clean_count": 0,
            "quarantined_count": 0,
            "scanning_count": 0,
            "folder_count": 0,
            "active_share_count": 0,
        }

    async def test_stats_require_membership(self, client: AsyncClient, db_session):
        """Read-level but still workspace-scoped: no membership, no counts."""
        owner = await _auth(client, "stats_owner@vaeloom.test")
        ws_id = await _workspace(client, owner)
        db_session.add(_doc(ws_id, "owner_doc.txt", size=5))
        await db_session.commit()

        stranger = await _auth(client, "stats_stranger@vaeloom.test")
        res = await client.get(
            f"/api/v1/documents/stats?workspace_id={ws_id}", headers=stranger
        )
        assert res.status_code == 403
        assert "total_documents" not in res.json()

    async def test_stats_requires_workspace_id(self, client: AsyncClient):
        headers = await _auth(client, "stats_nows@vaeloom.test")
        res = await client.get("/api/v1/documents/stats", headers=headers)
        assert res.status_code == 422

    async def test_stats_matches_the_list_endpoint_total(self, client: AsyncClient, db_session):
        """The two numbers the header shows must share a denominator."""
        headers = await _auth(client, "stats_parity@vaeloom.test")
        ws_id = await _workspace(client, headers)

        db_session.add_all(
            [
                _doc(ws_id, "live_1.txt"),
                _doc(ws_id, "live_2.txt"),
                _doc(ws_id, "gone.txt", deleted=True),
            ]
        )
        await db_session.commit()

        stats = await _stats(client, headers, ws_id)
        listing = await client.get(f"/api/v1/documents?workspace_id={ws_id}", headers=headers)
        assert listing.status_code == 200
        body = listing.json()

        assert body["total"] == stats["total_documents"] == 2
        archived = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&include_archived=true", headers=headers
        )
        assert archived.json()["total"] == 3
        assert stats["archived_documents"] == 3 - stats["total_documents"]

    async def test_stats_does_not_return_extra_keys(self, client: AsyncClient):
        """The response is a fixed contract; a stray column would reach the client."""
        headers = await _auth(client, "stats_shape@vaeloom.test")
        ws_id = await _workspace(client, headers)

        assert set(await _stats(client, headers, ws_id)) == {
            "total_documents",
            "archived_documents",
            "total_bytes",
            "clean_count",
            "quarantined_count",
            "scanning_count",
            "folder_count",
            "active_share_count",
        }