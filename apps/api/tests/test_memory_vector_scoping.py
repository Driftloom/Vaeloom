"""Memory vector search must satisfy the store's zero-trust scope guard.

`FallbackVectorStore.search` raises unless the caller supplies ``workspace_id``
or ``tenant_id``. That guard landed in 9e706182 ("feat(api): zero-trust auth,
TOTP MFA, session revocation...") and is correct: an unscoped vector search
returns every tenant's rows.

`search_memories` was not compatible with it. It set ``workspace_id`` on the
vector-store filters only ``if target_ws``, and always set ``source_type``. On
the tenant-wide path -- ``workspace_id=None, allow_tenant_wide=True`` -- the
filters were therefore ``{"source_type": "memory"}``, which trips the guard.
The resulting ``ValueError`` was swallowed by a broad ``except`` and logged at
``debug``, so the call silently fell through to the cosine query.

No data leaked: the cosine fallback scopes by tenant and workspace (see
``memory_service.search_memories``). The defect was silent degradation, plus a
wasted round trip, on a supported code path.
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.schemas.memory import MemorySearch
from api.services.memory_service import MemoryService

pytestmark = pytest.mark.asyncio

TENANT = "tenant-" + "t" * 8
OTHER_TENANT = "tenant-" + "o" * 8


@pytest.fixture
def svc() -> MemoryService:
    return MemoryService()


class _SpyStore:
    """Records the filters it was called with, and returns nothing."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def search(self, query_vector, limit=10, filters=None, **kwargs):
        self.calls.append(dict(filters or {}))
        return []

    async def upsert(self, *args, **kwargs):
        return None

    async def delete(self, *args, **kwargs):
        return None


async def _run(svc, db_session, *, tenant_id, workspace_id, allow_tenant_wide) -> _SpyStore:
    store = _SpyStore()
    dto = MemorySearch(query="anything", strategy="vector", top_k=5)
    with patch(
        "api.infrastructure.vector_store.get_vector_store", return_value=store
    ), patch.object(
        MemoryService, "_embedding", return_value=[0.1, 0.2, 0.3], create=True
    ), patch(
        "api.services.memory_service.llm_service.generate_embedding",
        new=AsyncMock(return_value=[0.1, 0.2, 0.3]),
    ):
        await svc.search_memories(
            db_session, dto,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            allow_tenant_wide=allow_tenant_wide,
        )
    return store


class TestVectorSearchSatisfiesTheScopeGuard:
    async def test_workspace_scoped_search_sends_workspace_id(self, db_session, svc):
        ws = str(uuid.uuid4())
        store = await _run(
            svc, db_session, tenant_id=TENANT, workspace_id=ws, allow_tenant_wide=False
        )
        assert store.calls, "the vector store was never consulted"
        assert store.calls[0].get("workspace_id") == ws

    async def test_tenant_wide_search_sends_tenant_id(self, db_session, svc):
        """The regression.

        With no workspace but ``allow_tenant_wide``, the filters used to be
        ``{"source_type": "memory"}`` with neither scope, so the store raised and
        the search silently degraded.
        """
        store = await _run(
            svc, db_session, tenant_id=TENANT, workspace_id=None, allow_tenant_wide=True
        )
        assert store.calls, "the vector store was never consulted"
        filters = store.calls[0]
        assert (
            filters.get("workspace_id") or filters.get("tenant_id")
        ), f"no scope in {filters}; the zero-trust guard would have rejected this"

    async def test_tenant_scope_is_the_tenant_requested(self, db_session, svc):
        store = await _run(
            svc, db_session, tenant_id=OTHER_TENANT, workspace_id=None, allow_tenant_wide=True
        )
        assert store.calls[0].get("tenant_id") == OTHER_TENANT

    async def test_source_type_filter_is_still_applied(self, db_session, svc):
        """The embeddings table is shared with document_chunk rows; dropping this
        filter lets placeholder source_ids consume the top_k slots."""
        ws = str(uuid.uuid4())
        store = await _run(
            svc, db_session, tenant_id=TENANT, workspace_id=ws, allow_tenant_wide=False
        )
        assert store.calls[0].get("source_type") == "memory"

    async def test_every_filter_carries_a_scope(self, db_session, svc):
        """Whatever the path, the store never receives an unscoped query."""
        for kwargs in (
            {"tenant_id": TENANT, "workspace_id": str(uuid.uuid4()), "allow_tenant_wide": False},
            {"tenant_id": TENANT, "workspace_id": None, "allow_tenant_wide": True},
            {"tenant_id": OTHER_TENANT, "workspace_id": None, "allow_tenant_wide": True},
        ):
            store = await _run(svc, db_session, **kwargs)
            for call in store.calls:
                assert call.get("workspace_id") or call.get("tenant_id"), (kwargs, call)


class TestUnscopedSearchIsRefusedNotSilentlyDegraded:
    async def test_no_scope_at_all_never_reaches_the_store(self, db_session, svc):
        """Neither tenant nor workspace: skip the round trip entirely.

        The guard would reject it, so calling it only to catch the exception
        wastes a database/vector-store call and produces a misleading
        "Zero-Trust violation" debug line for what is really a normal fallback.
        """
        store = _SpyStore()
        dto = MemorySearch(query="anything", strategy="vector", top_k=5)
        with patch(
            "api.infrastructure.vector_store.get_vector_store", return_value=store
        ), patch(
            "api.services.memory_service.llm_service.generate_embedding",
            new=AsyncMock(return_value=[0.1, 0.2, 0.3]),
        ):
            await svc.search_memories(
                db_session, dto,
                tenant_id=None,
                workspace_id=None,
                allow_tenant_wide=True,
            )
        for call in store.calls:
            assert call.get("workspace_id") or call.get("tenant_id"), call

    async def test_workspace_is_required_unless_tenant_wide(self, db_session, svc):
        dto = MemorySearch(query="anything", strategy="vector", top_k=5)
        with pytest.raises(ValueError, match="workspace_id is required"):
            await svc.search_memories(
                db_session, dto, tenant_id=TENANT, workspace_id=None, allow_tenant_wide=False
            )