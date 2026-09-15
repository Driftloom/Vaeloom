"""CONT-P13 (2026-09-15) — SAML callback fail-closed (WS-13.2 IAM/isolation).

The /api/v1/auth/saml/callback endpoint previously constructed
SAMLProvider(require_signature=False): any well-formed-but-unsigned
assertion could authenticate. Now: 503 unless IdP cert provisioned or
explicit SAML_ALLOW_UNSIGNED=true (dev/IdP-migration windows only).
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_saml_callback_unprovisioned_returns_503(client: AsyncClient, monkeypatch):
    """No IdP cert + no explicit opt-out -> fail closed, no auth issued."""
    monkeypatch.delenv("SAML_IDP_CERTIFICATE", raising=False)
    monkeypatch.delenv("SAML_ALLOW_UNSIGNED", raising=False)
    res = await client.post(
        "/api/v1/auth/saml/callback",
        json={"SAMLResponse": "dGVzdA=="},
    )
    assert res.status_code == 503
    body = res.json()
    text = str(body.get("detail", body.get("message", body))).lower()
    assert "not provisioned" in text


async def test_saml_callback_unsigned_opt_out_reaches_validation(client: AsyncClient, monkeypatch):
    """Explicit SAML_ALLOW_UNSIGNED=true proceeds to validation (401 on garbage)."""
    monkeypatch.setenv("SAML_ALLOW_UNSIGNED", "true")
    monkeypatch.delenv("SAML_IDP_CERTIFICATE", raising=False)
    res = await client.post(
        "/api/v1/auth/saml/callback",
        json={"SAMLResponse": "dGVzdA=="},
    )
    # Garbage is not valid XML -> 401 validation failure, never 503, never 200.
    assert res.status_code == 401


async def test_saml_callback_missing_response_returns_400(client: AsyncClient):
    res = await client.post("/api/v1/auth/saml/callback", json={})
    assert res.status_code == 400
