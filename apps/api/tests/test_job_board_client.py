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
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: client)
    return client


class TestJobBoardClientInit:
    def test_configured_when_all_creds_provided(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        assert client._configured is True
        assert client.api_url == "https://api.example.com"
        assert client.api_key == "key123"

    def test_unconfigured_when_empty(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        assert client._configured is False
        assert client.api_url == ""
        assert client.api_key == ""


class TestJobBoardClientSearchJobs:
    async def test_configured_list_response_returns_normalized_jobs(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        resp = MockResponse(json_data=[
            {"id": "j1", "title": "Engineer", "company": "ACME", "location": "NYC", "skills": ["Python"], "apply_url": "https://apply"}
        ])
        mock_httpx.get = AsyncMock(return_value=resp)
        result = await client.search_jobs(keywords=["engineer"])
        assert result is not None
        assert len(result) == 1
        assert result[0]["title"] == "Engineer"
        assert result[0]["company"] == "ACME"
        assert result[0]["location"] == "NYC"

    async def test_configured_dict_response_returns_normalized_jobs(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        resp = MockResponse(json_data={
            "jobs": [
                {"id": "j2", "title": "Analyst", "company": "BetaCorp", "location": "SF"}
            ]
        })
        mock_httpx.get = AsyncMock(return_value=resp)
        result = await client.search_jobs(keywords=["analyst"])
        assert result is not None
        assert len(result) == 1
        assert result[0]["title"] == "Analyst"

    async def test_with_location_param(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        resp = MockResponse(json_data=[])
        mock_httpx.get = AsyncMock(return_value=resp)
        result = await client.search_jobs(keywords=["engineer"], location="NYC")
        assert result is not None
        assert len(result) == 0

    async def test_api_error_returns_none(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        mock_httpx.get = AsyncMock(return_value=MockResponse(status_code=500, json_data={"error": "server error"}))
        result = await client.search_jobs(keywords=["engineer"])
        assert result is None

    async def test_not_configured_returns_none(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        result = await client.search_jobs(keywords=["engineer"])
        assert result is None

    async def test_exception_returns_none(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        mock_httpx.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.search_jobs(keywords=["engineer"])
        assert result is None


class TestJobBoardClientNormalizeResponse:
    def test_list_input(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = [{"id": "1", "title": "Role"}]
        result = client._normalize_response(raw)
        assert len(result) == 1
        assert result[0]["title"] == "Role"

    def test_dict_with_jobs_key(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"jobs": [{"id": "2", "title": "Job A"}]}
        result = client._normalize_response(raw)
        assert len(result) == 1
        assert result[0]["id"] == "2"

    def test_dict_with_results_key(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"results": [{"id": "3", "title": "Job B"}]}
        result = client._normalize_response(raw)
        assert len(result) == 1
        assert result[0]["id"] == "3"

    def test_dict_with_data_key(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"data": [{"id": "4", "title": "Job C"}]}
        result = client._normalize_response(raw)
        assert len(result) == 1
        assert result[0]["id"] == "4"

    def test_dict_with_no_matching_keys_returns_empty(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"other": "value"}
        result = client._normalize_response(raw)
        assert result == []

    def test_non_list_non_dict_returns_empty(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        result = client._normalize_response("invalid")
        assert result == []


class TestJobBoardClientNormalizeJob:
    def test_standard_field_names(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {
            "id": "j1",
            "title": "Engineer",
            "company": "ACME",
            "location": "NYC",
            "skills": ["Python"],
            "apply_url": "https://apply",
        }
        result = client._normalize_job(raw)
        assert result["id"] == "j1"
        assert result["title"] == "Engineer"
        assert result["company"] == "ACME"
        assert result["location"] == "NYC"
        assert result["required_skills"] == ["Python"]
        assert result["apply_url"] == "https://apply"

    def test_alternative_field_names(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {
            "external_id": "ext1",
            "name": "Senior Dev",
            "organization": "StartupX",
            "required_skills": ["Go"],
            "hostedUrl": "https://hosted/job",
        }
        result = client._normalize_job(raw)
        assert result["id"] == "ext1"
        assert result["title"] == "Senior Dev"
        assert result["company"] == "StartupX"
        assert result["required_skills"] == ["Go"]
        assert result["apply_url"] == "https://hosted/job"

    def test_apply_url_alternatives(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"applyUrl": "https://apply/url"}
        result = client._normalize_job(raw)
        assert result["apply_url"] == "https://apply/url"

    def test_title_fallback_to_position(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"position": "Manager"}
        result = client._normalize_job(raw)
        assert result["title"] == "Manager"

    def test_company_fallback_to_company_name(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"company_name": "Corp"}
        result = client._normalize_job(raw)
        assert result["company"] == "Corp"

    def test_location_as_string(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"location": "Remote"}
        result = client._normalize_job(raw)
        assert result["location"] == "Remote"

    def test_location_from_locations_list(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"locations": [{"name": "London"}]}
        result = client._normalize_job(raw)
        assert result["location"] == "London"

    def test_location_fallback_empty(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {}
        result = client._normalize_job(raw)
        assert result["location"] == ""

    def test_id_fallback_hash(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"title": "No ID"}
        result = client._normalize_job(raw)
        assert result["id"].startswith("job_")
        assert result["title"] == "No ID"

    def test_skills_fallback_to_required_skills(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        raw = {"required_skills": ["Java"]}
        result = client._normalize_job(raw)
        assert result["required_skills"] == ["Java"]


class TestJobBoardClientCheckHealth:
    async def test_configured_200_returns_true(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        mock_httpx.get = AsyncMock(return_value=MockResponse(status_code=200))
        result = await client.check_health()
        assert result is True

    async def test_configured_non_200_returns_false(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        mock_httpx.get = AsyncMock(return_value=MockResponse(status_code=500))
        result = await client.check_health()
        assert result is False

    async def test_not_configured_returns_false(self):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient()
        result = await client.check_health()
        assert result is False

    async def test_exception_returns_false(self, mock_httpx):
        from api.clients.job_board_client import JobBoardClient
        client = JobBoardClient(api_url="https://api.example.com", api_key="key123")
        mock_httpx.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        result = await client.check_health()
        assert result is False
