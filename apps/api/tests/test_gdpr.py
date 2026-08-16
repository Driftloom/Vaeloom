import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient

from api.models.schema import User, Event
from api.services.gdpr import GDPRService, DataExportResponse, gdpr_service

pytestmark = pytest.mark.asyncio


class TestGDPRService:
    async def test_export_user_data_empty(self, db_session):
        user_id = str(uuid.uuid4())
        result = await gdpr_service.export_user_data(user_id, db_session)
        assert isinstance(result, DataExportResponse)
        assert result.user_id == user_id
        assert result.total_records == 0

    async def test_export_after_user_creation(self, db_session, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-test@test.com", "password": "Test1234!",
        })
        assert res.status_code == 201
        user_id = res.json()["user"]["id"]

        db_session.add(Event(id=uuid.uuid4(), type="test", source="src", category="cat", correlation_id=uuid.uuid4(), user_id=uuid.UUID(user_id), created_at=datetime.now(timezone.utc)))
        await db_session.commit()

        result = await gdpr_service.export_user_data(user_id, db_session)
        assert result.total_records > 0
        assert "users" in result.data or "events" in result.data

    async def test_delete_user_data_anonymizes(self, db_session):
        user_id = uuid.uuid4()
        db_session.add(User(id=user_id, email="delete-test@test.com", display_name="Delete Test", status="ACTIVE"))
        await db_session.commit()

        result = await gdpr_service.delete_user_data(str(user_id), db_session)
        assert result["action"] == "anonymized"
        assert result["user_id"] == str(user_id)

        from sqlalchemy import text
        row = await db_session.execute(text("SELECT email, display_name, status FROM users WHERE id = :id"), {"id": str(user_id)})
        user = row.fetchone()
        assert user is not None
        assert "deleted-" in user[0]
        assert user[1] == "Deleted User"
        assert user[2] == "ANONYMIZED"


class TestGDPREndpoints:
    async def test_gdpr_export_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/gdpr/export")
        assert res.status_code in (401, 403)

    async def test_gdpr_export_requires_admin(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-user@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.get("/api/v1/gdpr/export", headers=headers)
        assert res.status_code == 403

    async def test_gdpr_delete_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/gdpr/delete")
        assert res.status_code in (401, 403)

    async def test_gdpr_delete_requires_admin(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-del@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.post("/api/v1/gdpr/delete", headers=headers)
        assert res.status_code == 403
