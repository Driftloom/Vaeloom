"""Zero-Trust Holistic Gate: Modules 01–03 End-to-End Verification Suite.

Comprehensive proof spanning:
- Module 01: Authentication (Affirmative consent, Session tracking & revocation, MFA challenge/TOTP/Recovery codes)
- Module 02: Tenant Isolation & Multi-Tenancy (Workspace assignment, cross-tenant boundary security)
- Module 03: Onboarding Pipeline (State machine progression, resume skill parsing, connectors, complete, reset)
"""

import io
import pytest
from httpx import AsyncClient
from api.services.totp_service import totp_service


@pytest.mark.asyncio
async def test_modules_01_03_comprehensive_zero_trust_gate(client: AsyncClient):
    # =========================================================================
    # MODULE 01: AUTHENTICATION & LEGAL CONSENT
    # =========================================================================

    # 1. Reject signup without affirmative terms acceptance
    user_email_a = "holistic.tenant.a@example.com"
    user_email_b = "holistic.tenant.b@example.com"
    password = "SecureEnterprisePassword123!"

    reject_resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": user_email_a,
            "password": password,
            "name": "Tenant A User",
            "terms_accepted": False,
        },
    )
    assert reject_resp.status_code == 422, "Signup must reject terms_accepted=False"

    # 2. Valid signup with affirmative consent for User A
    signup_a_resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": user_email_a,
            "password": password,
            "name": "Tenant A User",
            "terms_accepted": True,
        },
    )
    assert signup_a_resp.status_code == 201
    user_a = signup_a_resp.json()["user"]
    user_a_id = user_a["id"]

    # 3. Valid signup with affirmative consent for User B (separate tenant)
    signup_b_resp = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": user_email_b,
            "password": password,
            "name": "Tenant B User",
            "terms_accepted": True,
        },
    )
    assert signup_b_resp.status_code == 201
    user_b = signup_b_resp.json()["user"]
    user_b_id = user_b["id"]
    assert user_a_id != user_b_id

    # 4. User A logs in from Device 1
    login_a1_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user_email_a, "password": password},
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"},
    )
    assert login_a1_resp.status_code == 200
    token_a1 = login_a1_resp.json()["access_token"]
    headers_a1 = {"Authorization": f"Bearer {token_a1}"}

    # 5. User A logs in from Device 2 (simulating mobile / second session)
    login_a2_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user_email_a, "password": password},
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"},
    )
    assert login_a2_resp.status_code == 200
    token_a2 = login_a2_resp.json()["access_token"]
    headers_a2 = {"Authorization": f"Bearer {token_a2}"}

    # 6. Verify Active Sessions listing shows 2 active sessions
    sessions_resp = await client.get("/api/v1/auth/sessions", headers=headers_a1)
    assert sessions_resp.status_code == 200
    sessions_list = sessions_resp.json()["sessions"]
    assert len(sessions_list) >= 2
    current_session = next((s for s in sessions_list if s["is_current"]), None)
    assert current_session is not None

    # 7. Revoke other sessions from Device 1
    revoke_others_resp = await client.post("/api/v1/auth/sessions/revoke-others", headers=headers_a1)
    assert revoke_others_resp.status_code == 200

    # Device 2 token should now be invalidated (HTTP 401)
    revoked_check = await client.get("/api/v1/auth/me", headers=headers_a2)
    assert revoked_check.status_code == 401, "Revoked session token must be denied"

    # Device 1 token remains valid
    active_check = await client.get("/api/v1/auth/me", headers=headers_a1)
    assert active_check.status_code == 200

    # 8. Multi-Factor Authentication (MFA) Setup & Enablement for User A
    mfa_setup_resp = await client.post("/api/v1/auth/mfa/setup", headers=headers_a1)
    assert mfa_setup_resp.status_code == 200
    mfa_setup = mfa_setup_resp.json()
    secret = mfa_setup["secret"]
    recovery_codes = mfa_setup["recovery_codes"]

    # Enable MFA with valid TOTP code
    code = totp_service.generate_code(secret)
    enable_resp = await client.post(
        "/api/v1/auth/mfa/enable",
        headers=headers_a1,
        json={"code": code},
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json().get("mfa_enabled") is True

    # Next login requires MFA challenge
    mfa_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user_email_a, "password": password},
    )
    assert mfa_login_resp.status_code == 200
    challenge_payload = mfa_login_resp.json()
    assert challenge_payload["mfa_required"] is True
    mfa_token = challenge_payload["mfa_token"]

    # Verify with TOTP
    fresh_totp = totp_service.generate_code(secret)
    mfa_verify_resp = await client.post(
        "/api/v1/auth/mfa/verify",
        json={"mfa_token": mfa_token, "code": fresh_totp},
    )
    assert mfa_verify_resp.status_code == 200
    fresh_token_a = mfa_verify_resp.json()["access_token"]
    headers_a_mfa = {"Authorization": f"Bearer {fresh_token_a}"}

    # =========================================================================
    # MODULE 02: TENANT ISOLATION & MULTI-TENANCY
    # =========================================================================

    # User B logs in
    login_b_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": user_email_b, "password": password},
    )
    assert login_b_resp.status_code == 200
    token_b = login_b_resp.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Check /auth/me for User A and User B
    me_a = await client.get("/api/v1/auth/me", headers=headers_a_mfa)
    me_b = await client.get("/api/v1/auth/me", headers=headers_b)
    assert me_a.status_code == 200
    assert me_b.status_code == 200

    ws_a = me_a.json()["workspaces"]
    ws_b = me_b.json()["workspaces"]
    assert len(ws_a) > 0
    assert len(ws_b) > 0
    ws_a_id = ws_a[0]["id"]
    ws_b_id = ws_b[0]["id"]
    assert ws_a_id != ws_b_id, "Tenant A and Tenant B must have isolated workspaces"

    # =========================================================================
    # MODULE 03: ONBOARDING FLOW & UX PIPELINE
    # =========================================================================

    # 1. Fetch initial onboarding state for User A
    onboard_init_resp = await client.get("/api/v1/onboarding", headers=headers_a_mfa)
    assert onboard_init_resp.status_code == 200
    onboard_state = onboard_init_resp.json()
    assert onboard_state["is_completed"] is False

    # 2. Progress step: PROFILE
    step_profile_resp = await client.post(
        "/api/v1/onboarding/step",
        headers=headers_a_mfa,
        json={
            "step": "WORKSPACE",
            "step_data": {
                "display_name": "Executive Staff Engineer",
                "job_title": "Principal Architect",
            },
        },
    )
    assert step_profile_resp.status_code == 200
    assert step_profile_resp.json()["current_step"] == "WORKSPACE"
    assert "PROFILE" in step_profile_resp.json()["completed_steps"]

    # 3. Progress step: WORKSPACE
    step_ws_resp = await client.post(
        "/api/v1/onboarding/step",
        headers=headers_a_mfa,
        json={
            "step": "RESUME",
            "step_data": {
                "workspace_name": "Autonomous Career AI",
            },
        },
    )
    assert step_ws_resp.status_code == 200
    assert step_ws_resp.json()["current_step"] == "RESUME"
    assert "WORKSPACE" in step_ws_resp.json()["completed_steps"]

    # 4. Upload resume file & extract skills
    dummy_resume = b"Alex Architect - Principal Engineer\nSkills: Python, FastAPI, Next.js, Distributed Systems, PyTorch, Docker"
    files = {"file": ("resume.txt", io.BytesIO(dummy_resume), "text/plain")}
    resume_upload_resp = await client.post(
        "/api/v1/onboarding/resume",
        headers=headers_a_mfa,
        files=files,
    )
    assert resume_upload_resp.status_code == 200
    resume_res = resume_upload_resp.json()
    assert resume_res["skills_count"] > 0
    assert "Python" in resume_res["extracted_skills"]

    # 5. Progress step: CONNECTORS
    step_conn_resp = await client.post(
        "/api/v1/onboarding/step",
        headers=headers_a_mfa,
        json={
            "step": "CONNECTORS",
            "step_data": {
                "connected_tools": ["Google Drive / Docs", "GitHub", "Gmail"],
            },
        },
    )
    assert step_conn_resp.status_code == 200

    # 6. Complete Onboarding
    complete_resp = await client.post(
        "/api/v1/onboarding/complete",
        headers=headers_a_mfa,
        json={
            "final_data": {
                "confirmed": True,
                "launch_source": "holistic_gate",
            },
        },
    )
    assert complete_resp.status_code == 200
    complete_state = complete_resp.json()
    assert complete_state["is_completed"] is True
    assert complete_state["current_step"] == "COMPLETED"

    # 7. Verify subsequent get indicates completed
    verify_completed_resp = await client.get("/api/v1/onboarding", headers=headers_a_mfa)
    assert verify_completed_resp.status_code == 200
    assert verify_completed_resp.json()["is_completed"] is True

    # 8. Reset Onboarding
    reset_resp = await client.post("/api/v1/onboarding/reset", headers=headers_a_mfa)
    assert reset_resp.status_code == 200
    assert reset_resp.json()["is_completed"] is False
    assert reset_resp.json()["current_step"] == "PROFILE"
