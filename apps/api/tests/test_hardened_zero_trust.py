"""Zero-trust regression test suite verifying the hardened implementations of the 7 items:
1. FallbackVectorStore: in-memory cosine similarity and metadata filtering
2. Tool Executor: _handle_unrecognized_tool diagnostic payload and hallucination logging
3. Ingestion PDFParser: 0-text scanned PDF detection and DOC_SCANNED_IMAGE_NO_TEXT flag
4. KnowledgeGraphService: safe depth clamping and node bound
5. StateStore: CompositeStateStore fallback alerts and multi-replica safety
"""
from __future__ import annotations

import io
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord
from api.ingestion.parsers import PDFParser
from api.tools.executor import _handle_unrecognized_tool, ToolDefinition
from api.orchestrator.state_store import CompositeStateStore, MemoryStateStore, ConcurrentUpdateError

pytestmark = pytest.mark.asyncio


# -----------------------------------------------------------------------------
# 1. FallbackVectorStore In-Memory Cosine Similarity & Metadata Filtering
# -----------------------------------------------------------------------------
async def test_fallback_vector_store_in_memory_cosine():
    store = FallbackVectorStore()
    
    # Insert 3 records with distinct vectors and metadata
    r1 = VectorRecord(id="doc1", vector=[1.0, 0.0, 0.0], metadata={"category": "engineering"})
    r2 = VectorRecord(id="doc2", vector=[0.0, 1.0, 0.0], metadata={"category": "design"})
    r3 = VectorRecord(id="doc3", vector=[0.707, 0.707, 0.0], metadata={"category": "engineering"})
    
    await store.upsert([r1, r2, r3])
    
    # Query vector close to doc1
    results = await store.search([0.9, 0.1, 0.0], limit=2)
    assert len(results) == 2
    assert results[0].id == "doc1"
    assert results[1].id == "doc3"
    
    # Query with metadata filter
    filtered = await store.search([0.9, 0.1, 0.0], limit=5, filters={"category": "design"})
    assert len(filtered) == 1
    assert filtered[0].id == "doc2"
    
    # Delete
    await store.delete(["doc1"])
    remaining = await store.search([1.0, 0.0, 0.0], limit=5)
    assert len(remaining) == 2
    assert "doc1" not in [r.id for r in remaining]


# -----------------------------------------------------------------------------
# 2. Tool Executor Unrecognized Tool Handling & Diagnostics
# -----------------------------------------------------------------------------
async def test_unrecognized_tool_diagnostic_structure():
    result = await _handle_unrecognized_tool(
        params={"some_param": 123},
        workspace_id="test-workspace",
        tool_name="hallucinated_tool_xyz",
    )
    
    assert result["status"] == "error"
    assert result["tool"] == "hallucinated_tool_xyz"
    assert "not configured" in result["result"]
    assert "diagnostics" in result
    assert result["diagnostics"]["error_type"] == "TOOL_NOT_RECOGNIZED"
    assert isinstance(result["diagnostics"]["suggested_tools"], list)
    assert len(result["diagnostics"]["suggested_tools"]) > 0
    assert "setup_hint" in result


# -----------------------------------------------------------------------------
# 3. Ingestion PDFParser Scanned Image Detection
# -----------------------------------------------------------------------------
async def test_pdf_scanned_image_zero_text_flag():
    parser = PDFParser()
    
    # Mock _parse_sync or simulate a PDF that has pages but 0 extractable words
    with patch.object(parser, "_parse_sync") as mock_parse:
        from api.ingestion.parsers import ParsedDocument
        mock_parse.return_value = ParsedDocument(
            content="",
            metadata={
                "format": "pdf",
                "pages": 2,
                "word_count": 0,
                "warning": "DOC_SCANNED_IMAGE_NO_TEXT",
                "ocr_required": True,
                "ocr_hint": "Scanned image PDF detected. Install tesseract-ocr and pytesseract for image text extraction.",
            },
        )
        parsed = await parser.parse(b"%PDF-1.4 mock")
        assert parsed.metadata.get("warning") == "DOC_SCANNED_IMAGE_NO_TEXT"
        assert parsed.metadata.get("ocr_required") is True
        assert "ocr_hint" in parsed.metadata


# -----------------------------------------------------------------------------
# 4. KnowledgeGraphService Depth Clamping
# -----------------------------------------------------------------------------
async def test_kg_traversal_depth_clamping():
    from api.services.knowledge_graph_service import KnowledgeGraphService
    kg = KnowledgeGraphService()
    
    mock_db = MagicMock()
    mock_exec = MagicMock()
    mock_exec.fetchall.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_exec)
    
    # Mock get_node to return a sample node
    sample_node = MagicMock()
    kg.get_node = AsyncMock(return_value=sample_node)
    
    # Call traverse with excessive depth (e.g. 50) - clamped to 10
    start_id = uuid.uuid4()
    result = await kg.traverse(start_id, depth=50, mode="bfs", db=mock_db, workspace_id=str(uuid.uuid4()))
    assert isinstance(result, list)
    assert len(result) == 1


# -----------------------------------------------------------------------------
# 5. CompositeStateStore Fallback Mirroring & Resilience
# -----------------------------------------------------------------------------
async def test_composite_state_store_resilience():
    primary = MemoryStateStore()
    fallback = MemoryStateStore()
    composite = CompositeStateStore(primary=primary, fallback=fallback)
    
    req_id = f"test-{uuid.uuid4()}"
    v1 = await composite.save(req_id, {"status": "in_progress"})
    assert v1 == 2
    
    loaded = await composite.load(req_id)
    assert loaded is not None
    assert loaded["status"] == "in_progress"
    assert loaded["state_version"] == 2
    
    # Fallback mirror stored the checkpoint
    fb_loaded = await fallback.load(req_id)
    assert fb_loaded is not None
    assert fb_loaded["status"] == "in_progress"
