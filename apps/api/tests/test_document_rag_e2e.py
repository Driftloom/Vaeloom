"""End-to-end tests for the Document RAG cognitive lifecycle:
Parsing -> Chunking -> Vector Store Isolation -> Hybrid Retrieval -> Context Budgeting -> Agent Synthesis & Grounded Citations.

Ranking/budgeting is asserted against the live ContextEngine
(`api.services.context_engine`), which is what `_assemble_rag_context` actually
uses. These tests previously imported `api.agents.memory_agent.retrieval`, a
module that was never wired into production and has since been deleted.
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from api.agents.document_agent.handler import DocumentAgent
from api.config import settings
from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord
from api.ingestion.chunking import chunk_text
from api.ingestion.parsers import parse_document
from api.services.context_engine import (
    ContextItem,
    compress_to_budget,
    rank_items,
)


@pytest.mark.asyncio
async def test_parse_and_chunk_pipeline():
    """Verify document parser extracts clean text and chunker produces provenance-tagged chunks."""
    doc_content = b"""# Project Odyssey Architecture
The Odyssey system coordinates distributed AI agents across multiple operational clusters.
Each cluster operates with an independent zero-trust perimeter and mutual TLS authentication.

## Security Controls
All document chunks must be hashed via SHA-256 and tagged with tenant and workspace identifiers.
Direct memory access across workspace partitions is prohibited by design.

