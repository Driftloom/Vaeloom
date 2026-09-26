import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx
import jwt
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class SSOConfig(BaseModel):
    issuer: str
    client_id: str
    client_secret: str


class SSOProvider(ABC):
    def __init__(self, config: SSOConfig):
        self.config = config

    @abstractmethod
    async def validate_token(self, token: str) -> dict[str, Any] | None:
        ...

    @abstractmethod
    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
        ...


class GoogleSSOProvider(SSOProvider):
    JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"

    async def validate_token(self, token: str) -> dict[str, Any] | None:
        try:
            jwks_client = jwt.PyJWKClient(self.JWKS_URI)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.config.client_id,
                issuer="https://accounts.google.com",
                options={"verify_iss": True},
            )
            iss = payload.get("iss", "")
            if iss not in ("https://accounts.google.com", "accounts.google.com"):
                logger.error("Google ID token issuer mismatch: %s", iss)
                return None
            return payload
        except Exception as e:
            logger.warning("Local PyJWT validation failed (%s); trying Google tokeninfo endpoint", e)

        # Resilient fallback to Google's tokeninfo verification endpoint
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": token},
                )
                if resp.status_code == 200:
                    payload = resp.json()
                    aud = payload.get("aud")
                    if aud != self.config.client_id:
                        logger.error(
                            "Google token audience mismatch: expected %s, got %s",
                            self.config.client_id,
                            aud,
                        )
                        return None
                    return payload
                else:
                    # SECURITY: an upstream error body is uncontrolled input and
                    # can echo back token material. Record the status only.
                    logger.error(
                        "Google tokeninfo endpoint rejected token (HTTP %s, bodyBytes: %s)",
                        resp.status_code,
                        len(resp.text or ""),
                    )
        except Exception as e:
            logger.exception("Google tokeninfo fallback failed: %s", e)
        return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        import urllib.parse

        params = {
            "client_id": self.config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        query = urllib.parse.urlencode(params)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": self.config.client_id,
                    "client_secret": self.config.client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if resp.status_code != 200:
                # SECURITY: do not log the provider's error body verbatim; it is
                # uncontrolled input and may echo the authorization code or
                # client identifiers. Status and size are enough to triage.
                logger.error(
                    "Google OAuth token exchange failed (HTTP %s, bodyBytes: %s)",
                    resp.status_code,
                    len(resp.text or ""),
                )
                return None
            return resp.json().get("id_token")


class MicrosoftSSOProvider(SSOProvider):
    async def _get_jwks_uri(self) -> str | None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://login.microsoftonline.com/{self.config.issuer}/.well-known/openid-configuration"
            )
            if resp.status_code != 200:
                return None
            return resp.json().get("jwks_uri")

    async def validate_token(self, token: str) -> dict[str, Any] | None:
        try:
            jwks_uri = await self._get_jwks_uri()
            if not jwks_uri:
                return None
            jwks_client = jwt.PyJWKClient(jwks_uri)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # In Microsoft Azure AD, multi-tenant endpoints (common/organizations/consumers)
            # issue tokens with the specific user's tenant ID in the "iss" claim:
            # https://login.microsoftonline.com/{tenantid}/v2.0
            decode_kwargs: dict[str, Any] = {
                "algorithms": ["RS256"],
                "audience": self.config.client_id,
            }
            if self.config.issuer and self.config.issuer not in ("common", "organizations", "consumers"):
                decode_kwargs["issuer"] = f"https://login.microsoftonline.com/{self.config.issuer}/v2.0"
            else:
                decode_kwargs["options"] = {"verify_iss": False}

            payload = jwt.decode(
                token,
                signing_key.key,
                **decode_kwargs,
            )
            iss = payload.get("iss", "")
            if not (iss.startswith("https://login.microsoftonline.com/") and iss.endswith("/v2.0")):
                logger.error("Microsoft ID token issuer mismatch: %s", iss)
                return None
            tid = payload.get("tid", "")
            if not tid:
                logger.error("Microsoft ID token missing tid claim — refusing multi-tenant token without tenant binding")
                return None
            iss_tenant = iss.rsplit("/", 2)[-2] if iss.count("/") >= 3 else ""
            if iss_tenant and iss_tenant != tid:
                logger.error("Microsoft ID token iss/tid mismatch: %s vs %s", iss, tid)
                return None
            return payload
        except Exception as e:
            logger.exception("Microsoft ID token validation failed: %s", e)
            return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        import urllib.parse

        tenant = self.config.issuer or "common"
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        query = urllib.parse.urlencode(params)
        return f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
        tenant = self.config.issuer or "common"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                data={
                    "code": code,
                    "client_id": self.config.client_id,
                    "client_secret": self.config.client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if resp.status_code != 200:
                logger.error("Microsoft OAuth token exchange failed (HTTP %s): %s", resp.status_code, resp.text)
                return None
            return resp.json().get("id_token")


class SAMLSSOProvider(SSOProvider):
    """SAML SSO provider — wired to services/saml.py real signxml (ENT track)."""

    def __init__(self, config: SSOConfig):
        super().__init__(config)
        # saml.py provider needs expected_issuer etc. Map SSOConfig fields
        from .saml import SAMLProvider as RealSAML  # type: ignore

        idp_cert = getattr(config, "client_secret", None)
        if not idp_cert:
            raise ValueError("SAML IdP certificate is required (set SAML_IDP_CERT / SSO client_secret) — refusing unsigned SAML")
        self._real = RealSAML(
            expected_issuer=getattr(config, "issuer", "") or "",
            allowed_audiences=[self.config.client_id] if self.config.client_id else [],
            idp_certificate=idp_cert,
            require_signature=True,  # zero-trust: unsigned assertions are forged-assertion takeover
        )

    async def validate_token(self, token: str) -> dict[str, Any] | None:
        # token is base64 SAMLResponse
        try:
            assertion = self._real.parse_saml_response(token)
            info = self._real.validate_assertion(assertion)
            return info
        except Exception:
            return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        """Generate genuine SAML 2.0 AuthnRequest URL for Okta, Azure AD, Ping, etc."""
        import base64
        import urllib.parse
        import uuid
        import zlib
        from datetime import UTC, datetime

        idp_sso_url = (self.config.issuer or "").strip()
        if not idp_sso_url:
            raise ValueError("SAML Identity Provider (IdP) URL is not configured.")

        request_id = f"id_{uuid.uuid4().hex}"
        issue_instant = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        sp_entity_id = self.config.client_id or "https://vaeloom.app/saml/metadata"

        authn_request_xml = (
            f'<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
            f'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" '
            f'ID="{request_id}" '
            f'Version="2.0" '
            f'IssueInstant="{issue_instant}" '
            f'Destination="{idp_sso_url}" '
            f'AssertionConsumerServiceURL="{redirect_uri}" '
            f'ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">'
            f'<saml:Issuer>{sp_entity_id}</saml:Issuer>'
            f'<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>'
            f'</samlp:AuthnRequest>'
        )

        compressor = zlib.compressobj(level=9, method=zlib.DEFLATED, wbits=-15)
        deflated = compressor.compress(authn_request_xml.encode("utf-8")) + compressor.flush()
        b64_request = base64.b64encode(deflated).decode("ascii")

        params = {
            "SAMLRequest": b64_request,
            "RelayState": state,
        }
        separator = "&" if "?" in idp_sso_url else "?"
        return f"{idp_sso_url}{separator}{urllib.parse.urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
        # SAML uses POST binding, not code exchange — return code as token
        return code


def get_sso_provider(provider: str, config: SSOConfig) -> SSOProvider:
    providers = {
        "google": GoogleSSOProvider,
        "microsoft": MicrosoftSSOProvider,
        "saml": SAMLSSOProvider,
    }
    cls = providers.get(provider)
    if not cls:
        raise ValueError(f"Unsupported SSO provider: {provider}. Use 'google', 'microsoft', or 'saml'.")
    return cls(config)
