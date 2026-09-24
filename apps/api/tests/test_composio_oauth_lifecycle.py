"""Composio OAuth disconnect + refresh lifecycle tests (CON-OAUTH-01)."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from api.services.composio_service import ComposioService

pytestmark = pytest.mark.asyncio


def _mock_client_with_accounts(accounts):
    mock_composio_cls = MagicMock()
    mock_client = MagicMock()
    mock_composio_cls.return_value = mock_client
    mock_client.connected_accounts.list.return_value = accounts
    return mock_composio_cls, mock_client


async def test_disconnect_unconfigured_fails_closed(monkeypatch):
    monkeypatch.delenv("COMPOSIO_API_KEY", raising=False)
    svc = ComposioService(api_key=None)
    res = await svc.disconnect_connection(uuid.uuid4(), "slack")
    assert res["status"] == "error"
    assert res["error_code"] == "COMPOSIO_API_KEY_REQUIRED"
    assert res["revoked"] == []


async def test_disconnect_revokes_matching_accounts_only():
    svc = ComposioService(api_key="mock_key_for_test")
    accounts = [
        {"id": "acc-1", "status": "ACTIVE", "auth_config_id": "slack", "app_name": "slack"},
        {"id": "acc-2", "status": "EXPIRED", "auth_config_id": "slack", "app_name": "slack"},
        {"id": "acc-3", "status": "ACTIVE", "auth_config_id": "github", "app_name": "github"},
    ]
    mock_cls, mock_client = _mock_client_with_accounts(accounts)
    with patch("composio.Composio", mock_cls):
        res = await svc.disconnect_connection(uuid.uuid4(), "slack")
    assert res["status"] == "success"
    assert sorted(res["revoked"]) == ["acc-1", "acc-2"]
    deleted = [c.args[0] for c in mock_client.connected_accounts.delete.call_args_list]
    assert sorted(deleted) == ["acc-1", "acc-2"]


async def test_disconnect_is_idempotent_when_nothing_connected():
    svc = ComposioService(api_key="mock_key_for_test")
    mock_cls, mock_client = _mock_client_with_accounts([])
    with patch("composio.Composio", mock_cls):
        res = await svc.disconnect_connection(uuid.uuid4(), "slack")
    assert res["status"] == "success"
    assert res["revoked"] == []
    mock_client.connected_accounts.delete.assert_not_called()


async def test_disconnect_reports_per_account_errors():
    svc = ComposioService(api_key="mock_key_for_test")
    accounts = [{"id": "acc-9", "status": "ACTIVE", "auth_config_id": "slack", "app_name": "slack"}]
    mock_cls, mock_client = _mock_client_with_accounts(accounts)
    mock_client.connected_accounts.delete.side_effect = RuntimeError("remote gone")
    with patch("composio.Composio", mock_cls):
        res = await svc.disconnect_connection(uuid.uuid4(), "slack")
    assert res["revoked"] == []
    assert res["revocation_errors"] and res["revocation_errors"][0]["id"] == "acc-9"


async def test_refresh_active_returns_connected():
    svc = ComposioService(api_key="mock_key_for_test")
    accounts = [{"id": "acc-1", "status": "ACTIVE", "auth_config_id": "slack", "app_name": "slack"}]
    mock_cls, _ = _mock_client_with_accounts(accounts)
    with patch("composio.Composio", mock_cls):
        res = await svc.refresh_connection(uuid.uuid4(), "slack")
    assert res["status"] == "success"
    assert res["connected"] is True
    assert "checked_at" in res


async def test_refresh_expired_returns_relink_url():
    svc = ComposioService(api_key="mock_key_for_test")
    accounts = [{"id": "acc-1", "status": "EXPIRED", "auth_config_id": "slack", "app_name": "slack"}]
    mock_cls, _ = _mock_client_with_accounts(accounts)
    with patch("composio.Composio", mock_cls):
        res = await svc.refresh_connection(uuid.uuid4(), "slack")
    assert res["status"] == "error"
    assert res["connected"] is False
    assert res["error_code"] == "COMPOSIO_AUTH_REQUIRED"
    assert res["auth_url"]


class TestComposioOAuthRoutes:
    async def _setup(self, client: AsyncClient):
        email = f"oauth_{uuid.uuid4().hex[:8]}@test.com"
        res = await client.post(
            "/api/v1/auth/signup",
            json={"email": email, "password": "TestPassword123!", "name": "OAuth Tester"},
        )
        assert res.status_code == 201
        headers = {"Authorization": f"Bearer {res.json()['access_token']}"}
        ws = await client.post("/api/v1/workspaces", json={"name": "OAuth WS"}, headers=headers)
        assert ws.status_code == 201
        return headers, ws.json()["id"]

    async def test_disconnect_route_requires_membership(self, client: AsyncClient):
        ha, ws_a = await self._setup(client)
        hb, _ = await self._setup(client)
        # Stranger workspace id -> 404 (no enumeration)
        r = await client.post(
            "/api/v1/connectors/composio/disconnect",
            json={"app": "slack", "workspace_id": ws_a},
            headers=hb,
        )
        assert r.status_code == 404
        # Anonymous -> 401
        r = await client.post(
            "/api/v1/connectors/composio/disconnect", json={"app": "slack", "workspace_id": ws_a}
        )
        assert r.status_code == 401

    async def test_disconnect_route_owner_idempotent(self, client: AsyncClient):
        ha, ws_a = await self._setup(client)
        # Missing app -> 400 validation shape
        r = await client.post(
            "/api/v1/connectors/composio/disconnect",
            json={"workspace_id": ws_a},
            headers=ha,
        )
        assert r.status_code == 400
        # Owner with mocked SDK and no connections -> success, nothing revoked
        mock_cls, _ = _mock_client_with_accounts([])
        with patch("composio.Composio", mock_cls):
            r = await client.post(
                "/api/v1/connectors/composio/disconnect",
                json={"app": "slack", "workspace_id": ws_a},
                headers=ha,
            )
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "success"
        assert body["revoked"] == []

    async def test_refresh_route_requires_membership(self, client: AsyncClient):
        ha, ws_a = await self._setup(client)
        hb, _ = await self._setup(client)
        r = await client.post(
            "/api/v1/connectors/composio/refresh",
            json={"app": "slack", "workspace_id": ws_a},
            headers=hb,
        )
        assert r.status_code == 404
        r = await client.post(
            "/api/v1/connectors/composio/refresh", json={"app": "slack", "workspace_id": ws_a}
        )
        assert r.status_code == 401
