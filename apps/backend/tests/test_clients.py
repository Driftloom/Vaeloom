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


class TestGmailClient:
    async def test_gmail_send(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        draft_resp = MockResponse(json_data={"id": "draft1", "message": {"id": "msg1"}})
        mock_httpx.request = AsyncMock(return_value=draft_resp)
        result = await client.create_draft(to="a@b.com", subject="Hi", body="Hello")
        assert result == {"id": "draft1", "message": {"id": "msg1"}}

    async def test_gmail_search(self, mock_httpx):
        from backend.clients.gmail_client import GmailClient
        client = GmailClient(client_id="cid", client_secret="cs", refresh_token="rt")
        list_resp = MockResponse(json_data={"messages": [{"id": "m1"}]})
        detail_resp = MockResponse(json_data={
            "id": "m1",
            "payload": {"headers": [{"name": "Subject", "value": "Meeting"}, {"name": "From", "value": "alice@co.com"}]},
            "snippet": "Let us meet",
        })
        mock_httpx.request = AsyncMock(side_effect=[list_resp, detail_resp])
        results = await client.fetch_emails(max_results=10, query="meeting")
        assert results is not None
        assert len(results) == 1
        assert results[0]["subject"] == "Meeting"
        assert results[0]["sender"] == "alice@co.com"
        assert results[0]["body"] == "Let us meet"


class TestDriveClient:
    async def test_drive_list(self, mock_httpx):
        from backend.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        list_resp = MockResponse(json_data={
            "files": [{"id": "f1", "name": "doc1.pdf", "mimeType": "application/pdf"}]
        })
        mock_httpx.request = AsyncMock(return_value=list_resp)
        result = await client.list_files()
        assert result is not None
        assert len(result) == 1
        assert result[0]["name"] == "doc1.pdf"

    async def test_drive_download(self, mock_httpx):
        from backend.clients.drive_client import DriveClient
        client = DriveClient(client_id="cid", client_secret="cs", refresh_token="rt")
        file_resp = MockResponse(content=b"file binary content")
        mock_httpx.request = AsyncMock(return_value=file_resp)
        result = await client.download_file("f1")
        assert result == b"file binary content"


class TestCalendarClient:
    async def test_calendar_list_events(self, mock_httpx):
        from backend.clients.calendar_client import CalendarClient
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
        result = await client.list_events()
        assert result is not None
        assert len(result) == 1
        assert result[0]["title"] == "Standup"
        assert result[0]["start_time"] == "2025-01-01T09:00:00Z"
        assert result[0]["source"] == "calendar"

    async def test_calendar_create_event(self, mock_httpx):
        from backend.clients.calendar_client import CalendarClient
        client = CalendarClient(client_id="cid", client_secret="cs", refresh_token="rt", calendar_id="primary")
        create_resp = MockResponse(json_data={"id": "ev2", "summary": "Review"})
        mock_httpx.request = AsyncMock(return_value=create_resp)
        result = await client.create_event(summary="Review", start_time="2025-01-02T10:00:00Z", end_time="2025-01-02T11:00:00Z")
        assert result is not None
        assert result["id"] == "ev2"


class TestJobBoardClient:
    async def test_job_board_search(self, mock_httpx):
        from backend.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        search_resp = MockResponse(json_data=[
            {"id": "j1", "title": "Engineer", "company": "ACME", "location": "NYC", "skills": ["Python"], "apply_url": "https://apply"}
        ])
        mock_httpx.get = AsyncMock(return_value=search_resp)
        result = await client.search_jobs(keywords=["engineer"])
        assert result is not None
        assert len(result) == 1
        assert result[0]["title"] == "Engineer"
        assert result[0]["company"] == "ACME"
        assert result[0]["location"] == "NYC"
