# ADR-018: SSO with Google and Microsoft

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom users expect enterprise single sign-on (SSO) with Google and Microsoft identity providers. The auth system must support both OAuth authorization code flow (web) and token-based login (mobile/API). SSO users should get the same JWT tokens as email/password users, enabling unified auth across the platform.

Options considered: Auth0, Clerk, Firebase Auth, Custom OAuth implementation with authlib.

## Decision

Implement **custom SSO integration** using `authlib` for Google and Microsoft OAuth, with provider-agnostic abstraction.

Architecture:
- `SSOConfig` pydantic model defines provider configuration (client_id, client_secret, scopes, discover_url)
- `sso.py` service provides provider factory: `get_sso_provider(provider_name, config)` returns Google/Microsoft adapter
- Each adapter implements: `get_auth_url()`, `exchange_code()`, `validate_token()`
- SSO routers at `/api/v1/auth/sso/{provider}` (GET: auth URL, POST: token login)
- Unified auth response format — identical to email/password login response
- Provider configuration loaded from settings (`sso_providers` JSON dict from environment)

## Consequences

**Positive:**
- No third-party auth provider dependency — zero vendor lock-in, no per-user pricing
- Users can use existing Google/Microsoft accounts without creating new credentials
- SSO users automatically get a Vaeloom account on first login (auto-provisioning)
- Same JWT token format regardless of auth method — frontend handles both identically
- Provider-agnostic adapter pattern makes it easy to add more SSO providers (GitHub, Okta, AD FS)

**Negative:**
- OAuth implementation requires handling edge cases: state mismatch, token expiry, scope changes, provider outages
- Each provider has different token validation requirements (JWKS for Google, OIDC discovery for Microsoft)
- SSO auto-provisioning creates users without passwords — those users cannot use email/password login
- Provider discovery URL changes or downtime can block SSO login
