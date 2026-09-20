"""Zero-Trust Stage 1 Verification Tests (SAML, Vector Store, Onboarding Reset).

Tests strict SAML signature enforcement, vector store tenant isolation guards,
and onboarding reset lifecycle.
"""

import base64
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import settings
from api.infrastructure.vector_store import FallbackVectorStore, VectorRecord

pytestmark = pytest.mark.asyncio


async def test_saml_unsigned_strictly_rejected_even_with_env(client: AsyncClient, monkeypatch):
    """Verify that unsigned SAML assertions are strictly rejected even if SAML_ALLOW_UNSIGNED=true."""
    monkeypatch.setenv("SAML_ALLOW_UNSIGNED", "true")

    malicious_saml = """
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp1" Version="2.0">
        <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1" Version="2.0">
            <saml:Subject>
                <saml:NameID>admin@target-company.com</saml:NameID>
            </saml:Subject>
        </saml:Assertion>
    </samlp:Response>
    """
    b64_payload = base64.b64encode(malicious_saml.encode()).decode()

    res = await client.post(
        "/api/v1/auth/saml/callback",
        data={"SAMLResponse": b64_payload},
    )
    # ZERO-TRUST: Must fail closed (401 or 503), never allow unsigned authentication
    assert res.status_code in (401, 503)


async def test_vector_store_fail_closed_without_tenant_filter():
    """Verify that vector searches without tenant_id or workspace_id strictly fail closed."""
    store = FallbackVectorStore()
    vec = [0.1] * 1536

    # Upsert a sample vector
    await store.upsert([
        VectorRecord(id="rec-1", vector=vec, metadata={"workspace_id": "ws-123", "text": "secret"}),
    ])

    # 1. Search without filters -> must raise ValueError
    with pytest.raises(ValueError, match="Zero-Trust violation: vector search must specify tenant_id or workspace_id filter"):
        await store.search(query_vector=vec, filters=None)

    # 2. Search with empty dict -> must raise ValueError
    with pytest.raises(ValueError, match="Zero-Trust violation: vector search must specify tenant_id or workspace_id filter"):
        await store.search(query_vector=vec, filters={})

    # 3. Search with unrelated filter (e.g. source_type) -> must raise ValueError
    with pytest.raises(ValueError, match="Zero-Trust violation: vector search must specify tenant_id or workspace_id filter"):
        await store.search(query_vector=vec, filters={"source_type": "resume"})

    # 4. Search with workspace_id -> succeeds
    results = await store.search(query_vector=vec, filters={"workspace_id": "ws-123"})
    assert len(results) == 1
    assert results[0].id == "rec-1"


async def test_onboarding_reset_lifecycle(client: AsyncClient):
    """Verify that onboarding can be cleanly reset back to PROFILE step."""
    test_email = f"onb_reset_{uuid.uuid4().hex[:8]}@vaeloom.test"

    # 1. Sign up
    res = await client.post(
        "/api/v1/auth/signup",
        json={"email": test_email, "password": "Password123!", "display_name": "Reset Tester"},
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Advance through all steps and complete
    await client.post("/api/v1/onboarding/step", headers=headers, json={"step": "WORKSPACE", "step_data": {"workspace_name": "W1"}})
    await client.post("/api/v1/onboarding/step", headers=headers, json={"step": "RESUME", "step_data": {"skills": "Python"}})
    await client.post("/api/v1/onboarding/step", headers=headers, json={"step": "CONNECTORS", "step_data": {}})
    complete_res = await client.post("/api/v1/onboarding/complete", headers=headers, json={"final_data": {}})
    assert complete_res.status_code == 200
    assert complete_res.json()["is_completed"] is True

    # 3. Call /onboarding/reset
    reset_res = await client.post("/api/v1/onboarding/reset", headers=headers)
    assert reset_res.status_code == 200
    data = reset_res.json()
    assert data["current_step"] == "PROFILE"
    assert data["completed_steps"] == []
    assert data["is_completed"] is False
    assert data["step_data"] == {}
