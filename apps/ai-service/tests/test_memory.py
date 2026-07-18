import pytest
from app.agents.memory_agent.extraction import extract, ExtractedFacts
from app.agents.memory_agent.merge import merge_check
from app.agents.memory_agent.retrieval import retrieve

@pytest.mark.asyncio
async def test_extract_returns_entities_for_known_content():
    facts = await extract("React experience with TypeScript", "resume", "doc1", "ws1")
    assert isinstance(facts, ExtractedFacts)
    assert len(facts.entities) > 0
    assert any(e.name == "React" for e in facts.entities)
    assert any(e.entity_type == "Skill" for e in facts.entities)

@pytest.mark.asyncio
async def test_extract_returns_empty_for_unknown_content():
    facts = await extract("random unrelated text", "note", "doc2", "ws1")
    assert len(facts.entities) == 0
    assert len(facts.relationships) == 0

@pytest.mark.asyncio
async def test_extract_returns_typed_result():
    facts = await extract("React", "resume", "doc1", "ws1")
    for entity in facts.entities:
        assert entity.confidence > 0
        assert isinstance(entity.name, str)
        assert isinstance(entity.entity_type, str)

@pytest.mark.asyncio
async def test_merge_react():
    result = await merge_check("React", ["React.js"], "ws1")
    assert result.action == "merge"
    assert result.confidence >= 0.8

@pytest.mark.asyncio
async def test_merge_different_people():
    result = await merge_check("Alice Smith", ["Alice Jones"], "ws1")
    assert result.action == "create_new"
    assert result.confidence < 0.8

@pytest.mark.asyncio
async def test_merge_unknown_entity_creates_new():
    result = await merge_check("UnknownEntityXYZ", [], "ws1")
    assert result.action == "create_new"

@pytest.mark.asyncio
async def test_retrieve_vector_strategy():
    results = await retrieve("machine learning", "ws1", strategy="vector")
    assert len(results) == 1

@pytest.mark.asyncio
async def test_retrieve_keyword_strategy():
    results = await retrieve("machine learning", "ws1", strategy="keyword")
    assert len(results) == 1

@pytest.mark.asyncio
async def test_retrieve_graph_strategy():
    results = await retrieve("machine learning", "ws1", strategy="graph")
    assert len(results) == 1

@pytest.mark.asyncio
async def test_retrieve_hybrid():
    results = await retrieve("machine learning", "ws1", strategy="hybrid")
    assert len(results) == 3
    assert results[0].relevance_score >= results[1].relevance_score

@pytest.mark.asyncio
async def test_retrieve_empty_for_unknown_strategy():
    results = await retrieve("machine learning", "ws1", strategy="invalid_strategy")
    assert len(results) == 0

@pytest.mark.asyncio
async def test_retrieve_rerank_sorts_by_score():
    combined = await retrieve("test", "ws1", strategy="hybrid")
    scores = [r.relevance_score for r in combined]
    assert scores == sorted(scores, reverse=True)
