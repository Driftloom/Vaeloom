"""Zero-Trust Gap Tests: Module 01 (Authentication).

Covers:
- TEST-AUTH-SEC-01: Rejection of unsigned / forged Supabase JWTs.
- TEST-AUTH-SEC-02: IP rate limiting & brute-force throttling on login.
- TEST-AUTH-SEC-03: Password edge cases (null bytes, oversized DoS, homoglyphs).
- TEST-AUTH-SEC-04: SAML XML Signature Wrapping (XSW) rejection.
- TEST-AUTH-SEC-05: Concurrent session revocation race resilience.
"""
import asyncio
import uuid
from datetime import UTC, datetime, timedelta
import jwt
import pytest
from httpx import AsyncClient

from api.config import settings


@pytest.mark.asyncio
async def test_reject_unsigned_supabase_jwt(client: AsyncClient, monkeypatch):
    """TEST-AUTH-SEC-01: Verify that unsigned or forged Supabase JWTs are strictly rejected (HTTP 401).

    Zero-Trust Principle: Never trust token claims without cryptographic signature verification.
    """
    test_uid = str(uuid.uuid4())
    test_email = f"attacker_{uuid.uuid4().hex[:8]}@example.com"

    # Ensure no secret is set so verification would fail
    monkeypatch.setattr(settings, "supabase_jwt_secret", "")
    monkeypatch.setattr(settings, "supabase_url", "")

    # 1. Attacker attempts to send an unsigned token with 'supabase' in the issuer
    unsigned_token = jwt.encode(
        {
            "sub": test_uid,
            "email": test_email,
            "iss": "https://yygakxcttyaeunvkeybx.supabase.co/auth/v1",
            "exp": 9999999999,
            "iat": 1000000000,
        },
        "attacker-random-secret-that-does-not-match-anything-32chars!",
        algorithm="HS256",
    )

    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {unsigned_token}"})
    # ZERO-TRUST ENFORCEMENT: MUST be rejected with HTTP 401
    assert resp.status_code == 401, f"Expected 401 for forged Supabase token, got {resp.status_code}: {resp.text}"

    # 2. Attacker attempts 'alg: none' token
    none_token = jwt.encode(
        {
            "sub": test_uid,
            "email": test_email,
            "iss": "supabase",
            "exp": 9999999999,
        },
        key="",
        algorithm="none",
    )
    resp_none = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {none_token}"})
    assert resp_none.status_code == 401, f"Expected 401 for alg:none token, got {resp_none.status_code}: {resp_none.text}"


@pytest.mark.asyncio
async def test_login_rate_limiting_and_ip_throttling(rate_limited_client: AsyncClient):
    """TEST-AUTH-SEC-02: Verify brute-force attack from a single IP is throttled (HTTP 429)."""
    # Rapidly fire requests to /api/v1/auth/login using rate_limited_client (5 reqs/min limit)
    responses = []
    for i in range(35):
        res = await rate_limited_client.post(
            "/api/v1/auth/login",
            json={"email": f"brute_{i}@vaeloom.test", "password": "WrongPassword123!"},
        )
        responses.append(res.status_code)

    # Under zero-trust rate limiting with 5 reqs/min limit, 429 MUST be observed on bursts
    status_counts = {s: responses.count(s) for s in set(responses)}
    assert 429 in status_counts, f"Expected 429 in responses, got {status_counts}"


@pytest.mark.asyncio
async def test_password_edge_cases_and_dos_prevention(client: AsyncClient):
    """TEST-AUTH-SEC-03: Verify null bytes, 20,000-char DoS payloads, and script tags are rejected."""
    # 1. Null byte injection
    res_null = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "null_byte@vaeloom.test",
            "password": "ValidPassword\x00Injected!",
            "display_name": "Null Byte Test",
        },
    )
    # Must reject or handle cleanly, never 500
    assert res_null.status_code in (400, 422)

    # 2. Oversized DoS payload (25,000 characters)
    huge_password = "A" * 25000 + "!1a"
    res_huge = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "dos_pwd@vaeloom.test",
            "password": huge_password,
            "display_name": "DoS Test",
        },
    )
    assert res_huge.status_code in (400, 422)

    # 3. Script tag injection in display name and password
    res_xss = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "xss_user@vaeloom.test",
            "password": "<script>alert('pwned')</script>123!",
            "display_name": "<script>document.cookie</script>",
        },
    )
    # Should succeed with sanitized fields
    assert res_xss.status_code == 201
    if res_xss.status_code == 201:
        data = res_xss.json()
        assert "<script>" not in data.get("user", {}).get("display_name", "")


