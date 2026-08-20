import base64
from datetime import datetime, timedelta, timezone

import pytest

from api.services.saml import SAMLProvider, SAMLValidationError, SAML_XMLNS, SAML_PROTOCOL

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


def _build_xml_with_signature() -> str:
    """Build a SAML response with a structural (non-cryptographic) Signature element."""
    now = datetime.now(timezone.utc)
    not_before = (now - timedelta(minutes=5)).isoformat()
    not_on_or_after = (now + timedelta(hours=1)).isoformat()
    issue_instant = now.isoformat()
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"'
        ' xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"'
        ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"'
        f' ID="response123" Version="2.0" IssueInstant="{issue_instant}">'
        '<saml:Issuer>https://idp.example.com</saml:Issuer>'
        f'<saml:Assertion ID="assertion123" Version="2.0" IssueInstant="{issue_instant}">'
        '<saml:Issuer>https://idp.example.com</saml:Issuer>'
        f'<saml:Conditions NotBefore="{not_before}" NotOnOrAfter="{not_on_or_after}">'
        '<saml:AudienceRestriction><saml:Audience>https://sp.example.com</saml:Audience>'
        '</saml:AudienceRestriction></saml:Conditions>'
        '<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">'
        'user@example.com</saml:NameID></saml:Subject>'
        '<ds:Signature><ds:SignedInfo>'
        '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>'
        '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>'
        '<ds:Reference URI="#assertion123">'
        '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>'
        '<ds:DigestValue>dGVzdA==</ds:DigestValue>'
        '</ds:Reference></ds:SignedInfo>'
        '<ds:SignatureValue>bm90X3ZhbGlk</ds:SignatureValue>'
        '</ds:Signature>'
        '<saml:AttributeStatement>'
        '<saml:Attribute Name="email" FriendlyName="email">'
        '<saml:AttributeValue>user@example.com</saml:AttributeValue>'
        '</saml:Attribute></saml:AttributeStatement>'
        '</saml:Assertion></samlp:Response>'
    )
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
            require_signature=False,
        )
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        info = provider.validate_assertion(assertion)
        assert info["email"] == "user@example.com"
        assert info["name"] == "Test User"
        assert "Admins" in info["groups"]

    def test_rejects_issuer_mismatch(self):
        provider = SAMLProvider(expected_issuer="https://wrong-issuer.com", require_signature=False)
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="Issuer mismatch"):
            provider.validate_assertion(assertion)

    def test_rejects_expired_assertion(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com", require_signature=False)
        past = datetime.now(timezone.utc) - timedelta(hours=2)
        encoded = _build_saml_response(
            not_before=(past - timedelta(hours=1)).isoformat(),
            not_on_or_after=past.isoformat(),
        )
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="expired"):
            provider.validate_assertion(assertion)

    def test_rejects_future_assertion(self):
        provider = SAMLProvider(expected_issuer="https://idp.example.com", require_signature=False)
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
            require_signature=False,
        )
        encoded = _build_saml_response(audience="https://sp.example.com")
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="Audience"):
            provider.validate_assertion(assertion)

    def test_rejects_missing_signature_when_required(self):
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            require_signature=True,
        )
        encoded = _build_saml_response()
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="no ds:Signature"):
            provider.validate_assertion(assertion)

    def test_rejects_signature_when_no_idp_cert_and_no_structural_flag(self):
        """Without signxml, idp_certificate, or SAML_ALLOW_STRUCTURAL_FALLBACK, must reject."""
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            require_signature=True,
            idp_certificate=None,
        )
        encoded = _build_xml_with_signature()  # already base64-encoded
        assertion = provider.parse_saml_response(encoded)
        import os
        old_val = os.environ.pop("SAML_ALLOW_STRUCTURAL_FALLBACK", None)
        try:
            with pytest.raises(SAMLValidationError, match="requires signxml"):
                provider.validate_assertion(assertion)
        finally:
            if old_val is not None:
                os.environ["SAML_ALLOW_STRUCTURAL_FALLBACK"] = old_val


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


