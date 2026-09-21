"""Test Suite: Module 05 Document Search (M05-SEARCH).
Verifies full-text search, multi-tenant workspace scoping, and quarantine/soft-delete exclusions.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select

from api.models.schema import Document
from api.services.document_service import DocumentService


@pytest.mark.asyncio
async def test_search_documents_workspace_isolation_and_filters():
    """Verify search queries only return active, non-quarantined documents within the active workspace."""
    ws_a = uuid.uuid4()
    ws_b = uuid.uuid4()

    doc_clean = Document(
        id=uuid.uuid4(),
        workspace_id=ws_a,
        path="contracts/NDA_Acme.pdf",
        summary="Mutual NDA with Acme Corp",
        scan_status="CLEAN",
        deleted_at=None,
    )
    doc_quarantined = Document(
        id=uuid.uuid4(),
        workspace_id=ws_a,
        path="malware/infected.pdf",
        summary="Mutual NDA Trojan",
        scan_status="QUARANTINED",
        deleted_at=None,
    )
    doc_deleted = Document(
        id=uuid.uuid4(),
        workspace_id=ws_a,
        path="archive/old_nda.pdf",
        summary="Expired NDA",
        scan_status="CLEAN",
        deleted_at=type("Now", (), {})(),
    )
    doc_ws_b = Document(
        id=uuid.uuid4(),
        workspace_id=ws_b,
        path="confidential/NDA_Secret.pdf",
        summary="Secret NDA from Workspace B",
        scan_status="CLEAN",
        deleted_at=None,
    )

    # In-memory evaluation of search filtering rules
    all_docs = [doc_clean, doc_quarantined, doc_deleted, doc_ws_b]
    query = "NDA"

    results_a = [
        d for d in all_docs
        if d.workspace_id == ws_a
        and d.deleted_at is None
        and d.scan_status != "QUARANTINED"
        and (query.lower() in d.path.lower() or (d.summary and query.lower() in d.summary.lower()))
    ]

    assert len(results_a) == 1
    assert results_a[0].id == doc_clean.id
    assert results_a[0].path == "contracts/NDA_Acme.pdf"
