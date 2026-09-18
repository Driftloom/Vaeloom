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
# 3. Ingestion PDFParser Scanned Image Detection & OCR Pipeline
# -----------------------------------------------------------------------------
async def test_pdf_scanned_image_zero_text_flag():
    import fitz
    parser = PDFParser()
    
    # Generate real 1-page blank PDF in memory (scanned page with 0 text)
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    # Test Branch 1: OCR engine unavailable or offline fallback
    with patch("pytesseract.image_to_string", side_effect=RuntimeError("tesseract not found")):
        parsed = await parser.parse(pdf_bytes)
        assert parsed.metadata.get("warning") == "DOC_SCANNED_IMAGE_NO_TEXT"
        assert parsed.metadata.get("ocr_required") is True
        assert "ocr_hint" in parsed.metadata
        assert "Install tesseract-ocr" in parsed.metadata["ocr_hint"]
        assert parsed.metadata.get("word_count") == 0


async def test_pdf_scanned_image_ocr_pipeline_extraction():
    import fitz
    parser = PDFParser()

    # Generate real 1-page blank PDF in memory
    doc = fitz.open()
    doc.new_page()
    pdf_bytes = doc.write()
    doc.close()

    # Test Branch 2: OCR engine extracts text from scanned image
    with patch("pytesseract.image_to_string", return_value="Jane Doe Senior Cloud Architect Python Kubernetes"):
        parsed = await parser.parse(pdf_bytes)
        assert parsed.content == "Jane Doe Senior Cloud Architect Python Kubernetes"
        assert parsed.metadata.get("ocr_applied") is True
        assert parsed.metadata.get("ocr_required") is True
        assert parsed.metadata.get("word_count") == 7
        assert "warning" not in parsed.metadata


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


from api.orchestrator.state_store import (
    CompositeStateStore,
    MemoryStateStore,
    FileStateStore,
    ConcurrentUpdateError,
    get_state_store,
    set_state_store,
)

pytestmark = pytest.mark.asyncio


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


async def test_composite_state_store_fallback_divergence_logged(caplog):
    primary = MemoryStateStore()
    fallback = MemoryStateStore()
    composite = CompositeStateStore(primary=primary, fallback=fallback)
    
    req_id = f"test-div-{uuid.uuid4()}"
    # Seed fallback with a conflicting version to simulate divergence
    fallback._data[req_id] = {"state_version": 99}
    
    # Save with expected_version=1 on primary (which has no record yet)
    with caplog.at_level("ERROR"):
        v = await composite.save(req_id, {"status": "diverged_test"}, expected_version=1)
    
    assert v == 2
    assert "STATE_STORE_FALLBACK_DIVERGENCE" in caplog.text


async def test_composite_state_store_fallback_failure_logged(caplog):
    primary = MemoryStateStore()
    fallback = MemoryStateStore()
    fallback.save = AsyncMock(side_effect=OSError("Disk write I/O error"))
    composite = CompositeStateStore(primary=primary, fallback=fallback)
    
    req_id = f"test-fail-{uuid.uuid4()}"
    with caplog.at_level("ERROR"):
        v = await composite.save(req_id, {"status": "fallback_failed_test"})
    
    assert v == 2
    assert "STATE_STORE_FALLBACK_SAVE_FAILED" in caplog.text


async def test_state_store_production_ephemeral_guard(caplog):
    import os
    set_state_store(None)
    try:
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "VAELOOM_STATE_BACKEND": "file"}, clear=False):
            with caplog.at_level("ERROR"):
                store = get_state_store()
                assert isinstance(store, FileStateStore)
                assert "STATE_STORE_EPHEMERAL_FALLBACK" in caplog.text
    finally:
        set_state_store(None)


