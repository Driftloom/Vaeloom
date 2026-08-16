import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestKnowledgeGraph:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "kg@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_node(self, client, headers, **overrides):
        payload = {"label": "Test Node", "type": "concept", **overrides}
        res = await client.post("/api/v1/knowledge-graph/nodes", json=payload, headers=headers)
        assert res.status_code == 201
        return res.json()["id"]

    async def _create_edge(self, client, headers, source_id, target_id, relationship="connects"):
        res = await client.post(
            f"/api/v1/knowledge-graph/nodes/{source_id}/edges",
            json={"target_id": target_id, "relationship": relationship},
            headers=headers,
        )
        assert res.status_code == 201
        return res.json()["id"]

    async def test_create_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Person",
            "type": "person",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_nodes(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/knowledge-graph/nodes", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    async def test_get_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Get Test",
            "type": "concept",
        }, headers=headers)
        assert created.status_code == 201
        nid = created.json()["id"]
        res = await client.get(f"/api/v1/knowledge-graph/nodes/{nid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["label"] == "Get Test"

    async def test_get_node_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_create_edge(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Source",
            "type": "concept",
        }, headers=headers)
        assert n1.status_code == 201
        n1_id = n1.json()["id"]
        n2 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Target",
            "type": "concept",
        }, headers=headers)
        assert n2.status_code == 201
        n2_id = n2.json()["id"]
        res = await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "knows"},
            headers=headers,
        )
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_create_duplicate_edge(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1_id = await self._create_node(client, headers, label="Dup Source")
        n2_id = await self._create_node(client, headers, label="Dup Target")
        await self._create_edge(client, headers, n1_id, n2_id, "duplicates")
        res = await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "duplicates"},
            headers=headers,
        )
        assert res.status_code == 409

    async def test_create_edge_nonexistent_target(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1_id = await self._create_node(client, headers, label="Source Only")
        fake_id = str(uuid.uuid4())
        res = await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": fake_id, "relationship": "to-nowhere"},
            headers=headers,
        )
        assert res.status_code == 409

    async def test_list_edges(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/knowledge-graph/edges", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    async def test_list_edges_by_relationship(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await self._create_node(client, headers, label="Rel A")
        n2 = await self._create_node(client, headers, label="Rel B")
        n3 = await self._create_node(client, headers, label="Rel C")
        await self._create_edge(client, headers, n1, n2, "special_rel")
        await self._create_edge(client, headers, n1, n3, "other_rel")
        res = await client.get("/api/v1/knowledge-graph/edges?relationship=special_rel", headers=headers)
        assert res.status_code == 200
        data = res.json()
        for item in data["items"]:
            assert item["relationship"] == "special_rel"

    async def test_knowledge_graph_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "No Auth",
        })
        assert res.status_code == 401

    async def test_update_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Before Update",
            "type": "entity",
        }, headers=headers)
        assert created.status_code == 201
        nid = created.json()["id"]
        res = await client.put(f"/api/v1/knowledge-graph/nodes/{nid}", json={
            "label": "Updated",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["label"] == "Updated"

    async def test_delete_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Delete Me",
            "type": "entity",
        }, headers=headers)
        assert created.status_code == 201
        nid = created.json()["id"]
        res = await client.delete(f"/api/v1/knowledge-graph/nodes/{nid}", headers=headers)
        assert res.status_code == 204

    async def test_delete_nonexistent_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_delete_edge(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Edge Source",
            "type": "entity",
        }, headers=headers)
        assert n1.status_code == 201
        n1_id = n1.json()["id"]
        n2 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Edge Target",
            "type": "entity",
        }, headers=headers)
        assert n2.status_code == 201
        n2_id = n2.json()["id"]
        edge = await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "related"},
            headers=headers,
        )
        assert edge.status_code == 201
        eid = edge.json()["id"]
        res = await client.delete(f"/api/v1/knowledge-graph/edges/{eid}", headers=headers)
        assert res.status_code == 204

    async def test_delete_nonexistent_edge(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.delete(f"/api/v1/knowledge-graph/edges/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_traverse(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Traverse A",
            "type": "entity",
        }, headers=headers)
        assert n1.status_code == 201
        n1_id = n1.json()["id"]
        n2 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Traverse B",
            "type": "entity",
        }, headers=headers)
        assert n2.status_code == 201
        n2_id = n2.json()["id"]
        await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "connects"},
            headers=headers,
        )
        res = await client.post("/api/v1/knowledge-graph/traverse", json={
            "start_id": str(n1_id),
            "depth": 2,
            "mode": "bfs",
        }, headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_traverse_nonexistent_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        fake_id = str(uuid.uuid4())
        res = await client.post("/api/v1/knowledge-graph/traverse", json={
            "start_id": fake_id,
            "depth": 2,
            "mode": "bfs",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json() == []

    async def test_traverse_dfs_mode(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1_id = await self._create_node(client, headers, label="DFS A")
        n2_id = await self._create_node(client, headers, label="DFS B")
        await self._create_edge(client, headers, n1_id, n2_id)
        res = await client.post("/api/v1/knowledge-graph/traverse", json={
            "start_id": str(n1_id),
            "depth": 3,
            "mode": "dfs",
        }, headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    async def test_find_path(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Path A",
            "type": "entity",
        }, headers=headers)
        assert n1.status_code == 201
        n1_id = n1.json()["id"]
        n2 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Path B",
            "type": "entity",
        }, headers=headers)
        assert n2.status_code == 201
        n2_id = n2.json()["id"]
        await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "connects"},
            headers=headers,
        )
        res = await client.get(
            "/api/v1/knowledge-graph/path",
            params={"from_id": str(n1_id), "to_id": str(n2_id)},
            headers=headers,
        )
        assert res.status_code == 200
        assert "path" in res.json()

    async def test_find_path_no_path(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1_id = await self._create_node(client, headers, label="Island A")
        n2_id = await self._create_node(client, headers, label="Island B")
        res = await client.get(
            "/api/v1/knowledge-graph/path",
            params={"from_id": str(n1_id), "to_id": str(n2_id)},
            headers=headers,
        )
        assert res.status_code == 404

    async def test_find_path_same_node(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1_id = await self._create_node(client, headers, label="Self Node")
        res = await client.get(
            "/api/v1/knowledge-graph/path",
            params={"from_id": str(n1_id), "to_id": str(n1_id)},
            headers=headers,
        )
        assert res.status_code == 200
        assert len(res.json()["path"]) == 1

    async def test_list_nodes_with_search_filter(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_node(client, headers, label="Alpha", type="concept")
        await self._create_node(client, headers, label="Beta", type="entity")
        res = await client.get("/api/v1/knowledge-graph/nodes?search=Alpha", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert all("Alpha" in item["label"] for item in data["items"])

    async def test_endpoints_require_auth(self, db_session):
        from api.database import get_db
        from api.dependencies import get_current_user
        from api.routers import knowledge_graph
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(knowledge_graph.router, prefix="/api/v1/knowledge-graph")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.post("/api/v1/knowledge-graph/nodes", json={"label": "x", "type": "concept"})).status_code == 401
            assert (await ac.get("/api/v1/knowledge-graph/nodes")).status_code == 401
            assert (await ac.get(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}")).status_code == 401
            assert (await ac.put(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}", json={"label": "x"})).status_code == 401
            assert (await ac.delete(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}")).status_code == 401
            assert (await ac.post(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}/edges", json={"target_id": str(uuid.uuid4()), "relationship": "r"})).status_code == 401
            assert (await ac.get(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}/edges")).status_code == 401
            assert (await ac.get("/api/v1/knowledge-graph/edges")).status_code == 401
            assert (await ac.delete(f"/api/v1/knowledge-graph/edges/{uuid.uuid4()}")).status_code == 401
            assert (await ac.post("/api/v1/knowledge-graph/traverse", json={"start_id": str(uuid.uuid4()), "depth": 2, "mode": "bfs"})).status_code == 401
            assert (await ac.get("/api/v1/knowledge-graph/path", params={"from_id": str(uuid.uuid4()), "to_id": str(uuid.uuid4())})).status_code == 401

    async def test_update_node_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.put(f"/api/v1/knowledge-graph/nodes/{uuid.uuid4()}", json={
            "label": "Not Found",
        }, headers=headers)
        assert res.status_code == 404

    async def test_list_node_edges(self, client: AsyncClient):
        headers = await self._auth_header(client)
        n1 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Edge List Source",
            "type": "entity",
        }, headers=headers)
        assert n1.status_code == 201
        n1_id = n1.json()["id"]
        n2 = await client.post("/api/v1/knowledge-graph/nodes", json={
            "label": "Edge List Target",
            "type": "entity",
        }, headers=headers)
        assert n2.status_code == 201
        n2_id = n2.json()["id"]
        await client.post(
            f"/api/v1/knowledge-graph/nodes/{n1_id}/edges",
            json={"target_id": n2_id, "relationship": "connects"},
            headers=headers,
        )
        res = await client.get(f"/api/v1/knowledge-graph/nodes/{n1_id}/edges", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data
