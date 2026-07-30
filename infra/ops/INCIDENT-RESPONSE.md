# Vaeloom — Incident Response Runbook

## Severity Definitions

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **SEV1** | Complete service outage or data loss. All users affected. | 15 min | Site down, DB corruption, auth broken, billing failures |
| **SEV2** | Major feature degraded or partial outage. Significant user impact. | 30 min | LLM responses failing, uploads broken, slow page loads >5s |
| **SEV3** | Minor feature degraded. Workaround available. Small subset affected. | 2 hours | Rate limiting too aggressive, cache misses, non-critical UI bug |
| **SEV4** | Cosmetic issue, documentation, or non-urgent bug. No user impact. | Next business day | Typo in UI, stale docs, non-critical log noise |

---

## On-Call Rotation

### Schedule
- **Primary on-call**: 1 engineer, 7-day rotation (Mon→Mon)
- **Secondary on-call**: 1 engineer, same rotation (offset by 1 week)
- **Escalation lead**: Engineering manager, always available

### Handoff
- Handoff occurs every Monday at 09:00 UTC
- Primary reviews active incidents and open tickets with incoming primary
- Update on-call calendar in PagerDuty / Opsgenie
- Ensure secondary is aware of any ongoing incidents

### Communication Channels
| Channel | Purpose |
|---------|---------|
| `#vaeloom-alerts` | Automated monitoring alerts (PagerDuty, CloudWatch, Sentry) |
| `#vaeloom-incidents` | Incident coordination and status updates |
| `#vaeloom-eng` | Technical discussion / debugging |
| Phone / Zoom bridge | SEV1/SEV2 escalation calls |
| `status.vaeloom.app` | Public status page updates |

---

## Incident Response Lifecycle

### 1. Detect

**Sources:**
- PagerDuty alert → page primary on-call
- CloudWatch Alarm → `#vaeloom-alerts`
- Sentry error spike → `#vaeloom-alerts`
- Synthetic health check failure → PagerDuty
- User report → Support ticket (SEV triaged within 15 min)
- Rate limit or error budget burn alert

### 2. Triage (Goal: <5 min)

1. **Acknowledge** the alert in PagerDuty
2. **Create incident channel** `#incident-<date>-<brief>` in Slack
3. **Classify severity** using the table above
4. **Post initial assessment** to `#vaeloom-incidents`:
   ```
   Time: 2025-07-22T14:30Z
   Severity: SEV2
   Service: backend
   Symptom: API returning 502 on /api/v1/agents
   Action: Investigating...
   ```
5. **Declare SEV1 immediately** if >5% of users are affected or data loss suspected

### 3. Mitigate (Goal: <30 min for SEV1)

**Primary goal: stop the bleeding — not root cause.**

| Mitigation Tactic | When to Use |
|-------------------|-------------|
| Rollback ECS task definition | Bad deploy, code defect |
| Scale up / scale out | Traffic spike, resource exhaustion |
| Feature flag disable | Isolate bad feature |
| Restore from DB snapshot | Data corruption |
| Failover to replica | Primary DB failure |
| Block traffic at WAF | DDoS or abusive traffic |
| Restart service | Memory leak, hung connections |

**Commands (use `make` scripts where available):**

```bash
# Rollback web service to previous task revision
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-web \
  --task-definition vaeloom-prod-web:${PREVIOUS_REVISION} \
  --force-new-deployment

# Rollback backend service
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-backend \
  --task-definition vaeloom-prod-backend:${PREVIOUS_REVISION} \
  --force-new-deployment

# Scale up backend (increase desired count)
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-backend \
  --desired-count 5

# Restart a single service from ECS
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-backend \
  --force-new-deployment
```

### 4. Resolve

1. Verify mitigation via health checks, metrics, and synthetic monitoring
2. Update `status.vaeloom.app` → "Resolved"
3. Post resolution summary to `#vaeloom-incidents`
4. Keep monitoring for 15 min (SEV1) or 5 min (SEV2) to confirm stability

### 5. Postmortem (Goal: within 5 business days)

Every SEV1 and SEV2 requires a written postmortem.

**Postmortem template:**

```markdown
# Postmortem: [Title]

Date: YYYY-MM-DD
Severity: SEV1 | SEV2
Duration: HH:MM → HH:MM (total: Xh Ym)
Services affected: [web, backend, db, redis, cdn]
Author: @name

## Timeline
- HH:MM — Alert triggered
- HH:MM — Incident declared, on-call engaged
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Service confirmed healthy
- HH:MM — Status page updated

## Root Cause
[Description of what went wrong]

## Impact
- Users affected: [number or %]
- Downtime: [duration]
- Errors: [number of 5xx responses]
- Data loss: [yes/no, details]

## Action Items
| Action | Owner | Due | Type |
|--------|-------|-----|------|
| Fix bug in ... | @name | YYYY-MM-DD | patch |
| Add alert for ... | @name | YYYY-MM-DD | monitoring |
| Update runbook for ... | @name | YYYY-MM-DD | docs |

## Lessons Learned
- What went well
- What went wrong
- What to improve
```

---

