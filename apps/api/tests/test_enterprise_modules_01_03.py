import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from api.models.schema import (
    AuthSession,
    EmailVerificationToken,
    OnboardingState,
    User,
    Workspace,
    WorkspaceUser,
)


@pytest.mark.asyncio
async def test_password_policy_and_signup(client, db_session):
    # 1. Reject short password (< 8 chars)
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "test_pwd@vaeloom.test", "password": "short"},
    )
    assert res.status_code == 422 or res.status_code == 400

    # 2. Reject invalid email
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "invalid-email", "password": "SecurePassword123!"},
    )
    assert res.status_code == 422 or res.status_code == 400

    # 3. Successful signup
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "zero_trust_user@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Zero Trust User",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    user_id = data["user"]["id"]
    assert data["user"]["email"] == "zero_trust_user@vaeloom.test"
    assert data["user"]["email_verified"] is False

    # Verify DB records
    user_res = await db_session.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = user_res.scalar_one()
    assert user.email_verified is False
    assert user.failed_login_attempts == 0
    assert user.locked_until is None

    # Verify default workspace created
    ws_res = await db_session.execute(select(Workspace).where(Workspace.user_id == user.id))
    ws = ws_res.scalar_one_or_none()
    assert ws is not None

    # Verify email verification token generated
    tok_res = await db_session.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id)
    )
    token_record = tok_res.scalar_one_or_none()
    assert token_record is not None

    # Verify onboarding state initialized
    ob_res = await db_session.execute(
        select(OnboardingState).where(OnboardingState.user_id == user.id)
    )
    ob_record = ob_res.scalar_one_or_none()
    assert ob_record is not None
    assert ob_record.current_step == "PROFILE"
    assert ob_record.is_completed is False


@pytest.mark.asyncio
async def test_account_lockout_after_10_failed_attempts(client, db_session):
    # Sign up user
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "lockout_user@vaeloom.test",
            "password": "CorrectPassword123!",
            "display_name": "Lockout Test",
        },
    )
    assert signup_res.status_code == 201
    user_id = uuid.UUID(signup_res.json()["user"]["id"])

    # Attempt 1 to 9: bad password -> 401 Unauthorized
    for i in range(1, 10):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "lockout_user@vaeloom.test", "password": f"WrongPass{i}"},
        )
        assert res.status_code == 401, f"Attempt {i} did not return 401"

    # Check DB: failed_login_attempts should be 9, not yet locked
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert user.failed_login_attempts == 9
    assert user.locked_until is None

    # Attempt 10: 10th consecutive failure -> locks the account for 15 min
    res_10 = await client.post(
        "/api/v1/auth/login",
        json={"email": "lockout_user@vaeloom.test", "password": "WrongPass10"},
    )
    assert res_10.status_code == 401

    # Check DB: failed_login_attempts == 10, locked_until is set
    await db_session.refresh(user)
    assert user.failed_login_attempts == 10
    assert user.locked_until is not None
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    assert locked_until > datetime.now(UTC)

    # Attempt 11: even with the CORRECT password, login is blocked with HTTP 423
    res_11 = await client.post(
        "/api/v1/auth/login",
        json={"email": "lockout_user@vaeloom.test", "password": "CorrectPassword123!"},
    )
    assert res_11.status_code == 423
    detail_11 = res_11.json().get("detail") or res_11.json().get("error", {}).get("message", "")
    assert "locked" in detail_11.lower()

    # Simulate lockout expiration by setting locked_until into the past
    user.locked_until = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=10)
    await db_session.commit()

    # Attempt 12: now correct password succeeds and resets counters
    res_12 = await client.post(
        "/api/v1/auth/login",
        json={"email": "lockout_user@vaeloom.test", "password": "CorrectPassword123!"},
    )
    assert res_12.status_code == 200
    await db_session.refresh(user)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


