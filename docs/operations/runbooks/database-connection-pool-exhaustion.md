# Database Connection Pool Exhaustion — Runbook

**Alert:** `DatabaseConnectionPoolExhaustion` — active backend connections exceed 80.

## Severity
- **Pool 100%**: SEV1 — new requests queue / fail
- **Pool >80%**: SEV2 — risk of exhaustion

## Immediate Triage (5 min)

1. **Check current connection count**
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE state IS NOT NULL;
   SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
   ```
2. **Check pool configuration**
   ```sql
   SHOW max_connections;
   ```
3. **Identify long-running / idle-in-transaction sessions**
   ```sql
   SELECT pid, state, now() - query_start AS duration, query,
          wait_event, application_name
   FROM pg_stat_activity
   WHERE state = 'active' OR state = 'idle in transaction'
   ORDER BY duration DESC;
   ```
4. **Check PgBouncer status** (if using connection pooling)
   ```
   # PgBouncer stats
   psql -h localhost -p 6432 pgbouncer -c "SHOW STATS;"
   psql -h localhost -p 6432 pgbouncer -c "SHOW POOLS;"
   ```

## Common Causes

| Cause | Symptoms | Fix |
|-------|----------|-----|
| Connection leak | Idle connections accumulate | Fix application code |
| Traffic spike | All pools active | Scale out, increase pool |
| Slow queries | Connections held for long | Kill slow queries |
| PgBouncer misconfig | Pool size too small | Increase pool config |
| Dead connections | `wait_event: client_read` | Cleanup via PgBouncer |

## Resolution

### 1. Kill problematic sessions (urgent)
```sql
-- Kill all idle-in-transaction sessions lasting > 5 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND now() - query_start > interval '5 minutes';

-- Kill long-running queries (> 30 seconds)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '30 seconds';
```

### 2. Increase connection pool
```sql
-- Temporarily increase max_connections (requires restart or reload)
ALTER SYSTEM SET max_connections = 200;
SELECT pg_reload_conf();
```

### 3. Scale PgBouncer (if used)
```ini
; /ops/pgbouncer/pgbouncer.ini
[databases]
; Increase pool size
vaeloom = host=localhost port=5432 dbname=vaeloom pool_size=50
```

### 4. Scale application (reduce pressure)
```
aws ecs update-service --cluster vaeloom-prod --service vaeloom-prod-backend --desired-count <CURRENT+2>
```

### 5. Reset all connections (last resort — brief outage)
```sql
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'vaeloom' AND pid <> pg_backend_pid();
```

## Prevention

- Set `pool_size` on PgBouncer based on `max_connections * 0.8`
- Configure connection timeout in application layer
- Add `idle_in_transaction_session_timeout = '5min'` in PostgreSQL config
- Monitor `pg_stat_activity` with alert threshold at 70% capacity

## Post-Incident

- [ ] Identify leak source — add issue to backlog
- [ ] Adjust pool sizing for expected traffic
- [ ] Verify application closes connections in all code paths
- [ ] Review ORM session management (context managers)
