# High Error Rate — Runbook

**Alert:** `HighErrorRate` — API 5xx rate exceeds 5% for 5 minutes.

## Severity

- **>10% errors**: SEV1
- **5-10% errors**: SEV2

## Immediate Triage (5 min)

1. **Check alert dashboard** — identify which endpoints are failing
   ```
   rate(http_requests_total{status=~"5.."}[5m]) by (path)
   ```
2. **Check recent deploys** — did a deploy just roll out?
   ```
   git log --oneline -10
   ```
3. **Check application logs** — look for stack traces
   ```
   # Docker
   docker logs vaeloom-api --tail 100
   # CloudWatch
   aws logs tail /ecs/vaeloom-api --since 5m
   ```
4. **Check Sentry** — open Sentry dashboard, look for new error spike

## Common Causes

| Cause                   | Symptoms                    | Fix                               |
| ----------------------- | --------------------------- | --------------------------------- |
| Bad deploy              | Errors started after deploy | Rollback: `make rollback-backend` |
| DB migration issue      | 500 on specific endpoints   | `make db-rollback`                |
| LLM provider down       | 502 on agent endpoints      | Switch provider in env vars       |
| Throttling / rate limit | 429 responses               | Scale out or adjust limits        |
| Memory pressure         | OOM kills, slow then 503    | `docker stats` — increase memory  |

## Resolution

1. **If bad deploy**: rollback immediately
   ```
   aws ecs update-service --cluster vaeloom-prod --service vaeloom-prod-backend --task-definition vaeloom-prod-backend:<PREVIOUS_REVISION> --force-new-deployment
   ```
2. **If DB issue**: check migrations, rollback if needed
   ```
   cd apps/api && alembic downgrade -1
   ```
3. **If provider issue**: switch fallback or queue requests
4. **If memory leak**: restart service, open bug for leak investigation

## Post-Incident

- [ ] Root cause documented in postmortem
- [ ] Monitoring threshold adjusted if needed
- [ ] Automated test added to prevent regression
- [ ] Alert tuned to reduce noise
