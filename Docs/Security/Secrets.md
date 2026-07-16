# Secrets Management

> **Purpose:** Define secrets management strategy for Vaeloom
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** Security Team
> **Last Updated:** 2026-07-13

## Secrets Lifecycle

```mermaid
sequenceDiagram
    participant DEV as ðŸ‘¨â€ðŸ’» Developer / CI
    participant SM as ðŸ—„ï¸ Secrets Manager
    participant APP as ðŸš€ Application
    participant TGT as ðŸŽ¯ Target Service<br/>(DB / API / Redis)
    participant MON as ðŸ“Š Monitoring

    Note over DEV,MON: â”€â”€ 1. Secret Creation â”€â”€

    DEV->>SM: PUT /secrets/:name<br/>{ value: "sk-...", version: 1 }
    SM->>SM: Encrypt at rest (AES-256-GCM)<br/>Store with version, metadata, timestamps
    SM-->>DEV: Return secret ARN / path
    DEV->>APP: Deploy with env var reference<br/>SECRET_NAME=arn:aws:secretsmanager:...
    APP->>SM: Load secret at startup<br/>(not on every request!)
    SM-->>APP: Return decrypted value
    APP->>APP: Cache in memory (no disk)<br/>Auto-refresh if rotation detected

    Note over DEV,MON: â”€â”€ 2. Secret Rotation â”€â”€

    SM->>SM: Rotation trigger:<br/>scheduled / manual / expiry
    SM->>SM: Generate new version<br/>(version + 1, new value)
    SM->>TGT: Update target service<br/>(ALTER USER password / new API key)
    TGT-->>SM: Confirm update
    SM-->>APP: Notify: new version available
    APP->>SM: Fetch new version (lazy refresh)
    SM-->>APP: Return updated value
    APP->>APP: Swap in-memory cache<br/>Keep old for draining connections
    APP->>MON: Emit metric:<br/>secret_rotated, duration
    alt Rotation failed
        SM->>MON: ðŸš¨ Rotation failure alert
        SM->>SM: Keep previous version active<br/>Retry rotation in 5 min
    end

    Note over DEV,MON: â”€â”€ 3. Secret Revocation â”€â”€

    DEV->>SM: Mark secret as REVOKED<br/>reason: compromise / incident
    SM->>SM: Immediately disable<br/>All versions marked as revoked
    SM->>APP: Force refresh (or restart)
    APP->>SM: Fetch new secret (must exist!)
    alt New secret available
        SM-->>APP: Return replacement secret
        APP->>TGT: Update connection with new secret
        MON->>MON: Verify all services healthy
    else No replacement
        SM-->>APP: Return error â€” no fallback
        APP->>MON: ðŸš¨ Critical: app has no valid secret
        APP->>APP: Graceful shutdown / degraded mode
    end

    Note over DEV,MON: â”€â”€ 4. Secret Audit â”€â”€

    DEV->>SM: List all secrets<br/>check versions, last rotation
    SM-->>DEV: Return audit report
    DEV->>MON: Verify no secrets older<br/>than rotation policy (90d)
    MON-->>DEV: Any stale secrets flagged
    DEV->>SM: Schedule rotation for flagged
```

> **Diagram:** The secrets lifecycle covers four scenarios. **Creation:** developer stores encrypted secret â†’ app loads at startup â†’ caches in memory. **Rotation:** new version generated â†’ target updated â†’ app refreshes â†’ old connections drain. **Revocation:** immediate disable â†’ force refresh â†’ graceful degradation if no fallback. **Audit:** list â†’ verify age â†’ schedule rotation for stale secrets.

---

## Secrets Types

| Secret | Storage Location | Access Pattern |
|--------|-----------------|---------------|
| OAuth tokens | Secrets manager | Auto-refreshed by Connector Agent |
| Anthropic API key | Secrets manager | Environment variable at deploy |
| Database password | Secrets manager | Environment variable at deploy |
| JWT signing key | Secrets manager | Loaded at service startup |
| Redis password | Secrets manager | Environment variable at deploy |

## Secrets Manager

| Environment | Provider |
|-------------|----------|
| Development | `.env` file (gitignored) |
| Staging | PaaS built-in secrets / .env |
| Production | Cloud secrets manager (AWS Secrets Manager / GCP Secret Manager) |

## Secret Access Control

```typescript
// Secrets are loaded at startup, never at runtime from env
const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
};

// Service-to-service auth uses short-lived tokens
const internalToken = await getInternalToken(); // 15 min TTL
```

