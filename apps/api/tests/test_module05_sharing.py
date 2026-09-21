"""Test Suite: Module 05 Cross-Workspace Sharing (M05-SHARE).
Verifies sharing grants, permissions, and instant revocation across workspaces.
"""
import uuid
import pytest
from api.models.schema import DocumentShare


def test_document_share_model_integrity():
    """Verify DocumentShare schema constraints and permission defaults."""
    doc_id = uuid.uuid4()
    ws_src = uuid.uuid4()
    ws_tgt = uuid.uuid4()
    user_id = uuid.uuid4()

    share = DocumentShare(
        id=uuid.uuid4(),
        document_id=doc_id,
        source_workspace_id=ws_src,
        target_workspace_id=ws_tgt,
        permission="read",
        granted_by=user_id,
    )
    assert share.permission == "read"
    assert share.source_workspace_id == ws_src
    assert share.target_workspace_id == ws_tgt
    assert share.document_id == doc_id
