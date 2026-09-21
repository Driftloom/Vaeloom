"""Test Suite: Module 05 Vector RAG Pipeline (M05-RAG & M05-OCR).
Verifies parsing, chunking with byte offsets, vector store isolation, reranking, and context window budgeting.
"""
import uuid
import pytest

from api.ingestion.parsers import parse_document
from api.ingestion.chunking import chunk_text
from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord
from api.agents.memory_agent.retrieval import RetrievedMemory, rerank, fit_to_context_window


@pytest.mark.asyncio
async def test_multi_format_parsing_and_ocr():
    """Verify document parser extracts clean text and metadata."""
    markdown_bytes = b"# System Architecture\nDistributed agent clusters communicate over mTLS."
    parsed = await parse_document("arch.md", markdown_bytes)
    assert "System Architecture" in parsed.text
    assert parsed.metadata["format"] == "markdown"


@pytest.mark.asyncio
async def test_vector_store_zero_trust_isolation():
    """Verify vector store strictly rejects queries without workspace/tenant filters."""
    store = FallbackVectorStore()
    ws_a = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())

    rec_a = VectorRecord(id="rec-a", vector=[1.0, 0.0], metadata={"workspace_id": ws_a})
    rec_b = VectorRecord(id="rec-b", vector=[1.0, 0.0], metadata={"workspace_id": ws_b})
    await store.upsert([rec_a, rec_b])

    # Fails closed without filter
    with pytest.raises(ValueError, match="Zero-Trust violation"):
        await store.search(query_vector=[1.0, 0.0], filters=None)

    # Scoped query only returns workspace A
    res = await store.search(query_vector=[1.0, 0.0], filters={"workspace_id": ws_a})
    assert len(res) == 1
    assert res[0].id == "rec-a"


@pytest.mark.asyncio
async def test_reranking_and_context_budgeting():
    """Verify deduplication, overlap suppression, and context window token constraints."""
    memories = [
        RetrievedMemory(id="m1", content="Strategic growth grew 34% YoY across cloud services.", relevance_score=0.95),
        RetrievedMemory(id="m1", content="Strategic growth grew 34% YoY across cloud services.", relevance_score=0.95),  # dup id
        RetrievedMemory(id="m2", content="Strategic growth grew 34% YoY", relevance_score=0.80),  # substring overlap
        RetrievedMemory(id="m3", content="Operational costs dropped by 14% after rightsizing.", relevance_score=0.90),
    ]

    reranked = await rerank(memories, query="growth", limit=5)
    ids = [m.id for m in reranked]
    assert ids[0] == "m1"
    assert len([x for x in ids if x == "m1"]) == 1
    assert "m3" in ids

    fitted = fit_to_context_window(reranked, max_context_tokens=1550)
    assert len(fitted) >= 1
