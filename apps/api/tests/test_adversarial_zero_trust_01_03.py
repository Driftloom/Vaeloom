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
)


@pytest.mark.asyncio
async def test_case_insensitive_lockout_bypass_attack(client, db_session):
    """Adversarial test: verify lockout cannot be bypassed by alternating email casing."""
    # 1. Signup with mixed-case email
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "CaseTarget@Vaeloom.Test",
            "password": "TargetPassword123!",
            "display_name": "Target",
        },
    )
    assert signup_res.status_code == 201

    # 2. 9 failed attempts with lowercase
    for i in range(1, 10):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "casetarget@vaeloom.test", "password": f"BadPass{i}"},
        )
        assert res.status_code == 401

    # 3. 10th failed attempt with UPPERCASE email
    res_10 = await client.post(
        "/api/v1/auth/login",
        json={"email": "CASETARGET@VAELOOM.TEST", "password": "BadPass10"},
    )
    assert res_10.status_code == 401

    # 4. 11th attempt with CamelCase: MUST be locked with HTTP 423
    res_11 = await client.post(
        "/api/v1/auth/login",
        json={"email": "CaseTarget@Vaeloom.Test", "password": "TargetPassword123!"},
    )
    assert res_11.status_code == 423
    detail = res_11.json().get("detail") or res_11.json().get("error", {}).get("message", "")
    assert "locked" in detail.lower()


@pytest.mark.asyncio
async def test_onboarding_isolation_and_idor(client, db_session):
    """Verify complete isolation between users' onboarding states."""
    # User A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "user_a@vaeloom.test",
            "password": "PasswordUserA123!",
            "display_name": "User A",
        },
    )
    token_a = res_a.json()["access_token"]

    # User B
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "user_b@vaeloom.test",
            "password": "PasswordUserB123!",
            "display_name": "User B",
        },
    )
    token_b = res_b.json()["access_token"]

    # User A updates step to RESUME
    step_a = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "RESUME", "step_data": {"skills": "Rust, Python"}},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert step_a.status_code == 200
    assert step_a.json()["current_step"] == "RESUME"

    # User B gets onboarding state: MUST be unaffected and remain PROFILE
    get_b = await client.get(
        "/api/v1/onboarding",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_b.status_code == 200
    state_b = get_b.json()
    assert state_b["current_step"] == "PROFILE"
    assert "skills" not in state_b["step_data"]

    # User A completes onboarding
    comp_a = await client.post(
        "/api/v1/onboarding/complete",
        json={"final_data": {"completed": True}},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert comp_a.status_code == 200
    assert comp_a.json()["is_completed"] is True

    # User B must still be incomplete
    get_b_after = await client.get(
        "/api/v1/onboarding",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_b_after.json()["is_completed"] is False


@pytest.mark.asyncio
async def test_email_verification_expired_token_rejection(client, db_session):
    """Verify that expired verification tokens are rejected and purged."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "expired_token@vaeloom.test",
            "password": "ExpiredPassword123!",
            "display_name": "Expired Test",
        },
    )
    user_id = uuid.UUID(signup_res.json()["user"]["id"])

    # Create an expired token directly
    raw_token = "expired-token-xyz"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expired_tok = EmailVerificationToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
    )
    db_session.add(expired_tok)
    await db_session.commit()

    # Attempt verification: must return 400 expired
    res = await client.post(
        "/api/v1/auth/verify-email",
        json={"token": raw_token},
    )
    assert res.status_code == 400
    detail = res.json().get("detail") or res.json().get("error", {}).get("message", "")
    assert "expired" in detail.lower()


@pytest.mark.asyncio
async def test_workspace_tampering_and_idor_protection(client, db_session):
    """Verify that User B cannot modify or delete User A's workspace."""
    # User A creates workspace
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "owner_a@vaeloom.test",
            "password": "PasswordOwnerA123!",
            "display_name": "Owner A",
        },
    )
    token_a = res_a.json()["access_token"]
    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Owner A Workspace"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    ws_id = ws_res.json()["id"]

    # User B
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "attacker_b@vaeloom.test",
            "password": "PasswordAttackerB123!",
            "display_name": "Attacker B",
        },
    )
    token_b = res_b.json()["access_token"]

    # User B attempts to PATCH User A's workspace
    patch_res = await client.patch(
        f"/api/v1/workspaces/{ws_id}",
        json={"name": "Hacked Workspace"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_res.status_code == 404

    # User B attempts to DELETE User A's workspace
    del_res = await client.delete(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_res.status_code == 404

    # User A's workspace remains intact
    get_a = await client.get(
        f"/api/v1/workspaces/{ws_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert get_a.status_code == 200
    assert get_a.json()["name"] == "Owner A Workspace"
