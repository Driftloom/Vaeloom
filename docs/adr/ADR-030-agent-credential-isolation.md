# ADR-030: Agent Credential Isolation

| Metadata | Value |
| ------------ | ---------------------------------------- |
| **Status** | Proposed |
| **Date** | 2026-08-16 |
| **Deciders** | Security Architect, AI Architect |
| **Owner** | Security Team |
| **Tags** | security, agents, credentials, isolation |

## Context

Currently, all 24 AI agents share the same workspace OAuth tokens. When the
Gmail agent needs to access email, it uses the workspace's Google OAuth token.
This means:

- A compromised agent can access all workspace resources (not just its scope)
- No per-agent audit trail for credential usage
- Violation of least-privilege principle (ASI03: Identity and Privilege Abuse)

## Decision

We will implement per-agent credential isolation for MVP-scope agents:

### Credential Isolation Model

| Agent | Required Credentials | Isolation Strategy |
| -------------- | -------------------------------------------- | ------------------------------------------------- |
| Gmail Agent | Google OAuth (read-only, Gmail scope) | Dedicated OAuth token, revoked on agent disable |
| GitHub Agent | GitHub App token (read-only, specific repos) | Short-lived installation token |
| Drive Agent | Google OAuth (read-only, Drive scope) | Dedicated OAuth token, scoped to workspace folder |
| Calendar Agent | Google OAuth (calendar scope) | Dedicated OAuth token |
| Other Agents | No external credentials | N/A — use internal API only |

### Implementation

1. **Agent Credential Store**: New `agent_credentials` table with:
 - `agent_id` (foreign key to agent config)
 - `credential_type` (oauth_token, api_key, service_account)
 - `encrypted_token` (AES-256-GCM, key from ADR-014)
 - `scopes` (JSON array of granted scopes)
 - `expires_at` (timestamp)
 - `revoked_at` (timestamp, nullable)

2. **Credential Injection**: Each agent receives only its own credentials via:

 ```python
   class BaseAgent:
       async def get_credential(self, scope: str) -> str:
           cred = await credential_store.get(self.agent_id, scope)
           if cred.is_expired:
               cred = await self.refresh_credential(cred)
           return cred.value
   ```

3. **Audit Trail**: Every credential usage is logged to the audit table with:
 - `agent_id`, `credential_type`, `scope_used`, `action`, `timestamp`

## Rationale

| Alternative | Pros | Cons | Why Not |
| --------------------------------- | -------------------------- | -------------------------------------- | ----------------------------------- |
| Shared workspace tokens (current) | Simple | No isolation, blast radius = workspace | Security violation |
| Per-user OAuth + agent delegation | Full user control | Complex, UX burden | Overkill for MVP |
| Service accounts | No user involvement | Requires Google Workspace admin | Not available for personal accounts |
| Per-agent credentials (chosen) | Least privilege, auditable | Implementation effort ~3 days | Best security/effort ratio |

## Consequences

**Positive:**

- Compromised agent cannot access resources outside its scope
- Per-agent audit trail for credential usage
- Credential revocation is per-agent, not per-workspace

**Negative:**

- More OAuth flows to manage (one per agent per workspace)
- Token refresh logic must be implemented per provider
- Credential storage adds complexity to secret management (ADR-014)

**Risks:**

- OAuth rate limits may be hit if many agents refresh simultaneously
- Credential leakage still possible if agent is compromised (mitigate with
 short-lived tokens)

## Compliance & Safety Notes

- OWASP Agentic Top 10: ASI03 (Identity and Privilege Abuse) — this ADR directly
 mitigates this risk.
- GDPR: Credential scope must be limited to purpose (data minimization
 principle).

## Verification

1. Verify `agent_credentials` table exists with correct schema
2. Verify each agent can only access its own credentials
3. Verify audit trail logs credential usage
4. Test credential revocation: disable agent, verify access denied

## Related ADRs

- ADR-014: Secret Management (encryption key for tokens)
- ADR-007: JWT Auth (user authentication, separate from agent credentials)
- ADR-027: OWASP Security Posture (ASI03 mapping)

## Reversibility

Moderate — requires database migration and agent code changes. Rollback:

1. Revert to shared workspace tokens
2. Drop `agent_credentials` table
3. No data loss (credentials are ephemeral)