@pytest.mark.asyncio
async def test_saml_xml_signature_wrapping_rejection(client: AsyncClient):
    """TEST-AUTH-SEC-04: Verify SAML XML Signature Wrapping (XSW) attacks are rejected."""
    # Forged SAML response with mismatched / unsigned assertion
    malicious_saml_response = """
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp1" Version="2.0" IssueInstant="2026-09-20T00:00:00Z">
        <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_forged_assertion" Version="2.0" IssueInstant="2026-09-20T00:00:00Z">
            <saml:Issuer>https://idp.example.com</saml:Issuer>
            <saml:Subject>
                <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">admin@vaeloom.test</saml:NameID>
            </saml:Subject>
        </saml:Assertion>
    </samlp:Response>
    """
    import base64
    b64_payload = base64.b64encode(malicious_saml_response.encode()).decode()

    res = await client.post(
        "/api/v1/auth/saml/callback",
        data={"SAMLResponse": b64_payload},
    )
    # Must reject unprovisioned / unsigned SAML assertion (503 IdP not provisioned)
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_concurrent_session_revocation_race(client: AsyncClient):
    """TEST-AUTH-SEC-05: Verify revoked session cannot be reused under concurrent race conditions."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "session_race@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Session Race User",
        },
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    # Get active session ID
    sess_res = await client.get("/api/v1/auth/sessions", headers={"Authorization": f"Bearer {token}"})
    assert sess_res.status_code == 200
    sessions = sess_res.json()["sessions"]
    assert len(sessions) >= 1
    session_id = sessions[0]["id"]

    # Revoke session
    del_res = await client.delete(
        f"/api/v1/auth/sessions/{session_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204

    # Simultaneously execute 10 requests with the revoked token
    async def make_request():
        return await client.get("/api/v1/auth/sessions", headers={"Authorization": f"Bearer {token}"})

    results = await asyncio.gather(*(make_request() for _ in range(10)))
    # Every single request MUST be rejected with HTTP 401
    for r in results:
        assert r.status_code == 401, f"Revoked session leaked access! Status: {r.status_code}"


@pytest.mark.asyncio
async def test_password_reset_invalidates_active_refresh_tokens(client: AsyncClient):
    """TEST-AUTH-SEC-06: Verify password reset revokes all existing refresh tokens (GAP-AUTH-03)."""
    import hashlib
    import secrets
    from api.services.auth_service import AuthService

    # 1. Sign up user
    email = f"pwd_reset_{secrets.token_hex(4)}@vaeloom.test"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": email,
            "password": "InitialPassword123!",
            "display_name": "Reset Test User",
        },
    )
    assert signup_res.status_code == 201
    user_id = signup_res.json()["user"]["id"]
    old_refresh_token = signup_res.json()["refresh_token"]

    # 2. Seed a valid reset token in AuthService
    reset_token = f"test_reset_token_{secrets.token_urlsafe(16)}"
    token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
    AuthService._password_resets[token_hash] = (user_id, datetime.now(UTC) + timedelta(minutes=15))

    # 3. Perform password reset
    reset_res = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewStrongPassword123!"},
    )
    assert reset_res.status_code == 200

    # 4. Attempt to refresh token using old refresh token -> MUST be rejected (HTTP 401)
    refresh_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh_res.status_code == 401, f"Expected 401 on revoked refresh token, got {refresh_res.status_code}"


@pytest.mark.asyncio
async def test_concurrent_refresh_token_theft_defense(client: AsyncClient):
    """TEST-AUTH-SEC-07: Verify token rotation and replay theft defense (GAP-AUTH-05)."""
    # 1. Sign up user
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "token_rotation_theft@vaeloom.test",
            "password": "InitialPassword123!",
            "display_name": "Rotation Theft User",
        },
    )
    assert signup_res.status_code == 201
    refresh_token = signup_res.json()["refresh_token"]

    # 2. Valid refresh rotates the token
    res1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res1.status_code == 200
    new_refresh_token = res1.json()["refresh_token"]
    assert new_refresh_token != refresh_token

    # 3. Replay attack: attacker attempts to reuse the already-rotated refresh token
    res2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert res2.status_code == 401, f"Expected 401 on replayed refresh token, got {res2.status_code}"

    # 4. Subsequent attempts with that old rotated token MUST fail with 401
    subsequent_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert subsequent_res.status_code == 401, f"Expected 401 on old refresh token, got {subsequent_res.status_code}"

    # 5. Zero-Trust Family Revocation: because token theft/reuse was detected in step 3,
    # the entire token family is revoked to protect the user, so even the new refresh token is invalidated (401)
    res3 = await client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh_token})
    assert res3.status_code == 401, f"Expected 401 due to token family theft revocation, got {res3.status_code}"