## Common Incident Types & Runbooks

### A. Service Down (502/503)

```
Symptoms:
- ALB returning 502 or 503
- Health checks failing
- No traffic reaching service

Triage:
1. Check ECS service events: aws ecs describe-services --cluster vaeloom-prod --services vaeloom-prod-backend
2. Check CloudWatch logs for startup errors
3. Verify task definition and image tag
4. Check if ECR image exists: aws ecr describe-images --repository-name vaeloom-backend

Mitigation:
- Rollback to previous working task revision
- If OOM: increase task memory in task definition
- If image pull failure: verify ECR credentials and image tag
```

### B. Database Degraded

```
Symptoms:
- Slow queries (>1s)
- Connection pool exhaustion
- RDS CPU > 80%
- Replication lag > 10s

Triage:
1. Check RDS CloudWatch metrics (CPU, Connections, ReadIOPS)
2. Check pg_stat_activity for long-running queries
3. Review slow query log in CloudWatch Logs

Mitigation:
- Kill long-running queries: SELECT pg_terminate_backend(pid)
- Scale up instance class (modify via RDS console)
- Increase PgBouncer pool size
- If replication lag: failover to replica
- If full: Run VACUUM ANALYZE or increase storage
```

### C. Redis Failure

```
Symptoms:
- Cache misses spike
- Rate limiting broken
- Session errors
- High latency on Redis commands

Triage:
1. Check ElastiCache CloudWatch metrics (CPU, Memory, Evictions)
2. Check for OOM: INFO memory on Redis
3. Verify network connectivity from ECS tasks

Mitigation:
- Scale up node type
- Clear keyspace: FLUSHALL (only if cache can be rebuilt)
- Failover to replica node
- If memory fragmentation: run MEMORY PURGE
```

### D. Security Incident

```
Symptoms:
- Unusual traffic patterns
- Failed auth attempts spike
- WAF blocks increasing
- Suspicious API calls

Triage:
1. Check CloudTrail for suspicious API activity
2. Review ALB access logs for abnormal patterns
3. Check WAF logs in CloudWatch
4. Review auth logs in application logs

Mitigation:
- Block IP at WAF: create IP set rule
- Rotate all credentials if compromised
- Revoke sessions: REDIS__URL FLUSHALL (if sessions in Redis)
- Isolate affected ECS tasks
- Contact security lead immediately
```

### E. LLM Provider Down

```
Symptoms:
- LLM responses failing
- 429 / 503 from Anthropic/OpenAI
- Agent tasks queued but not processing

Triage:
1. Check LLM provider status page
2. Verify API key hasn't expired / hit quota
3. Check application logs for provider error codes

Mitigation:
- Switch LLM_PROVIDER to fallback provider
- Reduce rate of LLM requests (increase rate limit window)
- Queue requests for retry when provider recovers
- Degrade gracefully — show cached responses or fallback responses
```

### F. High Latency

```
Symptoms:
- API p95 > 500ms
- Page load > 3s
- User complaints about slowness

Triage:
1. Check APM traces (OpenTelemetry) for slow spans
2. Check DB query performance
3. Check Redis cache hit ratio
4. Check ECS task CPU/memory utilization
5. Check ALB latency metrics

Mitigation:
- Scale out service (increase desired count)
- Scale up instance (increase task CPU/memory)
- Clear / warm cache
- Check for N+1 queries in application code
- Rate limit aggressive clients
```

---

## Escalation Paths

```
SEV4 ──→ Primary on-call (resolve within business hours)
  ↓ (if not resolved within 2h)
SEV3 ──→ Primary on-call + Secondary on-call
  ↓ (if not resolved within 30min)
SEV2 ──→ + Engineering Lead
  ↓ (if not resolved within 15min)
SEV1 ──→ + CTO / VP Engineering + All hands
```

| Role | Contact |
|------|---------|
| Primary on-call | PagerDuty rotation (phone + Slack) |
| Secondary on-call | PagerDuty rotation (Slack) |
| Engineering Lead | @eng-lead in Slack / phone |
| DevOps / Infra | @devops in Slack |
| Security Lead | @security in Slack / phone |
| CTO / VP Eng | @cto in Slack / phone |

**If escalation is unreachable within 5 minutes:** call the next person in the chain. Do not wait.

---

## Incident Command Structure (ICS) for SEV1

For SEV1 incidents, assign these roles:

| Role | Responsibility |
|------|---------------|
| **Incident Commander** | Coordinates response, communication, resource allocation |
| **Tech Lead** | Drives root cause investigation and mitigation |
| **Communications Lead** | Updates status page, internal slack, stakeholders |
| **Scribe** | Takes notes and builds timeline for postmortem |

---

## Post-Incident Tasks

- [ ] Status page updated to reflect resolution
- [ ] Postmortem written and shared within 5 business days
- [ ] Action items created and assigned in project tracker
- [ ] Alert thresholds adjusted if they fired too early/late
- [ ] Runbook updated with any new mitigation tactics discovered
- [ ] On-call handoff includes incident summary
- [ ] Incident tagged and tracked for trend analysis (weekly ops review)
