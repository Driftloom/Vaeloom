import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from vaeloom.client import VaeloomClient
from vaeloom.models import MemoryQuery


@pytest.fixture
def mock_httpx_client():
    with patch("vaeloom.client.Client") as mock_cls:
        client_instance = MagicMock()
        mock_cls.return_value = client_instance
        yield client_instance


def test_client_headers_with_api_key(mock_httpx_client):
    client = VaeloomClient(api_key="vael_test_key_12345", tenant_id="tenant-123")
    assert mock_httpx_client is not None
    # Verify the headers passed to Client constructor
    import vaeloom.client as vc
    call_kwargs = vc.Client.call_args[1]
    assert call_kwargs["headers"]["X-API-Key"] == "vael_test_key_12345"
    assert call_kwargs["headers"]["X-Tenant-Id"] == "tenant-123"


def test_client_headers_with_access_token(mock_httpx_client):
    client = VaeloomClient(access_token="test.jwt.token")
    import vaeloom.client as vc
    call_kwargs = vc.Client.call_args[1]
    assert call_kwargs["headers"]["Authorization"] == "Bearer test.jwt.token"


def test_create_memory(mock_httpx_client):
    client = VaeloomClient(api_key="vael_test_key")
    mem_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    now_iso = datetime.now(timezone.utc).isoformat()

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {
        "data": {
            "id": str(mem_id),
            "type": "note",
            "status": "indexed",
            "title": "Test Memory",
            "created_at": now_iso,
            "updated_at": now_iso,
            "tenant_id": str(tenant_id),
        }
    }
    mock_httpx_client.request.return_value = fake_resp

    memory = client.create_memory({"title": "Test Memory", "type": "note"})
    assert memory.title == "Test Memory"
    assert str(memory.id) == str(mem_id)
    mock_httpx_client.request.assert_called_once()


def test_health_check(mock_httpx_client):
    client = VaeloomClient(api_key="vael_test_key")
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"status": "ok", "service": "vaeloom-api"}
    mock_httpx_client.request.return_value = fake_resp

    status = client.health_check()
    assert status == "ok"


def test_401_authentication_error(mock_httpx_client):
    client = VaeloomClient(api_key="vael_invalid_key")
    fake_resp = MagicMock()
    fake_resp.status_code = 401
    mock_httpx_client.request.return_value = fake_resp

    with pytest.raises(PermissionError, match="Authentication failed"):
        client.health_check()


def test_403_permission_error(mock_httpx_client):
    client = VaeloomClient(api_key="vael_test_key")
    fake_resp = MagicMock()
    fake_resp.status_code = 403
    mock_httpx_client.request.return_value = fake_resp

    with pytest.raises(PermissionError, match="Permission denied"):
        client.health_check()
