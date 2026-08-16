import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAudit:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "audit@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def _create_event(self, client, headers, **overrides):
        payload = {
            "actor_id": "user-1",
            "action": "test_action",
            "resource": "test",
            "resource_id": "123",
            **overrides,
        }
        return await client.post("/api/v1/audit/events", json=payload, headers=headers)

    async def test_track_event(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await self._create_event(client, headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_events(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/audit/events", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    async def test_list_events_filtered(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers, action="login")
        await self._create_event(client, headers, action="logout")
        res = await client.get(
            "/api/v1/audit/events?action=login",
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["total"] >= 1

    async def test_audit_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/audit/events", json={
            "actor_id": "user-1",
            "action": "test_action",
            "resource": "test",
        })
        assert res.status_code == 401

    async def test_get_event_by_id(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await self._create_event(client, headers)
        eid = created.json()["id"]
        res = await client.get(f"/api/v1/audit/events/{eid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["id"] == eid
        assert res.json()["action"] == "test_action"

    async def test_get_event_not_found(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get(f"/api/v1/audit/events/{uuid.uuid4()}", headers=headers)
        assert res.status_code == 404

    async def test_list_events_pagination(self, client: AsyncClient):
        headers = await self._auth_header(client)
        for i in range(5):
            await self._create_event(client, headers, action=f"paginate_{i}")
        res = await client.get("/api/v1/audit/events?page=1&page_size=2", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) <= 2
        assert data["total"] >= 5
        assert data["page"] == 1
        assert data["page_size"] == 2

    async def test_list_events_filter_by_resource(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers, resource="doc-1", action="view")
        await self._create_event(client, headers, resource="doc-2", action="edit")
        res = await client.get("/api/v1/audit/events?resource=doc-1", headers=headers)
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["resource"] == "doc-1"

    async def test_list_events_filter_by_actor(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers, actor_id="alice@test.com")
        await self._create_event(client, headers, actor_id="bob@test.com")
        res = await client.get("/api/v1/audit/events?actor_id=alice@test.com", headers=headers)
        assert res.status_code == 200
        for item in res.json()["items"]:
            assert item["actor_id"] == "alice@test.com"

    async def test_export_events_json(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers)
        res = await client.post("/api/v1/audit/export?format=json", headers=headers)
        assert res.status_code == 200
        import json
        data = json.loads(res.text)
        assert isinstance(data, list)

    async def test_export_events_csv(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers)
        res = await client.post("/api/v1/audit/export?format=csv", headers=headers)
        assert res.status_code == 200
        assert "actor_id" in res.text

    async def test_compliance_report(self, client: AsyncClient):
        headers = await self._auth_header(client)
        await self._create_event(client, headers, action="create")
        await self._create_event(client, headers, action="update")
        res = await client.get("/api/v1/audit/compliance/report", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "by_action" in data
        assert "by_resource" in data
        assert "total" in data
        assert data["total"] >= 2

    async def test_track_event_with_metadata(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await self._create_event(client, headers, metadata={"ip": "192.168.1.1", "user_agent": "test"})
        assert res.status_code == 201
        eid = res.json()["id"]
        fetched = await client.get(f"/api/v1/audit/events/{eid}", headers=headers)
        assert fetched.json()["metadata"]["ip"] == "192.168.1.1"
