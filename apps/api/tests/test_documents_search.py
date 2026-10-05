"""`GET /documents/search` pagination envelope and the `GET /documents` category filter.

Both are server-side narrowing decisions that were previously impossible or wrong:
search answered with a bare array (no total, so a truncated page was
indistinguishable from a complete one) and the category filter did not exist at
all, which pushed the documents list into filtering one page of rows in the
browser while showing a workspace total next to it.

Every count asserted here is an exact integer computed from rows the test itself
inserted, never "at least one".
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from api.models.schema import Document

pytestmark = pytest.mark.asyncio


class TestDocumentSearchEnvelope:
    async def _auth(self, client: AsyncClient, email: str) -> dict:
        res = await client.post(
            "/api/v1/auth/signup", json={"email": email, "password": "Search1234!"}
        )
        assert res.status_code == 201, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Search WS"}, headers=headers)
        assert res.status_code == 201, res.text
        return res.json()["id"]

    async def _upload(self, client: AsyncClient, headers: dict, ws_id: str, name: str) -> str:
        res = await client.post(
            f"/api/v1/documents?workspace_id={ws_id}",
            files={"file": (name, f"quarterly {name} body".encode(), "text/plain")},
            headers=headers,
        )
        assert res.status_code == 201, res.text
        return res.json()["id"]

    async def test_search_returns_envelope_with_real_total(self, client: AsyncClient):
        headers = await self._auth(client, "envelope@vaeloom.test")
        ws_id = await self._workspace(client, headers)
        for i in range(3):
            await self._upload(client, headers, ws_id, f"envelope_note_{i}.txt")

        res = await client.get(
            f"/api/v1/documents/search?workspace_id={ws_id}&q=envelope_note", headers=headers
        )
        assert res.status_code == 200
        body = res.json()

        # The envelope keys are the contract: a bare array here is the bug.
        assert set(body) == {"documents", "total", "limit", "offset"}
        assert body["total"] == 3
        assert body["limit"] == 50
        assert body["offset"] == 0
        assert len(body["documents"]) == 3
        assert all("envelope_note" in d["path"] for d in body["documents"])

    async def test_total_counts_matches_beyond_the_page(self, client: AsyncClient):
        """A capped page must still report the full match count.

        5 matches fetched 2 at a time: page 1 carries 2 rows and total 5. Under the
        old bare-array shape the client could only ever see len(rows) == 2 and had
        no way to know two more pages existed.
        """
        headers = await self._auth(client, "paged@vaeloom.test")
        ws_id = await self._workspace(client, headers)
        for i in range(5):
            await self._upload(client, headers, ws_id, f"paged_doc_{i}.txt")

        seen: list[str] = []
        for offset in (0, 2, 4):
            res = await client.get(
                f"/api/v1/documents/search?workspace_id={ws_id}&q=paged_doc&limit=2&offset={offset}",
                headers=headers,
            )
            assert res.status_code == 200, res.text
            body = res.json()
            assert body["total"] == 5
            assert body["limit"] == 2
            assert body["offset"] == offset
            seen.extend(d["path"] for d in body["documents"])

        assert len(seen) == 5
        assert len(set(seen)) == 5, "offset paging returned a duplicate row"

    async def test_search_envelope_for_zero_matches(self, client: AsyncClient):
        headers = await self._auth(client, "nomatch@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        res = await client.get(
            f"/api/v1/documents/search?workspace_id={ws_id}&q=nothing_matches_this", headers=headers
        )
        assert res.status_code == 200
        body = res.json()
        assert body == {"documents": [], "total": 0, "limit": 50, "offset": 0}

    async def test_search_still_requires_workspace_membership(self, client: AsyncClient):
        """The envelope must not become a cross-tenant oracle."""
        owner = await self._auth(client, "search_owner@vaeloom.test")
        ws_id = await self._workspace(client, owner)
        await self._upload(client, owner, ws_id, "private_owner.txt")

        stranger = await self._auth(client, "search_stranger@vaeloom.test")
        res = await client.get(
            f"/api/v1/documents/search?workspace_id={ws_id}&q=private_owner", headers=stranger
        )
        assert res.status_code == 403
        assert "documents" not in res.json()

    async def test_search_rejects_out_of_range_pagination(self, client: AsyncClient):
        headers = await self._auth(client, "bounds@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        for qs, expected in (("limit=0", 422), ("limit=101", 422), ("offset=-1", 422)):
            res = await client.get(
                f"/api/v1/documents/search?workspace_id={ws_id}&q=note&{qs}", headers=headers
            )
            assert res.status_code == expected, f"{qs} -> {res.status_code}"


class TestDocumentCategoryFilter:
    async def _auth(self, client: AsyncClient, email: str) -> dict:
        res = await client.post(
            "/api/v1/auth/signup", json={"email": email, "password": "Category1234!"}
        )
        assert res.status_code == 201, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _workspace(self, client: AsyncClient, headers: dict) -> str:
        res = await client.post("/api/v1/workspaces", json={"name": "Category WS"}, headers=headers)
        assert res.status_code == 201, res.text
        return res.json()["id"]

    def _doc(self, ws_id: str, path: str, metadata: dict) -> Document:
        return Document(
            id=uuid.uuid4(),
            workspace_id=uuid.UUID(ws_id),
            path=path,
            type="text",
            metadata_=metadata,
        )

    async def test_category_filter_is_server_side(self, client: AsyncClient, db_session):
        """The narrowed page AND the total must both come from the server.

        Filtering the current page in the browser is what made the count disagree
        with the rows: `total` came from the unfiltered query.
        """
        headers = await self._auth(client, "catfilter@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        db_session.add_all(
            [
                self._doc(ws_id, "fin_report.txt", {"category": "finance"}),
                self._doc(ws_id, "fin_notes.txt", {"category": "finance"}),
                self._doc(ws_id, "resume.txt", {"category": "career"}),
                self._doc(ws_id, "uncategorised.txt", {}),
            ]
        )
        await db_session.commit()

        res = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&category=finance", headers=headers
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["total"] == 2
        assert sorted(d["path"] for d in body["documents"]) == ["fin_notes.txt", "fin_report.txt"]

        other = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&category=career", headers=headers
        )
        assert other.status_code == 200
        assert other.json()["total"] == 1

        # A category nothing carries must return an empty page, not the unfiltered set.
        none_match = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&category=legal", headers=headers
        )
        assert none_match.status_code == 200
        assert none_match.json()["documents"] == []
        assert none_match.json()["total"] == 0

    async def test_category_filter_ignores_other_metadata_keys(self, client: AsyncClient, db_session):
        """`folder` is a sibling key; matching it must not satisfy a category filter."""
        headers = await self._auth(client, "catkey@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        db_session.add(
            self._doc(ws_id, "sibling_key.txt", {"folder": "/finance", "category": "other"})
        )
        await db_session.commit()

        res = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&category=finance", headers=headers
        )
        assert res.status_code == 200
        assert res.json()["total"] == 0

    async def test_category_composes_with_status_filter(self, client: AsyncClient, db_session):
        headers = await self._auth(client, "catstatus@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        db_session.add_all(
            [
                self._doc(ws_id, "active_fin.txt", {"category": "finance"}),
                Document(
                    id=uuid.uuid4(),
                    workspace_id=uuid.UUID(ws_id),
                    path="degraded_fin.txt",
                    type="text",
                    status="STORAGE_DEGRADED",
                    metadata_={"category": "finance"},
                ),
            ]
        )
        await db_session.commit()

        res = await client.get(
            f"/api/v1/documents?workspace_id={ws_id}&category=finance&status=STORAGE_DEGRADED",
            headers=headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 1
        assert body["documents"][0]["path"] == "degraded_fin.txt"

    async def test_omitted_category_returns_everything(self, client: AsyncClient, db_session):
        """None must stay 'no filter' — the new param cannot narrow by default."""
        headers = await self._auth(client, "catdefault@vaeloom.test")
        ws_id = await self._workspace(client, headers)

        db_session.add_all(
            [
                self._doc(ws_id, "a.txt", {"category": "finance"}),
                self._doc(ws_id, "b.txt", {}),
            ]
        )
        await db_session.commit()

        res = await client.get(f"/api/v1/documents?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 200
        assert res.json()["total"] == 2

    async def test_category_is_scoped_to_the_workspace(self, client: AsyncClient, db_session):
        headers_a = await self._auth(client, "catws_a@vaeloom.test")
        headers_b = await self._auth(client, "catws_b@vaeloom.test")
        ws_a = await self._workspace(client, headers_a)
        ws_b = await self._workspace(client, headers_b)

        db_session.add_all(
            [
                self._doc(ws_a, "a_secret.txt", {"category": "finance"}),
                self._doc(ws_b, "b_public.txt", {"category": "finance"}),
            ]
        )
        await db_session.commit()

        res = await client.get(
            f"/api/v1/documents?workspace_id={ws_b}&category=finance", headers=headers_b
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 1
        assert body["documents"][0]["path"] == "b_public.txt"