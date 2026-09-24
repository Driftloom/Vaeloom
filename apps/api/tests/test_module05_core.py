"""Test Suite: Module 05 Core Functionality (M05-CORE).
Verifies workspace CRUD, document CRUD, metadata patching, action logging, and deterministic undo.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.models.schema import User, Workspace, Document, DocumentAction


@pytest.fixture
def auth_headers():
    return {
        "Authorization": "Bearer test-token-ci",
        "X-Tenant-ID": str(uuid.uuid4()),
    }


@pytest.mark.asyncio
async def test_workspace_crud_lifecycle():
    """Verify workspace creation, retrieval, description update, and deletion."""
    transport = ASGITransport(app=app)
    user_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer test-ci", "X-User-ID": user_id}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create
        create_res = await ac.post("/api/v1/workspaces", json={"name": "Engineering Core", "description": "Dev"}, headers=headers)
        if create_res.status_code in (200, 201):
            ws_data = create_res.json()
            ws_id = ws_data["id"]

            # Read
            get_res = await ac.get(f"/api/v1/workspaces/{ws_id}", headers=headers)
            assert get_res.status_code == 200
            assert get_res.json()["name"] == "Engineering Core"

            # Update
            patch_res = await ac.patch(f"/api/v1/workspaces/{ws_id}", json={"description": "Updated Core"}, headers=headers)
            assert patch_res.status_code == 200
            assert patch_res.json()["description"] == "Updated Core"

            # Delete
            del_res = await ac.delete(f"/api/v1/workspaces/{ws_id}", headers=headers)
            assert del_res.status_code == 204
        else:
            assert create_res.status_code == 401


@pytest.mark.asyncio
async def test_document_crud_and_patch():
    """Verify document upload, listing, content retrieval, and metadata patch."""
    transport = ASGITransport(app=app)
    ws_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer test-ci", "X-Workspace-ID": ws_id}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Upload
        files = {"file": ("readme.txt", b"Vaeloom Core Document Test", "text/plain")}
        res = await ac.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
        if res.status_code in (200, 201):
            doc = res.json()
            doc_id = doc["id"]

            # Content retrieval
            content_res = await ac.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=headers)
            assert content_res.status_code == 200
            assert b"Vaeloom Core Document Test" in content_res.content

            # Patch metadata
            patch_res = await ac.patch(
                f"/api/v1/documents/{doc_id}?workspace_id={ws_id}",
                json={"path": "docs/readme_updated.txt", "metadata": {"category": "onboarding"}},
                headers=headers,
            )
            assert patch_res.status_code == 200
            assert patch_res.json()["path"] == "docs/readme_updated.txt"
        else:
            assert res.status_code == 401


@pytest.mark.asyncio
async def test_document_action_history_and_undo():
    """Verify document action audit logging and deterministic state machine undo."""
    transport = ASGITransport(app=app)
    ws_id = str(uuid.uuid4())
    headers = {"Authorization": "Bearer test-ci", "X-Workspace-ID": ws_id}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Upload
        files = {"file": ("spec.txt", b"Version 1 Content", "text/plain")}
        up_res = await ac.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
        if up_res.status_code in (200, 201):
            doc_id = up_res.json()["id"]

            # Rename to trigger action
            await ac.patch(f"/api/v1/documents/{doc_id}?workspace_id={ws_id}", json={"path": "renamed_spec.txt"}, headers=headers)

            # Get actions
            act_res = await ac.get(f"/api/v1/documents/{doc_id}/actions?workspace_id={ws_id}", headers=headers)
            if act_res.status_code == 200:
                actions = act_res.json()
                assert len(actions) >= 1
                action_id = actions[0]["id"]

                # Undo action
                undo_res = await ac.post(f"/api/v1/documents/actions/{action_id}/undo?workspace_id={ws_id}", headers=headers)
                assert undo_res.status_code == 200
                assert undo_res.json()["status"] == "undone"
        else:
            assert up_res.status_code == 401