@pytest.mark.asyncio
async def test_email_verification_lifecycle(client, db_session):
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "verify_me@vaeloom.test",
            "password": "VerifyPassword123!",
            "display_name": "Verify User",
        },
    )
    assert signup_res.status_code == 201
    user_id = uuid.UUID(signup_res.json()["user"]["id"])

    # Find the verification token in DB and test verification
    raw_token = "test-raw-token-12345"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    tok = EmailVerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )
    db_session.add(tok)
    await db_session.commit()

    # Call /auth/verify-email
    res = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": raw_token},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Check DB user
    user = (await db_session.execute(select(User).where(User.id == user_id))).scalar_one()
    assert user.email_verified is True

    # Calling again with same token must fail (token was consumed/deleted)
    res_repeat = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": raw_token},
    )
    assert res_repeat.status_code == 400

    # Resend verification
    res_resend = await client.post(
        "/api/v1/auth/resend-verification",
        json={"email": "verify_me@vaeloom.test"},
    )
    assert res_resend.status_code == 200
    assert res_resend.json()["status"] == "success"


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_theft_detection(client, db_session):
    # Signup
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "token_theft@vaeloom.test",
            "password": "TheftTestPassword123!",
            "display_name": "Theft Test",
        },
    )
    assert signup_res.status_code == 201
    tokens_1 = signup_res.json()
    refresh_1 = tokens_1["refresh_token"]

    # 1. Normal Refresh: Exchange refresh_1 for new tokens
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_1},
    )
    assert refresh_res.status_code == 200
    tokens_2 = refresh_res.json()
    refresh_2 = tokens_2["refresh_token"]
    assert refresh_2 != refresh_1

    # Check in DB that refresh_1 has status 'ROTATED'
    sess_1 = (
        await db_session.execute(
            select(AuthSession).where(AuthSession.refresh_token == refresh_1)
        )
    ).scalar_one()
    assert sess_1.status == "ROTATED"

    # 2. Token Theft / Replay Attack Simulation:
    # An attacker tries to use the already-rotated refresh_1 token
    replay_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_1},
    )
    # Should be blocked with 401 and detect reuse
    assert replay_res.status_code == 401
    detail_replay = replay_res.json().get("detail") or replay_res.json().get("error", {}).get("message", "")
    assert "suspicious activity detected" in detail_replay.lower()

    # 3. All tokens in the family must now be REVOKED
    sess_2 = (
        await db_session.execute(
            select(AuthSession).where(AuthSession.refresh_token == refresh_2)
        )
    ).scalar_one()
    assert sess_2.status == "REVOKED"

    # 4. Attempting to use refresh_2 also fails now
    res_after_theft = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_2},
    )
    assert res_after_theft.status_code == 401


@pytest.mark.asyncio
async def test_granular_session_management(client, db_session):
    # Signup
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "sessions_user@vaeloom.test",
            "password": "SessionsPassword123!",
            "display_name": "Sessions User",
        },
    )
    assert signup_res.status_code == 201
    token_1 = signup_res.json()["access_token"]

    # Login from a second device/client
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "sessions_user@vaeloom.test", "password": "SessionsPassword123!"},
        headers={"User-Agent": "Mobile-Device-1.0"},
    )
    assert login_res.status_code == 200
    token_2 = login_res.json()["access_token"]

    # List active sessions using token_2
    sessions_res = await client.get(
        "/api/v1/auth/sessions",
        headers={"Authorization": f"Bearer {token_2}"},
    )
    assert sessions_res.status_code == 200
    sessions = sessions_res.json()["sessions"]
    assert len(sessions) >= 2

    # Check is_current flag
    current_sessions = [s for s in sessions if s["is_current"] is True]
    assert len(current_sessions) == 1

    # Revoke the other session
    other_session = [s for s in sessions if not s["is_current"]][0]
    del_res = await client.delete(
        f"/api/v1/auth/sessions/{other_session['id']}",
        headers={"Authorization": f"Bearer {token_2}"},
    )
    assert del_res.status_code == 204

    # List sessions again: only 1 active session remaining
    sessions_after = (
        await client.get(
            "/api/v1/auth/sessions",
            headers={"Authorization": f"Bearer {token_2}"},
        )
    ).json()["sessions"]
    assert len(sessions_after) == 1
    assert sessions_after[0]["id"] != other_session["id"]


