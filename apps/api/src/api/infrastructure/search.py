from __future__ import annotations

import os
from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy import text


class SearchIndex(ABC):
    @abstractmethod
    async def index(self, documents: list[dict[str, Any]]) -> None: ...

    @abstractmethod
    async def search(self, query: str, options: dict[str, Any] | None = None) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def delete(self, id: str) -> None: ...

    @abstractmethod
    async def clear(self) -> None: ...


class MeilisearchIndex(SearchIndex):
    def __init__(self, url: str | None = None, api_key: str | None = None, index_name: str = "vaeloom"):
        self._url = url or os.environ.get("MEILISEARCH_URL", "http://localhost:7700")
        self._api_key = api_key or os.environ.get("MEILISEARCH_API_KEY", "")
        self._index_name = index_name
        self._client: Any = None

    async def _ensure_connected(self):
        if self._client is not None:
            return
        try:
            import meilisearch
            from meilisearch.index import Index
            self._Index = Index
            sync_client = meilisearch.Client(self._url, self._api_key or None)
            sync_client.create_index(self._index_name, {"primaryKey": "id"})
            self._client = sync_client.index(self._index_name)
        except ImportError:
            raise RuntimeError("meilisearch is not installed; cannot use MeilisearchIndex")

    async def index(self, documents: list[dict[str, Any]]) -> None:
        await self._ensure_connected()
        self._client.add_documents(documents)

    async def search(self, query: str, options: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        await self._ensure_connected()
        results = self._client.search(query, options or {})
        return results.get("hits", [])

    async def delete(self, id: str) -> None:
        await self._ensure_connected()
        self._client.delete_document(id)

    async def clear(self) -> None:
        await self._ensure_connected()
        self._client.delete_all_documents()


class PostgresFallbackIndex(SearchIndex):
    def __init__(self, session_factory=None):
        self._session_factory = session_factory

    def _get_session_factory(self):
        if self._session_factory is not None:
            return self._session_factory
        from api.database import async_session_factory
        return async_session_factory

    async def index(self, documents: list[dict[str, Any]]) -> None:
        factory = self._get_session_factory()
        async with factory() as session:
            for doc in documents:
                stmt = text("""
                    INSERT INTO search_documents (id, title, content, source_type, source_id, tenant_id, tsvector_col)
                    VALUES (:id, :title, :content, :source_type, :source_id, :tenant_id,
                            to_tsvector('english', coalesce(:title,'') || ' ' || coalesce(:content,'')))
                    ON CONFLICT (id) DO UPDATE SET
                        title = :title, content = :content,
                        tsvector_col = to_tsvector('english', coalesce(:title,'') || ' ' || coalesce(:content,''))
                """)
                await session.execute(
                    stmt,
                    {
                        "id": doc.get("id"),
                        "title": doc.get("title", ""),
                        "content": doc.get("content", ""),
                        "source_type": doc.get("source_type", "unknown"),
                        "source_id": doc.get("source_id", doc.get("id")),
                        "tenant_id": doc.get("tenant_id", "default"),
                    },
                )
            await session.commit()

    async def search(self, query: str, options: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        factory = self._get_session_factory()
        options = options or {}
        limit = options.get("limit", 20)
        offset = options.get("offset", 0)
        tenant_id = options.get("tenant_id")

        async with factory() as session:
            conditions = ["tsvector_col @@ plainto_tsquery('english', :query)"]
            params: dict[str, Any] = {"query": query, "limit": limit, "offset": offset}
            if tenant_id:
                conditions.append("tenant_id = :tenant_id")
                params["tenant_id"] = tenant_id

            where_clause = " AND ".join(conditions)
            stmt = text(f"""
                SELECT id, title, content, source_type, source_id, tenant_id,
                       ts_rank(tsvector_col, plainto_tsquery('english', :query)) AS rank
                FROM search_documents
                WHERE {where_clause}
                ORDER BY rank DESC
                LIMIT :limit OFFSET :offset
            """)
            result = await session.execute(stmt, params)
            rows = result.fetchall()

        return [
            {
                "id": str(r[0]),
                "title": r[1],
                "content": r[2],
                "source_type": r[3],
                "source_id": str(r[4]) if r[4] else "",
                "tenant_id": r[5],
                "score": float(r[6]) if r[6] else 0.0,
            }
            for r in rows
        ]

    async def delete(self, id: str) -> None:
        factory = self._get_session_factory()
        async with factory() as session:
            await session.execute(text("DELETE FROM search_documents WHERE id = :id"), {"id": id})
            await session.commit()

    async def clear(self) -> None:
        factory = self._get_session_factory()
        async with factory() as session:
            await session.execute(text("TRUNCATE TABLE search_documents"))
            await session.commit()


class NoopSearchIndex(SearchIndex):
    async def index(self, documents: list[dict[str, Any]]) -> None:
        pass

    async def search(self, query: str, options: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return []

    async def delete(self, id: str) -> None:
        pass

    async def clear(self) -> None:
        pass


def get_search_index(session_factory=None) -> SearchIndex:
    meili_url = os.environ.get("MEILISEARCH_URL")
    if meili_url:
        try:
            import meilisearch  # noqa: F401
            return MeilisearchIndex(url=meili_url)
        except ImportError:
            pass
    return PostgresFallbackIndex(session_factory=session_factory)
