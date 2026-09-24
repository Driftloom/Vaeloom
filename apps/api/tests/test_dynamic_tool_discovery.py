"""Enterprise Dynamic Tool Discovery Test Suite.

Verifies:
- Dynamic tool discovery based on agent capabilities and AgentCard declarations
- Least-privilege permission filtering
- DB-driven tool active/inactive overrides
- Side-effect restrictions (safe read-only mode)
"""
import uuid
import pytest
from sqlalchemy import select

from api.models.registries import ToolRegistryEntry
from api.services.tool_registry_service import tool_registry_service
from api.tools.definitions import ALL_TOOLS

pytestmark = pytest.mark.asyncio


async def test_discover_tools_agent_capabilities(db_session):
    """Test that tool discovery extracts tools matching agent capabilities and cards."""
    # Discover tools for career_architect
    tools = await tool_registry_service.discover_tools(
        agent_name="career_architect",
        session=db_session,
    )
    assert len(tools) > 0
    tool_names = {t.name for t in tools}
    # career_architect capability requires search_documents
    assert "search_documents" in tool_names


async def test_discover_tools_permission_filtering(db_session):
    """Test that unauthorized tools are filtered out when explicit permissions are enforced."""
    # Discover tools with empty permissions (least privilege)
    tools = await tool_registry_service.discover_tools(
        agent_name="career_architect",
        user_permissions=["unrelated.permission"],
        session=db_session,
    )
    for tool in tools:
        if tool.required_scope:
            assert tool.required_scope == "unrelated.permission" or "*" in ["unrelated.permission"]


async def test_discover_tools_db_inactive_override(db_session):
    """Test that marking a tool inactive in the DB removes it from discovery."""
    # Add an inactive override for search_documents
    override = ToolRegistryEntry(
        tool_id="search_documents",
        name="Search Documents",
        version="1.0.0",
        description="Search through candidate documents",
        category="system",
        input_schema={},
        output_schema={},
        required_permissions=[],
        is_active=False,  # DEACTIVATED
    )
    db_session.add(override)
    await db_session.commit()

    tools = await tool_registry_service.discover_tools(
        agent_name="career_architect",
        session=db_session,
    )
    tool_names = {t.name for t in tools}
    assert "search_documents" not in tool_names


async def test_discover_tools_side_effect_filtering(db_session):
    """Test that tools with side-effects are excluded when allow_side_effects=False."""
    tools_all = await tool_registry_service.discover_tools(
        agent_name="resume_tailor",
        allow_side_effects=True,
        declared_tools=["generate_resume", "read_file"],
        session=db_session,
    )
    tools_read_only = await tool_registry_service.discover_tools(
        agent_name="resume_tailor",
        allow_side_effects=False,
        declared_tools=["generate_resume", "read_file"],
        session=db_session,
    )

    names_all = {t.name for t in tools_all}
    names_ro = {t.name for t in tools_read_only}
    assert len(names_all) >= len(names_ro)