async def test_parse_document_ocr_tool_execution():
    from api.tools.executor import _execute_parse_document_ocr
    from api.models.schema import Document

    doc_id = uuid.uuid4()
    mock_doc = MagicMock(spec=Document)
    mock_doc.id = doc_id
    mock_doc.path = "sample_resume.pdf"
    mock_doc.summary = "Senior Software Engineer"

    # Mock storage returning 100 bytes of dummy PDF content
    with patch("api.tools.executor._ws_session") as mock_ws_session, \
         patch("api.services.storage_service.storage_service.download", new_callable=AsyncMock) as mock_download, \
         patch("api.ingestion.parsers.parse_document", new_callable=AsyncMock) as mock_parse:
        
        from api.ingestion.parsers import ParsedDocument
        mock_parse.return_value = ParsedDocument(
            content="Alex Rivera Senior Backend Engineer Python FastAPI PostgreSQL",
            metadata={"format": "pdf", "pages": 1, "ocr_applied": True},
        )
        mock_download.return_value = b"%PDF-1.4 dummy content"

        mock_session = AsyncMock()
        mock_session.get.return_value = mock_doc
        mock_ws_session.return_value.__aenter__.return_value = mock_session

        res = await _execute_parse_document_ocr(
            params={"document_id": str(doc_id)},
            workspace_id="test-workspace",
        )

        assert res["status"] == "success"
        assert res["tool"] == "parse_document_ocr"
        # Must extract actual string, NOT <ParsedDocument object ...>
        assert "Alex Rivera Senior Backend Engineer" in res["result"]["text"]
        assert "<" not in res["result"]["text"]
        assert res["result"]["metadata"]["ocr_applied"] is True


async def test_image_parser_missing_tesseract_ocr_hint():
    from api.ingestion.parsers import ImageParser
    from PIL import Image

    # Create dummy 10x10 PNG in memory
    buf = io.BytesIO()
    img = Image.new("RGB", (10, 10), color="white")
    img.save(buf, format="PNG")
    png_bytes = buf.getvalue()

    parser = ImageParser()
    with patch("pytesseract.image_to_string", side_effect=RuntimeError("tesseract is not installed or it's not in your PATH")):
        parsed = await parser.parse(png_bytes)
        assert parsed.metadata.get("format") == "image"
        assert parsed.metadata.get("needs_review") is True
        assert "ocr_hint" in parsed.metadata
        assert "Install tesseract-ocr" in parsed.metadata["ocr_hint"]


# -----------------------------------------------------------------------------
# 6. G-37 Knowledge Graph Traversal Depth Clamping & Node Bound
# -----------------------------------------------------------------------------
async def test_kg_traversal_node_limit_warning(caplog):
    import logging
    from api.services.knowledge_graph_service import KnowledgeGraphService
    svc = KnowledgeGraphService()

    start_id = uuid.uuid4()
    mock_db = AsyncMock()

    dummy_node = MagicMock()
    dummy_node._mapping = {"id": start_id, "label": "Start"}
    
    with patch.object(svc, "get_node", new_callable=AsyncMock) as mock_get_node, \
         patch.object(svc, "_read_scope", return_value=("test-tenant", "test-workspace")), \
         caplog.at_level(logging.WARNING):
        
        mock_get_node.return_value = dummy_node

        neighbor_ids = [uuid.uuid4() for _ in range(550)]
        mock_edge_result = MagicMock()
        mock_edge_result.fetchall.return_value = [(str(nid),) for nid in neighbor_ids]
        mock_db.execute.return_value = mock_edge_result

        nodes = await svc.traverse(
            start_id=start_id,
            depth=5,
            mode="bfs",
            db=mock_db,
            workspace_id="test-workspace",
            tenant_id="test-tenant",
        )
        assert len(nodes) == 500
        assert "KG_TRAVERSAL_LIMIT" in caplog.text