## Secret Rotation

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| Database password | Per incident | Update secrets manager, restart services |
| API keys | Quarterly | Generate new key, update secrets, verify, retire old |
| JWT signing key | Quarterly | Add to rotation list, old key kept for existing sessions |
| OAuth tokens | Auto-refresh | Handled by Connector Agent |

## Rotation Procedure

```bash
# 1. Generate new secret
openssl rand -base64 32 | tr -d '\n' > new-secret.txt

# 2. Update secrets manager
flyctl secrets set DATABASE_PASSWORD=$(cat new-secret.txt)

# 3. Rotate in database
psql -h localhost -U admin -c "ALTER USER Vaeloom WITH PASSWORD '$(cat new-secret.txt)';"

# 4. Restart services
flyctl restart apps/api

# 5. Verify
curl https://api.Vaeloom.dev/v1/health

# 6. Cleanup
rm new-secret.txt
```

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Loading secrets from environment variables at runtime instead of startup | Reading `process.env` on every request means a configuration change could expose secrets to a concurrent request â€” load all secrets once at application startup and cache in memory |
| Storing secrets in version control | A `.env` file or hardcoded API key committed to git is exposed to every developer who has access to the repository â€” use `.env` only for local development, never commit it, and scan for accidental commits with pre-push hooks |
| Using the same secret across environments | A development API key that gets exposed in CI logs exposes the production key if they're the same â€” use separate secrets per environment with different values and access controls |

## Best Practices

| Practice | Why |
|----------|-----|
| Load secrets once at startup, cache in memory, never read from env at runtime | Reading from environment variables at runtime introduces timing windows and makes it harder to audit secret access â€” load during initialization and swap references on rotation |
| Use a secrets manager with automatic rotation for production | Cloud secrets managers (AWS Secrets Manager, GCP Secret Manager) provide encryption, access logging, and rotation â€” don't manage secrets in configuration files |
| Implement a secret rotation strategy with verification steps | After rotating a secret, verify that all services are using the new value before retiring the old one â€” use a blue/green approach where old secrets are valid during a drain period |

## Security

| Concern | Mitigation |
|---------|------------|
| Secrets exposed through error messages and stack traces | An unhandled exception that includes a connection string or API key in the error message leaks to log aggregation â€” sanitize all error outputs to redact known secret patterns |
| Secrets in application memory dumps | A crash dump of a service that loaded secrets into memory can leak them â€” use isolated memory for secret storage and zero out after use where possible |
| Privilege escalation via secrets manager access | A developer with access to the staging secrets manager could read production secrets if permissions aren't scoped â€” enforce strict IAM separation between environments and audit all secret access |

## Performance

| Concern | Mitigation |
|---------|------------|
| Secrets manager API latency on every request | Calling AWS Secrets Manager or GCP Secret Manager on every request adds 50-200ms â€” load secrets once at startup into memory and refresh only on rotation notifications |
| Secret rotation causing connection storms | Rotating a database password causes all service instances to reconnect simultaneously â€” implement staggered rotation where instances reconnect over a drain window, not all at once |
| Encryption overhead for secrets at rest | Cloud secrets managers encrypt at rest by default, but custom secret storage (e.g., encrypted files) adds CPU overhead â€” use managed secrets manager services that handle encryption transparently |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Secrets exposed through error messages and stack traces | An unhandled exception that includes a connection string or API key in the error message leaks to log aggregation â€” sanitize all error outputs to redact known secret patterns |
| Secrets in application memory dumps | A crash dump of a service that loaded secrets into memory can leak them â€” use isolated memory for secret storage and zero out after use where possible |
| Privilege escalation via secrets manager access | A developer with access to the staging secrets manager could read production secrets if permissions aren't scoped â€” enforce strict IAM separation between environments and audit all secret access |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Secrets manager API latency on every request | Calling secrets manager on every request adds 50-200ms â€” load secrets once at startup into memory and refresh only on rotation notifications |
| Secret rotation causing connection storms | Rotating a database password causes all service instances to reconnect simultaneously â€” implement staggered rotation where instances reconnect over a drain window, not all at once |
| Encryption overhead for secrets at rest | Cloud secrets managers encrypt at rest by default, but custom secret storage (e.g., encrypted files) adds CPU overhead â€” use managed secrets manager services that handle encryption transparently |

## Scope

This document defines the secrets management strategy for Vaeloom â€” covering secrets types, storage locations, access patterns, rotation procedures, and lifecycle management (creation, rotation, revocation, audit). Applies to all environments (development, staging, production). Out of scope: encryption of secrets at rest (see [Encryption.md](./Encryption.md)), IAM for secrets manager access (see [IAM.md](./IAM.md)).

---

## Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| SC-FR-01 | All secrets must be stored in a secrets manager, never in code | P0 | Cloud secrets manager for production |
| SC-FR-02 | Secrets must be loaded at startup, never at runtime from env vars | P0 | Load once, cache in memory |
| SC-FR-03 | Secrets must have automatic rotation with defined schedule | P1 | Quarterly for API keys; per incident for DB passwords |
| SC-FR-04 | Secret revocation must immediately disable access | P0 | Force refresh or restart on revocation |
| SC-FR-05 | All secret access must be logged with audit trail | P1 | Who accessed which secret, when |

---

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| SC-NFR-01 | Secret retrieval latency at startup | <200ms | Time from request to decrypted value |
| SC-NFR-02 | Secret rotation downtime | Zero (envelope pattern) | Service uptime during rotation |
| SC-NFR-03 | Secret revocation propagation | <5 min | Time from revocation to effective denial |
| SC-NFR-04 | Secrets manager API calls | Only at startup + rotation | Rate of calls per hour |

---

## Workflows

### 1. Secret Creation Workflow

1. Developer generates new secret (e.g., API key, DB password)
2. Secret stored in Secrets Manager with version number
3. Application configured to reference secret by ARN/path at startup
4. Secret encrypted at rest (AES-256-GCM) by Secrets Manager
5. Application loads secret at startup into memory (never on disk)
6. Secret cached in memory; refreshed only on rotation notification

### 2. Secret Rotation Workflow

1. Rotation trigger: scheduled (quarterly) or incident-based
2. Secrets Manager generates new version (version + 1)
3. Target service updated (e.g., ALTER USER password in DB)
4. Application notified of new version
5. Application fetches new version (lazy refresh)
6. Old connections drain; new connections use new secret
7. Rotation logged with duration and status

---

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant DEV as Developer/CI
    participant SM as Secrets Manager
    participant APP as Application
    participant TGT as Target Service (DB/API)
    participant AUD as Audit Log

    DEV->>SM: Store secret (name, value, version)
    SM->>SM: Encrypt at rest (AES-256-GCM)
    SM-->>DEV: Secret ARN
    
    APP->>APP: Start up
    APP->>SM: Load secret by ARN
    SM-->>APP: Decrypted value
    APP->>APP: Cache in memory
    
    Note over SM: Rotation trigger
    SM->>SM: Generate new version
    SM->>TGT: Update target service
    TGT-->>SM: Confirmed
    SM-->>APP: Notify: new version available
    APP->>SM: Fetch new version (lazy refresh)
    SM-->>APP: Updated value
    APP->>APP: Swap cache (drain old connections)
    SM->>AUD: Log rotation event
```

> **Diagram:** Secrets lifecycle â€” creation (encrypted at rest), startup loading (cached in memory), rotation (new version, lazy refresh, connection drain). All events logged for audit.

---

## Data Flow

```text
Creation: Developer â†’ Secrets Manager (encrypt + version)
    â†’ Application startup (load by ARN â†’ cache in memory)
    
Rotation: Secrets Manager â†’ New version generated
    â†’ Target service updated (DB/API)
    â†’ Application notified â†’ Lazy refresh
    â†’ Old connections drain â†’ New value active
    
Revocation: Admin â†’ Mark secret REVOKED
    â†’ Application force refresh â†’ Replacement loaded
    â†’ No replacement â†’ Graceful shutdown / degraded mode
    
Audit: Developer â†’ List all secrets â†’ Check rotation age
    â†’ Flag stale secrets â†’ Schedule rotation
```

---

## APIs

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/secrets/store` | POST | Store a new secret | CI/Admin token |
| `/api/v1/secrets/retrieve/{name}` | GET | Retrieve secret value (startup only) | Service token |
| `/api/v1/secrets/rotate/{name}` | POST | Trigger manual rotation | Admin token |
| `/api/v1/secrets/revoke/{name}` | POST | Revoke a secret immediately | Security token |
| `/api/v1/secrets/audit` | GET | Get secret access and rotation audit | Admin token |

---

## Database

