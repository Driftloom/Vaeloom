# Vaeloom Disaster Recovery Runbook

This runbook defines recovery procedures for infrastructure failures, data
corruption, and region-level outages.

## RTO/RPO Targets

| Tier | Metric | Target | Severity |
| ------------ | ------------------------ | --------- | ----------------------------- |
| **Critical** | Recovery Time Objective | 1 hour | Full outage, data loss |
| **High** | Recovery Time Objective | 4 hours | Partial outage, degraded perf |
| **Medium** | Recovery Time Objective | 24 hours | Non-critical feature down |
| **Critical** | Recovery Point Objective | 5 minutes | Database writes |
| **High** | Recovery Point Objective | 1 hour | File storage writes |
| **Critical** | Availability SLA | 99.95% | Overall platform uptime |

## Backup Strategy

### Database (PostgreSQL RDS)

```bash
# Automated daily snapshots (retained 35 days)
# Automated transaction log backups every 5 minutes (retained 7 days)

# Manual snapshot for pre-deployment save point
aws rds create-db-snapshot \
  --db-instance-identifier vaeloom-${ENV} \
  --db-snapshot-identifier vaeloom-${ENV}-pre-deploy-$(date +%Y%m%d-%H%M)

# Export snapshot to S3 for long-term retention
aws rds export-task \
  --export-task-identifier vaeloom-${ENV}-weekly \
  --source-arn arn:aws:rds:${REGION}:${ACCOUNT}:snapshot:vaeloom-${ENV}-latest \
  --s3-bucket-name vaeloom-backups \
  --s3-prefix db-snapshots/ \
  --iam-role-arn arn:aws:iam::${ACCOUNT}:role/rds-s3-export
```

### File Storage (S3)

```bash
# Cross-region replication enabled on production bucket
aws s3 sync s3://vaeloom-files-prod s3://vaeloom-files-prod-dr --delete

# Lifecycle policy: transition to Glacier after 30 days, delete after 365 days
```

### Redis (ElastiCache)

Redis is a cache layer — no formal backup is required. On restart, it
repopulates from application usage. For the rate limiter, this means rate limits
reset on Redis failover.

## Backup Verification

```bash
# Weekly: restore snapshot to staging DB and run smoke tests
# Scheduled: Friday 02:00 UTC via GitHub Actions (.github/workflows/restore-test.yml)

aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vaeloom-backup-verify \
  --db-snapshot-identifier vaeloom-prod-latest-snapshot \
  --db-instance-class db.t3.medium

# Wait for restore
aws rds wait db-instance-available --db-instance-identifier vaeloom-backup-verify

# Run verification queries
PGPASSWORD=... psql -h vaeloom-backup-verify.${REGION}.rds.amazonaws.com \
  -U vaeloom -d vaeloom -c "
  SELECT count(*) as users FROM users;
  SELECT count(*) as tenants FROM tenants;
  SELECT count(*) as memories FROM memories;
  SELECT count(*) as knowledge_nodes FROM knowledge_nodes;
"

# Cleanup
aws rds delete-db-instance \
  --db-instance-identifier vaeloom-backup-verify \
  --skip-final-snapshot
```

## Full Restore Procedure

### Scenario: Complete database corruption or region failure

```bash
# 1. Identify the latest clean snapshot
SNAPSHOT=$(aws rds describe-db-snapshots \
  --db-instance-identifier vaeloom-prod \
  --query "sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier" \
  --output text)

# 2. Restore to a new RDS instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vaeloom-prod-restored \
  --db-snapshot-identifier $SNAPSHOT \
  --db-instance-class db.r6g.large \
  --vpc-security-group-ids $DB_SG \
  --db-subnet-group-name $DB_SUBNET_GROUP \
  --multi-az

# 3. Point restore to latest transaction log
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vaeloom-prod \
  --target-db-instance-identifier vaeloom-prod-restored \
  --restore-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --use-latest-restorable-time

# 4. Update DNS or connection string to point to restored instance
kubectl edit secret vaeloom-db -n vaeloom
# Update DATABASE_URL to point to vaeloom-prod-restored

# 5. Verify data integrity
kubectl exec -it deployment/vaeloom-api -- python -c "
from backend.database import engine
import asyncio
async def check():
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT count(*) FROM users'))
        print(f'Users: {result.scalar()}')
asyncio.run(check())
"

# 6. Scale up backend pods
kubectl scale deployment/vaeloom-api -n vaeloom --replicas=3

# 7. Rename restored instance to original name (optional)
aws rds modify-db-instance \
  --db-instance-identifier vaeloom-prod-restored \
  --new-db-instance-identifier vaeloom-prod
```

## Partial Restore (Single Tenant)

### Scenario: One tenant's data corrupted, others unaffected

