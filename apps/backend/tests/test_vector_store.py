from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytestmark = pytest.mark.asyncio


class TestVectorStore:
    async def test_fallback_store(self):
        from backend.infrastructure.vector_store import FallbackVectorStore

        store = FallbackVectorStore()
        await store.upsert([])
        results = await store.search([0.1] * 1536)
        assert results == []
        await store.delete(["a"])

    async def test_get_vector_store_default(self):
        from backend.infrastructure.vector_store import get_vector_store

        with patch.dict("os.environ", {"VECTOR_STORE": "pgvector"}):
            store = get_vector_store()
            from backend.infrastructure.vector_store import PGVectorStore
            assert isinstance(store, PGVectorStore)

    async def test_get_vector_store_fallback(self):
        from backend.infrastructure.vector_store import get_vector_store

        with patch.dict("os.environ", {"VECTOR_STORE": "nonexistent"}):
            store = get_vector_store()
            from backend.infrastructure.vector_store import FallbackVectorStore
            assert isinstance(store, FallbackVectorStore)

    async def test_get_vector_store_qdrant_not_installed(self):
        from backend.infrastructure.vector_store import get_vector_store

        with patch.dict("os.environ", {"VECTOR_STORE": "qdrant"}):
            with patch("backend.infrastructure.vector_store.QdrantStore") as mock_qdrant:
                import builtins
                original_import = __builtins__["__import__"] if isinstance(__builtins__, dict) else __builtins__.__import__

                def mock_import(name, *args, **kwargs):
                    if name == "qdrant_client":
                        raise ImportError
                    return original_import(name, *args, **kwargs)

                with patch("builtins.__import__", side_effect=mock_import):
                    store = get_vector_store()
                    from backend.infrastructure.vector_store import FallbackVectorStore
                    assert isinstance(store, FallbackVectorStore)

    async def test_pgvector_upsert_search(self):
        from backend.infrastructure.vector_store import PGVectorStore, VectorRecord

        store = PGVectorStore(connection_url="sqlite+aiosqlite://")
        store._ensure_connected = AsyncMock()
        mock_exec_result = MagicMock()
        mock_exec_result.fetchall.return_value = []
        mock_session = MagicMock()
        mock_session.__aenter__.return_value = mock_session
        mock_session.commit = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        store._session_factory = MagicMock(return_value=mock_session)
        store._engine = AsyncMock()

        records = [VectorRecord(id=str(uuid.uuid4()), vector=[0.1] * 1536, metadata={"source_type": "test"})]
        await store.upsert(records)
        assert mock_session.execute.called

        mock_session.reset_mock()
        mock_session.execute = AsyncMock(return_value=mock_exec_result)
        results = await store.search([0.1] * 1536)
        assert results == []

        await store.delete([records[0].id])

    async def test_vector_record_dataclass(self):
        from backend.infrastructure.vector_store import VectorRecord

        rec = VectorRecord(id="abc", vector=[0.1, 0.2], metadata={"key": "val"})
        assert rec.id == "abc"
        assert rec.vector == [0.1, 0.2]
        assert rec.metadata == {"key": "val"}
