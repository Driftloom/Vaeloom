"""Unit and integration tests for SAML 2.0 endpoints (/metadata, /login, /callback)."""

import pytest
from httpx import AsyncClient
import xml.etree.ElementTree as ET


@pytest.mark.asyncio
async def test_saml_metadata_endpoint(client: AsyncClient):
    """GET /api/v1/auth/saml/metadata returns valid SAML 2.0 XML metadata."""
    res = await client.get("/api/v1/auth/saml/metadata")
    assert res.status_code == 200
    assert "application/xml" in res.headers.get("content-type", "")

    xml_text = res.text
    assert "<md:EntityDescriptor" in xml_text
    assert "AssertionConsumerService" in xml_text
    assert "/api/v1/auth/saml/callback" in xml_text

    # Parse XML to guarantee valid syntax
    root = ET.fromstring(xml_text)
    assert root.tag.endswith("EntityDescriptor")


@pytest.mark.asyncio
async def test_saml_login_unprovisioned_returns_503(client: AsyncClient, monkeypatch):
    """GET /api/v1/auth/saml/login returns 503 fail-closed when IdP is not configured."""
    monkeypatch.delenv("SAML_IDP_SSO_URL", raising=False)
    res = await client.get("/api/v1/auth/saml/login")
    assert res.status_code == 503
    body = res.json()
    err_msg = str(body.get("detail") or (body.get("error") or {}).get("message") or body).lower()
    assert "not provisioned" in err_msg


@pytest.mark.asyncio
async def test_saml_login_redirects_to_idp(client: AsyncClient, monkeypatch):
    """GET /api/v1/auth/saml/login redirects to IdP SSO URL with SAMLRequest."""
    idp_url = "https://idp.okta.com/app/vaeloom/sso/saml"
    monkeypatch.setenv("SAML_IDP_SSO_URL", idp_url)

    res = await client.get("/api/v1/auth/saml/login?redirect_url=/dashboard", follow_redirects=False)
    assert res.status_code == 302
    location = res.headers.get("location", "")
    assert location.startswith(idp_url)
    assert "SAMLRequest=" in location
    assert "RelayState=%2Fdashboard" in location or "RelayState=/dashboard" in location