```bash
# 1. Export tenant data from the latest clean snapshot
#    (Requires manual identification of the tenant's last known good state)
TENANT_ID="<affected-tenant-uuid>"

# 2. Restore snapshot as a temporary instance
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier vaeloom-tenant-restore \
  --db-snapshot-identifier $SNAPSHOT \
  --db-instance-class db.t3.small

# 3. Export tenant data
PGPASSWORD=... pg_dump -h vaeloom-tenant-restore.${REGION}.rds.amazonaws.com \
  -U vaeloom -d vaeloom \
  --data-only \
  --schema=public \
  --table=users \
  --table=memories \
  --table=knowledge_nodes \
  --table=knowledge_edges \
  --table=documents \
  --where="tenant_id='$TENANT_ID'" \
  -f tenant_${TENANT_ID}.sql

# 4. Execute in production with safety checks
#    (Run in a transaction, verify counts before commit)
psql -h $PROD_DB_HOST -U vaeloom -d vaeloom <<SQL
BEGIN;
DELETE FROM memories WHERE tenant_id = '$TENANT_ID';
DELETE FROM knowledge_nodes WHERE tenant_id = '$TENANT_ID';
DELETE FROM knowledge_edges WHERE tenant_id = '$TENANT_ID';
-- Confirm counts, then:
-- COMMIT; -- or ROLLBACK;
SQL

# 5. Import the tenant data
psql -h $PROD_DB_HOST -U vaeloom -d vaeloom -f tenant_${TENANT_ID}.sql

# 6. Notify tenant admin of restore
# 7. Clean up temp instance
aws rds delete-db-instance \
  --db-instance-identifier vaeloom-tenant-restore \
  --skip-final-snapshot
```

## Data Corruption Recovery

### Scenario: Application bug corrupts data (e.g., wrong merge in memory consolidation)

```bash
# 1. Identify corruption window (from application logs, audit trail)
# 2. Find the last clean snapshot before corruption

# 3. Restore to point-in-time just before corruption
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier vaeloom-prod \
  --target-db-instance-identifier vaeloom-pre-corruption \
  --restore-time "2026-07-22T14:30:00"

# 4. Export affected tables
pg_dump -h vaeloom-pre-corruption.${REGION}.rds.amazonaws.com \
  -U vaeloom -d vaeloom \
  --data-only \
  --table=knowledge_nodes \
  --table=knowledge_edges \
  -f pre_corruption_kg.sql

# 5. Import corrected data
psql -h $PROD_DB_HOST -U vaeloom -d vaeloom -f pre_corruption_kg.sql

# 6. Verify integrity
# The application's dedup/merge logic should reconcile any conflicts
```

## Region Failover

### Scenario: Primary AWS region (us-east-1) is unavailable

```bash
# Prerequisites: DR region (us-west-2) must have:
#   - RDS read replica promoted to primary
#   - EKS cluster running (reduced capacity)
#   - S3 cross-region replication active
#   - Route53 health check pointing to DR

# 1. Promote read replica to primary
aws rds promote-read-replica \
  --db-instance-identifier vaeloom-prod-dr

# 2. Update EKS to point to DR database
kubectl edit configmap vaeloom-config -n vaeloom
# Update DATABASE_URL to point to DR RDS endpoint

# 3. Scale up DR EKS cluster
kubectl scale deployment/vaeloom-api -n vaeloom --replicas=3
kubectl scale deployment/vaeloom-web -n vaeloom --replicas=3

# 4. Update DNS (Route53 failover)
# Route53 health check should automatically fail over to DR
# Manual override if needed:
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.vaeloom.dev",
        "Type": "A",
        "SetIdentifier": "dr",
        "Failover": "PRIMARY",
        "AliasTarget": {
          "HostedZoneId": "$DR_LB_ZONE_ID",
          "DNSName": "$DR_LB_DNS",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# 5. Verify DR is serving traffic
curl -f https://api.vaeloom.dev/health
curl -f https://app.vaeloom.dev

# 6. Announce incident via status page
```

### Failback to Primary

```bash
# 1. Wait for primary region to be healthy again
# 2. Create new RDS instance from DR snapshot
# 3. Reverse replication direction
# 4. Update DNS to point back to primary
# 5. Verify and announce resolution
```

## Incident Response

| Severity | Definition | Response | Escalation |
| -------- | ------------------------- | --------------- | ---------------- |
| SEV-1 | Complete platform outage | 15 min response | VP Eng |
| SEV-2 | Major feature unavailable | 30 min response | Engineering lead |
| SEV-3 | Minor feature degraded | 4 hour response | Team lead |
| SEV-4 | Cosmetic/bug | Next sprint | Jira ticket |

### Incident Communication

1. Acknowledge via PagerDuty (SEV-1/SEV-2) within SLA
2. Post in #incidents Slack channel with status
3. Update status page if customer-facing
4. Every 30 minutes: update with findings and ETA
5. After resolution: post-incident review within 48 hours

## Key Contacts

| Role | Contact |
| ---------------- | ------------------ |
| On-call engineer | PagerDuty schedule |
| Engineering lead | Slack @eng-lead |
| VP Engineering | Slack @vp-eng |
| Database admin | Slack @dba-team |
| Security officer | Slack @security |

## DR Test Schedule

| Test | Frequency | Quarter |
| --------------------------- | ------------------ | -------------- |
| Database restore to staging | Weekly (automated) | Ongoing |
| Cross-region failover | Quarterly | Q1, Q2, Q3, Q4 |
| Full DR演习 (tabletop) | Bi-annual | Q2, Q4 |
| Backup integrity check | Monthly | Ongoing |
