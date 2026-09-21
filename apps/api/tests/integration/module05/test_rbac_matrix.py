"""Integration tests: RBAC Matrix and Share Permission Enforcement.

P0-02: Role permission tiers (_ROLES_WRITE, _ROLES_MUTATE, _ROLES_ADMIN).
P0-03: Share permission enforcement (read-only share cannot rename/archive/mutate).
"""
import uuid
import pytest
from sqlalchemy import select

from api.models.schema import User, Workspace, WorkspaceUser, DocumentShare
from tests.integration.module05.conftest import make_jwt

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_viewer_cannot_upload(authenticated_context):
    """P0-02: User with VIEWER role in workspace cannot upload documents (returns 403)."""
    db = authenticated_context["db"]
    client = authenticated_context["client"]
    ws_id = uuid.UUID(authenticated_context["workspace_id"])
    tenant_id = uuid.UUID(authenticated_context["tenant_id"])

    # Create a viewer user
    viewer_id = uuid.uuid4()
    viewer_user = User(
        id=viewer_id,
        email=f"viewer_{viewer_id.hex[:8]}@vaeloom.test",
        display_name="Viewer User",
        tenant_id=tenant_id,
        password_hash="hashed_pw",
        status="ACTIVE",
    )
    viewer_membership = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        user_id=viewer_id,
        role="VIEWER",
    )
    db.add_all([viewer_user, viewer_membership])
    await db.commit()

    viewer_token = make_jwt(str(viewer_id), viewer_user.email, str(tenant_id))
    headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Tenant-ID": str(tenant_id),
        "X-Workspace-ID": str(ws_id),
    }

    files = {"file": ("viewer_attempt.txt", b"Viewer trying to write", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=headers)
    assert res.status_code == 403, f"Expected 403 for Viewer upload, got {res.status_code}: {res.text}"


@pytest.mark.asyncio
async def test_viewer_can_read_document_content(authenticated_context):
    """User with VIEWER role CAN read documents in the workspace (returns 200)."""
    db = authenticated_context["db"]
    client = authenticated_context["client"]
    owner_headers = authenticated_context["headers"]
    ws_id = uuid.UUID(authenticated_context["workspace_id"])
    tenant_id = uuid.UUID(authenticated_context["tenant_id"])

    # 1. Owner uploads document
    files = {"file": ("public_notes.txt", b"Visible to all members", "text/plain")}
    upload_res = await client.post(f"/api/v1/documents?workspace_id={ws_id}", files=files, headers=owner_headers)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 2. Viewer user
    viewer_id = uuid.uuid4()
    viewer_user = User(
        id=viewer_id,
        email=f"viewer_reader_{viewer_id.hex[:8]}@vaeloom.test",
        display_name="Viewer Reader",
        tenant_id=tenant_id,
        password_hash="pw",
        status="ACTIVE",
    )
    viewer_membership = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=ws_id,
        user_id=viewer_id,
        role="VIEWER",
    )
    db.add_all([viewer_user, viewer_membership])
    await db.commit()

    viewer_token = make_jwt(str(viewer_id), viewer_user.email, str(tenant_id))
    viewer_headers = {"Authorization": f"Bearer {viewer_token}", "X-Tenant-ID": str(tenant_id)}

    # 3. Viewer reads content
    content_res = await client.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_id}", headers=viewer_headers)
    assert content_res.status_code == 200
    assert b"Visible to all members" in content_res.content


@pytest.mark.asyncio
async def test_read_only_share_cannot_rename_or_archive(authenticated_context):
    """P0-03: Document shared with 'read' permission to workspace B cannot be renamed or archived by workspace B."""
    db = authenticated_context["db"]
    client = authenticated_context["client"]
    owner_headers = authenticated_context["headers"]
    ws_a_id = uuid.UUID(authenticated_context["workspace_id"])
    tenant_id = uuid.UUID(authenticated_context["tenant_id"])

    # 1. Upload in workspace A
    files = {"file": ("original.txt", b"Original content in ws A", "text/plain")}
    up_res = await client.post(f"/api/v1/documents?workspace_id={ws_a_id}", files=files, headers=owner_headers)
    assert up_res.status_code == 201
    doc_id = uuid.UUID(up_res.json()["id"])

    # 2. Setup workspace B and user in workspace B
    ws_b_id = uuid.uuid4()
    user_b_id = uuid.uuid4()
    user_b = User(
        id=user_b_id,
        email=f"user_b_{user_b_id.hex[:8]}@vaeloom.test",
        display_name="User B",
        tenant_id=tenant_id,
        password_hash="pw",
        status="ACTIVE",
    )
    ws_b = Workspace(
        id=ws_b_id,
        user_id=user_b_id,
        name="Workspace B",
    )
    membership_b = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=ws_b_id,
        user_id=user_b_id,
        role="OWNER",
    )
    # Grant READ-ONLY share to workspace B
    share = DocumentShare(
        id=uuid.uuid4(),
        document_id=doc_id,
        source_workspace_id=ws_a_id,
        target_workspace_id=ws_b_id,
        permission="read",
    )
    db.add_all([user_b, ws_b, membership_b, share])
    await db.commit()

    token_b = make_jwt(str(user_b_id), user_b.email, str(tenant_id))
    headers_b = {
        "Authorization": f"Bearer {token_b}",
        "X-Tenant-ID": str(tenant_id),
    }

    # User B CAN read content
    read_res = await client.get(f"/api/v1/documents/{doc_id}/content?workspace_id={ws_b_id}", headers=headers_b)
    assert read_res.status_code == 200

    # User B CANNOT rename via read share (must return 403)
    rename_res = await client.patch(
        f"/api/v1/documents/{doc_id}?workspace_id={ws_b_id}",
        json={"path": "hijacked.txt"},
        headers=headers_b,
    )
    assert rename_res.status_code == 403, f"Expected 403 for read-share rename, got {rename_res.status_code}"

    # User B CANNOT archive via read share (must return 403)
    archive_res = await client.post(
        f"/api/v1/documents/{doc_id}/archive?workspace_id={ws_b_id}",
        headers=headers_b,
    )
    assert archive_res.status_code == 403, f"Expected 403 for read-share archive, got {archive_res.status_code}"
