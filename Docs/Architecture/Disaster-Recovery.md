# Disaster Recovery

> **Purpose:** Define disaster recovery procedures for Vaeloom â€” ensuring data integrity and service continuity across failure scenarios
> **Status:** âœ… Upgraded to enterprise quality
> **Owner:** DevOps Team
> **Last Updated:** 2026-07-12

---

## Overview

Vaeloom's disaster recovery strategy follows a tiered approach based on data criticality and recovery speed. The strategy covers database recovery, service restoration, backup verification, and multi-region failover for enterprise deployments.

This document defines RTO/RPO targets, backup strategies, recovery procedures, and testing schedules.

## Recovery Architecture

```mermaid
graph TD
    subgraph "Failure Detection"
        F1[Monitoring Alert]
        F2[Automated Health Check]
        F3[User Report]
    end
    
    subgraph "DR Decision"
        D1{Severity Assessment}
        D1 -->|Critical| D2[Activate DR Plan]
        D1 -->|High| D3[Engage On-Call]
        D1 -->|Medium| D4[Next Business Day]
        D1 -->|Low| D5[Next Sprint]
    end
    
    subgraph "Recovery Actions"
        R1[Database Restore\nfrom Backup]
        R2[Service Redeploy\nPrevious Version]
        R3[Failover to\nSecondary Region]
        R4[Data Integrity\nVerification]
    end
    
    subgraph "Validation"
        V1[Smoke Tests Pass?]
        V1 -->|Yes| V2[Monitor 1 Hour]
        V1 -->|No| V3[Escalate]
        V2 --> V4[Declare Resolved]
    end
    
    D2 --> R1 & R2 & R3
    R1 & R2 & R3 --> R4
    R4 --> V1

    style D1 fill:#fff3e0
    style V1 fill:#fff3e0
    style R1 fill:#e3f2fd
    style V2 fill:#e8f5e9
```## Recovery Objectives

| Tier | RTO (Recovery Time) | RPO (Recovery Point) | Example Scenarios | DR Plan Activation |
|------|--------------------|---------------------|-------------------|-------------------|
| Critical | < 1 hour | < 5 min | Complete service outage, data corruption | Immediate |
| High | < 4 hours | < 1 hour | Regional outage, database failure | < 30 min |
| Medium | < 24 hours | < 24 hours | Non-critical service degradation | Next business day |
| Low | < 1 week | < 1 week | Cosmetic issues, non-functional features | Next sprint |

## Backup Strategy

```mermaid
gantt
    title Backup Schedule
    dateFormat  HH:mm
    axisFormat  %H:%M
    
    section Daily
    Database Full Backup     :daily, 01:00, 30min
    Object Store Replication :daily, 02:00, 15min
    
    section Continuous
    WAL Archiving (PG)       :crit, 00:00, 24h
    Stream Replication       :00:00, 24h
```

