import pytest
from httpx import AsyncClient
from api.models.schema import AuthSession
from sqlalchemy import select


@pytest.mark.asyncio
async def test_session_lifecycle_and_revocation(client: AsyncClient, db_session):
    """Zero-Trust Gate: Session enumeration, current-session detection, individual and bulk revocation."""
    # 1. Sign up user
    email = "session_test@vaeloom.test"
    pw = "Password123!Secure"
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": pw, "terms_accepted": True},
    )
    assert res.status_code == 201
    token1 = res.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # 2. Login a second time to create a second active session
    res_login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pw},
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)"},
    )
    assert res_login.status_code == 200
    token2 = res_login.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # 3. List sessions with token2 (should see at least 2 sessions, token2 marked current)
    res_list = await client.get("/api/v1/auth/sessions", headers=headers2)
    assert res_list.status_code == 200
    sessions = res_list.json()["sessions"]
    assert len(sessions) >= 2

    current_sess = next((s for s in sessions if s["is_current"] is True), None)
    assert current_sess is not None
    other_sess = next((s for s in sessions if s["is_current"] is False), None)
    assert other_sess is not None

    # 4. Revoke the other session individually
    res_del = await client.delete(f"/api/v1/auth/sessions/{other_sess['id']}", headers=headers2)
    assert res_del.status_code == 204

    # 5. Verify the other session is now revoked and its token is rejected
    res_revoked = await client.get("/api/v1/auth/me", headers=headers1)
    assert res_revoked.status_code == 401

    # 6. Current session (token2) still works
    res_me2 = await client.get("/api/v1/auth/me", headers=headers2)
    assert res_me2.status_code == 200

    # 7. Create a third session and test revoke-others
    res_login3 = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": pw},
    )
    assert res_login3.status_code == 200
    token3 = res_login3.json()["access_token"]
    headers3 = {"Authorization": f"Bearer {token3}"}

    # Revoke others from session 2
    res_bulk = await client.post("/api/v1/auth/sessions/revoke-others", headers=headers2)
    assert res_bulk.status_code == 200
    assert res_bulk.json()["status"] == "success"
    assert res_bulk.json()["revoked_count"] >= 1

    # Session 3 is now revoked
    res_revoked3 = await client.get("/api/v1/auth/me", headers=headers3)
    assert res_revoked3.status_code == 401
