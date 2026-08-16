import base64
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

from xml.etree.ElementTree import ParseError as XMLParseError

SAML_XMLNS = "urn:oasis:names:tc:SAML:2.0:assertion"
SAML_PROTOCOL = "urn:oasis:names:tc:SAML:2.0:protocol"


class SAMLValidationError(Exception):
    pass


class SAMLProvider:
    def __init__(self, expected_issuer: str, allowed_audiences: list[str] | None = None):
        self.expected_issuer = expected_issuer
        self.allowed_audiences = allowed_audiences or []

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

    def validate_assertion(self, assertion: ET.Element, expected_issuer: str | None = None) -> dict[str, Any]:
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

        # TODO: Add real SAML signature validation when library configured (e.g. signxml)
        # The signature element is embedded in the assertion; real validation requires
        # the IdP's public certificate and proper XML signature validation.
        sig_el = assertion.find(f".//{{{SAML_XMLNS}}}Signature")
        if sig_el is not None:
            pass  # signature present but not validated without xmlsec library

        return self.extract_user_info(assertion)

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