@pytest.mark.asyncio
async def test_workspace_membership_and_idor_prevention(client, db_session):
    # User 1
    u1_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "owner@vaeloom.test",
            "password": "OwnerPassword123!",
            "display_name": "Owner User",
        },
    )
    u1_token = u1_res.json()["access_token"]
    u1_id = uuid.UUID(u1_res.json()["user"]["id"])

    # User 2
    u2_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "member@vaeloom.test",
            "password": "MemberPassword123!",
            "display_name": "Member User",
        },
    )
    u2_token = u2_res.json()["access_token"]
    u2_id = uuid.UUID(u2_res.json()["user"]["id"])

    # User 3 (Attacker / Unrelated)
    u3_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "attacker@vaeloom.test",
            "password": "AttackerPassword123!",
            "display_name": "Attacker User",
        },
    )
    u3_token = u3_res.json()["access_token"]

    # Owner creates workspace
    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Owner Secret Workspace"},
        headers={"Authorization": f"Bearer {u1_token}"},
    )
    assert ws_res.status_code == 201
    ws_id = ws_res.json()["id"]

    # Before being added as member: User 2 cannot access Owner's workspace (404)
    get_before = await client.get(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {u2_token}"},
    )
    assert get_before.status_code == 404

    # Add User 2 as a member via WorkspaceUser
    member_record = WorkspaceUser(
        workspace_id=uuid.UUID(ws_id),
        user_id=u2_id,
        role="MEMBER",
    )
    db_session.add(member_record)
    await db_session.commit()

    # After being added: User 2 can list and access Owner's workspace
    ws_list = await client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {u2_token}"},
    )
    assert ws_list.status_code == 200
    listed_ids = [w["id"] for w in ws_list.json()]
    assert ws_id in listed_ids

    get_after = await client.get(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {u2_token}"},
    )
    assert get_after.status_code == 200
    assert get_after.json()["name"] == "Owner Secret Workspace"

    # Member cannot delete Owner's workspace (only owner can delete)
    del_attempt = await client.delete(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {u2_token}"},
    )
    assert del_attempt.status_code == 404

    # Attacker (User 3) cannot access Owner's workspace (IDOR blocked)
    attacker_attempt = await client.get(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {u3_token}"},
    )
    assert attacker_attempt.status_code == 404


@pytest.mark.asyncio
async def test_onboarding_state_machine(client, db_session):
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "onboarding_user@vaeloom.test",
            "password": "OnboardingPass123!",
            "display_name": "Onboarding User",
        },
    )
    token = signup_res.json()["access_token"]

    # 1. Get initial onboarding state
    get_res = await client.get(
        "/api/v1/onboarding",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    state = get_res.json()
    assert state["current_step"] == "PROFILE"
    assert state["is_completed"] is False

    # 2. Advance step to WORKSPACE
    step_res = await client.post(
        "/api/v1/onboarding/step",
        json={
            "step": "WORKSPACE",
            "step_data": {"displayName": "Onboarding Pro", "jobTitle": "Lead Architect"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert step_res.status_code == 200
    state2 = step_res.json()
    assert state2["current_step"] == "WORKSPACE"
    assert "PROFILE" in state2["completed_steps"]

    # 3. Invalid step rejection
    invalid_res = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "NON_EXISTENT_STEP", "step_data": {}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert invalid_res.status_code == 400

    # 4. Complete onboarding
    comp_res = await client.post(
        "/api/v1/onboarding/complete",
        json={"final_data": {"completedVia": "wizard"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert comp_res.status_code == 200
    final_state = comp_res.json()
    assert final_state["is_completed"] is True
    assert final_state["current_step"] == "COMPLETED"


@pytest.mark.asyncio
async def test_organization_tenant_fail_closed(client):
    import jwt
    from api.config import settings

    # Token with invalid UUID sub and no tenant_id
    token = jwt.encode(
        {"sub": "invalid-uuid-sub", "email": "no_tenant@vaeloom.test", "exp": datetime.now(UTC) + timedelta(hours=1)},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    res = await client.get(
        "/api/v1/organizations/tree",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    detail = res.json().get("detail") or res.json().get("error", {}).get("message", "")
    assert "tenant context required" in detail.lower()

