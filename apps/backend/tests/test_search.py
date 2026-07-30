from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestSearchAPI:
    async def _auth_header(self, client: AsyncClient) -> dict:
        res = await client.post("/api/v1/auth/signup", json={
            "email": "search@test.com", "password": "Test1234!",
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_search_all(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/search", json={"query": "test query"}, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
        assert "total" in data

    async def test_search_with_sources(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/search", json={"query": "hello", "sources": ["memory"]}, headers=headers)
        assert res.status_code == 200

    async def test_search_empty_query_fails(self, client: AsyncClient):
        headers = await self._auth_header(client)
        res = await client.post("/api/v1/search", json={"query": ""}, headers=headers)
        assert res.status_code == 422


class TestSearchInfrastructure:
    async def test_noop_index(self):
        from backend.infrastructure.search import NoopSearchIndex
        idx = NoopSearchIndex()
        await idx.index([])
        results = await idx.search("test")
        assert results == []
        await idx.delete("x")
        await idx.clear()

    async def test_postgres_fallback_index_search(self):
        from backend.infrastructure.search import PostgresFallbackIndex

        mock_exec_result = MagicMock()
        mock_exec_result.fetchall.return_value = []
        mock_session = MagicMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        mock_factory = MagicMock(return_value=mock_session)

        idx = PostgresFallbackIndex(session_factory=mock_factory)
        results = await idx.search("test", {"limit": 5, "offset": 0})
        assert isinstance(results, list)

    async def test_postgres_fallback_index(self):
        from backend.infrastructure.search import PostgresFallbackIndex

        mock_exec_result = MagicMock()
        mock_exec_result.fetchall.return_value = []
        mock_session = MagicMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        mock_factory = MagicMock(return_value=mock_session)

        idx = PostgresFallbackIndex(session_factory=mock_factory)

        docs = [{"id": "1", "title": "test", "content": "hello world", "source_type": "memory", "tenant_id": "t1"}]
        await idx.index(docs)
        assert mock_session.execute.called

        mock_session.reset_mock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        await idx.delete("1")
        assert mock_session.execute.called

        mock_session.reset_mock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        await idx.clear()
        assert mock_session.execute.called

    async def test_get_search_index_from_env(self):
        from backend.infrastructure.search import get_search_index
        with patch.dict(os.environ, {"MEILISEARCH_URL": ""}):
            idx = get_search_index()
            from backend.infrastructure.search import PostgresFallbackIndex
            assert isinstance(idx, PostgresFallbackIndex)

    async def test_get_search_index_meili_not_installed(self):
        from backend.infrastructure.search import get_search_index
        with patch.dict(os.environ, {"MEILISEARCH_URL": "http://localhost:7700"}):
            import builtins
            original_import = builtins.__import__

            def mock_import(name, *args, **kwargs):
                if name == "meilisearch":
                    raise ImportError
                return original_import(name, *args, **kwargs)

            with patch("builtins.__import__", side_effect=mock_import):
                idx = get_search_index()
                from backend.infrastructure.search import PostgresFallbackIndex
                assert isinstance(idx, PostgresFallbackIndex)

    async def test_meilisearch_index_requires_import(self):
        from backend.infrastructure.search import MeilisearchIndex
        idx = MeilisearchIndex()
        with pytest.raises(RuntimeError, match="meilisearch is not installed"):
            await idx.index([])

    async def test_meilisearch_index_search_no_client(self):
        from backend.infrastructure.search import MeilisearchIndex
        idx = MeilisearchIndex()
        with pytest.raises(RuntimeError, match="meilisearch is not installed"):
            await idx.search("test")
