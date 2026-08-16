# Service Down — Runbook

**Alert:** `ServiceDown` — health/liveness/startup probe fails 3 consecutive
times.

## Severity

- SEV1 — complete service outage

## Immediate Triage (5 min)

1. **Verify the alert** — manually curl the endpoints
   ```
   curl -v http://<SERVICE_URL>/health
   curl -v http://<SERVICE_URL>/health/ready
   curl -v http://<SERVICE_URL>/health/startup
   ```
2. **Check if process is running**
   ```
   # Docker
   docker ps | grep vaeloom
   docker logs vaeloom-api --tail 50
   # Systemd
   systemctl status vaeloom-api
   # ECS
   aws ecs describe-services --cluster vaeloom-prod --services vaeloom-prod-backend
   ```
3. **Check port availability**
   ```
   netstat -tlnp | grep 8000
   # or: ss -tlnp | grep 8000
   ```
4. **Check recent changes** — config, env vars, network rules

## Common Causes

| Cause             | Symptoms                     | Fix                      |
| ----------------- | ---------------------------- | ------------------------ |
| Process crashed   | No process listening         | Restart service          |
| OOM kill          | Container exits with 137     | Increase memory limit    |
| Config error      | Startup failure in logs      | Fix config, redeploy     |
| Port conflict     | Address already in use       | Kill conflicting process |
| DB unavailable    | "connection refused" startup | Check DB status          |
| Migration failure | Alembic error in logs        | Rollback migration       |

## Resolution

### Option A: Restart service

```bash
# Docker
docker restart vaeloom-api

# ECS — force new deployment
aws ecs update-service --cluster vaeloom-prod --service vaeloom-prod-backend --force-new-deployment

# Direct
make restart-backend
```

### Option B: Rollback to previous version

```bash
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-backend \
  --task-definition vaeloom-prod-backend:<PREVIOUS_REVISION> \
  --force-new-deployment
```

### Option C: Rollback database migration

```bash
cd apps/api
alembic downgrade -1
# then restart
```

### Option D: Scale from zero

```bash
aws ecs update-service \
  --cluster vaeloom-prod \
  --service vaeloom-prod-backend \
  --desired-count 2
```

## Verify Recovery

```
curl -f http://<SERVICE_URL>/health && echo "OK"
curl -f http://<SERVICE_URL>/health/ready && echo "READY"
```

## Post-Incident

- [ ] Root cause identified — crash, config, or dependency?
- [ ] Postmortem written within 5 business days
- [ ] Auto-recovery tested (restart policy, health checks)
- [ ] Alert tuned to prevent noise (retries, debounce)
