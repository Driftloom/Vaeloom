import pytest
import uuid
import jwt
from httpx import AsyncClient
from api.config import settings
from api.models.schema import User, Tenant, Workspace

@pytest.mark.asyncio
async def test_auth_me_supabase_email_linking(client: AsyncClient, db_session, monkeypatch):
    """Verify that when a user logs in with an external provider (e.g. Supabase)
    whose JWT `sub` differs from the existing internal User UUID, the backend
    uses app.lookup_email under RLS to resolve the existing account, rather than
    failing with a unique constraint violation on email.
    """
    # 1. Create tenant and existing user
    tenant = Tenant(name="Test Org", slug=f"test-org-{uuid.uuid4().hex[:6]}")
    db_session.add(tenant)
    await db_session.flush()

    test_email = f"test_link_{uuid.uuid4().hex[:6]}@example.com"
    existing_user = User(
        id=uuid.uuid4(),
        email=test_email,
        display_name="Existing User",
        tenant_id=tenant.id,
        auth_provider="email",
        status="ACTIVE",
    )
    db_session.add(existing_user)
    await db_session.flush()

    ws = Workspace(
        id=uuid.uuid4(),
        user_id=existing_user.id,
        name="Existing Workspace",
    )
    db_session.add(ws)
    await db_session.commit()

    # 2. Configure Supabase secret and simulate token with a different `sub`
    supa_secret = "test-supabase-jwt-secret-for-linking-12345678"
    monkeypatch.setattr(settings, "supabase_jwt_secret", supa_secret)

    supabase_sub = str(uuid.uuid4())
    token = jwt.encode(
        {
            "sub": supabase_sub,
            "email": test_email,
            "role": "authenticated",
            "aud": "authenticated",
            "iss": "https://example.supabase.co/auth/v1",
            "exp": 9999999999,
            "iat": 1000000000,
            "email_verified": True,
            "user_metadata": {"full_name": "Supabase Linked User"},
        },
        supa_secret,
        algorithm="HS256",
    )

    # 3. Call GET /api/v1/auth/me
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["user"]["email"] == test_email
    # Should resolve to the existing user's ID, not create a duplicate
    assert data["user"]["id"] == str(existing_user.id)
    assert len(data["workspaces"]) >= 1
    assert data["workspaces"][0]["id"] == str(ws.id)
