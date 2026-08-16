import pytest
from unittest.mock import AsyncMock
import httpx

pytestmark = pytest.mark.asyncio


class MockResponse:
    def __init__(self, status_code=200, json_data=None, content=b""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.content = content
        self.text = str(self._json_data) if self._json_data else ""

    def json(self):
        return self._json_data


@pytest.fixture
def mock_httpx(monkeypatch):
    client = AsyncMock()
    client.__aenter__.return_value = client
    token_resp = MockResponse(json_data={"access_token": "fake_token"})
    client.post = AsyncMock(return_value=token_resp)
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: client)
    return client


class TestDriveClientInit:
    def test_configured_when_all_creds_provided(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._configured is True
        assert client.client_id == "cid"
        assert client.client_secret == "cs"
        assert client.refresh_token == "rt"

    def test_unconfigured_when_empty(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        assert client._configured is False
        assert client._access_token is None


class TestDriveClientRefreshAccessToken:
    async def test_success_stores_and_returns_token(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        token = await client._refresh_access_token()
        assert token == "fake_token"
        assert client._access_token == "fake_token"

    async def test_non_200_raises_drive_auth_error(self, mock_httpx):
        from api.clients.drive_client import DriveClient, DriveAuthError
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.post = AsyncMock(return_value=MockResponse(status_code=400, json_data={"error": "invalid_grant"}))
        with pytest.raises(DriveAuthError, match="Token refresh failed"):
            await client._refresh_access_token()

    async def test_not_configured_raises_drive_auth_error(self):
        from api.clients.drive_client import DriveClient, DriveAuthError
        client = DriveClient()
        with pytest.raises(DriveAuthError, match="Drive API not configured"):
            await client._refresh_access_token()


class TestDriveClientGetHeaders:
    async def test_calls_refresh_if_no_token_and_returns_bearer(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        headers = await client._get_headers()
        assert client._access_token == "fake_token"
        assert headers["Authorization"] == "Bearer fake_token"
        assert headers["Content-Type"] == "application/json"

    async def test_uses_existing_token(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        client._access_token = "existing"
        headers = await client._get_headers()
        assert headers["Authorization"] == "Bearer existing"


class TestDriveClientRequest:
    async def test_success_returns_json(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={"kind": "drive#fileList", "files": []}))
        result = await client._request("GET", "/files")
        assert result == {"kind": "drive#fileList", "files": []}

    async def test_with_extra_headers(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={"ok": True}))
        result = await client._request("GET", "/files", headers={"X-Custom": "val"})
        assert result == {"ok": True}
        call_kwargs = mock_httpx.request.call_args[1]
        assert call_kwargs["headers"]["X-Custom"] == "val"

    async def test_401_triggers_token_refresh_and_retry(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=[
            MockResponse(status_code=401, json_data={"error": "unauthorized"}),
            MockResponse(json_data={"files": [{"id": "f1"}]}),
        ])
        result = await client._request("GET", "/files")
        assert result == {"files": [{"id": "f1"}]}
        assert mock_httpx.request.call_count == 2

    async def test_400_plus_raises_drive_api_error(self, mock_httpx):
        from api.clients.drive_client import DriveClient, DriveAPIError
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(status_code=403, json_data={"error": "forbidden"}))
        with pytest.raises(DriveAPIError, match="Drive API error: 403"):
            await client._request("GET", "/files")


class TestDriveClientRequestBinary:
    async def test_success_returns_bytes(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(content=b"binary data"))
        result = await client._request_binary("GET", "/files/f1?alt=media")
        assert result == b"binary data"

    async def test_with_extra_headers(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(content=b"data"))
        result = await client._request_binary("GET", "/files/f1", headers={"X-Custom": "val"})
        assert result == b"data"
        call_kwargs = mock_httpx.request.call_args[1]
        assert call_kwargs["headers"]["X-Custom"] == "val"

    async def test_401_triggers_token_refresh_and_retry(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=[
            MockResponse(status_code=401),
            MockResponse(content=b"retried"),
        ])
        result = await client._request_binary("GET", "/files/f1")
        assert result == b"retried"
        assert mock_httpx.request.call_count == 2

    async def test_error_raises_drive_api_error(self, mock_httpx):
        from api.clients.drive_client import DriveClient, DriveAPIError
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(status_code=404, json_data={"error": "not found"}))
        with pytest.raises(DriveAPIError, match="Drive API error: 404"):
            await client._request_binary("GET", "/files/f1?alt=media")


class TestDriveClientListFiles:
    async def test_configured_returns_file_list(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={
            "files": [{"id": "f1", "name": "doc.pdf"}]
        }))
        result = await client.list_files()
        assert result == [{"id": "f1", "name": "doc.pdf"}]

    async def test_not_configured_returns_none(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.list_files()
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.list_files()
        assert result is None


class TestDriveClientDownloadFile:
    async def test_configured_returns_bytes(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(content=b"file content"))
        result = await client.download_file("f1")
        assert result == b"file content"

    async def test_not_configured_returns_none(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.download_file("f1")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.download_file("f1")
        assert result is None


class TestDriveClientSearchFiles:
    async def test_configured_returns_results(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={
            "files": [{"id": "f1", "name": "report.pdf"}]
        }))
        result = await client.search_files("report")
        assert result == [{"id": "f1", "name": "report.pdf"}]

    async def test_not_configured_returns_none(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.search_files("report")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.search_files("report")
        assert result is None


class TestDriveClientGetFile:
    async def test_configured_returns_metadata(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        expected = {"id": "f1", "name": "doc.pdf", "mimeType": "application/pdf", "modifiedTime": "2025-01-01T00:00:00Z", "size": "1024", "webViewLink": "https://drive.google.com/file/d/f1"}
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data=expected))
        result = await client.get_file("f1")
        assert result == expected

    async def test_not_configured_returns_none(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.get_file("f1")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.get_file("f1")
        assert result is None


class TestDriveClientExportFile:
    async def test_configured_returns_bytes(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(content=b"pdf data"))
        result = await client.export_file("f1", "application/pdf")
        assert result == b"pdf data"

    async def test_not_configured_returns_none(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.export_file("f1")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.export_file("f1")
        assert result is None


class TestDriveClientCheckHealth:
    async def test_configured_200_returns_true(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={"user": {"me": True}}))
        result = await client.check_health()
        assert result is True

    async def test_exception_returns_false(self, mock_httpx):
        from api.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.check_health()
        assert result is False

    async def test_not_configured_returns_false(self):
        from api.clients.drive_client import DriveClient
        client = DriveClient()
        result = await client.check_health()
        assert result is False
