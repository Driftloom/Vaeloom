import base64
import email
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

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)


@pytest.fixture
def mock_httpx(monkeypatch):
    client = AsyncMock()
    client.__aenter__.return_value = client
    token_resp = MockResponse(json_data={"access_token": "fake_token"})
    client.post = AsyncMock(return_value=token_resp)
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: client)
    return client


class TestGmailClientInit:
    def test_configured_when_all_creds_provided(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._configured is True
        assert client.client_id == "cid"
        assert client.client_secret == "cs"
        assert client.refresh_token == "rt"

    def test_unconfigured_when_empty(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        assert client._configured is False
        assert client._access_token is None


class TestGmailClientRefreshAccessToken:
    async def test_success_stores_and_returns_token(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        token = await client._refresh_access_token()
        assert token == "fake_token"
        assert client._access_token == "fake_token"

    async def test_non_200_raises_auth_error(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient, GmailAuthError
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.post = AsyncMock(return_value=MockResponse(status_code=400, json_data={"error": "invalid_grant"}))
        with pytest.raises(GmailAuthError, match="Token refresh failed"):
            await client._refresh_access_token()

    async def test_not_configured_raises_auth_error(self):
        from backend.clients.gmail_client import GmailClient, GmailAuthError
        client = GmailClient()
        with pytest.raises(GmailAuthError, match="Gmail API not configured"):
            await client._refresh_access_token()


class TestGmailClientGetHeaders:
    async def test_calls_refresh_if_no_token_and_returns_bearer(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        headers = await client._get_headers()
        assert client._access_token == "fake_token"
        assert headers["Authorization"] == "Bearer fake_token"
        assert headers["Content-Type"] == "application/json"

    async def test_uses_existing_token(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        client._access_token = "existing"
        headers = await client._get_headers()
        assert headers["Authorization"] == "Bearer existing"


class TestGmailClientRequest:
    async def test_success_returns_json(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        expected = {"messages": [{"id": "m1"}]}
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data=expected))
        result = await client._request("GET", "/messages")
        assert result == expected

    async def test_merges_extra_headers(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        expected = {"result": "ok"}
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data=expected))
        result = await client._request("GET", "/messages", headers={"X-Custom": "val"})
        assert result == expected

    async def test_401_triggers_token_refresh_and_retry(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=[
            MockResponse(status_code=401, json_data={"error": "unauthorized"}),
            MockResponse(json_data={"messages": [{"id": "m1"}]}),
        ])
        result = await client._request("GET", "/messages")
        assert result == {"messages": [{"id": "m1"}]}
        assert mock_httpx.request.call_count == 2

    async def test_400_plus_raises_http_error(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(status_code=403, json_data={"error": "forbidden"}))
        with pytest.raises(httpx.HTTPStatusError):
            await client._request("GET", "/messages")


class TestGmailClientFetchEmails:
    async def test_configured_returns_parsed_list(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        list_resp = MockResponse(json_data={"messages": [{"id": "m1"}]})
        detail_resp = MockResponse(json_data={
            "id": "m1",
            "payload": {"headers": [{"name": "Subject", "value": "Hello"}, {"name": "From", "value": "alice@test.com"}]},
            "snippet": "Hi there",
        })
        mock_httpx.request = AsyncMock(side_effect=[list_resp, detail_resp])
        results = await client.fetch_emails(max_results=10, query="hello")
        assert results is not None
        assert len(results) == 1
        assert results[0]["subject"] == "Hello"
        assert results[0]["sender"] == "alice@test.com"
        assert results[0]["body"] == "Hi there"

    async def test_no_messages_returns_empty_list(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        list_resp = MockResponse(json_data={"messages": []})
        mock_httpx.request = AsyncMock(return_value=list_resp)
        results = await client.fetch_emails(max_results=10)
        assert results is not None
        assert len(results) == 0

    async def test_not_configured_returns_none(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        result = await client.fetch_emails()
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.fetch_emails()
        assert result is None


class TestGmailClientParseMessage:
    def test_normal_headers(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        raw = {
            "id": "m1",
            "payload": {
                "headers": [
                    {"name": "Subject", "value": "Meeting"},
                    {"name": "From", "value": "boss@co.com"},
                ]
            },
            "snippet": "Let's meet",
        }
        result = client._parse_message(raw)
        assert result == {"id": "m1", "subject": "Meeting", "sender": "boss@co.com", "body": "Let's meet"}

    def test_uses_sender_header_when_from_missing(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        raw = {
            "id": "m2",
            "payload": {
                "headers": [
                    {"name": "Subject", "value": "Hi"},
                    {"name": "Sender", "value": "noreply@co.com"},
                ]
            },
            "snippet": "Welcome",
        }
        result = client._parse_message(raw)
        assert result["sender"] == "noreply@co.com"

    def test_missing_headers_returns_defaults(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        raw = {"id": "m3", "payload": {"headers": []}, "snippet": ""}
        result = client._parse_message(raw)
        assert result == {"id": "m3", "subject": "", "sender": "", "body": ""}

    def test_no_payload_key_uses_empty_defaults(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        raw = {"id": "m4", "snippet": "hi"}
        result = client._parse_message(raw)
        assert result == {"id": "m4", "subject": "", "sender": "", "body": "hi"}

    def test_exception_returns_none(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        raw = {
            "id": "m1",
            "payload": {
                "headers": [
                    "malformed_header"
                ]
            }
        }
        result = client._parse_message(raw)
        assert result is None


class TestGmailClientCreateDraft:
    async def test_configured_returns_draft_data(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        draft_resp = MockResponse(json_data={"id": "d1", "message": {"id": "msg1"}})
        mock_httpx.request = AsyncMock(return_value=draft_resp)
        result = await client.create_draft(to="a@b.com", subject="Hi", body="Hello")
        assert result == {"id": "d1", "message": {"id": "msg1"}}
        call_kwargs = mock_httpx.request.call_args[1]
        raw = call_kwargs["json"]["message"]["raw"]
        decoded = base64.urlsafe_b64decode(raw)
        msg = email.message_from_bytes(decoded)
        assert msg["To"] == "a@b.com"
        assert msg["Subject"] == "Hi"
        assert msg.get_payload(decode=True).decode().strip() == "Hello"

    async def test_not_configured_returns_none(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        result = await client.create_draft(to="a@b.com", subject="Hi", body="Hello")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.create_draft(to="a@b.com", subject="Hi", body="Hello")
        assert result is None


class TestGmailClientCheckHealth:
    async def test_configured_200_returns_true(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={"emailAddress": "me@me.com"}))
        result = await client.check_health()
        assert result is True

    async def test_exception_returns_false(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.check_health()
        assert result is False

    async def test_not_configured_returns_false(self):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient()
        result = await client.check_health()
        assert result is False
