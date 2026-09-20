"""Stage 3 Verification: Zero-Trust MFA Setup, Enable, Challenge, TOTP, and Recovery Flow.

Verifies:
1. Legal consent signup & initial login
2. MFA Setup (Base32 secret, otpauth URI, hashed recovery codes)
3. MFA Enablement (requires valid 6-digit TOTP code)
4. MFA Login Challenge (returns mfa_required=True, mfa_token, no access_token)
5. Invalid MFA verification attempts reject with 401
6. Valid TOTP verification succeeds and issues session tokens
7. Single-use emergency recovery code verification succeeds and consumes the code
"""

import pytest
from httpx import AsyncClient
from api.services.totp_service import totp_service


@pytest.mark.asyncio
async def test_mfa_complete_lifecycle(client: AsyncClient):
    # 1. Signup with affirmative consent
    email = "mfa.user@example.com"
    password = "StrongPassword123!"
    signup_resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "password": password,
            "name": "MFA Test User",
            "terms_accepted": True,
        },
    )
    assert signup_resp.status_code == 201
    user_id = signup_resp.json()["user"]["id"]

    # 2. Login to get initial session token
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert token_data.get("mfa_required") is False or token_data.get("mfa_required") is None
    access_token = token_data["access_token"]

    auth_headers = {"Authorization": f"Bearer {access_token}"}

    # 3. Request MFA setup
    setup_resp = await client.post("/api/v1/auth/mfa/setup", headers=auth_headers)
    assert setup_resp.status_code == 200
    setup_data = setup_resp.json()
    assert "secret" in setup_data
    assert "otpauth_url" in setup_data
    assert "recovery_codes" in setup_data
    secret = setup_data["secret"]
    recovery_codes = setup_data["recovery_codes"]
    assert len(recovery_codes) == 8

    # 4. Attempt to enable MFA with invalid code -> should fail
    bad_enable_resp = await client.post(
        "/api/v1/auth/mfa/enable",
        headers=auth_headers,
        json={"code": "000000"},
    )
    assert bad_enable_resp.status_code == 400

    # 5. Enable MFA with valid TOTP code
    valid_code = totp_service.generate_code(secret)
    enable_resp = await client.post(
        "/api/v1/auth/mfa/enable",
        headers=auth_headers,
        json={"code": valid_code},
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json()["mfa_enabled"] is True

    # 6. Login now requires MFA challenge
    challenge_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert challenge_resp.status_code == 200
    challenge_data = challenge_resp.json()
    assert challenge_data["mfa_required"] is True
    assert challenge_data["mfa_token"] is not None
    assert not challenge_data.get("access_token")
    mfa_token = challenge_data["mfa_token"]

    # 7. Attempt MFA verify with wrong code -> 401
    bad_verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": "999999"},
    )
    assert bad_verify_resp.status_code == 401

    # 8. MFA verify with valid TOTP code -> 200 and access_token
    valid_code_2 = totp_service.generate_code(secret)
    verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": valid_code_2},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["access_token"] is not None
    assert verify_data["user"]["id"] == user_id

    # 9. Verify emergency recovery code login
    recovery_challenge_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert recovery_challenge_resp.status_code == 200
    rec_token = recovery_challenge_resp.json()["mfa_token"]

    first_rec_code = recovery_codes[0]
    rec_verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": rec_token, "code": first_rec_code},
    )
    assert rec_verify_resp.status_code == 200
    assert rec_verify_resp.json()["access_token"] is not None

    # 10. Attempt to reuse the SAME recovery code -> must fail
    reuse_challenge_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    reuse_token = reuse_challenge_resp.json()["mfa_token"]

    reuse_verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": reuse_token, "code": first_rec_code},
    )
    assert reuse_verify_resp.status_code == 401