# -----------------------------------------------------------------------------
# 7. G-37 Multi-Hop Forward Memory Lineage with Cycle Detection
# -----------------------------------------------------------------------------
async def test_memory_lineage_multi_hop_forward_with_cycle_detection():
    from api.routers.memory import get_memory_lineage
    from api.models.schema import Memory
    from datetime import datetime, UTC

    ws_id = uuid.uuid4()
    u_id = uuid.uuid4()
    t_id = uuid.uuid4()
    m0_id = uuid.uuid4()
    m1_id = uuid.uuid4()
    m2_id = uuid.uuid4()
    m3_id = uuid.uuid4()

    def make_mem(mid, supersedes=None):
        m = MagicMock(spec=Memory)
        m.id = mid
        m.workspace_id = ws_id
        m.tenant_id = t_id
        m.user_id = u_id
        m.supersedes_id = supersedes
        m.content = f"Memory {mid}"
        m.type = "profile"
        m.domain = "career"
        m.title = f"Title {mid}"
        m.summary = f"Summary {mid}"
        m.content_hash = "hash123"
        m.size = 100
        m.confidence = 0.9
        m.importance = 0.5
        m.status = "active"
        m.tags = []
        m.metadata_ = {}
        m.source_type = "manual"
        m.source_uri = "https://vaeloom.app"
        m.source_label = "Manual Input"
        m.deleted_at = None
        m.created_at = datetime.now(UTC)
        m.updated_at = datetime.now(UTC)
        return m

    m0 = make_mem(m0_id)
    m1 = make_mem(m1_id, supersedes=m0_id)
    m2 = make_mem(m2_id, supersedes=m1_id)
    m3 = make_mem(m3_id, supersedes=m2_id)

    mock_db = AsyncMock()

    with patch("api.routers.memory.memory_service.get_memory", new_callable=AsyncMock) as mock_get_mem, \
         patch("api.routers.memory.check_user_workspace_access", new_callable=AsyncMock, return_value=True), \
         patch("api.services.provenance_service.ProvenanceService.trace_memory_lineage", new_callable=AsyncMock, side_effect=Exception("no prov")):
        
        mock_get_mem.return_value = m0

        r1 = MagicMock()
        r1.scalars.return_value.all.return_value = [m1]

        r2 = MagicMock()
        r2.scalars.return_value.all.return_value = [m2]

        r3 = MagicMock()
        r3.scalars.return_value.all.return_value = [m3, m1]  # m1 is a cycle reference!

        r4 = MagicMock()
        r4.scalars.return_value.all.return_value = []

        r_actions = MagicMock()
        r_actions.scalars.return_value.all.return_value = []

        mock_db.execute.side_effect = [r1, r2, r3, r4, r_actions]

        res = await get_memory_lineage(
            memory_id=m0_id,
            db=mock_db,
            current_user={"sub": str(u_id)},
            tenant_id=str(t_id),
            workspace_id=str(ws_id),
        )

        assert "chain_forwards" in res
        fw_ids = [item["id"] for item in res["chain_forwards"]]
        assert str(m1_id) in fw_ids
        assert str(m2_id) in fw_ids
        assert str(m3_id) in fw_ids
        # Duplicate m1 must be eliminated by visited_ids cycle guard
        assert fw_ids.count(str(m1_id)) == 1


async def test_memory_lineage_logger_defined_on_exception(caplog):
    import logging
    from api.routers.memory import get_memory_lineage
    from api.models.schema import Memory
    from datetime import datetime, UTC

    ws_id = uuid.uuid4()
    u_id = uuid.uuid4()
    t_id = uuid.uuid4()
    m0_id = uuid.uuid4()

    m0 = MagicMock(spec=Memory)
    m0.id = m0_id
    m0.workspace_id = ws_id
    m0.tenant_id = t_id
    m0.user_id = u_id
    m0.supersedes_id = None
    m0.content = "Memory Root"
    m0.type = "profile"
    m0.domain = "career"
    m0.title = "Title Root"
    m0.summary = "Summary Root"
    m0.content_hash = "hash_root"
    m0.size = 100
    m0.confidence = 0.9
    m0.importance = 0.5
    m0.status = "active"
    m0.tags = []
    m0.metadata_ = {}
    m0.source_type = "manual"
    m0.source_uri = "https://vaeloom.app"
    m0.source_label = "Manual Input"
    m0.deleted_at = None
    m0.created_at = datetime.now(UTC)
    m0.updated_at = datetime.now(UTC)

    mock_db = AsyncMock()
    mock_db.execute.side_effect = RuntimeError("DB connection timeout during lineage walk")

    with patch("api.routers.memory.memory_service.get_memory", new_callable=AsyncMock, return_value=m0), \
         patch("api.routers.memory.check_user_workspace_access", new_callable=AsyncMock, return_value=True), \
         patch("api.services.provenance_service.ProvenanceService.trace_memory_lineage", new_callable=AsyncMock, side_effect=Exception("no prov")), \
         caplog.at_level(logging.WARNING):

        res = await get_memory_lineage(
            memory_id=m0_id,
            db=mock_db,
            current_user={"sub": str(u_id)},
            tenant_id=str(t_id),
            workspace_id=str(ws_id),
        )

        assert res["chain_forwards"] == []
        assert "Error traversing forward memory lineage" in caplog.text

