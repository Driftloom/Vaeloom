"""Test Suite: Module 05 Core Functionality (M05-CORE).
Verifies workspace CRUD, document CRUD, metadata patching, action logging, and deterministic undo.

These run against the test app with a real signup + workspace, so the CRUD
lifecycle is actually exercised. The previous version used a hard-coded
``Bearer test-ci`` token that the auth middleware has never accepted: every
request was rejected before it reached a route, so the suite silently asserted
the rejection branch and verified no CRUD at all. The negative control below
keeps the unauthenticated case covered.
"""
import io
import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def _signup(client: AsyncClient) -> dict:
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": f"m05core_{uuid.uuid4().hex[:8]}@vaeloom.test",
            "password": "Test1234!",
        },
    )
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _create_workspace(client: AsyncClient, headers: dict, name: str) -> str:
    res = await client.post(
        "/api/v1/workspaces", json={"name": name, "description": "Dev"}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def test_workspace_crud_lifecycle(client: AsyncClient):
    """Verify workspace creation, retrieval, description update, and deletion."""
    headers = await _signup(client)
    ws_id = await _create_workspace(client, headers, "Engineering Core")

    # Read
    get_res = await client.get(f"/api/v1/workspaces/{ws_id}", headers=headers)
    assert get_res.status_code == 200, get_res.text
    assert get_res.json()["name"] == "Engineering Core"

    # Update
    patch_res = await client.patch(
        f"/api/v1/workspaces/{ws_id}",
        json={"description": "Updated Core"},
        headers=headers,
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["description"] == "Updated Core"

    # Delete
    del_res = await client.delete(f"/api/v1/workspaces/{ws_id}", headers=headers)
    assert del_res.status_code == 204, del_res.text


async def test_workspace_crud_requires_authentication(client: AsyncClient):
    """Negative control: an anonymous caller cannot create a workspace."""
    res = await client.post("/api/v1/workspaces", json={"name": "Anon"})
    assert res.status_code == 401, res.text


async def test_document_crud_and_patch(client: AsyncClient):
    """Verify document upload, listing, content retrieval, and metadata patch."""
    headers = await _signup(client)
    ws_id = await _create_workspace(client, headers, "Core Documents")

    # Upload
    files = {"file": ("readme.txt", io.BytesIO(b"Vaeloom Core Document Test"), "text/plain")}
    res = await client.post(
        f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers
    )
    assert res.status_code == 201, res.text
    doc = res.json()
    doc_id = doc["id"]

    # Content retrieval
    content_res = await client.get(
        f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=headers
    )
    assert content_res.status_code == 200, content_res.text
    assert b"Vaeloom Core Document Test" in content_res.content

    # Patch metadata
    patch_res = await client.patch(
        f"/api/v1/documents/{doc_id}?workspace_id={ws_id}",
        json={"path": "docs/readme_updated.txt", "metadata": {"category": "onboarding"}},
        headers=headers,
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["path"] == "docs/readme_updated.txt"


async def test_document_crud_requires_authentication(client: AsyncClient):
    """Negative control: an anonymous caller cannot upload a document."""
    ws_id = str(uuid.uuid4())
    files = {"file": ("readme.txt", io.BytesIO(b"anon"), "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files)
    assert res.status_code == 401, res.text


async def test_document_action_history_and_undo(client: AsyncClient):
    """Verify document action audit logging and deterministic state machine undo."""
    headers = await _signup(client)
    ws_id = await _create_workspace(client, headers, "Core Actions")

    # Upload
    files = {"file": ("spec.txt", io.BytesIO(b"Version 1 Content"), "text/plain")}
    up_res = await client.post(
        f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers
    )
    assert up_res.status_code == 201, up_res.text
    doc_id = up_res.json()["id"]

    # Rename to trigger action
    renamed = await client.patch(
        f"/api/v1/documents/{doc_id}?workspace_id={ws_id}",
        json={"path": "renamed_spec.txt"},
        headers=headers,
    )
    assert renamed.status_code == 200, renamed.text

    # Get actions
    act_res = await client.get(
        f"/api/v1/documents/{doc_id}/actions?workspace_id={ws_id}", headers=headers
    )
    assert act_res.status_code == 200, act_res.text
    actions = act_res.json()
    assert actions["total"] >= 1
    action_id = actions["actions"][0]["id"]

    # Undo action
    undo_res = await client.post(
        f"/api/v1/documents/actions/{action_id}/undo?workspace_id={ws_id}", headers=headers
    )
    assert undo_res.status_code == 200, undo_res.text
    assert undo_res.json()["path"] == "spec.txt"

    # A second undo of the same action is a conflict, not a silent re-apply.
    second_undo = await client.post(
        f"/api/v1/documents/actions/{action_id}/undo?workspace_id={ws_id}", headers=headers
    )
    assert second_undo.status_code == 409, second_undo.text
