# ADR-014: Secret Management Strategy

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom manages sensitive secrets: JWT signing keys, LLM API keys (Anthropic, OpenAI), OAuth tokens for integrations (Google, GitHub, Slack), database credentials, and storage access keys. These must be stored securely, rotated regularly, and accessible to the backend without being hardcoded or committed.

Options considered: Infisical (self-hosted), HashiCorp Vault, AWS Secrets Manager, Doppler, environment variables only.

## Decision

Use **Infisical** as the primary secret manager with environment variable fallback for local development.

Architecture:
- `SecretManager` protocol class (`infrastructure/secrets.py`) abstracts secret retrieval
- Infisical integration fetches secrets via their SDK with automatic caching
- Local development falls back to `.env` file — no Infisical dependency for dev
- `Settings._resolve_from_secret_manager()` infuses Infisical values into pydantic-settings at startup
- Secrets are never logged — structured logging filters secret fields
- JWT secret validation (`validate_settings()`) fails fast if default value detected

## Consequences

**Positive:**
- Secrets never committed to git — only `.env.example` with placeholder values is committed
- Infisical provides audit logging for secret access — track who read what and when
- Secret rotation can happen centrally without code changes or redeploy
- Fallback chain (Infisical → environment → .env) works across local dev, CI, staging, and production
- `SecretManager` protocol makes it easy to swap providers without changing application code

**Negative:**
- Infisical adds a startup dependency — if Infisical is down, the backend must fall back to environment variables or fail
- Secret caching introduces a window between secret rotation in Infisical and the application picking it up
- Infisical self-hosted adds operational overhead (database, backup, uptime monitoring)
- Team must manage Infisical access controls separate from application-level RBAC
