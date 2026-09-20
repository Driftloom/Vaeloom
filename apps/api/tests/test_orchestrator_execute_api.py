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
    def auth_headers(self):
        payload = {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "role": "admin",
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        return {"Authorization": f"Bearer {token}"}

    async def test_execute_orchestrator_turn_success(self, client: AsyncClient, auth_headers: dict):
        workspace_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())
        payload = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "agent_id": "memory",
            "message": "Remember this context",
        }

        mock_result = {"status": "completed", "result": {"summary": "Memory stored"}}
        with patch("api.routers.orchestrator.orchestrator_handle", new=AsyncMock(return_value=mock_result)):
            response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["agent_id"] == "memory"
            assert "request_id" in data
            assert data["result"] == mock_result

    async def test_execute_orchestrator_turn_invalid_uuid(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "workspace_id": "invalid-uuid",
            "user_id": "invalid-uuid",
            "agent_id": "memory",
            "message": "Hello",
        }
        response = await client.post("/api/v1/orchestrator/execute", json=payload, headers=auth_headers)
        assert response.status_code == 400
        data = response.json()
        error_msg = data.get("error", {}).get("message") or data.get("detail", "")
        assert "Invalid workspace_id or user_id UUID format" in error_msg
