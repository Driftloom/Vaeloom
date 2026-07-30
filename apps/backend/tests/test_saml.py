import base64
from datetime import datetime, timedelta, timezone

import pytest

from backend.services.saml import SAMLProvider, SAMLValidationError

SAML_ASSERTION_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="response123" Version="2.0"
                IssueInstant="{issue_instant}">
  <saml:Issuer>{issuer}</saml:Issuer>
  <saml:Assertion ID="assertion123" Version="2.0"
                  IssueInstant="{issue_instant}">
    <saml:Issuer>{issuer}</saml:Issuer>
    <saml:Conditions NotBefore="{not_before}"
                     NotOnOrAfter="{not_on_or_after}">
      <saml:AudienceRestriction>
        <saml:Audience>{audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">{name_id}</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="email" FriendlyName="email">
        <saml:AttributeValue>{email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="displayName" FriendlyName="displayName">
        <saml:AttributeValue>{display_name}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="memberOf" FriendlyName="memberOf">
        <saml:AttributeValue>{group1}</saml:AttributeValue>
        <saml:AttributeValue>{group2}</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>"""


def _build_saml_response(**kwargs) -> str:
    now = datetime.now(timezone.utc)
    defaults = {
        "issue_instant": now.isoformat(),
        "issuer": "https://idp.example.com",
        "not_before": (now - timedelta(minutes=5)).isoformat(),
        "not_on_or_after": (now + timedelta(hours=1)).isoformat(),
        "audience": "https://sp.example.com",
        "name_id": "user@example.com",
        "email": "user@example.com",
        "display_name": "Test User",
        "group1": "Admins",
        "group2": "Developers",
    }
    defaults.update(kwargs)
    xml = SAML_ASSERTION_TEMPLATE.format(**defaults)
    return base64.b64encode(xml.encode()).decode()


class TestParseSamlResponse:
    def test_parses_valid_response(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        assert assertion.tag.endswith("Assertion")

    def test_rejects_invalid_xml(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        bad_b64 = base64.b64encode(b"not xml").decode()
        with pytest.raises(SAMLValidationError):
            provider.parse_saml_response(bad_b64)

    def test_rejects_missing_assertion(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        xml = '<?xml version="1.0"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="r1" Version="2.0"/>'
        encoded = base64.b64encode(xml.encode()).decode()
        with pytest.raises(SAMLValidationError, match="No Assertion"):
            provider.parse_saml_response(encoded)


class TestValidateAssertion:
    def test_valid_assertion(self):
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            allowed_audiences=["https://sp.example.com"],
        )
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        info = provider.validate_assertion(assertion)
        assert info["email"] == "user@example.com"
        assert info["name"] == "Test User"
        assert "Admins" in info["groups"]

    def test_rejects_issuer_mismatch(self):
        provider = SAMLProvider(expected_issuer="https://wrong-issuer.com")
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="Issuer mismatch"):
            provider.validate_assertion(assertion)

    def test_rejects_expired_assertion(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        past = datetime.now(timezone.utc) - timedelta(hours=2)
        encoded = _build_saml_response(
            not_before=(past - timedelta(hours=1)).isoformat(),
            not_on_or_after=past.isoformat(),
        )
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="expired"):
            provider.validate_assertion(assertion)

    def test_rejects_future_assertion(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        future = datetime.now(timezone.utc) + timedelta(hours=2)
        encoded = _build_saml_response(
            not_before=future.isoformat(),
            not_on_or_after=(future + timedelta(hours=1)).isoformat(),
        )
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="not yet valid"):
            provider.validate_assertion(assertion)

    def test_rejects_audience_mismatch(self):
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            allowed_audiences=["https://other-sp.com"],
        )
        encoded = _build_saml_response(audience="https://sp.example.com")
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="Audience"):
            provider.validate_assertion(assertion)


class TestExtractUserInfo:
    def test_extracts_all_attributes(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        info = provider.extract_user_info(assertion)
        assert info["email"] == "user@example.com"
        assert info["name_id"] == "user@example.com"
        assert info["name"] == "Test User"
        assert info["groups"] == ["Admins", "Developers"]

    def test_falls_back_to_name_id(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com")
        encoded = _build_saml_response(email="", display_name="")
        assertion = provider.parse_saml_response(encoded)
        info = provider.extract_user_info(assertion)
        assert info["email"] == "user@example.com"
