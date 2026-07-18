import pytest
from app.agents.memory_agent.merge import merge_check
from app.agents.memory_agent.retrieval import retrieve

@pytest.mark.asyncio
async def test_merge_react():
    # Should merge
    result = await merge_check("React", ["React.js"], "ws1")
    assert result.action == "merge"
    assert result.confidence >= 0.8

@pytest.mark.asyncio
async def test_merge_different_people():
    # Should NOT merge
    result = await merge_check("Alice Smith", ["Alice Jones"], "ws1")
    assert result.action == "create_new"
    assert result.confidence < 0.8

@pytest.mark.asyncio
async def test_retrieve_hybrid():
    results = await retrieve("machine learning", "ws1", strategy="hybrid")
    # Hybrid should combine vector, keyword, and graph (total 3 in our mock)
    assert len(results) == 3
    # Check if they are sorted by relevance
    assert results[0].relevance_score >= results[1].relevance_score
