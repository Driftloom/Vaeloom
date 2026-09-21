"""Integration tests: Cache Isolation and Cross-Workspace Poisoning Prevention (P0-06).

Verifies that CacheService.make_key properly namespaces cache keys by tenant and workspace,
guaranteeing that identical queries in different workspaces or tenants never collide or leak.
"""
import uuid
import pytest

from api.services.cache_service import CacheService, cache_service

pytestmark = pytest.mark.integration


def test_cache_key_includes_workspace_and_tenant():
    """Cache key must encode tenant_id and workspace_id."""
    t_id = "tenant-alpha"
    w_id = "workspace-beta"
    key = CacheService.make_key(t_id, w_id, "documents", "list", "page=1")

    assert key.startswith("cache:tenant-alpha:workspace-beta:documents:")
    assert len(key.split(":")) == 5


def test_cross_workspace_keys_never_collide():
    """Identical query parameters across two different workspaces must yield distinct keys."""
    t_id = "tenant-1"
    ws_1 = str(uuid.uuid4())
    ws_2 = str(uuid.uuid4())

    key1 = CacheService.make_key(t_id, ws_1, "documents", "list", "filter=active")
    key2 = CacheService.make_key(t_id, ws_2, "documents", "list", "filter=active")

    assert key1 != key2, f"Collision detected between workspace {ws_1} and {ws_2}"


def test_cross_tenant_keys_never_collide():
    """Identical workspace and query in different tenants must yield distinct keys."""
    t_1 = str(uuid.uuid4())
    t_2 = str(uuid.uuid4())
    ws_id = "shared-ws-id"

    key1 = CacheService.make_key(t_1, ws_id, "search", "query=confidential")
    key2 = CacheService.make_key(t_2, ws_id, "search", "query=confidential")

    assert key1 != key2


@pytest.mark.asyncio
async def test_cache_store_and_retrieve_isolation():
    """Setting cache in workspace 1 must not be retrievable using workspace 2's key."""
    ws_1 = str(uuid.uuid4())
    ws_2 = str(uuid.uuid4())
    tenant = "test-tenant"

    key_1 = CacheService.make_key(tenant, ws_1, "doc_summary", "doc_123")
    key_2 = CacheService.make_key(tenant, ws_2, "doc_summary", "doc_123")

    await cache_service.set(key_1, {"summary": "Confidential Project Alpha"})

    val_1 = await cache_service.get(key_1)
    val_2 = await cache_service.get(key_2)

    assert val_1 == {"summary": "Confidential Project Alpha"}
    assert val_2 is None, "Cross-workspace cache leak detected!"
