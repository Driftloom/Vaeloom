"""MOCK-SUCCESS-01 battery: unavailable integrations are truthful, never success.

For each affected tool: credentials absent, provider unavailable/timeout,
malformed input -> truthful non-success with zero fabricated records.
Live-provider success requires real credentials (operator-proven, not here).
A deep payload scan rejects any mock marker in every response.
"""
import pytest

pytestmark = pytest.mark.asyncio

MOCK_MARKERS = ("Mock content", "Mock snippet", "page_mock_", "example.com/search",
                "simulated web search", "returned mock")


def _assert_no_fabrication(res: dict):
    import json as _json

    blob = _json.dumps(res, default=str)
    hits = [m for m in MOCK_MARKERS if m in blob]
    assert not hits, f"fabricated markers in payload: {hits}"
    assert res.get("status") != "success", f"fabricated success: {res}"


class TestWebSearchTruthful:
    async def test_no_credentials_not_configured(self, monkeypatch):
        from api.tools.executor import _execute_web_search

        monkeypatch.delenv("BRAVE_SEARCH_API_KEY", raising=False)
        monkeypatch.delenv("SERPAPI_KEY", raising=False)
        res = await _execute_web_search({"query": "q", "limit": 2}, "ws")
        assert res["status"] == "not_configured", res
        _assert_no_fabrication(res)

    async def test_missing_query_error(self):
        from api.tools.executor import _execute_web_search

        res = await _execute_web_search({"query": ""}, "ws")
        assert res["status"] == "error", res


class TestOneDriveTruthful:
    async def test_missing_file_unavailable(self):
        from api.tools.executor import _execute_download_onedrive_file

        res = await _execute_download_onedrive_file({"file_id": "nope", "name": "f"}, "ws")
        assert res["status"] in ("unavailable", "error"), res
        _assert_no_fabrication(res)

    async def test_missing_file_id_error(self):
        from api.tools.executor import _execute_download_onedrive_file

        res = await _execute_download_onedrive_file({}, "ws")
        assert res["status"] == "error", res


class TestNotionTruthful:
    async def test_no_token_not_configured(self, monkeypatch):
        from api.tools import executor as ex

        async def _no_token(_ws, _scopes):
            return None

        monkeypatch.setattr(ex, "_get_workspace_connector_token", _no_token)
        monkeypatch.delenv("NOTION_TOKEN", raising=False)
        monkeypatch.delenv("NOTION_API_KEY", raising=False)
        res = await ex._execute_sync_notion_pages({"database_id": "db1", "query": "t"}, "ws")
        assert res["status"] == "not_configured", res
        _assert_no_fabrication(res)

    async def test_missing_database_id_error(self):
        from api.tools.executor import _execute_sync_notion_pages

        res = await _execute_sync_notion_pages({"query": "t"}, "ws")
        assert res["status"] == "error", res
