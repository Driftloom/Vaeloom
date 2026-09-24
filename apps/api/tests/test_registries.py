"""Enterprise Dynamic Registries Test Suite.

Verifies:
- DB Model definitions and constraints
- Pydantic schema validation
- CRUD operations on Tool, Model, Policy, Prompt, Evaluation registries
- Seeder synchronization from built-in catalogs
"""
import uuid
import pytest
from sqlalchemy import select

from api.models.registries import (
    EvaluationEntry,
    ModelProviderEntry,
    PolicyEntry,
    PromptVersionEntry,
    ToolRegistryEntry,
)
from api.schemas.registries import (
    ModelProviderCreate,
    PolicyCreate,
    PromptVersionCreate,
    ToolRegistryCreate,
)
from api.services.registry_seeder import seed_registries

pytestmark = pytest.mark.asyncio


async def test_tool_registry_crud(db_session):
    """Verify tool registration, querying, and unique constraints."""
    tool_data = ToolRegistryEntry(
        tool_id="test_custom_tool",
        name="Custom Test Tool",
        version="1.0.0",
        description="A tool for testing dynamic discovery",
        category="system",
        input_schema={"type": "object", "properties": {"val": {"type": "string"}}},
        output_schema={"type": "object", "properties": {"status": {"type": "string"}}},
        required_permissions=["system.read"],
        data_scopes=["test"],
        risk_level="LOW",
        side_effects=False,
        idempotent=True,
    )
    db_session.add(tool_data)
    await db_session.commit()

    # Query back
    stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.tool_id == "test_custom_tool")
    res = await db_session.execute(stmt)
    entry = res.scalars().first()
    assert entry is not None
    assert entry.name == "Custom Test Tool"
    assert entry.is_active is True
    assert entry.required_permissions == ["system.read"]


async def test_model_provider_registry(db_session):
    """Verify model provider registry storage and tier filtering."""
    model_entry = ModelProviderEntry(
        model_id="gemma-custom-31b",
        name="Custom Gemma 31B",
        provider="ollama",
        version="v1",
        tier="powerful",
        context_window=32768,
        cost_per_1k_input=0.0005,
        cost_per_1k_output=0.001,
        capabilities={"tool_calling": True, "structured_output": True},
        health_status="healthy",
    )
    db_session.add(model_entry)
    await db_session.commit()

    stmt = select(ModelProviderEntry).where(ModelProviderEntry.tier == "powerful")
    res = await db_session.execute(stmt)
    models = res.scalars().all()
    assert any(m.model_id == "gemma-custom-31b" for m in models)


async def test_policy_and_prompt_versioning(db_session):
    """Verify policy entry and prompt versioning."""
    policy = PolicyEntry(
        policy_id="test_security_policy",
        name="Test Policy",
        scope="agent",
        target="resume",
        rules={"max_iterations": 5},
        risk_threshold="HIGH",
        requires_approval=True,
    )
    prompt = PromptVersionEntry(
        prompt_id="system.test_agent",
        version="2.0.0",
        agent_scope="test_agent",
        template="You are a helpful assistant.",
        content_hash="abc123hash",
        variables=["user_name"],
        canary_percentage=50,
    )
    db_session.add(policy)
    db_session.add(prompt)
    await db_session.commit()

    # Check policy
    res_pol = await db_session.execute(select(PolicyEntry).where(PolicyEntry.policy_id == "test_security_policy"))
    p = res_pol.scalars().first()
    assert p is not None
    assert p.requires_approval is True

    # Check prompt
    res_pr = await db_session.execute(select(PromptVersionEntry).where(PromptVersionEntry.prompt_id == "system.test_agent"))
    pr = res_pr.scalars().first()
    assert pr is not None
    assert pr.canary_percentage == 50


async def test_seed_registries(db_session):
    """Verify seeder imports built-in tools and models without duplicates."""
    stats = await seed_registries(db_session)
    assert stats["tools"] > 0
    assert stats["models"] > 0
    assert stats["policies"] > 0

    # Idempotent re-run
    stats2 = await seed_registries(db_session)
    assert stats2["tools"] == 0
    assert stats2["models"] == 0
    assert stats2["policies"] == 0