| Data | Frequency | Retention | Method | Location |
|------|-----------|-----------|--------|----------|
| PostgreSQL | Daily full + continuous WAL | 30 days daily, 12 months weekly | pg_dump + WAL archiving | S3 + cross-region replica |
| Object storage | Built-in durability (11 9's) | As long as user has account | S3 replication + versioning | Cross-region |
| Redis | AOF persistence | Rebuildable from PG | appendonly yes | Same region |
| Secrets | Secrets manager native backup | Per provider policy | Provider backup | Cross-region |
| Application config | Every deploy | Permanent (git history) | Git + CI artifacts | GitHub + artifact store |

## Recovery Procedures

### Tier 1: Database Recovery

```bash
# Full restore from daily backup
pg_restore -h localhost -U Vaeloom -d Vaeloom_db \
  --clean --if-exists \
  --jobs=4 \
  s3://Vaeloom-backups/db/2026-07-12/Vaeloom_db.dump

# Point-in-time recovery (to specific second)
pg_restore -h localhost -U Vaeloom -d Vaeloom_db \
  --clean --if-exists \
  --target-time "2026-07-12 14:30:00 UTC" \
  s3://Vaeloom-backups/db/2026-07-12/Vaeloom_db.dump

# Verify data integrity after restore
psql -h localhost -U Vaeloom -d Vaeloom_db -c "
  SELECT COUNT(*) as total_users FROM users;
  SELECT COUNT(*) as total_docs FROM documents;
  SELECT COUNT(*) as total_memories FROM memory_records;
"
```

### Tier 2: Service Recovery

```bash
# PaaS (MVP): redeploy from last known good version
flyctl deploy apps/api --image ghcr.io/Vaeloom/api:v1.2.3
flyctl deploy apps/web --image ghcr.io/Vaeloom/web:v1.2.3
flyctl deploy apps/ai-service --image ghcr.io/Vaeloom/ai-service:v1.2.3

# K8s (Enterprise): rollout undo
kubectl rollout undo deployment/Vaeloom-api -n Vaeloom
kubectl rollout undo deployment/Vaeloom-web -n Vaeloom
kubectl rollout undo deployment/Vaeloom-ai -n Vaeloom

# Verify all services are healthy
curl -f https://api.Vaeloom.dev/v1/health && \
  echo "API healthy" || \
  echo "API recovery failed â€” escalate"
```

### Tier 3: Cross-Region Failover

```bash
# 1. Promote read-replica to primary
aws rds promote-read-replica \
  --db-instance-identifier Vaeloom-db-replica

# 2. Update DNS to point to failover region
# (Managed via Route53 health checks â€” automatic)

# 3. Verify all services in failover region
curl -f https://api.Vaeloom.dev/v1/health && \
  curl -f https://Vaeloom.dev && \
  echo "Failover successful"
```

## Recovery Testing Schedule

| Test | Frequency | Scope | Success Criteria | Responsible |
|------|-----------|-------|-----------------|-------------|
| Backup verification | Monthly | Restore database backup in staging | All data intact, queries pass | DevOps |
| DR drill | Quarterly | Full recovery simulation in staging | RTO + RPO met | DevOps + SRE |
| Failover test | Annually | Cross-region failover (enterprise) | < 1 min DNS propagation | Infrastructure |
| Secrets restore | Quarterly | Restore from secrets manager backup | All services authenticate | Security |
| Object store recovery | Quarterly | Restore files from S3 backup | File integrity verified | DevOps |

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Automate recovery procedures | Manual recovery is error-prone under pressure |
| Test restores, not just backups | A backup that can't be restored is worthless |
| Document runbooks in version control | Runbooks stale quickly â€” keep them with code |
| Cross-region for critical data | Single region = single point of failure |
| Immutable infrastructure | Redeploy, don't repair â€” reduces recovery time |

## Common Mistakes

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Never testing backup restores | Backup is corrupt when needed | Monthly restore verification |
| Single-region deployment | Regional outage = total outage | Multi-region for enterprise |
| Manual recovery steps | Errors under incident pressure | Automate everything with scripts |
| No data integrity check after restore | Corrupted data served to users | Always run integrity queries post-restore |
| Secrets not backed up | Can't authenticate after recovery | Cross-region secrets replication |

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Large database restore time | Use parallel jobs in pg_restore, consider logical replication |
| WAL archive lag | Monitor archive lag, alert if > 5 min behind |
| Cross-region data transfer cost | Minimize frequent cross-region syncs |
| Recovery time vs data freshness | Trade-off: faster RTO = more recent RPO cost |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Backup data contains PII | Encrypt backups at rest (AES-256) |
| Backup access by unauthorized roles | IAM policies restrict backup access to DevOps team |
| Secrets in recovery scripts | Use secrets manager references, not hardcoded values |
| Cross-region data transfer | Encrypt in transit (TLS 1.3) |

## Goals

- Meet Critical-tier RTO of < 1 hour and RPO of < 5 minutes for all production data
- Achieve 100% automated recovery for Tier 1 (database) and Tier 2 (service) scenarios
- Verify backup integrity monthly and complete DR readiness quarterly
- Maintain cross-region backup replication for all critical data stores
- Ensure zero permanent data loss across all failure scenarios including regional outages

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Database backup, restore, and point-in-time recovery | Business continuity for third-party integrations |
| Service redeployment from last known good version | Physical site disaster recovery |
| Cross-region failover for enterprise deployments | Hardware-level redundant power/networking |
| Backup verification and DR drill scheduling | End-user data backup (client-side) |
| Secrets and configuration recovery | Legal/regulatory compliance documentation |

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DR-F1 | System shall support point-in-time recovery for PostgreSQL to any second within 30 days | P0 |
| DR-F2 | All backups shall be replicated to a secondary region automatically | P0 |
| DR-F3 | Recovery procedures shall be fully automated via scripts, not manual steps | P1 |
| DR-F4 | DR drills shall be executed quarterly and results documented | P1 |
| DR-F5 | Data integrity verification shall run automatically after every restore | P0 |

## Non-Functional Requirements

| ID | Requirement | Target | Measurement |
|----|-------------|--------|-------------|
| DR-N1 | Recovery Time Objective for critical tier | < 1 hour | DR drill timer |
| DR-N2 | Recovery Point Objective for critical tier | < 5 minutes | WAL archive lag |
| DR-N3 | Backup verification frequency | Monthly | Calendar audit |
| DR-N4 | DR drill success rate | 100% success | Drill report |
| DR-N5 | Cross-region replication lag | < 15 minutes | Replication lag metric |

## Components

| Component | Responsibility | Technology | Scale Strategy |
|-----------|---------------|------------|---------------|
| Backup Scheduler | Trigger daily full and continuous WAL backups | pg_cron + AWS Backup | Multi-region backup plan |
| WAL Archiver | Stream PostgreSQL WAL to S3 continuously | pg_receivewal + WAL-G | Parallel WAL streams at scale |
| Restore Engine | Automate database restore from backup with integrity check | Shell scripts + pg_restore | Parallel job execution for large DBs |
| Failover Orchestrator | Promote read replica and update DNS on primary failure | AWS RDS / custom scripts | Route53 health check automation |
| Verification Runner | Run data integrity queries after every restore | psql + custom SQL | Scheduled cron for monthly verification |

## Data Flow

1. Daily full PostgreSQL backup runs at 01:00 UTC using pg_dump with compression and parallel jobs, uploaded to S3
2. Continuous WAL archiving streams every transaction to S3 in near-real-time, providing sub-5-minute RPO
3. On critical failure, the Restore Engine pulls the latest full backup and replays WAL to the target point-in-time
4. Data integrity verification queries run automatically â€” if checks pass, traffic is routed to the restored database
5. For cross-region failover, the read replica in the secondary region is promoted to primary and DNS records are updated via health check automation

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Database size for backup | 50 GB | Parallel pg_dump with 4 jobs | Logical replication + pg_basebackup streaming |
| WAL archive volume | 10 GB/day | Compress WAL before upload | Partition WAL per tablespace |
| Restore time (full) | 30 min at 50 GB | Parallel pg_restore with 8 jobs | Physical replication for sub-minute failover |
| Cross-region transfer | 100 GB/day | S3 cross-region replication | Direct Connect for dedicated bandwidth |
| Recovery testing scope | Single region | Multi-region test every other quarter | Full active-active failover test quarterly |

## Error Handling

| Error Scenario | Detection | Mitigation | Recovery |
|----------------|-----------|------------|----------|
| Backup job failure | Prometheus alert on backup completion status | Retry within 1 hour, alert on-call if second failure | Manual backup trigger after root cause fix |
| WAL archive lag exceeding 5 min | Archive lag metric alert | Throttle write-heavy operations | Investigate archiver process health |
| Restore data integrity check failure | Integrity SQL returns non-zero mismatches | Abort recovery, preserve corrupted restore for analysis | Restore from earlier known-good backup |
| Cross-region replication failure | Replication lag alert > 30 min | Switch to async replication temporarily | Investigate network or storage issue |
| Secret rotation failure during recovery | Service authentication fails after restore | Fall back to previous secret version | Manual secrets manager sync |

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Last successful backup age | > 26 hours | Critical | Backup Status |
| WAL archive lag | > 5 min | Warning | Replication Health |
| Restore test success rate | < 100% monthly | Critical | DR Readiness |
| Cross-region replication lag | > 15 min | Warning | Regional Sync |
| Secrets manager sync age | > 7 days | Warning | Secrets Health |

## Configuration

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| DR_BACKUP_BUCKET | S3 bucket for database backups | Vaeloom-backups | Yes |
| DR_BACKUP_RETENTION_DAYS | Daily backup retention period | 30 | Yes |
| DR_WAL_ARCHIVE_INTERVAL_SECONDS | WAL archive upload frequency | 60 | Yes |
| DR_CROSS_REGION_TARGET | Secondary region for backup replication | us-west-2 | Yes |
| DR_RESTORE_PARALLEL_JOBS | Parallel job count for pg_restore | 4 | No |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backup corruption go undetected until needed | Low | Critical | Monthly restore test with integrity verification |
| WAL archive storage exhausted during high-write event | Low | High | Archive to S3 with lifecycle policies, alert on rate |
| Cross-region network outage preventing replication | Medium | Medium | Fall back to same-region backup with async replication |
| Secrets manager unavailable during recovery | Low | High | Cache secrets locally with 24h TTL and auto-refresh |
| RTO missed due to manual steps in recovery procedure | Medium | High | Automate all recovery steps, manual steps are fail-only |

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| pg_dump takes exclusive locks on large tables | Concurrent writes blocked during backup window | Use pg_dump --jobs=4 with minimal locking | pgBackRest for lock-free parallel backup |
| No active-active multi-region for MVP | Regional outage requires DNS failover with propagation delay | Route53 health checks with 60s TTL | Active-active deployment with global load balancer |
| Manual DR drill requires staging environment | Testing every restore interaction is impractical | Use isolated staging DB snapshot | Automated DR simulation in CI/CD pipeline |
| WAL archive replay is sequential | Restore speed limited by WAL apply rate | Use latest full backup to minimize WAL replay | Logical replication for near-instant failover |

## Examples

### Trigger a database restore

```bash
Vaeloom dr restore --type database --backup-id bk_20260713 --target production
```

### Verify backup integrity

```bash
Vaeloom dr verify --backup-id bk_20260713 --checksum sha256
```

### Run a DR drill

```bash
Vaeloom dr drill --scenario region-failure --staging
```

### Check RTO/RPO status

```bash
Vaeloom dr status --format table
```

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Active-active multi-region deployment | High | High | Q2 2027 |
| pgBackRest for lock-free zero-data-loss backup | Medium | Medium | Q4 2026 |
| Automated DR drill in CI/CD pipeline | Medium | High | Q1 2027 |
| Chaos engineering for failure scenario validation | Low | High | Q3 2027 |
| Real-time backup integrity verification via checksums | Medium | Low | Q3 2026 |

## Related Documents

- [`Operations/Incident Response.md`](../Operations/02-incident-response.md)
- [`DevOps/Deployment.md`](../DevOps/Deployment.md)
- [`Operations/SRE.md`](../Operations/SRE.md)
- [`Security/Encryption.md`](../Security/Encryption.md)
- [`Operations/Runbooks.md`](../Operations/01-operations-runbook.md)
