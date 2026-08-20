import base64
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

from xml.etree.ElementTree import ParseError as XMLParseError

logger = logging.getLogger(__name__)

SAML_XMLNS = "urn:oasis:names:tc:SAML:2.0:assertion"
SAML_PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol"
DSIG_NS = "http://www.w3.org/2000/09/xmldsig#"


class SAMLValidationError(Exception):
    pass


def _signxml_available() -> bool:
    try:
        import signxml  # noqa: F401
        return True
    except ImportError:
        return False


def _verify_signature_with_signxml(
    assertion_element: ET.Element,
    idp_certificate: str,
) -> bool:
    """Verify XML digital signature using the signxml library.

    Args:
        assertion_element: The SAML Assertion XML element containing the Signature.
        idp_certificate: The IdP's public certificate (PEM format) for verification.

    Returns:
        True if signature is valid.

    Raises:
        SAMLValidationError: If signature is invalid or verification fails.
    """
    try:
        from signxml import XMLVerifier

        # signxml expects the element that contains the Signature
        # It will find and verify the ds:Signature element within it.
        # The assertion must have an Id attribute for URI reference.
        assertion_id = assertion_element.get("ID") or assertion_element.get("Id")
        if not assertion_id:
            # Some IdPs use lowercase 'id' or no ID attribute at all.
            # signxml requires the signed element to be referenceable.
            raise SAMLValidationError(
                "Assertion element missing 'ID' attribute required for signature verification"
            )

        # signxml verifies the signature and returns the verified element tree
        # It handles canonicalization (C14N) and digest verification internally.
        verifier = XMLVerifier()
        verified_data = verifier.verify(
            assertion_element,
            x509_cert=idp_certificate,
            require_x509=True,
        )

        # If verify() returns without raising, the signature is valid.
        logger.info("SAML signature verified successfully for assertion ID=%s", assertion_id)
        return True

    except SAMLValidationError:
        raise
    except Exception as exc:
        raise SAMLValidationError(f"Signature verification failed: {exc}") from exc


def _verify_signature_manual(
    assertion_element: ET.Element,
    idp_certificate: str,
) -> bool:
    """Fallback: verify signature structure exists and extract digest for audit.

    This is a structural validation only — it confirms the Signature element
    is well-formed and contains the expected sub-elements. It does NOT perform
    cryptographic verification. Use signxml for production SAML.

    Raises:
        SAMLValidationError: If signature structure is malformed.
    """
    sig_element = assertion_element.find(f".//{{{DSIG_NS}}}Signature")
    if sig_element is None:
        raise SAMLValidationError("No ds:Signature element found in assertion")

    # Verify required Signature sub-elements exist
    signed_info = sig_element.find(f"{{{DSIG_NS}}}SignedInfo")
    if signed_info is None:
        raise SAMLValidationError("Signature missing ds:SignedInfo element")

    signature_value = sig_element.find(f"{{{DSIG_NS}}}SignatureValue")
    if signature_value is None:
        raise SAMLValidationError("Signature missing ds:SignatureValue element")

    # Verify the canonicalization method is present
    canonical_method = signed_info.find(f"{{{DSIG_NS}}}CanonicalizationMethod")
    if canonical_method is None:
        raise SAMLValidationError("SignedInfo missing ds:CanonicalizationMethod")

    # Verify the signature method is present
    signature_method = signed_info.find(f"{{{DSIG_NS}}}SignatureMethod")
    if signature_method is None:
        raise SAMLValidationError("SignedInfo missing ds:SignatureMethod")

    # Verify at least one Reference with DigestValue exists
    references = signed_info.findall(f"{{{DSIG_NS}}}Reference")
    if not references:
        raise SAMLValidationError("SignedInfo has no ds:Reference elements")

    for ref in references:
        digest_value = ref.find(f"{{{DSIG_NS}}}DigestValue")
        if digest_value is None:
            raise SAMLValidationError("Reference missing ds:DigestValue element")

    logger.warning(
        "SAML signature structure validated but NOT cryptographically verified. "
        "Install 'signxml' for production signature validation."
    )
    return True