| Table | Purpose | Key Columns | Indexes |
|-------|---------|-------------|---------|
| `secrets_registry` | Registered secrets metadata | `id`, `name`, `arn`, `current_version`, `status`, `rotation_frequency_days`, `last_rotated_at` | `(name)` UNIQUE |
| `secrets_rotation_log` | Rotation event history | `id`, `secret_name`, `previous_version`, `new_version`, `status`, `duration_ms`, `rotated_at` | `(secret_name, rotated_at)` |
| `secrets_access_log` | Secret access audit ($) | `id`, `secret_name`, `accessed_by`, `action`, `accessed_at` | `(secret_name, accessed_at)` |

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Secrets managed | 10 | 100 (auto-detected from service config) | 1000 (hierarchical namespaces) |
| Rotation events/day | 1/day | 10/day (scheduled rotations) | 100/day (continuous rotation) |
| Secret access audits | 100/day | 1000/day | 10K/day (sampled if needed) |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Secrets Manager unavailable at startup | Connection timeout | Use last cached value if available; warn in logs | Retry; if persistent, fail to start |
| Rotation fails mid-process | Target service update fails | Keep old version active; retry rotation | Alert; manual intervention if retry fails |
| Secret revocation with no replacement | Replace secret doesn't exist | Graceful shutdown / degraded mode | Admin must provision replacement |
| Secret accidentally committed to git | Pre-push hook / secret scanner | Block commit; instruct developer to rotate | Rotate secret; remove from git history |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Secret age since last rotation | > 100 days | Warning | Secret Rotation |
| Secrets Manager API latency | > 500ms | Warning | Secrets Performance |
| Secret revocation events | Any revocation | Critical | Secret Incidents |
| Secrets without rotation schedule | > 0 | Warning | Secret Hygiene |
| Secret access from unknown service | > 0 unexpected access | Critical | Secrets Access |

---

## Deployment

| Environment | Method | Trigger | Verification |
|-------------|--------|---------|-------------|
| Development | .env file (gitignored) | Manual | App starts with secrets loaded |
| Staging | PaaS built-in secrets | CI/CD deploy | Secrets loaded at startup test |
| Production | Cloud Secrets Manager | CI/CD deploy | Secrets loaded + rotation verification |

---

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `SECRETS_MANAGER_PROVIDER` | Secrets manager provider | aws | Yes |
| `SECRETS_ROTATION_DAYS_API` | API key rotation interval | 90 | Yes |
| `SECRETS_ROTATION_DAYS_DB` | DB password rotation interval | 180 | Yes |
| `SECRETS_ROTATION_DAYS_JWT` | JWT signing key rotation | 90 | Yes |
| `SECRETS_CACHE_TTL_MS` | In-memory cache refresh interval | 3600000 | No |

---

## Examples

### Example 1: Secret Rotation Procedure

```bash
# 1. Generate new database password
openssl rand -base64 32 | tr -d '\n' > new-db-password.txt

# 2. Update secrets manager
flyctl secrets set DATABASE_PASSWORD=$(cat new-db-password.txt)

# 3. Rotate in database (if applicable)
psql -h localhost -U admin -c "ALTER USER Vaeloom WITH PASSWORD '$(cat new-db-password.txt)';"

# 4. Restart services to pick up new secret
flyctl restart apps/api

# 5. Verify
curl https://api.Vaeloom.dev/v1/health

# 6. Cleanup
rm new-db-password.txt
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Secrets exposed through error messages / stack traces | Low | Critical | Sanitize all error outputs to redact known secret patterns |
| Secrets in application memory dumps | Low | High | Isolated memory for secret storage; zero out after use |
| Privilege escalation via secrets manager access | Low | Critical | Strict IAM separation between environments; audit all access |
| Secret committed to source control | Medium | High | Pre-push hooks + secret scanning in CI; automatic rotation if detected |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| Secrets loaded at startup require restart for rotation | Restart needed for new values to take effect | Lazy refresh for caches; connection drain for long-lived connections | Hot-reloadable secrets (Phase 2) |
| .env file for local dev is less secure than cloud SM | Local development risk | .env gitignored; pre-commit hook scans for secrets | Local secrets manager emulation (Phase 2) |
| No automatic secret rotation for all secret types | Some secrets must be rotated manually | Scheduled reminders for manual rotation | Fully automated rotation for all types (Phase 3) |

---

## Overview

Vaeloom manages secrets (API keys, database credentials, JWT signing keys, third-party tokens) using a tiered vault strategy. Environment-specific secrets are stored in production-grade vaults (AWS Secrets Manager or HashiCorp Vault) and injected into services at runtime. Local development and CI secrets are managed through environment variables with strict `.env` governance.

This document defines the secret lifecycle, storage tiers, access control, rotation policies, and emergency procedures for secret compromise. The primary audience is DevOps engineers managing secret infrastructure and developers using secrets in their services.

Within the Vaeloom platform, secrets fall into three tiers: Tier 1 (platform credentials â€” DB passwords, JWT keys, encryption keys), Tier 2 (third-party tokens â€” OpenAI API key, SendGrid API key, OAuth client secrets), and Tier 3 (CI/CD secrets â€” Docker registry tokens, deployment SSH keys). Each tier has distinct access, rotation, and audit requirements.

Enterprise-grade secret management requires a zero-trust approach: secrets are never hardcoded, never committed to source control, never logged, and always rotated on a defined schedule or on suspicion of compromise. Access to secrets is audited, time-limited, and role-scoped.

---

## Goals

- Store all Tier 1 and Tier 2 secrets in a production-grade vault (AWS Secrets Manager or Vault) with no exceptions
- Enforce automatic rotation: Tier 1 keys every 90 days, Tier 2 tokens every 180 days, Tier 3 secrets rotated on incident
- Implement RBAC for secret access with read, write, and admin scopes per secret path
- Audit every secret access event (who, what, when, from where) with immutable audit log
- Achieve sub-30-second incident response to suspected secret compromise (rotation + invalidation)

---

## Scope

### In Scope

- Secret lifecycle: generation, storage, access, rotation, revocation, archival
- Secret storage tiers: production vault (Tier 1, Tier 2), environment variables (Tier 3)
- Access control: RBAC with read/write/admin roles, time-limited emergency access
- Rotation policies: automatic rotation schedule per tier, manual rotation trigger on compromise
- Secret patterns in code: `process.env.VAULT_SECRET_NAME`, SDK-based retrieval, no environment variable in production code paths
- Emergency procedures: suspected compromise â†’ immediate rotation â†’ incident report
- Local development: `.env.local` files with `.gitignore` enforcement, developer-specific secrets

### Out of Scope

- Certificate management and PKI infrastructure (planned for future)
- Service mesh secrets (Istio mTLS certificates â€” covered in future service mesh deployment)
- Database encryption at rest keys (managed by cloud provider)
- User password hashing and management (handled by Supabase Auth)
- Build-time signing keys (covered in [Container-Signing.md](../DevOps/Container-Signing.md))

---

## Examples

### Example 1: Local Development Secret Setup

```bash
# .env.local (never committed)
DATABASE_URL="postgresql://dev_user:dev_pass@localhost:5432/Vaeloom_dev"
OPENAI_API_KEY="sk-dev-..."
JWT_SECRET="dev-jwt-secret-do-not-use-in-prod"
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"

