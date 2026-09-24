"""Test Suite: Module 05 Multi-Tenancy & Zero-Trust Isolation (M05-SEC).
Verifies strict isolation across tenants and workspaces.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app


@pytest.mark.asyncio
async def test_cross_workspace_access_denied():
    """Verify that a user from Workspace A cannot access documents in Workspace B."""
    transport = ASGITransport(app=app)
    ws_a = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())

    headers_a = {"Authorization": "Bearer test-ci", "X-Workspace-ID": ws_a}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # User in Workspace A attempts to access Workspace B document
        res = await ac.get(f"/api/v1/documents/{doc_id}?workspace_id={ws_b}", headers=headers_a)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_cross_tenant_access_denied():
    """Verify that tenant context boundaries cannot be breached."""
    transport = ASGITransport(app=app)
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())

    headers_a = {"Authorization": "Bearer test-ci", "X-Tenant-ID": tenant_a}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(f"/api/v1/workspaces/{ws_b}", headers=headers_a)
        assert res.status_code == 401
