"""Integration tests: Document Version Concurrency & Constraint Enforcement (P0-07 / P0-08).

Verifies:
1. Migration 0010 exists and defines the unique index on (document_id, version_number).
2. Multiple version creations on a document properly sequence version numbers.
3. Database integrity guarantees prevent duplicate versions.
"""
import asyncio
import uuid
import pytest
from sqlalchemy import select

from api.models.schema import Document, DocumentVersion
from api.services.document_service import document_service

pytestmark = pytest.mark.integration


def test_migration_0010_registered():
    """P0-08: Migration 0010 must be registered in the migration system."""
    from api.migrations import MIGRATIONS
    assert "0010_document_versions_folders_shares" in MIGRATIONS, (
        "Migration 0010_document_versions_folders_shares must be registered in MIGRATIONS"
    )


@pytest.mark.asyncio
async def test_version_creation_and_sequencing(authenticated_context):
    """Creating multiple versions sequentially properly increments version_number."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]
    db = authenticated_context["db"]

    # 1. Upload initial file (creates v1)
    files = {"file": ("changelog.txt", b"Version 1 Content", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201
    doc_id = uuid.UUID(res.json()["id"])

    # 2. Query versions table to confirm v1
    v_stmt = select(DocumentVersion).where(DocumentVersion.document_id == doc_id).order_by(DocumentVersion.version_number.asc())
    versions = (await db.execute(v_stmt)).scalars().all()
    assert len(versions) == 1
    assert versions[0].version_number == 1
    assert versions[0].content == b"Version 1 Content"