## Recovery Procedures
In the event of network partition, local SQLite caches preserve operational state until
the primary PostgreSQL cluster re-establishes replication consensus.
"""
    parsed = await parse_document("architecture_spec.md", doc_content)
    assert "Odyssey" in parsed.text
    assert parsed.metadata.get("format") == "markdown"

    doc_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())
    chunks = chunk_text(
        text=parsed.text,
        chunk_size=150,
        chunk_overlap=30,
        source_document_id=doc_id,
        source_version_id=version_id,
        metadata={"filename": "architecture_spec.md"},
    )

    assert len(chunks) >= 2
    for chunk in chunks:
        assert chunk.source_document_id == doc_id
        assert chunk.source_version_id == version_id
        assert chunk.metadata["filename"] == "architecture_spec.md"
        assert chunk.start_offset >= 0
        assert chunk.end_offset > chunk.start_offset
        assert len(chunk.content) > 0


@pytest.mark.asyncio
async def test_vector_store_zero_trust_isolation():
    """Verify vector store strictly rejects queries lacking tenant/workspace filters and isolates data."""
    store = FallbackVectorStore()

    ws_a = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())

    # Seed vector for Workspace A
    rec_a = VectorRecord(
        id=str(uuid.uuid4()),
        vector=[1.0, 0.0, 0.0, 0.0],
        metadata={"workspace_id": ws_a, "content": "Workspace A confidential roadmap"},
    )
    # Seed vector for Workspace B
    rec_b = VectorRecord(
        id=str(uuid.uuid4()),
        vector=[1.0, 0.0, 0.0, 0.0],
        metadata={"workspace_id": ws_b, "content": "Workspace B confidential salaries"},
    )

    await store.upsert([rec_a, rec_b])

    # 1. Zero-trust enforcement: search without filter MUST raise ValueError
    with pytest.raises(ValueError, match="Zero-Trust violation"):
        await store.search(query_vector=[1.0, 0.0, 0.0, 0.0], limit=10, filters=None)

    # 2. Workspace A query must only return rec_a
    results_a = await store.search(
        query_vector=[1.0, 0.0, 0.0, 0.0],
        limit=10,
        filters={"workspace_id": ws_a},
    )
    assert len(results_a) == 1
    assert results_a[0].id == rec_a.id
    assert results_a[0].metadata["workspace_id"] == ws_a

    # 3. Workspace B query must only return rec_b
    results_b = await store.search(
        query_vector=[1.0, 0.0, 0.0, 0.0],
        limit=10,
        filters={"workspace_id": ws_b},
    )
    assert len(results_b) == 1
    assert results_b[0].id == rec_b.id
    assert results_b[0].metadata["workspace_id"] == ws_b


def test_ranker_orders_by_cognitive_priority_then_score():
    """Live ranking path (ContextEngine) orders by cognitive priority, then score."""
    items = [
        ContextItem(
            kind="memory",
            content="Enterprise agent adoptions grew 34% YoY across North American regions.",
            relevance=0.95,
        ),
        ContextItem(
            kind="evidence",
            content="Operating expenses decreased by 12% following cloud infrastructure optimization.",
            relevance=0.88,
        ),
        ContextItem(kind="memory", content="Low relevance archive note.", relevance=0.10),
    ]

    ranked = rank_items(items, limit=5)

    # "evidence" maps to P1_ACTIVE_GROUNDING, which must outrank P3_DYNAMIC_MEMORY
    # despite the memory's higher raw relevance -- the point of cognitive priority.
    assert ranked[0].content.startswith("Operating expenses")
    assert ranked[0].priority == "P1_ACTIVE_GROUNDING"
    assert ranked[1].priority == "P3_DYNAMIC_MEMORY"
    # Within the same priority tier, higher score ranks first.
    assert ranked[1].score > ranked[2].score


def test_context_budget_compression_never_exceeds_budget():
    """Live budget path (ContextEngine.compress_to_budget) must respect the token cap."""
    items = [
        ContextItem(kind="memory", content="A" * 800, relevance=1.0 - (i * 0.05))
        for i in range(10)
    ]
    total_tokens = sum(i.token_estimate for i in items)
    assert total_tokens > 1000, "fixture must actually exceed the budget"

    kept, compressed = compress_to_budget(items, token_budget=1000)

    assert sum(i.token_estimate for i in kept) <= 1000
    assert len(kept) < len(items), "over-budget items must be dropped"
    assert compressed, "compression must report what it dropped"


def test_context_budget_preserves_grounding_over_dynamic_memory():
    """A single oversized grounding item must survive compression."""
    items = [
        ContextItem(kind="evidence", content="D" * 8000, relevance=0.9),
        ContextItem(kind="memory", content="m" * 8000, relevance=0.8),
    ]

    kept, _compressed = compress_to_budget(items, token_budget=600)

    kinds = [i.kind for i in kept]
    assert "evidence" in kinds, "Active Grounding must be preserved before Dynamic Memory"
    if "memory" in kinds:
        assert kinds.index("evidence") < kinds.index("memory")
    # A hard-truncated item may carry a small marker suffix, so allow that overhead.
    assert sum(i.token_estimate for i in kept) <= 600 + 4


@pytest.mark.asyncio
async def test_end_to_end_rag_grounding_into_document_agent(monkeypatch):
    """Verify end-to-end flow: Ingested chunks -> Vector Store -> Retrieved Context -> LLM Synthesis -> Grounded Citations."""
    monkeypatch.setattr(settings, "llm_api_key", "sk-test-key")

    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    doc_title = "SOC2_Compliance_Audit_2026.pdf"

    # Step 1: Simulate Ingestion Chunking
    raw_text = (
        "SOC2 Principle CC6.1 mandates all remote employee workstations must have whole-disk encryption enabled. "
        "CC6.6 requires continuous network egress monitoring and daily audit log aggregation to cold storage. "
        "Section 8.4 confirms zero non-conformities were found during the audit period."
    )
    chunks = chunk_text(
        text=raw_text,
        chunk_size=120,
        chunk_overlap=20,
        source_document_id=doc_id,
        metadata={"filename": doc_title},
    )
    assert len(chunks) >= 2

    # Step 2: Simulate Vector Store Embedding & Search
    store = FallbackVectorStore()
    vector_records = []
    for idx, c in enumerate(chunks):
        # assign mock query-relevant vector to first chunk
        vec = [0.95, 0.1, 0.0] if idx == 0 else [0.1, 0.8, 0.2]
        vector_records.append(
            VectorRecord(
                id=f"chunk-{idx}",
                vector=vec,
                metadata={
                    "workspace_id": ws_id,
                    "document_id": doc_id,
                    "filename": doc_title,
                    "content": c.content,
                    "chunk_index": c.index,
                },
            )
        )
    await store.upsert(vector_records)

    # Search vector store for CC6.1 query vector [1.0, 0.0, 0.0]
    matched_records = await store.search(
        query_vector=[1.0, 0.0, 0.0],
        limit=2,
        filters={"workspace_id": ws_id},
    )
    assert len(matched_records) >= 1
    best_match = matched_records[0]
    assert "whole-disk encryption" in best_match.metadata["content"]

    # Step 3: Package retrieved chunks for DocumentAgent
    retrieved_docs_for_agent = [
        {
            "id": best_match.metadata["document_id"],
            "title": best_match.metadata["filename"],
            "page_or_section": f"Chunk #{best_match.metadata['chunk_index']}",
            "excerpt": best_match.metadata["content"],
        }
    ]

    # Step 4: DocumentAgent Grounded Synthesis
    agent = DocumentAgent()
    mock_llm_response = {
        "content": "Per SOC2 CC6.1, whole-disk encryption is mandatory for all employee workstations.",
        "role": "assistant",
        "usage": {"input_tokens": 85, "output_tokens": 20},
    }

    with patch("api.services.llm_service.llm_service.generate_completion", new_callable=AsyncMock) as mock_comp:
        mock_comp.return_value = mock_llm_response
        synth_result = await agent.synthesize_documents(
            query="What is the encryption policy under SOC2 CC6.1?",
            documents=retrieved_docs_for_agent,
        )

        assert mock_comp.called
        assert "whole-disk encryption is mandatory" in synth_result["synthesis"]
        assert len(synth_result["citations"]) == 1

        cit = synth_result["citations"][0]
        assert cit["document_id"] == doc_id
        assert cit["document_title"] == doc_title
        assert "whole-disk encryption" in cit["excerpt"]
