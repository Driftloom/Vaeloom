# Connector Security & OAuth Isolation Report

**Scope**: Google Drive, Gmail, Slack, GitHub Connectors & MCP Bridges  
**Encryption Standard**: AES-256-GCM / per-key envelope encryption

---

## 1. Security Architecture

1. **OAuth State & PKCE**:
   - OAuth flows generate high-entropy cryptographic state tokens
     (`secrets.token_urlsafe(32)`).
   - State stored in Redis with 15-minute TTL.
   - Redirect URIs strictly validated against whitelist to prevent authorization
     code interception.

2. **Secret Encryption**:
   - Access tokens, refresh tokens, and webhook secrets are encrypted at rest
     using AES-256-GCM before DB insertion.
   - Secret keys are never serialized in API responses; responses return masked
     metadata only (`is_connected: true`, `scopes: [...]`).

3. **Workspace Binding**:
   - Connectors are scoped strictly to `workspace_id`.
   - An agent running in Workspace A has zero capability to access or invoke
     connectors configured in Workspace B.
   - MCP connectors run in sandboxed processes; shell interpreters and
     destructive filesystem calls are denied.
