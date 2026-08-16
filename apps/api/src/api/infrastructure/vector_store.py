from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Sequence


@dataclass
class VectorRecord:
    id: str
    vector: list[float]
    metadata: dict[str, Any]


class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, embeddings: Sequence[VectorRecord]) -> None: ...

    @abstractmethod
    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None
    ) -> list[VectorRecord]: ...

    @abstractmethod
    async def delete(self, ids: Sequence[str]) -> None: ...


class PGVectorStore(VectorStore):
    def __init__(self, connection_url: str | None = None, collection_name: str = "vaeloom_vectors"):
        self._url = connection_url or os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom")
        self._collection = collection_name
        self._engine: Any = None
        self._session_factory: Any = None

    async def _ensure_connected(self):
        if self._engine is not None:
            return
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        self._engine = create_async_engine(self._url, pool_pre_ping=True, pool_size=5, max_overflow=5)
        self._session_factory = async_sessionmaker(self._engine, expire_on_commit=False)

    async def upsert(self, embeddings: Sequence[VectorRecord]) -> None:
        await self._ensure_connected()
        from sqlalchemy import text

        async with self._session_factory() as session:
            for rec in embeddings:
                vector_str = "[" + ",".join(f"{v}" for v in rec.vector) + "]"
                stmt = text("""
                    INSERT INTO embeddings (id, source_type, source_id, vector, model_version, workspace_id)
                    VALUES (:id, :source_type, :source_id, :vector::vector, :model_version, :workspace_id)
                    ON CONFLICT (id) DO UPDATE SET vector = :vector::vector
                """)
                await session.execute(
                    stmt,
                    {
                        "id": rec.id,
                        "source_type": rec.metadata.get("source_type", "unknown"),
                        "source_id": rec.metadata.get("source_id", rec.id),
                        "vector": vector_str,
                        "model_version": rec.metadata.get("model_version", "text-embedding-3-small"),
                        "workspace_id": rec.metadata.get("workspace_id", "00000000-0000-0000-0000-000000000000"),
                    },
                )
            await session.commit()

    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None
    ) -> list[VectorRecord]:
        await self._ensure_connected()
        from sqlalchemy import text

        vector_str = "[" + ",".join(f"{v}" for v in query_vector) + "]"
        conditions = []
        params: dict[str, Any] = {"vector_str": vector_str, "limit": limit}

        if filters:
            if "workspace_id" in filters:
                conditions.append("workspace_id = :workspace_id")
                params["workspace_id"] = filters["workspace_id"]
            if "source_type" in filters:
                conditions.append("source_type = :source_type")
                params["source_type"] = filters["source_type"]

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        stmt = text(f"""
            SELECT id, vector, source_type, source_id, model_version, workspace_id
            FROM embeddings
            WHERE {where_clause} AND vector IS NOT NULL
            ORDER BY vector <=> :vector_str::vector
            LIMIT :limit
        """)
        async with self._session_factory() as session:
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

    async def delete(self, ids: Sequence[str]) -> None:
        await self._ensure_connected()
        from sqlalchemy import text

        async with self._session_factory() as session:
            for id_ in ids:
                await session.execute(text("DELETE FROM embeddings WHERE id = :id"), {"id": id_})
            await session.commit()


class QdrantStore(VectorStore):
    def __init__(self, url: str | None = None, api_key: str | None = None, collection_name: str = "vaeloom_vectors"):
        self._url = url or os.environ.get("QDRANT_URL", "http://localhost:6333")
        self._api_key = api_key or os.environ.get("QDRANT_API_KEY", "")
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

    async def upsert(self, embeddings: Sequence[VectorRecord]) -> None:
        await self._ensure_connected()
        points = []
        for rec in embeddings:
            payload = {k: (str(v) if not isinstance(v, (str, int, float, bool)) else v) for k, v in rec.metadata.items()}
            payload["_id"] = rec.id
            points.append(self._models.PointStruct(id=rec.id, vector=rec.vector, payload=payload))
        await self._client.upsert(collection_name=self._collection, points=points)

    async def search(
        self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None
    ) -> list[VectorRecord]:
        await self._ensure_connected()
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

    async def delete(self, ids: Sequence[str]) -> None:
        await self._ensure_connected()
        await self._client.delete(collection_name=self._collection, points_selector=self._models.PointIdsList(points=list(ids)))


class FallbackVectorStore(VectorStore):
    async def upsert(self, embeddings: Sequence[VectorRecord]) -> None:
        pass

    async def search(self, query_vector: list[float], limit: int = 10, filters: dict[str, Any] | None = None) -> list[VectorRecord]:
        return []

    async def delete(self, ids: Sequence[str]) -> None:
        pass


def get_vector_store() -> VectorStore:
    store_type = os.environ.get("VECTOR_STORE", "pgvector").lower()
    if store_type == "qdrant":
        try:
            import qdrant_client  # noqa: F401
            return QdrantStore()
        except ImportError:
            pass
    if store_type == "pgvector":
        return PGVectorStore()
    return FallbackVectorStore()
