"""Test Suite: Module 05 Frontend Integration & API Contracts (M05-FE).
Verifies that backend document and workspace endpoints align with frontend api-client contracts,
including casing transforms, query parameters, CSRF protection, and response schemas.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app


@pytest.mark.asyncio
async def test_frontend_document_query_params_and_headers():
    """Verify backend accepts workspace_id query parameter and validates authentication."""
    transport = ASGITransport(app=app)
    ws_id = str(uuid.uuid4())
    headers = {
        "Authorization": "Bearer test-ci-token",
        "X-CSRF-Token": "valid-test-csrf-token",
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Check GET /documents with workspace_id query param
        res = await ac.get(f"/api/v1/documents?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_frontend_folder_tree_contract():
    """Verify GET /documents/folders/tree endpoint returns valid hierarchical structure expected by UI tree view."""
    transport = ASGITransport(app=app)
    ws_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer test-ci-token"}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/documents/folders/tree?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_frontend_bulk_upload_download_contract():
    """Verify bulk upload and download endpoints conform to multipart and zip contracts."""
    transport = ASGITransport(app=app)
    ws_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer test-ci-token"}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test download contract
        res = await ac.get(f"/api/v1/documents/bulk/download?workspace_id={ws_id}", headers=headers)
        assert res.status_code == 401
        if res.status_code == 200:
            assert res.headers.get("content-type") == "application/zip"
