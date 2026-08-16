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


class TestCalendarClientInit:
    def test_configured_when_all_creds_provided(self):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        assert client._configured is True
        assert client.client_id == "cid"
        assert client.client_secret == "cs"
        assert client.refresh_token == "rt"
        assert client.calendar_id == "primary"

    def test_unconfigured_when_empty(self):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient()
        assert client._configured is False
        assert client._access_token is None


class TestCalendarClientRefreshAccessToken:
    async def test_success_stores_and_returns_token(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        token = await client._refresh_access_token()
        assert token == "fake_token"
        assert client._access_token == "fake_token"

    async def test_non_200_raises_auth_error(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient, CalendarAuthError
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt")
        mock_httpx.post = AsyncMock(return_value=MockResponse(status_code=400, json_data={"error": "invalid_grant"}))
        with pytest.raises(CalendarAuthError, match="Token refresh failed"):
            await client._refresh_access_token()

    async def test_not_configured_raises_auth_error(self):
        from api.clients.calendar_client import CalendarClient, CalendarAuthError
        client = CalendarClient()
        with pytest.raises(CalendarAuthError, match="Calendar API not configured"):
            await client._refresh_access_token()


class TestCalendarClientGetHeaders:
    async def test_calls_refresh_if_no_token_and_returns_bearer(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt")
        assert client._access_token is None
        headers = await client._get_headers()
        assert client._access_token == "fake_token"
        assert headers["Authorization"] == "Bearer fake_token"
        assert headers["Content-Type"] == "application/json"

    async def test_uses_existing_token(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt")
        client._access_token = "existing"
        headers = await client._get_headers()
        assert headers["Authorization"] == "Bearer existing"


class TestCalendarClientRequest:
    async def test_success_returns_json(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        expected = {"items": [{"id": "ev1"}]}
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data=expected))
        result = await client._request("GET", "/calendars/primary/events")
        assert result == expected

    async def test_merges_extra_headers(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        expected = {"result": "ok"}
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data=expected))
        result = await client._request("GET", "/calendars/primary/events", headers={"X-Custom": "val"})
        assert result == expected

    async def test_401_triggers_token_refresh_and_retry(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(side_effect=[
            MockResponse(status_code=401, json_data={"error": "unauthorized"}),
            MockResponse(json_data={"items": [{"id": "ev1"}]}),
        ])
        result = await client._request("GET", "/calendars/primary/events")
        assert result == {"items": [{"id": "ev1"}]}
        assert mock_httpx.request.call_count == 2

    async def test_400_plus_raises_http_error(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(return_value=MockResponse(status_code=403, json_data={"error": "forbidden"}))
        with pytest.raises(httpx.HTTPStatusError):
            await client._request("GET", "/calendars/primary/events")


class TestCalendarClientListEvents:
    async def test_configured_returns_events_with_time_params(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        list_resp = MockResponse(json_data={
            "items": [
                {
                    "id": "ev1",
                    "summary": "Standup",
                    "start": {"dateTime": "2025-01-01T09:00:00Z"},
                    "end": {"dateTime": "2025-01-01T09:30:00Z"},
                }
            ]
        })
        mock_httpx.request = AsyncMock(return_value=list_resp)
        results = await client.list_events(
            time_min="2025-01-01T00:00:00Z",
            time_max="2025-01-02T00:00:00Z",
            max_results=100,
        )
        assert results is not None
        assert len(results) == 1
        assert results[0]["title"] == "Standup"
        assert results[0]["start_time"] == "2025-01-01T09:00:00Z"
        assert results[0]["end_time"] == "2025-01-01T09:30:00Z"
        assert results[0]["source"] == "calendar"

    async def test_with_date_only_fields(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        list_resp = MockResponse(json_data={
            "items": [
                {
                    "id": "ev2",
                    "summary": "All day",
                    "start": {"date": "2025-01-01"},
                    "end": {"date": "2025-01-02"},
                }
            ]
        })
        mock_httpx.request = AsyncMock(return_value=list_resp)
        results = await client.list_events()
        assert results is not None
        assert len(results) == 1
        assert results[0]["start_time"] == "2025-01-01"
        assert results[0]["end_time"] == "2025-01-02"

    async def test_not_configured_returns_none(self):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient()
        result = await client.list_events()
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.list_events()
        assert result is None


class TestCalendarClientCreateEvent:
    async def test_configured_returns_event_data(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        create_resp = MockResponse(json_data={"id": "ev3", "summary": "Review", "htmlLink": "https://calendar.google.com/calendar/event?eid=ev3"})
        mock_httpx.request = AsyncMock(return_value=create_resp)
        result = await client.create_event(
            summary="Review",
            start_time="2025-01-02T10:00:00Z",
            end_time="2025-01-02T11:00:00Z",
            description="Code review",
        )
        assert result is not None
        assert result["id"] == "ev3"
        assert result["summary"] == "Review"

    async def test_not_configured_returns_none(self):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient()
        result = await client.create_event(summary="Review", start_time="2025-01-02T10:00:00Z", end_time="2025-01-02T11:00:00Z")
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.create_event(summary="Review", start_time="2025-01-02T10:00:00Z", end_time="2025-01-02T11:00:00Z")
        assert result is None


class TestCalendarClientCheckHealth:
    async def test_configured_200_returns_true(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(return_value=MockResponse(json_data={"id": "primary"}))
        result = await client.check_health()
        assert result is True

    async def test_exception_returns_false(self, mock_httpx):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        mock_httpx.request = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.check_health()
        assert result is False

    async def test_not_configured_returns_false(self):
        from api.clients.calendar_client import CalendarClient
        client = CalendarClient()
        result = await client.check_health()
        assert result is False
