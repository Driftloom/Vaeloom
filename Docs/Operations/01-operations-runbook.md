# Operations Runbook

> **Purpose:** Standard operating procedures for running the Vaeloom platform in production
> **Status:** Active
> **Owner:** Operations Team
> **Last Updated:** 2026-07-13
> **Applies to:** MVP deployment (PaaS) and Enterprise deployment (Kubernetes)

---

## Table of Contents

1. [Service Architecture Overview](#1-service-architecture-overview)
2. [Health Checks & Monitoring](#2-health-checks--monitoring)
3. [Common Procedures](#3-common-procedures)
4. [Backup & Restore](#4-backup--restore)
5. [Deployment Procedures](#5-deployment-procedures)
6. [Scaling](#6-scaling)
7. [Secrets Management](#7-secrets-management)
8. [Database Operations](#8-database-operations)
9. [Agent System Operations](#9-agent-system-operations)
10. [Cost Management](#10-cost-management)
11. [Runbook Checklists](#11-runbook-checklists)

---

## 1. Service Architecture Overview {#1-service-architecture-overview}

### MVP deployment (PaaS)

```mermaid
graph LR
    classDef web fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef ai fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef data fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1px
    classDef ext fill:#ffebee,stroke:#c62828,color:#000,stroke-width:1px

    subgraph Services["ðŸš€ Services"]
        WEB["apps/web (Next.js)<br/>1+ instance"]
        API["apps/api (NestJS)<br/>1+ instance"]
        AI_SVC["apps/ai-service (FastAPI)<br/>1+ instance"]
    end

    subgraph Infra["âš™ï¸ Infrastructure"]
        PG["PostgreSQL<br/>+ AGE + pgvector"]
        REDIS["Redis<br/>Queue + cache"]
    end

    subgraph External["ðŸ”— External Dependencies"]
        E1["Anthropic Claude API<br/>SLA: 99.9%"]
        E2["Auth Provider<br/>SLA: 99.95%"]
        E3["S3 Storage<br/>SLA: 99.99%"]
        E4["Gmail/Google API<br/>SLA: 99.9%"]
    end

    WEB --> API --> AI_SVC
    API & AI_SVC --> PG & REDIS
    AI_SVC --> E1 & E2
    API --> E3 & E4

    class WEB web
    class API api
    class AI_SVC ai
    class PG,REDIS data
    class E1,E2,E3,E4 ext
```

### Service dependencies

| Service | Depends on | Health check endpoint |
|---------|------------|----------------------|
| apps/web | apps/api | `GET /api/health` |
| apps/api | Postgres, Redis | `GET /health` (checks DB + Redis) |
| ai-service | Postgres, Redis, Claude API | `GET /health` (checks all dependencies) |

### External dependencies

| Dependency | Type | SLA expectation | Failure mode |
|------------|------|----------------|--------------|
| Anthropic Claude API | Model provider | 99.9% | Fallback model, degraded agent quality |
| Auth provider (e.g., Clerk/Auth0) | Auth | 99.95% | Login failures, cached sessions still work |
| S3-compatible storage | Object storage | 99.99% | Upload failures, reads from cache |
| Gmail/Google API | Connector | 99.9% per Google SLA | Connector shows "degraded" status |

---

## 2. Health Checks & Monitoring

<a id="2-health-checks--monitoring"></a>

### Health check endpoints

```text
GET /health          â†’ { status: "ok", version: "x.y.z", uptime: 12345 }
GET /health/ready    â†’ { status: "ok", deps: { db: "ok", redis: "ok", ai: "ok" } }
GET /health/live     â†’ { status: "ok" }
```

### Key metrics to monitor

| Metric | What it measures | Alert threshold | Severity |
|--------|-----------------|-----------------|----------|
| `api_request_latency_seconds` | API response time | > 2s p99 for 5 min | Warning |
| `ai_request_latency_seconds` | Agent response time | > 10s p99 for 5 min | Warning |
| `queue_depth` | BullMQ queue size | > 1000 for 10 min | Critical |
| `memory_write_rate` | Memory Agent writes/sec | Drop to 0 for 5 min | Critical |
| `agent_error_rate` | Agent failure rate | > 5% for 5 min | Warning |
| `db_connection_pool_usage` | Postgres connections | > 80% for 5 min | Warning |
| `redis_memory_usage` | Redis memory | > 80% for 10 min | Warning |
| `embedding_queue_depth` | Pending embedding jobs | > 500 for 10 min | Warning |

### Logging

All services emit structured JSON logs:

```json
{
  "level": "info",
  "timestamp": "2026-07-12T10:30:00Z",
  "service": "ai-service",
  "agent": "memory-agent",
  "action": "extract_entities",
  "document_id": "doc_abc123",
  "duration_ms": 342,
  "entities_found": 12
}
```

Log levels: `debug`, `info`, `warn`, `error`, `fatal`

### Alerting channels

| Severity | Channel | Response time | Notification method |
|----------|---------|---------------|-------------------|
| Critical | On-call engineer | < 15 min | PagerDuty/OpsGenie push + SMS |
| Warning | Engineering team | < 1 hour | Slack #alerts channel |
| Info | Engineering team | Next business day | Slack #general |

---

## 3. Common Procedures {#3-common-procedures}

### 3.1 Restart a service

```bash
# PaaS (Render/Fly.io)
flyctl restart apps/api
flyctl restart ai-service

# Kubernetes
kubectl rollout restart deployment/apps-api -n Vaeloom
kubectl rollout restart deployment/ai-service -n Vaeloom
```

**Verify:** Check `GET /health` returns `status: "ok"` within 60 seconds.

### 3.2 View recent logs

```bash
# PaaS
flyctl logs -a apps-api --tail

# Kubernetes
kubectl logs -n Vaeloom -l app=apps-api --tail=100 -f
```

### 3.3 Scale a service

```bash
# PaaS
flyctl scale count apps-api=3

# Kubernetes
kubectl scale deployment/apps-api -n Vaeloom --replicas=3
```

### 3.4 Run a database migration

```bash
# Via migration runner
kubectl create job --from=cronjob/db-migrate -n Vaeloom db-migrate-manual-001

# Or via API service
kubectl exec -n Vaeloom deploy/apps-api -- npx prisma migrate deploy
```

### 3.5 Clear Redis cache

```bash
# Clear specific cache namespace
kubectl exec -n Vaeloom deploy/redis -- redis-cli DEL "cache:dashboard:*"

# Clear all cache (caution â€” performance impact)
kubectl exec -n Vaeloom deploy/redis -- redis-cli FLUSHDB
```

### 3.6 Re-run a failed ingestion job

```bash
# Via API
curl -X POST https://api.Vaeloom.dev/internal/jobs/replay \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  -d '{"job_id": "job_abc123", "reason": "transient_failure"}'
```

---

## 4. Backup & Restore

<a id="4-backup--restore"></a>

### 4.1 Database backups

**Schedule:** Full backup daily, WAL archiving continuous

```bash
# Manual full backup
pg_dump -h localhost -U Vaeloom -d Vaeloom_db \
  --format=custom \
  --compress=9 \
  --file=backup_$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -U Vaeloom -d Vaeloom_db \
  --clean \
  --if-exists \
  backup_20260712.dump
```

**Retention:** Daily backups kept 30 days, weekly backups kept 12 months

### 4.2 Object storage backups

Documents stored in S3-compatible storage are durable by design (99.999999999%). Enable cross-region replication for enterprise.

### 4.3 Redis persistence

Redis is used as a cache (loss acceptable) and queue (persistence desired). Enable AOF persistence:

```bash
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec
```

### 4.4 Verification

Test full restore in staging environment quarterly:

1. Provision clean staging database
2. Restore from most recent backup
3. Run smoke tests against restored data
4. Document any issues found

---

## 5. Deployment Procedures {#5-deployment-procedures}

### 5.1 Standard deployment

```yaml
# .github/workflows/deploy.yml (conceptual)
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci && npm test
      - run: cd ai-service && pip install -r requirements.txt && pytest
  
  deploy-staging:
    needs: [test]
    steps:
      - run: flyctl deploy apps/api --app Vaeloom-api-staging
      - run: flyctl deploy ai-service --app Vaeloom-ai-staging
      - run: flyctl deploy apps/web --app Vaeloom-web-staging
      - run: ./scripts/smoke-test.sh staging.Vaeloom.dev
  
  deploy-production:
    needs: [deploy-staging]
    environment: production
    steps:
      - run: flyctl deploy apps/api --app Vaeloom-api
      - run: flyctl deploy ai-service --app Vaeloom-ai
      - run: flyctl deploy apps/web --app Vaeloom-web
      - run: ./scripts/smoke-test.sh Vaeloom.dev
```

### 5.2 Rollback procedure

```bash
# PaaS â€” redeploy previous version
flyctl deploy apps/api --image Vaeloom-api:vPrevious

# Kubernetes
kubectl rollout undo deployment/apps-api -n Vaeloom
```

**Verify rollback:** Run smoke tests and check error rates for 10 minutes before declaring success.

### 5.3 Blue-green deployment (Kubernetes)

For zero-downtime deployments:

1. Deploy new version to `-green` environment
2. Run smoke tests against green
3. Switch load balancer from `-blue` to `-green`
4. Monitor for 15 minutes
5. Tear down `-blue`

---

## 6. Scaling {#6-scaling}

### 6.1 When to scale

| Service | Scale-up trigger | Scale-down trigger |
|---------|-----------------|-------------------|
| apps/web | CPU > 70% for 10 min | CPU < 30% for 30 min |
| apps/api | Latency p99 > 1s for 5 min | Latency p99 < 200ms for 30 min |
| ai-service | Queue depth > 500 for 5 min | Queue depth < 50 for 30 min |
| Postgres | Connections > 80% for 10 min | Connections < 50% for 1 hour |
| Redis | Memory > 80% for 10 min | Memory < 60% for 1 hour |

### 6.2 Vertical vs horizontal scaling

| Service | MVP approach | Enterprise approach |
|---------|-------------|-------------------|
| apps/web | Horizontal (add instances) | Horizontal (auto-scaling) |
| apps/api | Horizontal (add instances) | Horizontal (auto-scaling) |
| ai-service | Horizontal (add instances) | Horizontal (auto-scaling + GPU) |
| Postgres | Vertical (larger instance) | Read replicas + partitioning |
| Redis | Vertical (larger instance) | Cluster mode |

---

## 7. Secrets Management {#7-secrets-management}

### 7.1 Secret types

| Secret | Storage | Rotation |
|--------|---------|----------|
| OAuth tokens (Gmail, GitHub, etc.) | Secrets manager | Auto-refresh via Connector Agent |
| Anthropic API key | Secrets manager | Manual, quarterly |
| Database password | Secrets manager | Manual, per incident |
| JWT signing key | Secrets manager (per env) | Manual, quarterly |
| Redis password | Secrets manager | Manual, per incident |

### 7.2 Secret rotation procedure

```bash
# 1. Generate new secret
openssl rand -base64 32 | tr -d '\n' > new-secret.txt

# 2. Update secrets manager
flyctl secrets set DATABASE_PASSWORD=$(cat new-secret.txt) -a Vaeloom-api

# 3. Rotate database password
psql -h localhost -U admin -d Vaeloom_db \
  -c "ALTER USER Vaeloom WITH PASSWORD '$(cat new-secret.txt)';"

# 4. Restart affected services
flyctl restart apps/api

# 5. Verify connectivity
curl https://api.Vaeloom.dev/health

# 6. Delete old secret files
rm new-secret.txt
```

---

## 8. Database Operations {#8-database-operations}

### 8.1 Connection pool sizing

| Service | Pool size | Max connections |
|---------|-----------|----------------|
| apps/api | 10 | 20 |
| ai-service | 5 | 10 |
| Background workers | 3 | 5 |
| **Total** | **18** | **35** |

Set `max_connections` in Postgres to at least 50 for MVP.

### 8.2 Query performance

Slow query detection:

```sql
-- Find queries taking > 1 second
SELECT query, calls, mean_time, rows
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC
LIMIT 20;
```

### 8.3 Vacuum and maintenance

```sql
-- Manual vacuum (run during low traffic)
VACUUM ANALYZE memory_records;
VACUUM ANALYZE agent_actions;

-- Check bloat
SELECT schemaname, tablename, n_dead_tup, n_live_tup
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000;
```

---

## 9. Agent System Operations {#9-agent-system-operations}

### 9.1 Agent health monitoring

Each agent in the system publishes health metrics:

| Metric | What it measures | Healthy range |
|--------|-----------------|---------------|
| `agent.memory.extraction_rate` | Entities extracted per minute | > 10 |
| `agent.memory.merge_rate` | Merges per minute | 1â€“100 |
| `agent.organization.proposal_rate` | Proposals generated per minute | > 1 |
| `agent.organization.approval_rate` | User approval % of proposals | > 80% |
| `agent.resume.generation_time` | Time to generate resume variant | < 30s |
| `agent.job_search.latency` | Time to return shortlist | < 15s |

### 9.2 Agent queue management

| Queue | Priority | Concurrency | Max retries |
|-------|----------|-------------|-------------|
| ingestion | High | 3 | 3 |
| memory_extraction | High | 2 | 3 |
| organization | Medium | 2 | 2 |
| resume_generation | Low | 1 | 2 |
| job_search | Low | 1 | 1 |
| gmail_scan | Medium | 1 | 3 |

### 9.3 Manual agent intervention

```bash
# Force an agent to re-process a document
curl -X POST https://api.Vaeloom.dev/internal/agents/reprocess \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  -d '{"document_id": "doc_abc123", "agent": "memory_agent"}'

# Clear agent error state
curl -X POST https://api.Vaeloom.dev/internal/agents/clear-error \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  -d '{"agent": "gmail_agent", "workspace_id": "ws_xyz"}'
```

---

## 10. Cost Management {#10-cost-management}

### 10.1 AI model costs

| Model usage | Estimated cost per month (1K users) | Optimization |
|-------------|-------------------------------------|--------------|
| Classification (Gmail Agent) | $50â€“150 | Use cheapest adequate model |
| Entity extraction (Memory Agent) | $200â€“500 | Batch + deduplicate |
| Resume generation | $100â€“300 | Cache variants |
| Chat (user-facing) | $300â€“1,000 | Context window management |

### 10.2 Infrastructure costs (MVP)

| Service | Estimated monthly | Notes |
|---------|------------------|-------|
| Web app hosting | $25â€“100 | PaaS, 2â€“3 instances |
| API hosting | $25â€“100 | PaaS, 2â€“3 instances |
| AI service hosting | $50â€“200 | May need GPU instance |
| Postgres | $15â€“50 | Managed, smallest tier |
| Redis | $15â€“30 | Managed, smallest tier |
| Object storage | $5â€“20 | Per GB stored |
| **Total** | **$135â€“500** | Scales with users + documents |

### 10.3 Cost alerts

Set budget alerts at:

- 80% of monthly projected spend â†’ warning notification
- 100% of monthly budget â†’ critical alert, review all services

---

## 11. Runbook Checklists {#11-runbook-checklists}

### 11.1 Daily checks

- [ ] All services report `health: "ok"`
- [ ] No queue depths > 500
- [ ] No agent error rates > 5%
- [ ] Database backups completed successfully
- [ ] No unusual cost spikes

### 11.2 Weekly checks

- [ ] Review slow query log
- [ ] Check database bloat
- [ ] Review agent approval rates
- [ ] Verify connector health for all connected users
- [ ] Review error budgets

### 11.3 Monthly checks

- [ ] Full restore test in staging
- [ ] Secret rotation for any keys nearing expiry
- [ ] Review and update runbook
- [ ] Capacity planning review
- [ ] Cost optimization review

### 11.4 Quarterly checks

- [ ] Penetration test (can be scoped)
- [ ] Disaster recovery drill
- [ ] Compliance review (if applicable)
- [ ] Dependency update audit
- [ ] Performance benchmark

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Runbooks that are not tested regularly | A procedure that hasn't been tested in 6 months is likely wrong â€” services change, endpoints move, credentials rotate. Test every runbook procedure quarterly in staging |
| Runbooks that assume too much context | Steps like "restart the service" without specifying which service, how, or how to verify â€” every procedure must be executable by a junior engineer with no prior context |
| Runbooks without verification steps | A procedure that says "deploy the fix" without "verify the fix by checking X endpoint returns Y" â€” without verification, you don't know if the procedure actually worked |

## Best Practices

| Practice | Why |
|----------|-----|
| Keep runbooks in version control alongside the code | Runbooks drift when they're in a wiki separate from the codebase â€” treat runbooks as code: PR them alongside service changes, review them in code review |
| Include explicit verification steps after every action | Each procedure should end with "Verify: run this command, expect this output" â€” verification confirms the procedure worked and provides a clear done signal |
| Test runbooks in staging before relying on them in production | A quarterly runbook drill in staging catches drift before it matters â€” schedule runbook testing as a recurring calendar event |

## Security

| Concern | Mitigation |
|---------|------------|
| Runbooks containing hardcoded credentials | A runbook with `export DATABASE_URL=postgres://admin:password@...` exposes secrets to everyone with repo access â€” use `$SECRET_NAME` placeholders and reference the secrets manager |
| Runbook access allowing privilege escalation | A runbook that grants temporary database admin access for backups could be used to exfiltrate data â€” monitor and audit all runbook-driven privilege escalations |
| Incident response runbooks revealing internal architecture | Runbooks published to a status page or shared with customers may expose internal service names and IPs â€” maintain a customer-safe version of the runbook |

## Performance

| Concern | Mitigation |
|---------|------------|
| Runbook procedures that create performance regressions | A runbook step like "clear Redis cache" without staggering across instances causes a thundering herd of cache misses â€” add rate-limiting delays to cache-clearing procedures |
| Backup and restore procedures that block production traffic | A full database restore on a production replica locks tables â€” use point-in-time recovery instead of full restores during business hours |
| Scaling procedures that overshoot demand | Manually scaling from 2 to 10 instances based on a hunch wastes money â€” scaling decisions should be data-driven and use the capacity planning triggers, not manual estimates |

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Runbooks containing hardcoded credentials | A runbook with `export DATABASE_URL=postgres://admin:password@...` exposes secrets to everyone with repo access â€” use `$SECRET_NAME` placeholders and reference the secrets manager |
| Runbook access allowing privilege escalation | A runbook that grants temporary database admin access for backups could be used to exfiltrate data â€” monitor and audit all runbook-driven privilege escalations |
| Incident response runbooks revealing internal architecture | Runbooks published to a status page or shared with customers may expose internal service names and IPs â€” maintain a customer-safe version of the runbook |

## Performance Considerations

| Concern | Approach |
|---------|----------|
| Runbook procedures that create performance regressions | A runbook step like "clear Redis cache" without staggering across instances causes a thundering herd of cache misses â€” add rate-limiting delays to cache-clearing procedures |
| Backup and restore procedures that block production traffic | A full database restore on a production replica locks tables â€” use point-in-time recovery instead of full restores during business hours |
| Scaling procedures that overshoot demand | Manually scaling from 2 to 10 instances based on a hunch wastes money â€” scaling decisions should be data-driven and use the capacity planning triggers, not manual estimates |

---

## Workflows

1. **Daily health check:** Run automated health checks â†’ verify all services `status: "ok"` â†’ check no queue depths > 500 â†’ confirm backups completed
2. **Incident response:** Alert â†’ acknowledge â†’ mitigate (rollback/feature flag/scale) â†’ verify â†’ recover â†’ post-mortem
3. **Routine maintenance:** Weekly (error budgets, dependencies, backups) â†’ Monthly (VACUUM, slow queries, storage, key rotation) â†’ Quarterly (capacity, DR drill, dependencies, benchmarks)
4. **Cost management:** Monitor daily spend â†’ review per-user AI costs â†’ adjust model routing â†’ optimize infrastructure
5. **Scaling decision:** Monitor triggers (CPU, latency, queue depth, connections, memory) â†’ auto-scale or manual scale â†’ verify
6. **Secrets rotation:** Generate new secret â†’ update secrets manager â†’ rotate service â†’ verify connectivity â†’ clean up old secret
7. **Backup restore test:** Provision clean staging â†’ restore from latest backup â†’ run smoke tests â†’ document issues

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Services managed | 5 | 15: per-service runbooks with automation | 50: service mesh with auto-remediation |
| Instance count | 2-4 per service | 10-20 per service: HPA with custom metrics | 50-100: global load balancing |
| Queue throughput | 1000 jobs/min | 10000 jobs/min: auto-scaling workers | 100K jobs/min: partitioned queues |
| Database connections | 35 | 350: PgBouncer pool expansion | 3500: read replicas + sharding |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Service crash/restart loop | Health check fails repeatedly | Rollback to previous version | Investigate crash logs, fix bug |
| Queue backlog blocks processing | Queue depth > 1000 for 10 min | Increase worker concurrency | Reprocess failed jobs after fix |
| Database connection pool exhausted | Connection errors in logs | Kill long-running queries, increase pool | Optimize query patterns, add connection pooling |
| Memory leak causes OOM | Instance restart, error logs | Increase memory limit temporarily | Fix leak, deploy fix, monitor |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| API latency p99 | > 2s for 5 min | Warning | Service Health |
| AI latency p99 | > 10s for 5 min | Warning | AI Service |
| Queue depth | > 1000 for 10 min | Critical | Queue Dashboard |
| Error rate (any service) | > 5% for 5 min | Critical | Error Dashboard |
| Memory usage | > 80% for 10 min | Warning | Resource Usage |

---

## Deployment

| Environment | Method | Trigger | Verification |
|-------------|--------|---------|--------------|
| Staging | CI/CD auto-deploy on merge to main | PR merged | Smoke tests pass |
| Production | Manual approval after staging | Verified staging | Health check + error rate monitoring |
| Emergency hotfix | Direct deploy (with approval) | Critical bug/security issue | Immediate monitoring verification |
| Rollback | Deploy previous image | Post-deploy issue detected | Health checks return to baseline |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| MVP uses PaaS (limited control) | No container orchestration, limited auto-scaling | Manual scaling decisions | Migrate to Kubernetes for enterprise |
| Manual production approval gate | Delays urgent deployments | Pre-approved window for hotfixes | Automated approval for low-risk changes |
| No blue-green deployments | Brief downtime during deploys | Deploy during low-traffic windows | Zero-downtime blue-green for all services |
| Database migration requires manual run | Risk of missed migration step | Runbook checklist with verification | Automated migration as part of CI/CD |

---

## Overview

The Operations Runbook is the authoritative reference for standard operating procedures required to run the Vaeloom platform in production. It covers the full lifecycle of service management â€” from health checks and deployment to scaling, secrets rotation, and database maintenance â€” for both the MVP PaaS deployment and the enterprise Kubernetes deployment.

This document is written for the operations team, on-call engineers, and any developer who needs to perform production procedures on Vaeloom's services. Each procedure includes explicit steps, expected outcomes, and verification commands to ensure correctness even under time pressure.

As a second-brain AI platform serving education and career workflows, Vaeloom depends on continuous availability of its agent system (memory, organization, resume, job-search agents), document processing pipeline, and connector integrations. This runbook ensures that every operator â€” regardless of seniority â€” can maintain, diagnose, and restore these critical services with confidence.

Operations runbooks are only as reliable as their testing cadence. Every procedure in this document should be validated in staging quarterly, and the runbook itself should be updated as part of every post-incident review.

## Goals

- Standardize all production procedures â€” health checks, backup/restore, deployments, scaling, secrets management, database ops, and agent system operations â€” into repeatable, verified steps
- Reduce mean-time-to-recovery (MTTR) by providing clear, executable procedures that any on-call engineer can follow without tribal knowledge
- Define alert thresholds, escalation paths, and monitoring metrics for every Vaeloom service (web, API, AI service, Postgres, Redis)
- Codify cost management practices specific to AI inference spend, which represents 50-60% of Vaeloom's operational costs
- Establish a regular testing and review cadence (daily, weekly, monthly, quarterly checklists) to prevent runbook drift

## Scope

### In Scope

- Service architecture overview for MVP (PaaS) and Enterprise (Kubernetes) deployments including all microservices and dependencies
- Health check endpoints, monitoring metrics, alert thresholds, and logging standards for all services
- Common procedures: restart, log inspection, scaling, database migrations, cache clearing, and job re-processing
- Backup and restore procedures for PostgreSQL, Redis, and S3 object storage with retention policies
- Deployment procedures including CI/CD workflow, rollback, and blue-green deployment for zero-downtime
- Horizontal and vertical scaling triggers per service with MVP and enterprise approaches
- Secrets management types, storage, and rotation procedures
- Database operations: connection pool sizing, slow query detection, vacuum and maintenance
- Agent system operations: health monitoring per agent (memory, organization, resume, job-search), queue management, and manual intervention
- Cost management for AI model inference and infrastructure spend with budget alerts

### Out of Scope

- Incident response and post-mortem processes (covered in Incident Response Plan)
- Business continuity and disaster recovery planning (covered in Business Continuity Plan)
- SLA/SLO/SLI definitions and tracking (covered in SLA, SLO, and SLI documents)
- Detailed infrastructure-as-code configuration (covered in DevOps documentation)
- Security incident procedures and compliance audits (covered in Security documentation)

---

## Examples

### Health Check Usage (CLI)

```bash
# Quick health verification across all services
curl -s https://api.Vaeloom.dev/health | jq '.status'
curl -s https://api.Vaeloom.dev/health/ready | jq '.deps'
curl -s https://ai.Vaeloom.dev/health | jq '.status'
```

### Scale a Service (CLI)

```bash
# Scale API service to handle load
flyctl scale count apps-api=5
# Verify scaling
flyctl status -a apps-api | grep "Instances"

# Kubernetes equivalent
kubectl scale deployment/apps-api -n Vaeloom --replicas=5
kubectl get pods -n Vaeloom -l app=apps-api
```

### Database Migration (CLI)

```bash
# Check pending migrations
kubectl exec -n Vaeloom deploy/apps-api -- npx prisma migrate status
# Apply migration
kubectl create job --from=cronjob/db-migrate -n Vaeloom db-migrate-manual-$(date +%s)
```

### Redis Cache Operations (CLI)

```bash
# Check cache hit rate
redis-cli -h $REDIS_ENDPOINT INFO stats | grep -E "keyspace_hits|keyspace_misses"
# Clear a specific namespace
redis-cli -h $REDIS_ENDPOINT DEL "cache:inference:*"
```

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Zero-downtime blue-green deployments | High | High | Q1 2027 |
| Kubernetes migration for enterprise | High | High | Q2 2027 |
| Automated database migrations in CI/CD | Medium | Medium | Q4 2026 |
| Self-healing auto-remediation for common failures | Medium | High | Q2 2027 |
| AI-assisted runbook execution | Low | High | Q3 2027 |

## Related Documents

- [Incident Response Plan](./02-incident-response.md) â€” Procedures for detecting and responding to production incidents
- [DevOps README](../DevOps/README.md) â€” Deployment infrastructure and CI/CD
- [Architecture README](../Architecture/README.md) â€” System architecture being operated
- [Security README](../Security/README.md) â€” Security policies and compliance

*Maintained by the Vaeloom engineering team. Last updated: Q4 2026.*