class TestSamlCryptographicSignature:
    """End-to-end signxml cryptographic signature verification (positive + negative)."""

    @staticmethod
    def _make_test_idp():
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509 import (
            CertificateBuilder,
            Name,
            NameAttribute,
            random_serial_number,
        )
        from cryptography.x509.oid import NameOID

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = Name([NameAttribute(NameOID.COMMON_NAME, "vaeloom-test-idp")])
        now = datetime.now(timezone.utc)
        cert = (
            CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(random_serial_number())
            .not_valid_before(now - timedelta(days=1))
            .not_valid_after(now + timedelta(days=365))
            .sign(key, hashes.SHA256())
        )
        pem = cert.public_bytes(serialization.Encoding.PEM).decode()
        return key, cert, pem

    @staticmethod
    def _build_signed_response(key, cert, pem) -> str:
        pytest.importorskip("signxml")
        from lxml import etree as lxml_etree

        import signxml
        from signxml import XMLSigner

        now = datetime.now(timezone.utc)
        assertion_xml = (
            '<?xml version="1.0"?>'
            f'<saml:Assertion xmlns:saml="{SAML_XMLNS}" ID="assertion123" Version="2.0" '
            f'IssueInstant="{now.isoformat()}">'
            f'<saml:Issuer>https://idp.example.com</saml:Issuer>'
            f'<saml:Conditions NotBefore="{(now - timedelta(minutes=5)).isoformat()}" '
            f'NotOnOrAfter="{(now + timedelta(hours=1)).isoformat()}">'
            '<saml:AudienceRestriction><saml:Audience>https://sp.example.com</saml:Audience>'
            '</saml:AudienceRestriction></saml:Conditions>'
            '<saml:Subject><saml:NameID '
            'Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">'
            'user@example.com</saml:NameID></saml:Subject>'
            '<saml:AttributeStatement>'
            '<saml:Attribute Name="email" FriendlyName="email">'
            '<saml:AttributeValue>user@example.com</saml:AttributeValue></saml:Attribute>'
            '<saml:Attribute Name="displayName" FriendlyName="displayName">'
            '<saml:AttributeValue>Test User</saml:AttributeValue></saml:Attribute>'
            '</saml:AttributeStatement>'
            '</saml:Assertion>'
        )
        root = lxml_etree.fromstring(assertion_xml.encode())
        signer = XMLSigner(
            method=signxml.methods.enveloped,
            signature_algorithm="rsa-sha256",
            c14n_algorithm="http://www.w3.org/2001/10/xml-exc-c14n#",
        )
        signed = signer.sign(root, key=key, cert=pem.encode())
        signed_bytes = lxml_etree.tostring(signed)
        wrapper = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<samlp:Response xmlns:samlp="{SAML_PROTOCOL}" xmlns:saml="{SAML_XMLNS}" '
            f'ID="resp123" Version="2.0" IssueInstant="{now.isoformat()}">'
            '<saml:Issuer>https://idp.example.com</saml:Issuer>'
            f"{signed_bytes.decode()}"
            '</samlp:Response>'
        )
        return base64.b64encode(wrapper.encode()).decode()

    def test_accepts_cryptographically_valid_signature(self):
        pytest.importorskip("signxml")
        key, cert, pem = self._make_test_idp()
        encoded = self._build_signed_response(key, cert, pem)
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            allowed_audiences=["https://sp.example.com"],
            idp_certificate=pem,
            require_signature=True,
        )
        assertion = provider.parse_saml_response(encoded)
        info = provider.validate_assertion(assertion)
        assert info["email"] == "user@example.com"
        assert info["name"] == "Test User"

    def test_rejects_tampered_signature(self):
        pytest.importorskip("signxml")
        key, cert, pem = self._make_test_idp()
        signed_bytes = bytearray(
            base64.b64decode(self._build_signed_response(key, cert, pem))
        )
        marker = b"<ds:SignatureValue>"
        start = signed_bytes.find(marker)
        assert start != -1
        end = signed_bytes.find(b"</ds:SignatureValue>", start)
        body = signed_bytes[start + len(marker):end]
        new_body = (b"A" if not body.startswith(b"A") else b"B") + body[1:]
        signed_bytes[start + len(marker):end] = new_body
        encoded = base64.b64encode(bytes(signed_bytes)).decode()
        provider = SAMLProvider(
            expected_issuer="https://idp.example.com",
            idp_certificate=pem,
            require_signature=True,
        )
        assertion = provider.parse_saml_response(encoded)
        with pytest.raises(SAMLValidationError, match="Signature verification failed"):
            provider.validate_assertion(assertion)
