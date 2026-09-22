"""Test Suite: Module 05 Document Search (M05-SEARCH).
Verifies full-text search, multi-tenant workspace scoping, and soft-delete exclusions via search_service.
"""
import uuid
from datetime import datetime, timezone
import pytest

from api.models.schema import Document
from api.services.search_service import search_service
from tests.integration.module05.conftest import authenticated_context, make_jwt


@pytest.mark.asyncio
async def test_search_documents_workspace_isolation_and_filters(authenticated_context):
    """Verify search queries only return active documents within the active workspace."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_a = uuid.UUID(authenticated_context["workspace_id"])
    ws_b = uuid.uuid4()
    db = authenticated_context["db"]

    doc_clean = Document(
        id=uuid.uuid4(),
        workspace_id=ws_a,
        path="contracts/NDA_Acme.pdf",
        type="pdf",
        summary="Mutual NDA with Acme Corp",
        status="ACTIVE",
        deleted_at=None,
    )
    doc_deleted = Document(
        id=uuid.uuid4(),
        workspace_id=ws_a,
        path="archive/old_nda.pdf",
        type="pdf",
        summary="Expired NDA",
        status="ARCHIVED",
        deleted_at=datetime.now(timezone.utc),
    )
    doc_ws_b = Document(
        id=uuid.uuid4(),
        workspace_id=ws_b,
        path="confidential/NDA_Secret.pdf",
        type="pdf",
        summary="Secret NDA from Workspace B",
        status="ACTIVE",
        deleted_at=None,
    )

    db.add_all([doc_clean, doc_deleted, doc_ws_b])
    await db.commit()

    # 1. Search via search_service directly with workspace isolation
    res = await search_service.search_all(
        query="Acme",
        sources=["document"],
        workspace_id=str(ws_a),
        db=db,
    )
    assert res["total"] == 1
    assert res["results"][0]["id"] == str(doc_clean.id)
    assert res["results"][0]["text"] == "NDA_Acme.pdf"
    assert res["results"][0]["source"] == "document"

    # 2. Search for term present in Workspace B only — must yield 0 results for Workspace A
    res_b = await search_service.search_all(
        query="Secret",
        sources=["document"],
        workspace_id=str(ws_a),
        db=db,
    )
    assert res_b["total"] == 0

    # 3. Soft-deleted documents must not be returned
    res_del = await search_service.search_all(
        query="Expired",
        sources=["document"],
        workspace_id=str(ws_a),
        db=db,
    )
    assert res_del["total"] == 0
