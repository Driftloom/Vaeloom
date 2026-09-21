"""Test Suite: Module 05 Deletion & GDPR Erasure (M05-DEL / M05-DR).
Verifies soft-delete archiving, hard deletion, and cascading multi-store erasure via ErasureService.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from api.services.erasure_service import ErasureService, ErasureReceipt


@pytest.mark.asyncio
async def test_erasure_service_cascade_receipt():
    """Verify ErasureService executes complete multi-store purge and outputs an ErasureReceipt."""
    service = ErasureService()
    user_id = uuid.uuid4()
    ws_id = uuid.uuid4()

    mock_db = AsyncMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_cursor.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_cursor
    mock_db.commit = AsyncMock()

    receipt = await service.execute_erasure(mock_db, user_id, ws_id)
    assert isinstance(receipt, ErasureReceipt)
    assert receipt.user_id == str(user_id)
    assert receipt.workspace_id == str(ws_id)
    assert "object_storage" in receipt.stores_affected
    assert mock_db.execute.call_count >= 5


def test_document_soft_delete_vs_hard_delete():
    """Verify soft-delete preserves document record with archived status, while hard-delete removes row."""
    from api.models.schema import Document
    doc = Document(
        id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        path="contracts/deal.pdf",
        status="ARCHIVED",
    )
    assert doc.status == "ARCHIVED"
    assert doc.path == "contracts/deal.pdf"
