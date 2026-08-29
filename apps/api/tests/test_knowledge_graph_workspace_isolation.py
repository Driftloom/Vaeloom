import uuid

import pytest
from sqlalchemy import text

from api.schemas.knowledge_graph import CreateEdgeRequest, CreateNodeRequest
from api.services.knowledge_graph_service import kg_service

pytestmark = pytest.mark.asyncio


async def _make_node(db, *, workspace_id, tenant_id="t", label="n"):
    dto = CreateNodeRequest(label=label, type="person", description="d")
    return await kg_service.create_node(dto, tenant_id, db, workspace_id=str(workspace_id))


# ── Service-layer isolation (primary, matches F-03 evidence tier L3) ──


async def test_create_node_stores_workspace(db_session):
    ws = uuid.uuid4()
    row = await _make_node(db_session, workspace_id=ws)
    assert str(row._mapping["workspace_id"]) == str(ws)


async def test_list_nodes_isolated(db_session):
    ws_a, ws_b = uuid.uuid4(), uuid.uuid4()
    await _make_node(db_session, workspace_id=ws_a, label="only-a")
    await _make_node(db_session, workspace_id=ws_b, label="only-b")

    rows_a, total_a = await kg_service.list_nodes(
        1, 50, None, None, None, None, None, None, "t", db_session, workspace_id=str(ws_a)
    )
    assert total_a == 1 and rows_a[0]._mapping["label"] == "only-a"

    rows_b, total_b = await kg_service.list_nodes(
        1, 50, None, None, None, None, None, None, "t", db_session, workspace_id=str(ws_b)
    )
    assert total_b == 1 and rows_b[0]._mapping["label"] == "only-b"


async def test_get_node_cross_workspace_none(db_session):
    ws_a, ws_b = uuid.uuid4(), uuid.uuid4()
    row = await _make_node(db_session, workspace_id=ws_a)
    nid = uuid.UUID(row._mapping["id"])
    assert await kg_service.get_node(nid, db_session, workspace_id=str(ws_b)) is None
    assert await kg_service.get_node(nid, db_session, workspace_id=str(ws_a)) is not None


async def test_traverse_stays_in_workspace(db_session):
    ws_a, ws_b = uuid.uuid4(), uuid.uuid4()
    ra = await _make_node(db_session, workspace_id=ws_a, label="a")
    rb = await _make_node(db_session, workspace_id=ws_a, label="b")
    await kg_service.create_edge(
        uuid.UUID(ra._mapping["id"]),
        CreateEdgeRequest(target_id=rb._mapping["id"], relationship="rel"),
        db_session,
        workspace_id=str(ws_a),
    )
    res_a = await kg_service.traverse(uuid.UUID(ra._mapping["id"]), 3, "bfs", db_session, workspace_id=str(ws_a))
    assert len(res_a) == 2
    # Cross-workspace scope: start node not visible -> empty traversal.
    res_b = await kg_service.traverse(uuid.UUID(ra._mapping["id"]), 3, "bfs", db_session, workspace_id=str(ws_b))
    assert res_b == []


async def test_list_all_edges_isolated(db_session):
    ws_a, ws_b = uuid.uuid4(), uuid.uuid4()
    na = await _make_node(db_session, workspace_id=ws_a, label="a1")
    nb = await _make_node(db_session, workspace_id=ws_a, label="a2")
    await kg_service.create_edge(
        uuid.UUID(na._mapping["id"]),
        CreateEdgeRequest(target_id=nb._mapping["id"], relationship="rel"),
        db_session,
        workspace_id=str(ws_a),
    )
    _, total_a = await kg_service.list_all_edges(1, 50, None, db_session, tenant_id="t", workspace_id=str(ws_a))
    assert total_a == 1
    _, total_b = await kg_service.list_all_edges(1, 50, None, db_session, tenant_id="t", workspace_id=str(ws_b))
    assert total_b == 0


# ── API-layer wiring (router passes authoritative workspace_id via X-Workspace-ID) ──


class TestKnowledgeGraphWorkspaceIsolationAPI:
    async def _auth(self, client, email):
        res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "Test1234!"})
        assert res.status_code == 201, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    async def _ws_id(self, db_session, email):
        row = (await db_session.execute(
            text("SELECT w.id FROM workspaces w JOIN users u ON u.id = w.user_id WHERE u.email = :email"),
            {"email": email},
        )).fetchone()
        assert row is not None, "workspace not found for user"
        return str(row[0])

    async def test_api_list_nodes_isolated(self, client, db_session):
        ha = await self._auth(client, "kgapi-a@test.com")
        hb = await self._auth(client, "kgapi-b@test.com")
        wsa = await self._ws_id(db_session, "kgapi-a@test.com")
        wsb = await self._ws_id(db_session, "kgapi-b@test.com")

        cn = await client.post(
            "/api/v1/knowledge-graph/nodes",
            json={"label": "only-a", "type": "person", "description": "d"},
            headers={**ha, "X-Workspace-ID": wsa},
        )
        assert cn.status_code == 201, cn.text

        res_b = await client.get("/api/v1/knowledge-graph/nodes", headers={**hb, "X-Workspace-ID": wsb})
        assert res_b.status_code == 200
        assert all(it["label"] != "only-a" for it in res_b.json()["items"])

        res_a = await client.get("/api/v1/knowledge-graph/nodes", headers={**ha, "X-Workspace-ID": wsa})
        assert any(it["label"] == "only-a" for it in res_a.json()["items"])

    async def test_api_get_node_cross_workspace_404(self, client, db_session):
        ha = await self._auth(client, "kgapi-ga@test.com")
        hb = await self._auth(client, "kgapi-gb@test.com")
        wsa = await self._ws_id(db_session, "kgapi-ga@test.com")
        wsb = await self._ws_id(db_session, "kgapi-gb@test.com")

        cn = await client.post(
            "/api/v1/knowledge-graph/nodes",
            json={"label": "secret", "type": "person", "description": "d"},
            headers={**ha, "X-Workspace-ID": wsa},
        )
        nid = cn.json()["id"]

        assert (await client.get(f"/api/v1/knowledge-graph/nodes/{nid}", headers={**hb, "X-Workspace-ID": wsb})).status_code == 404
        assert (await client.get(f"/api/v1/knowledge-graph/nodes/{nid}", headers={**ha, "X-Workspace-ID": wsa})).status_code == 200
