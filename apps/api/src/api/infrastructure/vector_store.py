from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class VectorRecord:
    id: str
    vector: list[float]
    metadata: dict[str, Any]


class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, embeddings: Sequence[VectorRecord], **kwargs: Any) -> None: ...

    @abstractmethod
    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None, **kwargs: Any
    ) -> list[VectorRecord]: ...

    @abstractmethod
    async def delete(self, ids: Sequence[str], **kwargs: Any) -> None: ...


class PGVectorStore(VectorStore):
    def __init__(self, connection_url: str | None = None, collection_name: str = "vaeloom_vectors"):
        from ..config import settings
        db_url = (
            connection_url
            or getattr(settings, "database__url", None)
            or getattr(settings, "database_url", None)
            or os.environ.get("DATABASE__URL")
            or os.environ.get("DATABASE_URL")
            or "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom"
        )
        self._url = db_url
        self._collection = collection_name
        self._engine: Any = None
        self._session_factory: Any = None

    async def _ensure_connected(self):
        if self._engine is not None:
            return
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        self._engine = create_async_engine(self._url, pool_pre_ping=True, pool_size=5, max_overflow=5)
        self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)

    async def _execute_upsert(self, session: Any, embeddings: Sequence[VectorRecord]) -> None:
        from sqlalchemy import text
        for rec in embeddings:
            vector_str = "[" + ",".join(f"{v}" for v in rec.vector) + "]"
            dims = len(rec.vector) if rec.vector else None
            stmt = text("""
                INSERT INTO embeddings (id, source_type, source_id, vector, model_version, workspace_id, dimensions, source_table)
                VALUES (:id, :source_type, :source_id, CAST(:vector AS vector), :model_version, :workspace_id, :dimensions, :source_table)
                ON CONFLICT (id) DO UPDATE SET
                    vector = EXCLUDED.vector,
                    model_version = EXCLUDED.model_version,
                    dimensions = EXCLUDED.dimensions,
                    source_table = EXCLUDED.source_table
            """)
            await session.execute(
                stmt,
                {
                    "id": rec.id,
                    "source_type": rec.metadata.get("source_type", "unknown"),
                    "source_id": rec.metadata.get("source_id", rec.id),
                    "vector": vector_str,
                    "model_version": rec.metadata.get("model_version", "gemini-embedding-2"),
                    "workspace_id": rec.metadata.get("workspace_id", "00000000-0000-0000-0000-000000000000"),
                    "dimensions": dims,
                    "source_table": rec.metadata.get("source_table"),
                },
            )

    async def upsert(self, embeddings: Sequence[VectorRecord], **kwargs: Any) -> None:
        session = kwargs.get("session")
        if session is not None:
            await self._execute_upsert(session, embeddings)
        else:
            await self._ensure_connected()
            async with self._session_factory() as s:
                await self._execute_upsert(s, embeddings)
                await s.commit()

    async def _execute_search(
        self, session: Any, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None
    ) -> list[VectorRecord]:
        from sqlalchemy import text

        vector_str = "[" + ",".join(f"{v}" for v in query_vector) + "]"
        conditions = []
        params: dict[str, Any] = {"vector_str": vector_str, "limit": limit}

        if not filters or ("workspace_id" not in filters and "tenant_id" not in filters):
            raise ValueError("Zero-Trust violation: vector search must specify tenant_id or workspace_id filter")

        if filters:
            if "workspace_id" in filters:
                conditions.append("workspace_id = :workspace_id")
                params["workspace_id"] = filters["workspace_id"]
            if "tenant_id" in filters:
                conditions.append("workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = :tenant_id)")
                params["tenant_id"] = filters["tenant_id"]
            if "source_type" in filters:
                conditions.append("source_type = :source_type")
                params["source_type"] = filters["source_type"]

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        stmt = text(f"""
            SELECT id, vector, source_type, source_id, model_version, workspace_id
            FROM embeddings
            WHERE {where_clause} AND vector IS NOT NULL
            ORDER BY vector <=> CAST(:vector_str AS vector)
            LIMIT :limit
        """)
        result = await session.execute(stmt, params)
        rows = result.fetchall()

        records = []
        for row in rows:
            raw_vec = row[1]
            vec = list(raw_vec) if hasattr(raw_vec, "__iter__") else raw_vec
            records.append(
                VectorRecord(
                    id=str(row[0]),
                    vector=vec,
                    metadata={
                        "source_type": row[2],
                        "source_id": str(row[3]) if row[3] else "",
                        "model_version": row[4],
                        "workspace_id": str(row[5]) if row[5] else "",
                    },
                )
            )
        return records

    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None, **kwargs: Any
    ) -> list[VectorRecord]:
        session = kwargs.get("session")
        if session is not None:
            return await self._execute_search(session, query_vector, limit, filters)
        await self._ensure_connected()
        async with self._session_factory() as s:
            return await self._execute_search(s, query_vector, limit, filters)

    async def _execute_delete(self, session: Any, ids: Sequence[str]) -> None:
        from sqlalchemy import text
        for id_ in ids:
            await session.execute(text("DELETE FROM embeddings WHERE id = :id"), {"id": id_})

    async def delete(self, ids: Sequence[str], **kwargs: Any) -> None:
        session = kwargs.get("session")
        if session is not None:
            await self._execute_delete(session, ids)
        else:
            await self._ensure_connected()
            async with self._session_factory() as s:
                await self._execute_delete(s, ids)
                await s.commit()


