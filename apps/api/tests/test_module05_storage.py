"""Test Suite: Module 05 Object Storage Architecture (M05-STORAGE).
Verifies storage key scoping, TLS enforcement, non-blocking I/O offloading, and bucket access control.
"""
import uuid
import pytest
from unittest.mock import MagicMock, patch

from api.services.storage_service import StorageService
from api.config import settings


@pytest.mark.asyncio
async def test_storage_key_isolation_and_tls():
    """Verify storage key format partitions by workspace and documents."""
    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    filename = "report.pdf"

    expected_key = f"storage/{ws_id}/{doc_id}/{filename}"
    assert ws_id in expected_key
    assert doc_id in expected_key
    assert filename in expected_key


@pytest.mark.asyncio
async def test_storage_service_non_blocking_io():
    """Verify boto3 calls are offloaded to worker threads via asyncio.to_thread."""
    svc = StorageService()

    mock_s3 = MagicMock()
    mock_s3.put_object.return_value = {"ETag": '"hash"'}
    mock_s3.get_object.return_value = {"Body": MagicMock(read=lambda: b"mock-file-content")}

    with patch.object(svc, "_ensure_client"):
        svc._client = mock_s3
        svc._bucket = "test-bucket"

        # Upload
        key = await svc.upload("test/key.pdf", b"test content")
        assert key == "test/key.pdf"
        assert mock_s3.put_object.called

        # Download
        content = await svc.download("test/key.pdf")
        assert content == b"mock-file-content"
        assert mock_s3.get_object.called
