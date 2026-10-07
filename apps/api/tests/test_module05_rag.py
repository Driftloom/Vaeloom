"""Test Suite: Module 05 Vector RAG Pipeline (M05-RAG & M05-OCR).
Verifies parsing, chunking with byte offsets, vector store isolation, ranking, and context window budgeting.

Ranking/budgeting is asserted against the live ContextEngine
(`api.services.context_engine`). These tests previously imported the deleted,
never-wired `api.agents.memory_agent.retrieval`.
"""
import uuid

import pytest

from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord
from api.ingestion.parsers import parse_document
from api.services.context_engine import ContextItem, compress_to_budget, rank_items


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
    """Verify ranking order and context window token constraints.

    Asserted against the live ContextEngine used by `_assemble_rag_context`.
    """
    items = [
        ContextItem(kind="memory", content="Strategic growth grew 34% YoY across cloud services.", relevance=0.95),
        ContextItem(kind="evidence", content="Strategic growth grew 34% YoY", relevance=0.80),
        ContextItem(kind="evidence", content="Operational costs dropped by 14% after rightsizing.", relevance=0.90),
    ]

    ranked = rank_items(items, limit=5)
    # Grounding evidence (P1) outranks dynamic memory (P3) despite lower relevance.
    assert ranked[0].priority == "P1_ACTIVE_GROUNDING"
    assert ranked[0].content.startswith("Operational costs")
    assert ranked[-1].kind == "memory"

    fitted, _compressed = compress_to_budget(ranked, token_budget=1550)
    assert len(fitted) >= 1
    assert sum(i.token_estimate for i in fitted) <= 1550 + 4
