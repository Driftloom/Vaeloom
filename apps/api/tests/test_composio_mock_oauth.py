"""Offline mock test suite for Composio SaaS Gateway OAuth lifecycle and execution (GAP-CON-05)."""
import uuid
from unittest.mock import MagicMock, patch
import pytest

from api.services.composio_service import ComposioService

pytestmark = pytest.mark.asyncio


class TestComposioMockOAuthLifecycle:
    async def test_composio_unconfigured_fails_closed(self, monkeypatch):
        """Verify fail-closed diagnostics when Composio API key is not set."""
        monkeypatch.delenv("COMPOSIO_API_KEY", raising=False)
        svc = ComposioService(api_key=None)
        assert svc.is_configured is False
        assert svc.is_enabled is False

        wid = uuid.uuid4()
        uid = uuid.uuid4()

        # 1. Initiate connection without key
        init_res = await svc.initiate_connection(wid, uid, "slack")
        assert init_res["status"] == "error"
        assert init_res["error_code"] == "COMPOSIO_API_KEY_REQUIRED"

        # 2. Check connection status without key
        status_res = await svc.get_connection_status(wid, "slack")
        assert status_res["connected"] is False
        assert status_res["error_code"] == "COMPOSIO_API_KEY_REQUIRED"

        # 3. Execute tool without key
        exec_res = await svc.execute_composio_action(wid, "slack", "send_message", {})
        assert exec_res["status"] == "error"
        assert exec_res["error_code"] == "COMPOSIO_API_KEY_REQUIRED"

    async def test_composio_oauth_initiation_mock_handshake(self):
        """Verify OAuth connection URL generation offline with valid redirect URI."""
        svc = ComposioService(api_key="mock_key_for_test")
        wid = uuid.uuid4()
        uid = uuid.uuid4()

        res = await svc.initiate_connection(wid, uid, "slack")
        assert res["status"] == "success"
        assert res["app"] == "slack"
        assert res["auth_url"] is not None
        assert "slack" in res["auth_url"].lower()
        assert str(wid) in res["auth_url"]

    async def test_composio_connection_status_active_and_inactive(self):
        """Verify connection polling accurately resolves ACTIVE and INACTIVE states offline."""
        svc = ComposioService(api_key="mock_key_for_test")
        wid = uuid.uuid4()

        # Mock Composio client
        mock_composio_cls = MagicMock()
        mock_client = MagicMock()
        mock_composio_cls.return_value = mock_client

        # 1. Inactive account
        mock_client.connected_accounts.list.return_value = [
            {"status": "INACTIVE", "app_name": "slack", "auth_config_id": "slack"}
        ]
        with patch.dict("sys.modules", {"composio": MagicMock(Composio=mock_composio_cls)}):
            status = await svc.get_connection_status(wid, "slack")
            assert status["connected"] is False
            assert status["status"] == "inactive"

        # 2. Active account
        mock_client.connected_accounts.list.return_value = [
            {"status": "ACTIVE", "app_name": "slack", "auth_config_id": "slack"}
        ]
        with patch.dict("sys.modules", {"composio": MagicMock(Composio=mock_composio_cls)}):
            status = await svc.get_connection_status(wid, "slack")
            assert status["connected"] is True
            assert status["status"] == "active"

    async def test_composio_execute_action_success_and_auth_expired(self):
        """Verify tool execution succeeds, and 401/auth expiration cleanly raises COMPOSIO_AUTH_REQUIRED."""
        svc = ComposioService(api_key="mock_key_for_test")
        wid = uuid.uuid4()

        mock_composio_cls = MagicMock()
        mock_client = MagicMock()
        mock_composio_cls.return_value = mock_client

        # 1. Success execution
        mock_result = MagicMock()
        mock_result.data = {"message_id": "msg-12345", "delivered": True}
        mock_client.tools.execute.return_value = mock_result

        with patch.dict("sys.modules", {"composio": MagicMock(Composio=mock_composio_cls)}):
            res = await svc.execute_composio_action(wid, "slack", "send_message", {"text": "hello"})
            assert res["status"] == "success"
            assert res["result"]["message_id"] == "msg-12345"

        # 2. Token expired / auth required
        mock_client.tools.execute.side_effect = Exception("401 Unauthorized: token expired")
        with patch.dict("sys.modules", {"composio": MagicMock(Composio=mock_composio_cls)}):
            res_expired = await svc.execute_composio_action(wid, "slack", "send_message", {"text": "hello"})
            assert res_expired["status"] == "error"
            assert res_expired["error_code"] == "COMPOSIO_AUTH_REQUIRED"
            assert "Authentication required" in res_expired["message"]
