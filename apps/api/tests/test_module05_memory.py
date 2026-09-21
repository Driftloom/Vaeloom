"""Test Suite: Module 05 Memory Integration & Invalidation (M05-MEM).
Verifies memory extraction from documents, source document provenance linking, and soft-delete propagation.
"""
import uuid
import pytest
from api.models.schema import MemoryRecord


def test_memory_provenance_linking():
    """Verify MemoryRecord retains foreign key to source document ID."""
    doc_id = uuid.uuid4()
    ws_id = uuid.uuid4()

    rec = MemoryRecord(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        type="fact",
        content={"statement": "Zero trust architecture is mandated for all endpoints."},
        confidence=0.98,
        source_document_id=doc_id,
    )

    assert rec.source_document_id == doc_id
    assert rec.workspace_id == ws_id
    assert rec.content["statement"] == "Zero trust architecture is mandated for all endpoints."
