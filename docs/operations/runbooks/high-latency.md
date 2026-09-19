# High Latency — Runbook

**Alert:** `HighLatency` — p95 API latency exceeds 1 second for 5 minutes.

## Severity
- **p95 > 5s**: SEV1
- **p95 > 1s**: SEV2

## Immediate Triage (5 min)

1. **Identify slow endpoints**
   ```
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) by (path)
   ```
2. **Check database query performance**
   ```
   # Postgres: find long-running queries
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '1 second'
   ORDER BY duration DESC;
   ```
3. **Check OpenTelemetry traces** — identify slow spans
4. **Check resource utilization**
   ```
   docker stats vaeloom-backend
   # or AWS: CPU/Memory utilization in CloudWatch
   ```
5. **Check cache hit ratio** (Redis)
   ```
   redis-cli INFO stats | grep hit_rate
   ```

## Common Causes

| Cause | Symptoms | Fix |
|-------|----------|-----|
| N+1 queries | Slow on specific endpoints | Add selectinload / joinedload |
| Missing index | Table scans in slow queries | `EXPLAIN ANALYZE` — add index |
| Cache miss spike | Redis hit rate < 80% | Warm cache, increase TTL |
| Resource exhaustion | High CPU/memory | Scale out service |
| LLM response slow | Agent endpoints slow | Check provider status |
| Large payloads | Upload/download endpoints | Implement pagination |

## Resolution

1. **Add missing DB index**
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<table>_<column> ON <table>(<column>);
   ```
2. **Scale out service**
   ```
   aws ecs update-service --cluster vaeloom-prod --service vaeloom-prod-backend --desired-count <CURRENT+2>
   ```
3. **Warm cache**
   ```
   curl -X POST http://localhost:8000/admin/cache/warm
   ```
4. **Kill long-running queries** (last resort)
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '30 seconds';
   ```

## Post-Incident

- [ ] Add missing index to migrations
- [ ] Add query performance test
- [ ] Review N+1 patterns in code
- [ ] Update APM thresholds
