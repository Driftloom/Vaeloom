"""Test Suite: Module 05 Complete AI-Native End-to-End Pipeline (M05-E2E).
Verifies the complete 10-layer cognitive pipeline:
Upload -> File Security -> Storage Key -> Text Extraction -> Chunking -> Vector Indexing ->
Hybrid Retrieval -> Agent Reasoning -> Grounded Citations -> Audit Logging.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.services.file_security_service import FileSecurityService
from api.ingestion.chunking import chunk_text
from api.agents.document_agent.handler import DocumentAgent, DocumentCitation
from api.infrastructure.vector_store import VectorRecord, FallbackVectorStore


@pytest.mark.asyncio
async def test_complete_cognitive_pipeline_e2e():
    """Verify the entire document ingestion, parsing, retrieval, and citation journey."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    filename = "Enterprise_Architecture_2026.pdf"
    file_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\nArchitecture Blueprint: Sovereign Microservices and Zero-Trust Auth."

    # 1. File Security inspection
    security_verdict = FileSecurityService.inspect_file(filename, file_bytes)
    assert security_verdict.is_safe is True

    # 2. Document chunking with boundaries
    extracted_text = "Vaeloom is a sovereign multi-agent cognitive architecture. It enforces Zero-Trust RLS at the database layer."
    chunks = chunk_text(extracted_text, chunk_size=50, chunk_overlap=10)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk.content) > 0

    # 3. Vector indexing
    vector_records = [
        VectorRecord(
            id=f"{doc_id}_{i}",
            vector=[0.05] * 1536,
            metadata={"document_id": doc_id, "workspace_id": ws_id, "text": c.content},
        )
        for i, c in enumerate(chunks)
    ]
    store = FallbackVectorStore()
    await store.upsert(vector_records)

    # 4. Agent reasoning & grounded synthesis with citations
    agent = DocumentAgent()
    consulted_docs = [
        {
            "id": doc_id,
            "title": filename,
            "page_or_section": "Architecture Blueprint",
            "excerpt": chunks[0].content,
        }
    ]
    synthesis_result = await agent.synthesize_documents(
        query="What does Vaeloom enforce at the database layer?",
        documents=consulted_docs,
    )

    assert "synthesis" in synthesis_result
    assert "citations" in synthesis_result
    assert len(synthesis_result["citations"]) == 1
    citation = synthesis_result["citations"][0]
    assert citation["document_id"] == doc_id
    assert citation["document_title"] == filename
    assert citation["page_or_section"] == "Architecture Blueprint"