class QdrantStore(VectorStore):
    def __init__(self, url: str | None = None, api_key: str | None = None, collection_name: str = "vaeloom_vectors"):
        self._url = url or os.environ.get("QDRANT_URL", "")
        self._api_key = api_key or os.environ.get("QDRANT_API_KEY", "")
        if not self._url:
            try:
                from api.config import settings
                self._url = getattr(settings, "qdrant_url", "") or ""
                self._api_key = self._api_key or getattr(settings, "qdrant_api_key", "") or ""
            except Exception:
                pass
        self._url = self._url or "http://localhost:6333"
        self._collection = collection_name
        self._client: Any = None

    async def _ensure_connected(self):
        if self._client is not None:
            return
        try:
            from qdrant_client import AsyncQdrantClient
            from qdrant_client.http import models
            self._models = models
            self._client = AsyncQdrantClient(url=self._url, api_key=self._api_key or None)
            collections = await self._client.get_collections()
            exists = any(c.name == self._collection for c in collections.collections)
            if not exists:
                await self._client.create_collection(
                    collection_name=self._collection,
                    vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE),
                )
        except ImportError:
            raise RuntimeError("qdrant_client is not installed; cannot use QdrantStore")

    async def upsert(self, embeddings: Sequence[VectorRecord], **kwargs: Any) -> None:
        await self._ensure_connected()
        points = []
        for rec in embeddings:
            payload = {k: (str(v) if not isinstance(v, (str, int, float, bool)) else v) for k, v in rec.metadata.items()}
            payload["_id"] = rec.id
            points.append(self._models.PointStruct(id=rec.id, vector=rec.vector, payload=payload))
        await self._client.upsert(collection_name=self._collection, points=points)

    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None, **kwargs: Any
    ) -> list[VectorRecord]:
        await self._ensure_connected()
        if not filters or ("workspace_id" not in filters and "tenant_id" not in filters):
            raise ValueError("Zero-Trust violation: vector search must specify tenant_id or workspace_id filter")
        qfilter = None
        if filters:
            conditions = []
            for key, value in filters.items():
                conditions.append(self._models.FieldCondition(key=key, match=self._models.MatchValue(value=value)))
            if conditions:
                qfilter = self._models.Filter(must=conditions)

        results = await self._client.query_points(
            collection_name=self._collection,
            query=query_vector,
            query_filter=qfilter,
            limit=limit,
            with_payload=True,
        )
        records = []
        for point in results.points:
            payload = dict(point.payload or {})
            id_ = payload.pop("_id", str(point.id))
            records.append(VectorRecord(id=id_, vector=list(point.vector or []), metadata=payload))
        return records

    async def delete(self, ids: Sequence[str], **kwargs: Any) -> None:
        await self._ensure_connected()
        await self._client.delete(collection_name=self._collection, points_selector=self._models.PointIdsList(points=list(ids)))


class FallbackVectorStore(VectorStore):
    """In-memory cosine similarity vector store used when external vector engines
    (pgvector, qdrant) are unavailable.

    Provides functional vector search and metadata filtering in development, CI,
    and fallback scenarios rather than silently dropping ingested vectors.
    """

    def __init__(self) -> None:
        self._records: dict[str, VectorRecord] = {}
        if os.environ.get("ENVIRONMENT") == "production":
            logger.error(
                "VECTOR_STORE_DEGRADED: FallbackVectorStore active in production! "
                "Vectors stored only in process memory and lost on restart."
            )
        else:
            logger.info("FallbackVectorStore initialized (in-memory cosine similarity).")

    @staticmethod
    def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = sum(a * a for a in v1) ** 0.5
        norm2 = sum(b * b for b in v2) ** 0.5
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return dot / (norm1 * norm2)

    async def upsert(self, embeddings: Sequence[VectorRecord], **kwargs: Any) -> None:
        if os.environ.get("ENVIRONMENT") == "production":
            logger.error(
                "VECTOR_STORE_EPHEMERAL_UPSERT: Storing vectors in ephemeral fallback store in production!"
            )
        for rec in embeddings:
            self._records[rec.id] = rec

    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None, **kwargs: Any
    ) -> list[VectorRecord]:
        if not filters or ("workspace_id" not in filters and "tenant_id" not in filters):
            raise ValueError("Zero-Trust violation: vector search must specify tenant_id or workspace_id filter")
        scored: list[tuple[float, VectorRecord]] = []
        for rec in self._records.values():
            if filters:
                match = True
                for k, v in filters.items():
                    if rec.metadata.get(k) != v:
                        match = False
                        break
                if not match:
                    continue
            sim = self._cosine_similarity(query_vector, rec.vector)
            scored.append((sim, rec))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [rec for _, rec in scored[:limit]]

    async def delete(self, ids: Sequence[str], **kwargs: Any) -> None:
        for id_ in ids:
            self._records.pop(id_, None)


def get_vector_store() -> VectorStore:
    store_type = os.environ.get("VECTOR_STORE", "")
    if not store_type:
        try:
            from api.config import settings
            store_type = getattr(settings, "vector_store", "") or ""
        except Exception:
            pass
    store_type = (store_type or "pgvector").lower()

    if store_type == "qdrant":
        try:
            import qdrant_client  # noqa: F401
            return QdrantStore()
        except ImportError:
            return FallbackVectorStore()

    if store_type == "pgvector":
        return PGVectorStore()

    return FallbackVectorStore()
