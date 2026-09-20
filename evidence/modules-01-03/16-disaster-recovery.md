# Modules 01–03 Disaster Recovery & High Availability Runbook

**Audit Date:** 2026-09-20  
**RTO Objective:** < 60 seconds  
**RPO Objective:** < 10 seconds

---

## 1. Disaster Recovery & Data Protection

### 1.1 State Partitioning & Replication

- **Primary Data Store:** PostgreSQL with streaming replication to a warm
  standby.
- **Session Cache & Rate Limiting:** Redis cluster with Sentinel failover;
  fallback to in-memory store if Redis becomes unreachable.
- **Secrets Management:** Infisical / HashiCorp Vault with local encrypted
  environment fallback.

### 1.2 Recovery Scenarios

1. **Primary Database Failure:** Automatic failover to standby replica;
   application reconnects within 15 seconds.
2. **Redis Outage:** Rate limiter falls back to `MemoryBackend`; session
   revocation falls back to `RevokedUserCutoff` DB table.
3. **Corrupted Migration / Policy Drift:** Alembic rollback command
   (`alembic downgrade -1`) restores preceding schema state.
