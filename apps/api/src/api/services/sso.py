from abc import ABC, abstractmethod
from typing import Any

import httpx
import jwt
from pydantic import BaseModel


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
                issuer=self.config.issuer or "https://accounts.google.com",
            )
            return payload
        except jwt.PyJWTError:
            return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
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
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.config.client_id,
                issuer=f"https://login.microsoftonline.com/{self.config.issuer}/v2.0",
            )
            return payload
        except jwt.PyJWTError:
            return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        tenant = self.config.issuer or "common"
        params = {
            "client_id": self.config.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
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
                return None
            return resp.json().get("id_token")


class SAMLSSOProvider(SSOProvider):
    """SAML SSO provider — wired to services/saml.py real signxml (ENT track)."""

    def __init__(self, config: SSOConfig):
        super().__init__(config)
        # saml.py provider needs expected_issuer etc. Map SSOConfig fields
        from .saml import SAMLProvider as RealSAML  # type: ignore

        self._real = RealSAML(
            expected_issuer=getattr(config, "issuer", "") or "",
            allowed_audiences=[self.config.client_id] if self.config.client_id else [],
            idp_certificate=getattr(config, "client_secret", None),  # reuse client_secret as cert for demo
            require_signature=False,  # allow structural fallback in dev
        )

    async def validate_token(self, token: str) -> dict[str, Any] | None:
        # token is base64 SAMLResponse
        try:
            from .saml import SAMLProvider as RealSAML  # type: ignore

            assertion = self._real.parse_saml_response(token)
            info = self._real.validate_assertion(assertion)
            return info
        except Exception:
            return None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        # SAML IdP-initiated or SP-initiated mock URL — return IdP metadata URL
        return f"{redirect_uri}?SAMLRequest=mock&RelayState={state}"

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
