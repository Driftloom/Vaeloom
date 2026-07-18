"""Tests for Memory Agent Handler edge cases."""
import pytest
from app.agents.memory_agent.handler import MemoryAgentHandler


@pytest.mark.asyncio
async def test_handler_execute_extracts_and_merges():
    handler = MemoryAgentHandler()
    result = await handler.execute("React experience", "resume", "doc1", "ws1")
    assert result["agent_name"] == "memory"
    assert result["action"] == "suggest"
    assert result["confidence"] > 0
    details = result["result"]["details"]
    assert len(details["entities"]) > 0
    assert len(details["merge_decisions"]) > 0


@pytest.mark.asyncio
async def test_handler_empty_content_returns_empty():
    handler = MemoryAgentHandler()
    result = await handler.execute("", "note", "doc2", "ws1")
    assert result["agent_name"] == "memory"
    details = result["result"]["details"]
    assert len(details["entities"]) == 0
    assert len(details["relationships"]) == 0


@pytest.mark.asyncio
async def test_handler_fallback_returns_clarification():
    handler = MemoryAgentHandler()
    result = await handler.fallback()
    assert result["agent_name"] == "memory"
    assert result["action"] == "ask_clarification"
    assert result["confidence"] == 0.0
    assert len(result["result"]["questions"]) > 0
    assert "more context" in result["result"]["summary"].lower()


@pytest.mark.asyncio
async def test_handler_default_autonomy_is_suggest():
    handler = MemoryAgentHandler()
    assert handler.default_autonomy == "suggest"


@pytest.mark.asyncio
async def test_handler_mission_is_set():
    handler = MemoryAgentHandler()
    assert "extract" in handler.mission.lower()
    assert "entity" in handler.mission.lower()


@pytest.mark.asyncio
async def test_handler_has_required_tools():
    handler = MemoryAgentHandler()
    tool_names = [t.name for t in handler.tools]
    assert "search_documents" in tool_names
    assert "create_entity" in tool_names
    assert "merge_entities" in tool_names
    assert "query_graph" in tool_names


@pytest.mark.asyncio
async def test_handler_memory_scopes_configured():
    handler = MemoryAgentHandler()
    assert "profile" in handler.memory_scopes.read_types
    assert "document" in handler.memory_scopes.read_types
    assert "profile" in handler.memory_scopes.write_types
    assert "document" in handler.memory_scopes.write_types


@pytest.mark.asyncio
async def test_handler_execute_returns_summary_with_counts():
    handler = MemoryAgentHandler()
    result = await handler.execute("React and TypeScript", "resume", "doc3", "ws1")
    summary = result["result"]["summary"]
    assert "entities" in summary.lower()
    assert "relationships" in summary.lower()
    assert any(c.isdigit() for c in summary)
