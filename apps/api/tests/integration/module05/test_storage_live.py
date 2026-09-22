"""Live integration tests for Object Storage (MinIO S3).

Verifies genuine non-mocked S3 upload, download, list, and delete against live containerized MinIO.
Run: uv run python -m pytest tests/integration/module05/test_storage_live.py -v -o addopts=""
"""
import uuid
import pytest

from api.config import settings
from api.services.storage_service import StorageService

pytestmark = [pytest.mark.integration, pytest.mark.live_provider]


@pytest.mark.asyncio
async def test_live_minio_s3_lifecycle():
    """Verify live S3 upload, readback, listing, and deletion using running MinIO."""
    import socket
    try:
        sock = socket.create_connection(("127.0.0.1", 9000), timeout=0.5)
        sock.close()
    except OSError:
        pytest.skip("Live MinIO S3 container is not running on localhost:9000 (start vaeloom-test-minio container to run)")

    settings.storage_endpoint = "http://localhost:9000"
    settings.storage_access_key = "minioadmin"
    settings.storage_secret_key = "minioadmin"
    settings.storage_bucket = "vaeloom-test-bucket"

    storage = StorageService()
    test_key = f"integration/documents/{uuid.uuid4()}.pdf"
    content = b"%PDF-1.4 Live MinIO Integration Test Payload"

    # 1. Upload
    uploaded_key = await storage.upload(test_key, content)
    assert uploaded_key == test_key

    # 2. Download
    retrieved = await storage.download(test_key)
    assert retrieved == content

    # 3. List
    listing = await storage.list("integration/documents/")
    assert test_key in listing

    # 4. Delete
    await storage.delete(test_key)
    listing_after = await storage.list("integration/documents/")
    assert test_key not in listing_after
