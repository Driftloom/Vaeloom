"""Adversarial tests: Share Privilege Escalation and Cross-Tenant Bypass (P0-03).

Attempts to bypass security checks through:
1. Mutating operations using read-only share permissions.
2. Forging X-Workspace-ID or accessing documents from alien tenants.
3. Accessing non-existent or foreign document IDs across boundaries.
"""
import uuid
import pytest
from httpx import ASGITransport, AsyncClient

from api.models.schema import User, Workspace, WorkspaceUser, DocumentShare
from tests.integration.module05.conftest import make_jwt

pytestmark = pytest.mark.adversarial


@pytest.mark.asyncio
async def test_forged_workspace_id_rejected(authenticated_context):
    """Attempting to access document using a forged workspace_id not belonging to user must return 403 or 404."""
    client = authenticated_context["client"]
    token = authenticated_context["token"]
    alien_ws = str(uuid.uuid4())
    alien_doc = str(uuid.uuid4())

    headers = {"Authorization": f"Bearer {token}", "X-Workspace-ID": alien_ws}
    res = await client.get(f"/api/v1/documents/{alien_doc}/content?workspace_id={alien_ws}", headers=headers)

    # Must be exact 403 (workspace access forbidden)
    assert res.status_code == 403, f"Alien workspace access leaked with status {res.status_code}"


@pytest.mark.asyncio
async def test_read_share_user_cannot_restore_version(authenticated_context):
    """P0-03: User with read share access cannot restore previous versions (must return 403)."""
    db = authenticated_context["db"]
    client = authenticated_context["client"]
    owner_headers = authenticated_context["headers"]
    ws_a_id = uuid.UUID(authenticated_context["workspace_id"])
    tenant_id = uuid.UUID(authenticated_context["tenant_id"])

    # 1. Upload in ws A
    files = {"file": ("doc_v1.txt", b"Version 1", "text/plain")}
    res = await client.post(f"/api/v1/documents?workspace_id={ws_a_id}", files=files, headers=owner_headers)
    assert res.status_code == 201
    doc_id = uuid.UUID(res.json()["id"])

    # 2. Setup ws B with read share
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
    headers_b = {"Authorization": f"Bearer {token_b}", "X-Tenant-ID": str(tenant_id)}

    # Attempt to restore version 1 through ws B (must fail with 403)
    from api.services.document_service import document_service
    with pytest.raises(Exception) as exc_info:
        await document_service.restore_version(
            document_id=str(doc_id),
            version_number=1,
            workspace_id=str(ws_b_id),
            db=db,
        )
    assert "403" in str(exc_info.value) or "Forbidden" in str(exc_info.value)
