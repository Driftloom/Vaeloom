"""Zero-Trust Gap Tests: Module 03 (Onboarding).

Covers:
- TEST-ONB-SEC-01: Strict step progression (no jumping ahead without prerequisites).
- TEST-ONB-SEC-02: Step data sanitization and schema bounds.
- TEST-ONB-SEC-03: Onboarding immutability post-completion.
"""
import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_onboarding_strict_step_progression(client: AsyncClient):
    """TEST-ONB-SEC-01: Verify user cannot jump from PROFILE directly to CONNECTORS/COMPLETED."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "jump_step@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Jump Step User",
        },
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]

    # Initial state is PROFILE
    init_res = await client.get("/api/v1/onboarding", headers={"Authorization": f"Bearer {token}"})
    assert init_res.status_code == 200
    assert init_res.json()["current_step"] == "PROFILE"

    # User attempts to skip WORKSPACE and RESUME directly to CONNECTORS
    jump_res = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "CONNECTORS", "step_data": {"gmail": True}},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Under strict zero-trust validation, skipping prerequisite steps should return 400
    assert jump_res.status_code == 400
    assert "prerequisite" in jump_res.text.lower()


@pytest.mark.asyncio
async def test_onboarding_step_data_sanitization_and_schema(client: AsyncClient):
    """TEST-ONB-SEC-02: Verify step_data rejects oversized / corrupt payloads."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "step_data_user@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Step Data User",
        },
    )
    token = signup_res.json()["access_token"]

    # Attempt to post a 1MB payload into step_data
    massive_data = {"junk": "X" * 1000000}
    res = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "WORKSPACE", "step_data": massive_data},
        headers={"Authorization": f"Bearer {token}"},
    )
    # System should either handle cleanly or reject oversized body (413/422/400), never unhandled 500
    assert res.status_code in (200, 400, 413, 422)


@pytest.mark.asyncio
async def test_onboarding_immutable_post_completion(client: AsyncClient):
    """TEST-ONB-SEC-03: Verify onboarding state cannot be mutated once marked completed."""
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "complete_user@vaeloom.test",
            "password": "StrongPassword123!",
            "display_name": "Completed User",
        },
    )
    token = signup_res.json()["access_token"]

    # Complete onboarding
    comp_res = await client.post(
        "/api/v1/onboarding/complete",
        json={"final_data": {"role": "Architect"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["is_completed"] is True

    # Attempt to mutate step after completion
    post_comp_res = await client.post(
        "/api/v1/onboarding/step",
        json={"step": "PROFILE", "step_data": {"displayName": "Hacked Profile"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Under zero-trust immutability, mutating after completion must be rejected with 400
    assert post_comp_res.status_code == 400
    assert "completed" in post_comp_res.text.lower()


@pytest.mark.asyncio
async def test_unauthorized_workspace_join_rejected(client: AsyncClient):
    """TEST-ONB-SEC-04: Verify User B cannot join Workspace A without ownership or invitation."""
    # User A creates Workspace A
    res_a = await client.post(
        "/api/v1/auth/signup",
        json={"email": "ws_owner@vaeloom.test", "password": "Password123!", "display_name": "Owner A"},
    )
    token_a = res_a.json()["access_token"]
    ws_res = await client.post(
        "/api/v1/workspaces",
        json={"name": "Owner A Private WS"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    ws_a_id = ws_res.json()["id"]

    # User B signs up
    res_b = await client.post(
        "/api/v1/auth/signup",
        json={"email": "ws_intruder@vaeloom.test", "password": "Password123!", "display_name": "Intruder B"},
    )
    token_b = res_b.json()["access_token"]

    # User B attempts to join Workspace A via /api/v1/onboarding/join without invitation
    join_res = await client.post(
        "/api/v1/onboarding/join",
        json={"workspace_id": ws_a_id},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert join_res.status_code == 403
    assert "invited" in join_res.text.lower() or "forbidden" in join_res.text.lower()


@pytest.mark.asyncio
async def test_resume_magic_byte_spoofing_rejected(client: AsyncClient):
    """TEST-ONB-SEC-05: Verify resume upload rejects file with spoofed extension and invalid magic bytes."""
    import io
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": "resume_spoof@vaeloom.test", "password": "Password123!", "display_name": "Resume Spoofer"},
    )
    token = res.json()["access_token"]

    # Upload fake PDF with executable magic bytes
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    files = {"file": ("malicious.pdf", io.BytesIO(fake_exe), "application/pdf")}
    upload_res = await client.post(
        "/api/v1/onboarding/resume",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert upload_res.status_code == 400
    assert "magic bytes" in upload_res.text.lower() or "signature" in upload_res.text.lower()
