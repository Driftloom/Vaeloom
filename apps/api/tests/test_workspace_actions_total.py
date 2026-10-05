"""`GET /workspaces/{workspace_id}/document-actions` must report a real total.

The endpoint caps the page at 100 rows and then reported `total=len(actions)`,
i.e. the size of the CAP, so a workspace with 3,000 actions told every client it
had exactly 100 — the same bug the documents router already fixed. A row cap is a
display decision; the total is a fact about the workspace.
"""
import uuid

import pytest
from httpx import AsyncClient

from api.models.schema import DocumentAction

pytestmark = pytest.mark.asyncio

PAGE_CAP = 100
OVER_CAP = 137


async def _auth(client: AsyncClient, email: str) -> dict:
    res = await client.post(
        "/api/v1/auth/signup", json={"email": email, "password": "Actions1234!"}
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _workspace(client: AsyncClient, headers: dict, name: str) -> str:
    res = await client.post("/api/v1/workspaces", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _seed_actions(db_session, ws_id: str, count: int) -> None:
    ws_uuid = uuid.UUID(ws_id)
    db_session.add_all(
        [
            DocumentAction(
                id=uuid.uuid4(),
                document_id=uuid.uuid4(),
                workspace_id=ws_uuid,
                action_type="document_rename",
                new_path=f"seeded_{i}.txt",
            )
            for i in range(count)
        ]
    )
    await db_session.commit()


class TestWorkspaceDocumentActionsTotal:
    async def test_total_exceeds_the_page_cap(self, client: AsyncClient, db_session):
        headers = await _auth(client, "actions_total@vaeloom.test")
        ws_id = await _workspace(client, headers, "Actions WS")
        await _seed_actions(db_session, ws_id, OVER_CAP)

        res = await client.get(
            f"/api/v1/workspaces/{ws_id}/document-actions", headers=headers
        )
        assert res.status_code == 200, res.text
        body = res.json()

        assert len(body["actions"]) == PAGE_CAP
        # The whole point: the total is not the page size.
        assert body["total"] == OVER_CAP
        assert body["total"] > len(body["actions"])

    async def test_total_matches_rows_below_the_cap(self, client: AsyncClient, db_session):
        headers = await _auth(client, "actions_under@vaeloom.test")
        ws_id = await _workspace(client, headers, "Actions Under WS")
        await _seed_actions(db_session, ws_id, 3)

        res = await client.get(
            f"/api/v1/workspaces/{ws_id}/document-actions", headers=headers
        )
        assert res.status_code == 200
        body = res.json()
        assert body["total"] == 3
        assert len(body["actions"]) == 3

    async def test_empty_workspace_reports_zero(self, client: AsyncClient):
        headers = await _auth(client, "actions_empty@vaeloom.test")
        ws_id = await _workspace(client, headers, "Actions Empty WS")

        res = await client.get(
            f"/api/v1/workspaces/{ws_id}/document-actions", headers=headers
        )
        assert res.status_code == 200
        assert res.json() == {"actions": [], "total": 0}

    async def test_total_is_scoped_to_the_workspace(self, client: AsyncClient, db_session):
        headers_a = await _auth(client, "actions_iso_a@vaeloom.test")
        headers_b = await _auth(client, "actions_iso_b@vaeloom.test")
        ws_a = await _workspace(client, headers_a, "Actions A")
        ws_b = await _workspace(client, headers_b, "Actions B")
        await _seed_actions(db_session, ws_a, 5)
        await _seed_actions(db_session, ws_b, 9)

        res = await client.get(f"/api/v1/workspaces/{ws_a}/document-actions", headers=headers_a)
        assert res.status_code == 200
        assert res.json()["total"] == 5

    async def test_actions_require_workspace_membership(self, client: AsyncClient, db_session):
        owner = await _auth(client, "actions_owner@vaeloom.test")
        ws_id = await _workspace(client, owner, "Actions Private WS")
        await _seed_actions(db_session, ws_id, 2)

        stranger = await _auth(client, "actions_stranger@vaeloom.test")
        res = await client.get(
            f"/api/v1/workspaces/{ws_id}/document-actions", headers=stranger
        )
        assert res.status_code == 404
        assert "total" not in res.json()