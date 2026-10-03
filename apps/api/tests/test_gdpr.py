import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import text

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


class TestGDPRChatTranscripts:
    """Chat transcripts are persisted personal data (0063), not browser state.

    The fixture writes through the real HTTP routes so the assertions are about
    what the product actually stores, not about hand-built ORM rows.
    """

    # Distinctive so a leaked row cannot be mistaken for the other test's data.
    PII = "Salary expectation 180k, interviewing at Initech and Globex"

    async def _seed(self, client: AsyncClient, tag: str, texts: list[str]) -> tuple[str, str]:
        res = await client.post("/api/v1/auth/signup", json={
            "email": f"gdpr-chat-{tag}-{uuid.uuid4().hex[:8]}@test.com",
            "password": "Test1234!",
        })
        assert res.status_code == 201
        token = res.json()["access_token"]
        user_id = res.json()["user"]["id"]
        auth = {"Authorization": f"Bearer {token}"}

        ws_res = await client.post("/api/v1/workspaces", json={"name": f"Chat {tag}"}, headers=auth)
        assert ws_res.status_code == 201
        workspace_id = ws_res.json()["id"]

        conv_res = await client.post(
            f"/api/v1/workspaces/{workspace_id}/conversations",
            json={"title": f"Transcript {tag}", "agent_name": "resume"},
            headers={**auth, "X-Workspace-Id": workspace_id},
        )
        assert conv_res.status_code == 201
        conv_id = conv_res.json()["id"]

        for i, text in enumerate(texts):
            msg_res = await client.post(
                f"/api/v1/workspaces/{workspace_id}/conversations/{conv_id}/messages",
                json={"role": "user", "text": text, "client_id": f"{tag}-{i}", "status": "complete"},
                headers={**auth, "X-Workspace-Id": workspace_id},
            )
            assert msg_res.status_code == 201

        return user_id, workspace_id

    async def test_export_includes_conversation_and_message_text(self, client: AsyncClient, db_session):
        user_id, workspace_id = await self._seed(client, "export", [self.PII])

        result = await gdpr_service.export_user_data(user_id, db_session)

        assert "conversations" in result.data, "transcript metadata missing from Art.20 export"
        assert len(result.data["conversations"]) == 1
        conversation = result.data["conversations"][0]
        assert conversation["id"] != ""
        assert conversation["workspace_id"] == workspace_id
        assert conversation["title"] == "Transcript export"

        assert "chat_messages" in result.data, "message bodies missing from Art.20 export"
        assert len(result.data["chat_messages"]) == 1
        message = result.data["chat_messages"][0]
        # The export must carry the transcript itself, not just row metadata.
        assert message["text"] == self.PII
        assert message["role"] == "user"
        assert message["conversation_id"] == conversation["id"]
        assert message["workspace_id"] == workspace_id

    async def test_delete_removes_conversations_and_messages(self, client: AsyncClient, db_session):
        user_id, workspace_id = await self._seed(
            client, "delete", ["First turn", "Second turn", "Third turn"],
        )

        result = await gdpr_service.delete_user_data(user_id, db_session)

        assert result["action"] == "anonymized"
        assert result["tables"]["chat_messages"] == 3
        assert result["tables"]["conversations"] == 1

        for table in ("conversations", "chat_messages"):
            remaining = await db_session.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE workspace_id = :ws"),  # nosec B608
                {"ws": workspace_id},
            )
            assert remaining.scalar_one() == 0, f"{table} rows survived an Art.17 erasure"

    async def test_delete_spares_another_users_transcript(self, client: AsyncClient, db_session):
        target_id, target_ws = await self._seed(client, "target", [self.PII])
        bystander_id, bystander_ws = await self._seed(client, "bystander", ["Unrelated applicant data"])

        result = await gdpr_service.delete_user_data(target_id, db_session)

        assert result["tables"]["chat_messages"] == 1
        assert result["tables"]["conversations"] == 1

        # Cross-tenant survival: the other user's rows must be untouched.
        convs = await db_session.execute(
            text("SELECT COUNT(*) FROM conversations WHERE workspace_id = :ws"), {"ws": bystander_ws},
        )
        assert convs.scalar_one() == 1
        msgs = await db_session.execute(
            text("SELECT text FROM chat_messages WHERE workspace_id = :ws"), {"ws": bystander_ws},
        )
        rows = [r[0] for r in msgs.fetchall()]
        assert rows == ["Unrelated applicant data"]

        # The erased user's own workspace has nothing left in either table.
        for table in ("conversations", "chat_messages"):
            gone = await db_session.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE workspace_id = :ws"),  # nosec B608
                {"ws": target_ws},
            )
            assert gone.scalar_one() == 0

    async def test_delete_leaves_no_orphan_messages(self, client: AsyncClient, db_session):
        user_id, workspace_id = await self._seed(client, "orphans", [self.PII])

        await gdpr_service.delete_user_data(user_id, db_session)

        # SQLite does not enforce FKs (PRAGMA foreign_keys is 0 in this suite), so
        # this asserts the delete is genuinely cascade-independent: if the service
        # were relying on ON DELETE CASCADE, messages would outlive the parent
        # conversation here exactly as they would on a database where the FK
        # constraint failed to apply.
        orphans = await db_session.execute(text(
            "SELECT COUNT(*) FROM chat_messages "
            "WHERE conversation_id NOT IN (SELECT id FROM conversations)"
        ))
        assert orphans.scalar_one() == 0

        total = await db_session.execute(text("SELECT COUNT(*) FROM chat_messages"))
        assert total.scalar_one() == 0

        # And nothing is left pointing at the erased workspace either.
        left = await db_session.execute(
            text("SELECT COUNT(*) FROM chat_messages WHERE workspace_id = :ws"), {"ws": workspace_id},
        )
        assert left.scalar_one() == 0


class TestGDPREndpoints:
    async def test_gdpr_export_requires_auth(self, client: AsyncClient):
        res = await client.get("/api/v1/gdpr/export")
        assert res.status_code == 401

    async def test_gdpr_export_self_service(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-user@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.get("/api/v1/gdpr/export", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert "user_id" in body
        assert "data" in body
        assert "total_records" in body

    async def test_gdpr_delete_requires_auth(self, client: AsyncClient):
        res = await client.post("/api/v1/gdpr/delete")
        assert res.status_code == 401

    async def test_gdpr_delete_self_service(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-del@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        res = await client.post("/api/v1/gdpr/delete", headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["action"] == "anonymized"
        assert "tables" in body

    async def test_gdpr_delete_other_user_forbidden(self, client: AsyncClient):
        res = await client.post("/api/v1/auth/signup", json={
            "email": "gdpr-other@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        target = str(uuid.uuid4())
        res = await client.post(f"/api/v1/gdpr/delete?user_id={target}", headers=headers)
        assert res.status_code == 403
