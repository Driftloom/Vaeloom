"""Zero-Trust MFA & TOTP Verification Tests (Stage 1).

Tests RFC 6238 cryptographic TOTP generation, clock drift tolerance, recovery code
consumption, login challenge issuance, and OTP verification gates.
"""

import time
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.models.schema import User
from api.services.totp_service import totp_service

pytestmark = pytest.mark.asyncio


async def test_totp_generation_and_validation():
    """Verify RFC 6238 TOTP generation, 6-digit formatting, and clock drift verification."""
    secret = totp_service.generate_secret()
    assert len(secret) >= 16

    # Test code at current time
    code = totp_service.generate_code(secret)
    assert len(code) == 6
    assert code.isdigit()
    assert totp_service.verify_code(secret, code) is True

    # Test clock drift ±30 seconds
    past_code = totp_service.generate_code(secret, for_time=time.time() - 30)
    future_code = totp_service.generate_code(secret, for_time=time.time() + 30)
    assert totp_service.verify_code(secret, past_code, window=1) is True
    assert totp_service.verify_code(secret, future_code, window=1) is True

    # Rejection of invalid codes
    assert totp_service.verify_code(secret, "000000" if code != "000000" else "111111") is False
    assert totp_service.verify_code(secret, "short") is False
    assert totp_service.verify_code(secret, "") is False


async def test_mfa_recovery_codes_generation_and_consumption():
    """Verify recovery codes are single-use and properly invalidated after consumption."""
    plaintext, hashed = totp_service.generate_recovery_codes(count=8)
    assert len(plaintext) == 8
    assert len(hashed) == 8

    # Use first code
    valid, remaining = totp_service.verify_recovery_code(plaintext[0], hashed)
    assert valid is True
    assert len(remaining) == 7

    # Re-using the same code must fail
    valid_replay, _ = totp_service.verify_recovery_code(plaintext[0], remaining)
    assert valid_replay is False


async def test_mfa_setup_and_enable_flow(client: AsyncClient, db_session: AsyncSession):
    """Verify full MFA setup and activation flow for an authenticated user."""
    test_email = f"mfa_user_{uuid.uuid4().hex[:8]}@vaeloom.test"
    password = "SecurePassword123!"

    # 1. Sign up
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": test_email, "password": password, "display_name": "MFA Test User"},
    )
    assert signup_res.status_code == 201
    auth_data = signup_res.json()
    token = auth_data["access_token"]
    user_id = auth_data["user"]["id"]

    # 2. Call /mfa/setup
    setup_res = await client.post(
        "/api/v1/auth/mfa/setup",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert setup_res.status_code == 200
    setup_data = setup_res.json()
    assert "secret" in setup_data
    assert "otpauth_url" in setup_data
    assert len(setup_data["recovery_codes"]) == 8
    secret = setup_data["secret"]

    # 3. Call /mfa/enable with valid code
    valid_code = totp_service.generate_code(secret)
    enable_res = await client.post(
        "/api/v1/auth/mfa/enable",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": valid_code},
    )
    assert enable_res.status_code == 200

    # 4. Verify user in DB has mfa_enabled = True
    res = await db_session.execute(select(User).where(User.id == uuid.UUID(user_id)))
    u = res.scalar_one_or_none()
    assert u is not None
    assert u.mfa_enabled is True


async def test_login_mfa_challenge_and_verification(client: AsyncClient, db_session: AsyncSession):
    """Verify that a user with MFA enabled is challenged during login and requires OTP to authenticate."""
    test_email = f"mfa_login_{uuid.uuid4().hex[:8]}@vaeloom.test"
    password = "SecurePassword123!"

    # 1. Sign up and enable MFA
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": test_email, "password": password, "display_name": "MFA Login User"},
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    setup_res = await client.post(
        "/api/v1/auth/mfa/setup",
        headers={"Authorization": f"Bearer {token}"},
    )
    secret = setup_res.json()["secret"]
    recovery_codes = setup_res.json()["recovery_codes"]

    enable_res = await client.post(
        "/api/v1/auth/mfa/enable",
        headers={"Authorization": f"Bearer {token}"},
        json={"code": totp_service.generate_code(secret)},
    )
    assert enable_res.status_code == 200

    # 2. Login attempt with correct password
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": password},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()

    # ZERO-TRUST GATE: Full access tokens MUST NOT be returned yet!
    assert login_data["access_token"] == ""
    assert login_data["mfa_required"] is True
    assert "mfa_token" in login_data
    mfa_token = login_data["mfa_token"]

    # 3. Submit invalid OTP code -> 401
    verify_bad = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": "999999"},
    )
    assert verify_bad.status_code == 401

    # 4. Submit valid OTP code -> 200 with real access_token
    verify_good = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": totp_service.generate_code(secret)},
    )
    assert verify_good.status_code == 200
    final_auth = verify_good.json()
    assert len(final_auth["access_token"]) > 20
    assert final_auth["user"]["email"] == test_email

    # 5. Test login challenge using single-use recovery code
    login_res2 = await client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": password},
    )
    mfa_token2 = login_res2.json()["mfa_token"]

    recovery_auth = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token2, "code": recovery_codes[0]},
    )
    assert recovery_auth.status_code == 200
    assert len(recovery_auth.json()["access_token"]) > 20
