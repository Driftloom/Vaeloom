# ADR-007: JWT-Based Authentication

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom requires stateless authentication that works across the web frontend, API clients, and future mobile/desktop apps. The system must support email/password login, SSO (Google, Microsoft), token refresh, and API key authentication for programmatic access. Tokens must encode tenant context for multi-tenancy.

Options considered: JWT, opaque session tokens (Redis-backed), PASETO, Django session middleware.

## Decision

Use **JWT-based authentication** with refresh tokens.

Architecture:
- **Access tokens** — short-lived (1 hour), contain `sub` (user_id), `email`, `tenant_id`, `iat`, `exp`
- **Refresh tokens** — long-lived (30 days), stored hashed in `auth_sessions` table, one-time use with rotation
- **Auth middleware** — FastAPI middleware extracts Bearer token from `Authorization` header, validates signature and expiry, attaches `current_user` dict to request
- **SSO** — Google and Microsoft OAuth via `authlib`, returning JWT tokens in the same format
- **API keys** — alternative auth mechanism with key prefix + hashed key pattern for programmatic access
- **`validate_settings()`** — fails startup if `JWT_SECRET` is the default value

## Consequences

**Positive:**
- Stateless — no server-side session store for access tokens, scales horizontally without Redis dependency for auth
- Tenant context embedded in token — every request carries `tenant_id` for multi-tenant isolation
- Refresh token rotation provides automatic session extension with security (old token invalidated on use)
- SSO providers return the same JWT format as email/password auth — unified auth response
- API key auth enables headless/integration usage without user sessions

**Negative:**
- Token revocation requires a blocklist (Redis), adding complexity for immediate invalidation scenarios
- JWT size (~1KB) increases request overhead slightly compared to opaque tokens (~32 bytes)
- Refresh token rotation requires database writes on every token refresh — mitigated by the 1-hour access token window
- JWT secret rotation requires coordinated deployment or multiple valid signing keys during transition