# Access in code
const dbUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production') {
  // In production, never read DB URL from env directly
  throw new Error('Use vault secret manager in production');
}
```

### Example 2: Production Secret Retrieval (TypeScript)

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManager({ region: 'us-east-1' });

async function getDatabaseUrl(): Promise<string> {
  const response = await secrets.getSecretValue({
    SecretId: `Vaeloom/${process.env.ENVIRONMENT}/database-url`,
  });

  if (!response.SecretString) {
    throw new Error('Database secret not found');
  }

  return response.SecretString;
}

// Usage
const databaseUrl = await getDatabaseUrl();
```

---

## Sequence Diagrams

```mermaid
sequenceDiagram
    participant SVC as Application Service
    participant VAULT as Secret Vault
    participant ROTATE as Rotation Worker
    participant AUDIT as Audit Log
    participant OPS as Security Operations

    Note over SVC,OPS: Normal Operation
    SVC->>VAULT: Request secret (role: read)
    VAULT->>VAULT: Check RBAC + audit access
    VAULT-->>SVC: Secret value
    VAULT->>AUDIT: Log access (SVC, path, time)

    Note over ROTATE,OPS: Scheduled Rotation
    ROTATE->>VAULT: Generate new secret + update
    VAULT-->>ROTATE: New version created
    ROTATE->>SVC: Signal rotation (trigger service reload)
    SVC->>VAULT: Request latest version of secret

    Note over OPS,RIGGER: Compromise Response
    OPS->>VAULT: Emergency rotate (revoke all versions)
    VAULT-->>OPS: New secret deployed
    OPS->>SVC: Force restart with new secret
```

> **Diagram:** Secret lifecycle â€” services request secrets from vault with RBAC + audit logging, rotation workers periodically rotate secrets and signal services to reload, emergency rotation revokes all versions and forces service restart.

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Hot-reloadable secrets (no restart required) | High | Medium | Phase 2 (Q4 2026) |
| Local secrets manager emulation for development | Medium | Medium | Phase 2 (Q4 2026) |
| Fully automated rotation for all secret types | Medium | High | Phase 3 (Q1 2027) |
| Secret scanning with auto-remediation | Low | Medium | Phase 3 (Q1 2027) |

## Related Documents

- [Encryption.md](./Encryption.md)
- [Security Architecture.md](./Security-Architecture.md)
- [`Operations/Runbooks.md`](../Operations/01-operations-runbook.md)