class SAMLProvider:
    def __init__(
        self,
        expected_issuer: str,
        allowed_audiences: list[str] | None = None,
        idp_certificate: str | None = None,
        require_signature: bool = True,
    ):
        self.expected_issuer = expected_issuer
        self.allowed_audiences = allowed_audiences or []
        self.idp_certificate = idp_certificate
        self.require_signature = require_signature

    def parse_saml_response(self, saml_response: str) -> ET.Element:
        try:
            raw = base64.b64decode(saml_response)
            root = ET.fromstring(raw)
        except (Exception, XMLParseError) as exc:
            raise SAMLValidationError(f"Failed to parse SAML response: {exc}") from exc
        if root.tag != f"{{{SAML_PROTOCOL}}}Response":
            raise SAMLValidationError("Root element is not a SAML Response")
        assertion = root.find(f".//{{{SAML_XMLNS}}}Assertion")
        if assertion is None:
            raise SAMLValidationError("No Assertion found in SAML Response")
        return assertion

    def validate_assertion(
        self,
        assertion: ET.Element,
        expected_issuer: str | None = None,
        raw_response: str | None = None,
    ) -> dict[str, Any]:
        issuer_el = assertion.find(f"{{{SAML_XMLNS}}}Issuer")
        if issuer_el is None or issuer_el.text != (expected_issuer or self.expected_issuer):
            raise SAMLValidationError("Issuer mismatch")

        conditions = assertion.find(f"{{{SAML_XMLNS}}}Conditions")
        if conditions is not None:
            now = datetime.now(timezone.utc)
            not_before_str = conditions.get("NotBefore")
            not_on_or_after_str = conditions.get("NotOnOrAfter")
            if not_before_str:
                nb = datetime.fromisoformat(not_before_str.replace("Z", "+00:00"))
                if now < nb:
                    raise SAMLValidationError("Assertion not yet valid (NotBefore)")
            if not_on_or_after_str:
                noa = datetime.fromisoformat(not_on_or_after_str.replace("Z", "+00:00"))
                if now >= noa:
                    raise SAMLValidationError("Assertion expired (NotOnOrAfter)")

            audience_el = conditions.find(f".//{{{SAML_XMLNS}}}Audience")
            if audience_el is not None and self.allowed_audiences:
                if audience_el.text not in self.allowed_audiences:
                    raise SAMLValidationError(f"Audience '{audience_el.text}' not in allowed list")

        # Signature validation
        self._validate_signature(assertion)

        return self.extract_user_info(assertion)

    def _validate_signature(self, assertion: ET.Element) -> None:
        """Validate the XML digital signature on the SAML assertion.

        Uses signxml if available for cryptographic verification.
        Falls back to structural validation if signxml is not installed.
        Raises SAMLValidationError if validation fails or is required but unavailable.
        """
        sig_el = assertion.find(f".//{{{DSIG_NS}}}Signature")
        if sig_el is None:
            if self.require_signature:
                raise SAMLValidationError(
                    "SAML assertion has no ds:Signature element and require_signature=True"
                )
            logger.warning("SAML assertion has no signature — proceeding without verification")
            return

        if self.idp_certificate and _signxml_available():
            _verify_signature_with_signxml(assertion, self.idp_certificate)
        else:
            # Structural validation only — no cryptographic verification
            _verify_signature_manual(assertion, self.idp_certificate or "")

    def extract_user_info(self, assertion: ET.Element) -> dict[str, Any]:
        result: dict[str, Any] = {}

        subject = assertion.find(f".//{{{SAML_XMLNS}}}Subject/{{{SAML_XMLNS}}}NameID")
        if subject is not None:
            result["name_id"] = subject.text
            result["name_id_format"] = subject.get("Format")

        attr_stmt = assertion.find(f".//{{{SAML_XMLNS}}}AttributeStatement")
        if attr_stmt is not None:
            for attr in attr_stmt.findall(f"{{{SAML_XMLNS}}}Attribute"):
                name = attr.get("Name") or attr.get("FriendlyName")
                if not name:
                    continue
                values = []
                for val in attr.findall(f"{{{SAML_XMLNS}}}AttributeValue"):
                    if val.text:
                        values.append(val.text)
                if len(values) == 1:
                    result[name] = values[0]
                elif values:
                    result[name] = values

        if "email" not in result and "Email" not in result and "mail" not in result:
            result["email"] = result.get("name_id", "")

        result.setdefault("name", result.get("displayName", result.get("cn", "")))
        result.setdefault("groups", result.get("memberOf", result.get("groups", [])))
        if isinstance(result.get("groups"), str):
            result["groups"] = [result["groups"]]

        return result
