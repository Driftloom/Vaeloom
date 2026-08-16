# Finding 05 — SSO/SAML Implementation Status

**Verified:** `services/sso.py`, `services/saml.py`, `routers/auth.py`,
`config.py` **Date:** 2026-08-16

## Architecture

```
routers/auth.py
  → /sso/{provider} (POST) — token login
  → /sso/{provider} (GET) — OAuth redirect
  → /sso/{provider}/callback — OAuth callback
      ↓
services/sso.py
  → get_sso_provider(provider, config) → SSOProvider subclass
      ↓
  GoogleSSOProvider (fully implemented)
  MicrosoftSSOProvider (fully implemented)
  SAMLSSOProvider (STUB)
      ↓
services/saml.py
  → SAMLProvider (real XML parser, but not called by SSOProvider)
```

## Google SSO — FULLY IMPLEMENTED

`services/sso.py:33-76` — `GoogleSSOProvider`:

- `validate_token()`: Fetches JWKS from `googleapis.com`, verifies RS256, checks
  audience/issuer ✓
- `get_auth_url()`: Builds Google OAuth2 authorize URL ✓
- `exchange_code()`: Exchanges auth code for id_token ✓

## Microsoft SSO — FULLY IMPLEMENTED

`services/sso.py:79-134` — `MicrosoftSSOProvider`:

- `validate_token()`: Fetches JWKS from Azure AD, verifies RS256 ✓
- `get_auth_url()`: Builds Microsoft OAuth2 authorize URL ✓
- `exchange_code()`: Exchanges auth code for id_token ✓

## SAML — STUB

`services/sso.py:137-145` — `SAMLSSOProvider`:

```python
class SAMLSSOProvider(SSOProvider):
    async def validate_token(self, token: str) -> dict[str, Any] | None:
        pass          # returns None

    async def get_auth_url(self, redirect_uri: str, state: str) -> str:
        pass          # returns None

    async def exchange_code(self, code: str, redirect_uri: str) -> str | None:
        pass          # returns None
```

All three methods return `None`. Any SAML SSO attempt would:

1. Get a `None` auth URL → redirect to `None` → crash
2. If somehow the callback fires, `exchange_code` returns `None` → crash
3. Token validation returns `None` → user not authenticated

## SAML Parser — REAL (but unused)

`services/saml.py` (98 lines) — `SAMLProvider`:

| Method                             | Status | Detail                                                   |
| ---------------------------------- | ------ | -------------------------------------------------------- |
| `parse_saml_response()`            | ✓ Real | Base64 decode, XML parse, validates root element         |
| `validate_assertion()`             | ✓ Real | Issuer check, NotBefore/NotOnOrAfter, audience           |
| `validate_assertion()` (signature) | ✗ STUB | Line 58-63: `pass` — signature present but not validated |
| `extract_user_info()`              | ✓ Real | NameID, AttributeStatement, email, name, groups          |

The parser is complete and correct — **except** it never validates the XML
signature (requires `signxml` or `xmlsec` library). This is noted in the TODO at
line 58.

## Config

`config.py:39`: `sso_providers: dict[str, Any] = {}` — defaults to empty dict.
No Keycloak config exists anywhere in the repo.

`routers/auth.py:14`: Imports `SSOConfig, get_sso_provider` from `services.sso`

`routers/auth.py:86-91`: Gets provider config from
`settings.sso_providers.get(provider)` — would return `None` if not configured,
causing crash.

## Impact

- Google and Microsoft SSO are production-ready
- SAML SSO is completely non-functional (stub methods)
- The SAML XML parser exists but is never called by the SSOProvider
- No Keycloak integration exists
- SSO requires `sso_providers` config to be populated (currently empty dict)
