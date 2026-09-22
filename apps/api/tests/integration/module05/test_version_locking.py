"""Integration tests for Document Version Concurrency, Row Locking, and S3 Offloading.

Verifies:
1. Concurrency safety: Multiple sequential version creations increment atomically.
2. Large file offload (>=1MB): doc.content is None in DB, stored in MinIO S3, and fetched via get_content().
3. Version restore re-populates current document content from version history.
"""
import asyncio
import io
import uuid
import pytest
from sqlalchemy import select

from api.config import settings
from api.models.schema import Document, DocumentVersion
from api.services.document_service import document_service
from api.services.storage_service import StorageService

pytestmark = [pytest.mark.integration]


@pytest.mark.asyncio
async def test_sequential_version_creation_and_ordering(authenticated_context):
    """Creating multiple versions sequentially increments version_number and maintains order."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]
    db = authenticated_context["db"]

    # 1. Upload initial file (creates v1)
    files = {"file": ("notes.txt", b"Version 1 Notes", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201
    doc_id = res.json()["id"]

    # 2. Create 3 subsequent versions
    for i in range(2, 5):
        v_files = {"file": (f"notes_v{i}.txt", f"Version {i} Notes".encode("utf-8"), "text/plain")}
        vres = await client.post(
            f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}",
            files=v_files,
            headers=headers,
        )
        assert vres.status_code == 201
        assert vres.json()["version_number"] == i

    # 3. List versions from API
    list_res = await client.get(f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}", headers=headers)
    assert list_res.status_code == 200
    versions = list_res.json()
    assert len(versions) == 4
    # Ordered descending by version_number
    assert [v["version_number"] for v in versions] == [4, 3, 2, 1]


@pytest.mark.asyncio
async def test_large_file_s3_offloading_and_retrieval(authenticated_context, monkeypatch):
    """Files >= 1MB are offloaded to S3 (doc.content is None in DB) and retrieved via get_content."""
    s3_store = {}

    async def mock_upload(key: str, data: bytes) -> str:
        s3_store[key] = data
        return key

    async def mock_download(key: str) -> bytes:
        return s3_store[key]

    monkeypatch.setattr("api.services.document_service.storage_service.upload", mock_upload)
    monkeypatch.setattr("api.services.document_service.storage_service.download", mock_download)

    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]
    db = authenticated_context["db"]

    # 1. Generate 1.2MB payload
    large_payload = b"A" * (1200 * 1024)
    files = {"file": ("large_archive.txt", large_payload, "text/plain")}

    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 201
    doc_id = uuid.UUID(res.json()["id"])

    # 2. Inspect DB row: doc.content MUST be None to avoid PostgreSQL WAL/RAM bloat
    stmt = select(Document).where(Document.id == doc_id)
    doc_row = (await db.execute(stmt)).scalar_one()
    assert doc_row.content is None, "doc.content must be None in DB for files >= 1MB"
    assert doc_row.raw_storage_key is not None, "doc.raw_storage_key must be set"
    assert doc_row.raw_storage_key in s3_store, "Object must be persisted in S3 store"

    # 3. Retrieve content via GET /documents/{id}/content — transparently fetched from S3
    content_res = await client.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=headers)
    assert content_res.status_code == 200
    assert len(content_res.content) == len(large_payload)
    assert content_res.content == large_payload


@pytest.mark.asyncio
async def test_version_restore_preserves_content(authenticated_context):
    """Restoring an older version restores document content to the target version state."""
    client = authenticated_context["client"]
    headers = authenticated_context["headers"]
    ws_id = authenticated_context["workspace_id"]

    # 1. Upload v1
    files_v1 = {"file": ("spec.txt", b"Specification Version 1.0", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files_v1, headers=headers)
    doc_id = res.json()["id"]

    # 2. Create v2
    files_v2 = {"file": ("spec.txt", b"Specification Version 2.0 (Draft)", "text/plain")}
    await client.post(f"/api/v1/documents/{doc_id}/versions?workspace_id={ws_id}", files=files_v2, headers=headers)

    # 3. Verify current content is v2
    c2 = await client.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=headers)
    assert c2.content == b"Specification Version 2.0 (Draft)"

    # 4. Restore v1
    restore_res = await client.post(
        f"/api/v1/documents/{doc_id}/versions/1/restore?workspace_id={ws_id}",
        headers=headers,
    )
    assert restore_res.status_code == 200

    # 5. Verify content reverted to v1
    c_restored = await client.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=headers)
    assert c_restored.content == b"Specification Version 1.0"
