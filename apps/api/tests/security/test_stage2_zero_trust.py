"""Zero-Trust Stage 2 Verification Tests (Password Entropy, SCIM Tenant Isolation, Onboarding Resume).

Tests:
1. Password entropy enforcement & common breached password rejection.
2. Per-tenant SCIM token provisioning, tenant-scoped user CRUD, and cross-tenant enumeration rejection.
3. Onboarding resume upload, format validation, and automated skill extraction.
"""

import io
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Tenant, User

pytestmark = pytest.mark.asyncio


async def test_password_entropy_enforcement(client: AsyncClient):
    """Verify that common breached passwords and low entropy passwords are strictly rejected."""
    # 1. Common breached password: "password123"
    res1 = await client.post(
        "/api/v1/auth/signup",
        json={"email": "weak1@vaeloom.test", "password": "password123"},
    )
    assert res1.status_code == 422
    assert "Password is too common" in res1.text

    # 2. Common breached password: "admin123"
    res2 = await client.post(
        "/api/v1/auth/signup",
        json={"email": "weak2@vaeloom.test", "password": "admin123"},
    )
    assert res2.status_code == 422
    assert "Password is too common" in res2.text

    # 3. No numbers or special characters (all letters)
    res3 = await client.post(
        "/api/v1/auth/signup",
        json={"email": "weak3@vaeloom.test", "password": "onlylettershere"},
    )
    assert res3.status_code == 422
    assert "at least one digit or special character" in res3.text

    # 4. Valid strong password
    res4 = await client.post(
        "/api/v1/auth/signup",
        json={"email": "strong_user@vaeloom.test", "password": "VaeloomSecure2026!", "display_name": "Strong User"},
    )
    assert res4.status_code == 201
    assert "access_token" in res4.json()


async def test_scim_per_tenant_isolation(client: AsyncClient, db_session: AsyncSession):
    """Verify that SCIM tokens are strictly bound to a tenant and cannot read or mutate other tenants' users."""
    # 1. Create two distinct tenants
    tenant_a = Tenant(name="Acme Corp", slug=f"acme-{uuid.uuid4().hex[:6]}")
    tenant_b = Tenant(name="Beta Labs", slug=f"beta-{uuid.uuid4().hex[:6]}")
    db_session.add_all([tenant_a, tenant_b])
    await db_session.commit()
    await db_session.refresh(tenant_a)
    await db_session.refresh(tenant_b)

    # 2. Generate SCIM tokens for both tenants
    res_tok_a = await client.post(f"/scim/tokens?tenant_id={tenant_a.id}&name=TokenA")
    assert res_tok_a.status_code == 201
    token_a = res_tok_a.json()["token"]

    res_tok_b = await client.post(f"/scim/tokens?tenant_id={tenant_b.id}&name=TokenB")
    assert res_tok_b.status_code == 201
    token_b = res_tok_b.json()["token"]

    # 3. Tenant A provisions a user via SCIM
    user_a_email = f"user_a_{uuid.uuid4().hex[:6]}@acme.test"
    create_res = await client.post(
        "/scim/v2/Users",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "userName": user_a_email,
            "name": {"formatted": "Alice Acme"},
            "active": True,
        },
    )
    assert create_res.status_code == 201
    user_a_id = create_res.json()["id"]

    # 4. Tenant A lists users -> sees User A
    list_res_a = await client.get(
        "/scim/v2/Users",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert list_res_a.status_code == 200
    user_ids_a = [u["id"] for u in list_res_a.json()["Resources"]]
    assert user_a_id in user_ids_a

    # 5. ZERO-TRUST: Tenant B lists users -> must NOT see User A!
    list_res_b = await client.get(
        "/scim/v2/Users",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert list_res_b.status_code == 200
    user_ids_b = [u["id"] for u in list_res_b.json()["Resources"]]
    assert user_a_id not in user_ids_b

    # 6. ZERO-TRUST: Tenant B attempts to read User A directly -> 404
    get_res_b = await client.get(
        f"/scim/v2/Users/{user_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_res_b.status_code == 404

    # 7. ZERO-TRUST: Tenant B attempts to delete User A directly -> 404
    del_res_b = await client.delete(
        f"/scim/v2/Users/{user_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_res_b.status_code == 404


async def test_onboarding_resume_upload_and_extraction(client: AsyncClient):
    """Verify resume upload parses text, extracts skills, and updates onboarding state."""
    # 1. Sign up user
    email = f"resume_tester_{uuid.uuid4().hex[:6]}@vaeloom.test"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "VaeloomSecure2026!", "display_name": "Resume Tester"},
    )
    assert signup_res.status_code == 201
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Upload unpermitted extension (.exe) -> 400
    bad_file = {"file": ("malicious.exe", io.BytesIO(b"binarycontent"), "application/octet-stream")}
    bad_res = await client.post("/api/v1/onboarding/resume", headers=headers, files=bad_file)
    assert bad_res.status_code == 400
    assert "Unsupported file type" in bad_res.text

    # 3. Upload valid text resume containing skills
    resume_text = (
        "Experienced Principal Engineer with expertise in Python, FastAPI, TypeScript, React, "
        "and distributed architectures using Docker, Kubernetes, and PostgreSQL. "
        "Built AI systems with LangChain and OpenAI."
    )
    files = {"file": ("resume.txt", io.BytesIO(resume_text.encode()), "text/plain")}
    res = await client.post("/api/v1/onboarding/resume", headers=headers, files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["filename"] == "resume.txt"
    assert "Python" in data["extracted_skills"]
    assert "FastAPI" in data["extracted_skills"]
    assert "Docker" in data["extracted_skills"]
    assert "Kubernetes" in data["extracted_skills"]
    assert "React" in data["extracted_skills"]
    assert data["skills_count"] >= 5

    # 4. Check that onboarding state has RESUME in completed_steps
    state = data["state"]
    assert "RESUME" in state["completed_steps"]
    assert "resume" in state["step_data"]
    assert state["step_data"]["resume"]["filename"] == "resume.txt"
