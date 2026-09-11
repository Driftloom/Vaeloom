"""APP-KG-01 HTTP matrix: two users, two workspaces, cross-attempts denied.

Workspace A: A1 -> A2 ; Workspace B: B1 -> B2 (each owned by its user).
Attempts A1->B2, B1<->A*, foreign get/update/delete/traverse/path/edges
must fail closed (404/empty) via router AND service. No foreign nodes,
edges, traversal, or mutation.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient, email: str) -> dict:
    r = await client.post("/api/v1/auth/signup",
                          json={"email": email, "password": "Test1234!"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _node(client: AsyncClient, h: dict, label: str, ws: str | None = None) -> str:
    hdr = dict(h)
    if ws:
        hdr["X-Workspace-ID"] = ws
    r = await client.post("/api/v1/knowledge-graph/nodes",
                          json={"label": label, "type": "entity"}, headers=hdr)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _ws(client: AsyncClient, h: dict, name: str) -> str:
    r = await client.post("/api/v1/workspaces", json={"name": name}, headers=h)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture()
async def two_worlds(client: AsyncClient):
    ha = await _signup(client, "kg-a@test.com")
    hb = await _signup(client, "kg-b@test.com")
    wa = await _ws(client, ha, "A")
    wb = await _ws(client, hb, "B")
    a1 = await _node(client, ha, "A1", wa)
    a2 = await _node(client, ha, "A2", wa)
    b1 = await _node(client, hb, "B1", wb)
    b2 = await _node(client, hb, "B2", wb)
    for src, tgt, h, w in ((a1, a2, ha, wa), (b1, b2, hb, wb)):
        r = await client.post(f"/api/v1/knowledge-graph/nodes/{src}/edges",
                              json={"target_id": tgt, "relationship": "rel"},
                              headers={**h, "X-Workspace-ID": w})
        assert r.status_code == 201, r.text
    return {"ha": ha, "hb": hb, "wa": wa, "wb": wb,
            "a1": a1, "a2": a2, "b1": b1, "b2": b2}


def _h(h, w):
    return {**h, "X-Workspace-ID": w}


class TestKgHttpMatrix:
    async def test_foreign_get_404(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.get(f"/api/v1/knowledge-graph/nodes/{w['b1']}",
                             headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 404, r.text

    async def test_foreign_update_404(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.put(f"/api/v1/knowledge-graph/nodes/{w['b1']}",
                             json={"label": "PWN"}, headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 404, r.text

    async def test_foreign_delete_404(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.delete(f"/api/v1/knowledge-graph/nodes/{w['b1']}",
                                headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 404, r.text
        # B1 still exists for its owner
        r2 = await client.get(f"/api/v1/knowledge-graph/nodes/{w['b1']}",
                              headers=_h(w["hb"], w["wb"]))
        assert r2.status_code == 200, r2.text

    async def test_cross_edge_409(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.post(f"/api/v1/knowledge-graph/nodes/{w['a1']}/edges",
                              json={"target_id": w["b2"], "relationship": "x"},
                              headers=_h(w["ha"], w["wa"]))
        assert r.status_code in (404, 409), r.text

    async def test_traverse_stays_inside(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.post("/api/v1/knowledge-graph/traverse",
                              json={"start_id": w["a1"], "depth": 3, "mode": "bfs"},
                              headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 200, r.text
        labels = {n["label"] for n in r.json()}
        assert labels <= {"A1", "A2"}, labels

    async def test_path_cross_workspace_404(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.get("/api/v1/knowledge-graph/path",
                             params={"from_id": w["a1"], "to_id": w["b1"]},
                             headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 404, r.text

    async def test_list_hides_foreign(self, client: AsyncClient, two_worlds):
        w = two_worlds
        r = await client.get("/api/v1/knowledge-graph/nodes",
                             headers=_h(w["ha"], w["wa"]))
        assert r.status_code == 200, r.text
        labels = {n["label"] for n in r.json()["items"]}
        assert "B1" not in labels and "B2" not in labels, labels
        # edges dump likewise
        e = await client.get("/api/v1/knowledge-graph/edges",
                             headers=_h(w["ha"], w["wa"]))
        assert e.status_code == 200, e.text
        for edge in e.json()["items"]:
            assert edge["source"]["label"] in ("A1", "A2"), edge
            assert edge["target"]["label"] in ("A1", "A2"), edge
