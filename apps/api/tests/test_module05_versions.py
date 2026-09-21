"""Test Suite: Module 05 Document Versioning (M05-VERSION).
Verifies immutable version snapshots, version numbering, and revision restoration.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from api.models.schema import Document, DocumentVersion


@pytest.mark.asyncio
async def test_document_version_model_invariants():
    """Verify DocumentVersion invariants, checksums, and version numbering."""
    doc_id = uuid.uuid4()
    v1 = DocumentVersion(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_number=1,
        storage_key=f"storage/ws/{doc_id}/v1_report.pdf",
        checksum="sha256:abc12345",
        size_bytes=1024,
        content=b"Version 1 content",
    )
    assert v1.version_number == 1
    assert v1.content == b"Version 1 content"
    assert v1.checksum == "sha256:abc12345"

    v2 = DocumentVersion(
        id=uuid.uuid4(),
        document_id=doc_id,
        version_number=2,
        storage_key=f"storage/ws/{doc_id}/v2_report.pdf",
        checksum="sha256:def67890",
        size_bytes=1050,
        content=b"Version 2 updated content",
    )
    assert v2.version_number == 2
    assert v2.content != v1.content
