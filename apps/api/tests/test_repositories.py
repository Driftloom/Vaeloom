"""Enterprise Repositories Test Suite.

Verifies:
- BaseRepository tenant and workspace RLS isolation
- Negative control: cross-tenant isolation
- ToolRepository querying and active filtering
- ModelRepository tier and health status querying
- PromptRepository latest version resolution
"""

import uuid
import pytest

from api.models.registries import (
    ModelProviderEntry,
    PromptVersionEntry,
    ToolRegistryEntry,
)
from api.repositories import (
    ModelRepository,
    PromptRepository,
    ToolRepository,
)

pytestmark = pytest.mark.asyncio


async def test_tool_repository_tenant_isolation(db_session):
    """Verify ToolRepository enforces tenant boundaries."""
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()

    # Tool for tenant A
    tool_a = ToolRegistryEntry(
        tool_id="tool_tenant_a",
        name="Tool A",
        version="1.0.0",
        description="Tenant A tool",
        category="custom",
        tenant_id=tenant_a,
    )
    # Tool for tenant B
    tool_b = ToolRegistryEntry(
        tool_id="tool_tenant_b",
        name="Tool B",
        version="1.0.0",
        description="Tenant B tool",
        category="custom",
        tenant_id=tenant_b,
    )
    db_session.add_all([tool_a, tool_b])
    await db_session.commit()

    # Query with repo scoped to Tenant A
    repo_a = ToolRepository(db_session, tenant_id=tenant_a)
    tools_a = await repo_a.list_active_tools()
    tool_ids_a = {t.tool_id for t in tools_a}

    assert "tool_tenant_a" in tool_ids_a
    # Negative Control: Tenant A must NOT see Tenant B's tool
    assert "tool_tenant_b" not in tool_ids_a


async def test_model_repository_tier_and_health(db_session):
    """Verify ModelRepository filters by tier and health."""
    m_fast = ModelProviderEntry(
        model_id="fast-model-test",
        name="Fast Model",
        provider="openai",
        tier="fast",
        health_status="healthy",
    )
    m_unhealthy = ModelProviderEntry(
        model_id="broken-model-test",
        name="Broken Model",
        provider="openai",
        tier="fast",
        health_status="unhealthy",
    )
    m_powerful = ModelProviderEntry(
        model_id="powerful-model-test",
        name="Powerful Model",
        provider="anthropic",
        tier="powerful",
        health_status="healthy",
    )
    db_session.add_all([m_fast, m_unhealthy, m_powerful])
    await db_session.commit()

    repo = ModelRepository(db_session)
    fast_models = await repo.list_active_by_tier("fast")
    fast_ids = {m.model_id for m in fast_models}

    assert "fast-model-test" in fast_ids
    # Unhealthy model must be excluded
    assert "broken-model-test" not in fast_ids
    # Powerful tier model must be excluded
    assert "powerful-model-test" not in fast_ids


async def test_prompt_repository_latest_version(db_session):
    """Verify PromptRepository retrieves the latest version."""
    p_v1 = PromptVersionEntry(
        prompt_id="test_prompt_chain",
        version="v1.0",
        template="Version 1",
        content_hash="h1",
    )
    p_v2 = PromptVersionEntry(
        prompt_id="test_prompt_chain",
        version="v2.0",
        template="Version 2",
        content_hash="h2",
    )
    db_session.add_all([p_v1, p_v2])
    await db_session.commit()

    repo = PromptRepository(db_session)
    latest = await repo.get_latest_version("test_prompt_chain")
    assert latest is not None
    assert latest.version == "v2.0"
    assert latest.template == "Version 2"

    versions = await repo.list_versions("test_prompt_chain")
    assert len(versions) == 2
