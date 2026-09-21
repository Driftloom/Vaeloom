import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import jwt
import pytest
from httpx import AsyncClient

from api.config import settings

pytestmark = pytest.mark.asyncio


class TestOrchestratorExecuteEndpoint:
    @pytest.fixture
    def auth_context(self):
        user_id = str(uuid.uuid4())
        payload = {
            "sub": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "role": "admin",
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        return {"headers": {"Authorization": f"Bearer {token}"}, "user_id": user_id}

    async def test_execute_orchestrator_turn_success(self, client: AsyncClient, auth_context: dict):
        workspace_id = str(uuid.uuid4())
        user_id = auth_context["user_id"]
        payload = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "agent_id": "memory",
            "message": "Remember this context",
        }

        mock_result = {"status": "completed", "result": {"summary": "Memory stored"}}
        with patch("api.routers.orchestrator.orchestrator_handle", new=AsyncMock(return_value=mock_result)), \
             patch("api.routers.orchestrator.check_user_workspace_access", new=AsyncMock(return_value=True)):
            response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_context["headers"])
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["agent_id"] == "memory"
            assert "request_id" in data
            assert data["result"] == mock_result

    async def test_execute_orchestrator_turn_user_id_mismatch_forbidden(self, client: AsyncClient, auth_context: dict):
        workspace_id = str(uuid.uuid4())
        spoofed_user_id = str(uuid.uuid4())
        payload = {
            "workspace_id": workspace_id,
            "user_id": spoofed_user_id,
            "agent_id": "memory",
            "message": "Attack context",
        }

        response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_context["headers"])
        assert response.status_code == 403
        data = response.json()
        error_msg = data.get("error", {}).get("message") or data.get("detail", "")
        assert "User ID mismatch" in error_msg

    async def test_execute_orchestrator_turn_workspace_access_denied(self, client: AsyncClient, auth_context: dict):
        workspace_id = str(uuid.uuid4())
        user_id = auth_context["user_id"]
        payload = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "agent_id": "memory",
            "message": "Access test",
        }

        with patch("api.routers.orchestrator.check_user_workspace_access", new=AsyncMock(return_value=False)):
            response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_context["headers"])
            assert response.status_code == 403
            data = response.json()
            error_msg = data.get("error", {}).get("message") or data.get("detail", "")
            assert "Access denied to workspace" in error_msg

    async def test_execute_orchestrator_turn_unauthenticated_401(self, client: AsyncClient):
        workspace_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        payload = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "agent_id": "memory",
            "message": "Unauthenticated attempt",
        }

        response = await client.post("/api/v1/orchestrator/execute", json=payload)
        assert response.status_code == 401

    async def test_execute_orchestrator_turn_invalid_uuid(self, client: AsyncClient, auth_context: dict):
        payload = {
            "workspace_id": "invalid-uuid",
            "user_id": "invalid-uuid",
            "agent_id": "memory",
            "message": "Hello",
        }
        response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_context["headers"])
        assert response.status_code == 400
        data = response.json()
        error_msg = data.get("error", {}).get("message") or data.get("detail", "")
        assert "Invalid workspace_id or user_id UUID format" in error_msg
