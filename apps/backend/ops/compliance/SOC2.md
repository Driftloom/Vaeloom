# SOC 2 Readiness Report

## Overview

Vaeloom is designed and operated to meet SOC 2 Type II criteria across the
following trust service criteria.

## Trust Service Criteria

### 1. Security — Protected Against Unauthorized Access

**Controls in place:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Access control | JWT + RBAC + SSO | ✅ |
| API authentication | API keys with bcrypt hashing | ✅ |
| Network security | IP allowlisting (CIDR) | ✅ |
| Encryption at rest | AES-256 (via encryption_key) | ✅ |
| Encryption in transit | TLS 1.3 | ✅ |
| Secrets management | Infisical + fallback | ✅ |
| Session management | JWT with refresh rotation | ✅ |
| Rate limiting | Sliding window per-endpoint | ✅ |
| CORS hardening | Restricted origins/methods/headers | ✅ |

### 2. Availability — System is Available for Operation and Use

**Controls in place:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Health checks | Liveness, readiness, startup endpoints | ✅ |
| Monitoring | Prometheus metrics, OpenTelemetry | ✅ |
| Alerting | Audit logging + structured logging | ✅ |
| Backup | Redis persistence + DB connection pooling | ✅ |
| Incident response | Runbook in ops/runbook.md | ✅ |

### 3. Processing Integrity — Processing is Complete, Valid, Accurate

**Controls in place:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Input validation | Pydantic schema validation | ✅ |
| Error handling | Unified exception handler | ✅ |
| Idempotency | Event correlation IDs | ✅ |
| Data integrity | Encrypted storage + checksums | ✅ |
| Circuit breaker | Agent circuit breaker pattern | ✅ |

### 4. Confidentiality — Information Designated as Confidential is Protected

**Controls in place:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Access logging | Full audit event trail | ✅ |
| Data classification | Tenant isolation + RBAC | ✅ |
| Secrets redaction | Auto-redacted from logs | ✅ |
| Retention policies | Configurable per resource type | ✅ |
| Data minimization | Least-privilege permissions | ✅ |

### 5. Privacy — Personal Information is Collected, Used, Retained, and Disclosed

**Controls in place:**

| Control | Implementation | Status |
|---------|---------------|--------|
| Consent management | User registration consent | ✅ |
| Data export | GDPR export endpoint | ✅ |
| Right to erasure | GDPR delete endpoint | ✅ |
| Anonymization | PII fields anonymized on delete | ✅ |
| Retention limits | Configurable via RETENTION_POLICIES | ✅ |

## System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client     │────▶│  Load Balancer│────▶│   FastAPI    │
│  (HTTPS TLS) │     │  (TLS 1.3)   │     │  (RBAC/RL)   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌────────────────────────────┼────────────────────┐
                    │                            │                    │
              ┌─────▼──────┐            ┌────────▼───────┐  ┌───────▼────────┐
              │ PostgreSQL  │            │     Redis      │  │  Object Store  │
              │ (encrypted) │            │ (cache/queue)  │  │  (encrypted)   │
              └────────────┘            └────────────────┘  └────────────────┘
```

## Key Management

- JWT signing keys rotated via Infisical
- Encryption keys: 32+ character AES-256 key
- API keys: bcrypt hashed, prefixed with `vael_`
- Secrets: never stored in config files in production

## Incident Response

See `ops/runbook.md` for the full incident response plan.
