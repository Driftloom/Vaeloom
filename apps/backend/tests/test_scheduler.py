import uuid
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestScheduler:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "sched@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_create_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/scheduler/jobs", json={
            "name": "test",
            "type": "http",
            "cron": "* * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert res.status_code == 201
        assert "id" in res.json()

    async def test_list_jobs(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.get("/api/v1/scheduler/jobs", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_get_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Get Test",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.get(f"/api/v1/scheduler/jobs/{jid}", headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Get Test"

    async def test_delete_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Delete Me",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.delete(f"/api/v1/scheduler/jobs/{jid}", headers=headers)
        assert res.status_code == 204

    async def test_scheduler_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/scheduler/jobs", json={
            "name": "test",
            "type": "http",
            "cron": "* * * * *",
        })
        assert res.status_code == 401

    async def test_update_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Original",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.patch(f"/api/v1/scheduler/jobs/{jid}", json={
            "name": "Updated",
            "type": "webhook",
            "url": "https://example.com/webhook",
            "cron": "0 * * * *",
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Updated"

    async def test_pause_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Pause Test",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.post(f"/api/v1/scheduler/jobs/{jid}/pause", headers=headers)
        assert res.status_code == 200

    async def test_resume_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Resume Test",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.post(f"/api/v1/scheduler/jobs/{jid}/resume", headers=headers)
        assert res.status_code == 200

    async def test_trigger_job(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Trigger Test",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.post(f"/api/v1/scheduler/jobs/{jid}/trigger", headers=headers)
        assert res.status_code == 200

    async def test_list_job_executions(self, client: AsyncClient):
        headers = await self._auth_header(client)
        created = await client.post("/api/v1/scheduler/jobs", json={
            "name": "Executions Test",
            "type": "http",
            "cron": "0 * * * *",
            "url": "https://example.com",
        }, headers=headers)
        assert created.status_code == 201
        jid = created.json()["id"]
        res = await client.get(f"/api/v1/scheduler/jobs/{jid}/executions", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_endpoints_require_auth(self, db_session):
        from backend.database import get_db
        from backend.dependencies import get_current_user
        from backend.routers import scheduler
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        app.include_router(scheduler.router, prefix="/api/v1/scheduler")

        async def override_get_db():
            yield db_session
        app.dependency_overrides[get_db] = override_get_db

        async def no_user():
            return None
        app.dependency_overrides[get_current_user] = no_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.post("/api/v1/scheduler/jobs", json={"name": "x", "type": "http", "cron": "* * * * *", "url": "https://x.com"})).status_code == 401
            assert (await ac.get("/api/v1/scheduler/jobs")).status_code == 401
            assert (await ac.get(f"/api/v1/scheduler/jobs/{uuid.uuid4()}")).status_code == 401
            assert (await ac.patch(f"/api/v1/scheduler/jobs/{uuid.uuid4()}", json={"name": "x", "type": "http", "cron": "* * * * *", "url": "https://x.com"})).status_code == 401
            assert (await ac.post(f"/api/v1/scheduler/jobs/{uuid.uuid4()}/pause")).status_code == 401
            assert (await ac.post(f"/api/v1/scheduler/jobs/{uuid.uuid4()}/resume")).status_code == 401
            assert (await ac.post(f"/api/v1/scheduler/jobs/{uuid.uuid4()}/trigger")).status_code == 401
            assert (await ac.delete(f"/api/v1/scheduler/jobs/{uuid.uuid4()}")).status_code == 401
            assert (await ac.get(f"/api/v1/scheduler/jobs/{uuid.uuid4()}/executions")).status_code == 401
