# DEL-ENT-P15-05 — Scaling Runbook

**Deliverable ID:** DEL-ENT-P15-05  
**Phase:** ENT-P15 — Performance, Reliability, and Scalability  
**Version:** 1.0.0  
**Owner:** SRE  
**Reviewer:** Performance Engineer + DevOps Lead  
**Status:** DELIVERED  
**Date:** 2026-09-29

---

## 1. Horizontal Scaling Triggers

| Service                          | Scale-up trigger                        | Scale-down trigger    | Min replicas | Max replicas |
| -------------------------------- | --------------------------------------- | --------------------- | ------------ | ------------ |
| FastAPI API pods                 | CPU >70% for 3min OR p95 latency >200ms | CPU <30% for 10min    | 2            | 32           |
| Next.js Web pods                 | CPU >80% for 3min                       | CPU <40% for 10min    | 1            | 8            |
| pgvector queries (read replicas) | DB read latency >12ms p95               | Read latency <6ms p95 | 0            | 4            |
| MinIO / S3                       | Not applicable (managed)                | Not applicable        | N/A          | N/A          |

---

## 2. Scale-Up Runbook (API)

```bash
# Step 1: Verify current utilization
curl -s http://127.0.0.1:8000/metrics | grep 'api_request_duration_seconds'

# Step 2: Check PG connection pool saturation
# In psql: SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# Step 3: Kubernetes horizontal scale (production target)
kubectl scale deployment vaeloom-api --replicas=<N> -n vaeloom

# Step 4: Verify health after scale
for pod in $(kubectl get pods -n vaeloom -l app=vaeloom-api -o name); do
  kubectl exec $pod -n vaeloom -- curl -s http://localhost:8000/health
done

# Step 5: Update PgBouncer pool_size if needed
# Edit /etc/pgbouncer/pgbouncer.ini: max_client_conn = <N*25>

# Step 6: Record scaling event
echo "$(date -u) SCALE_UP api replicas=<N> trigger=<reason>" >> /var/log/vaeloom/scaling.log
```

---

## 3. pgvector HNSW Tuning (High Load)

```bash
# Increase ef_search for accuracy/speed tradeoff when load is low (maintenance window)
# Current: ef_search=40 (tuned from default 50)

# In psql (as superuser):
SET hnsw.ef_search = 60;  -- More accurate, ~20% slower
-- OR
SET hnsw.ef_search = 20;  -- Faster under load, ~15% less accurate

# For index rebuild with new parameters (concurrent, non-blocking):
REINDEX INDEX CONCURRENTLY idx_memory_embedding;

# Monitor index status:
SELECT * FROM pg_stat_user_indexes WHERE indexname LIKE '%embedding%';
```

---

## 4. Emergency Runbooks

### 4.1 API Complete Failure

```bash
# 1. Check process status
Get-Process -Name "python" | Where-Object {$_.MainWindowTitle -like "*uvicorn*"}

# 2. Restart (dev)
cd apps/api && uv run uvicorn api.main:app --host 127.0.0.1 --port 8000 --app-dir src

# 3. Verify
curl -s http://127.0.0.1:8000/health

# 4. Check logs for root cause
type C:\Users\Dell\.gemini\antigravity\brain\ffdd46a7-12e9-40be-a219-cfcf65ac0c40\.system_generated\tasks\task-20037.log | tail -50
```

### 4.2 PostgreSQL Recovery

```bash
# 1. Check if accepting connections
pg_isready -h localhost -p 5432

# 2. Verify migration head
cd apps/api && uv run --project apps/api alembic current

# 3. Run health check
curl -s http://127.0.0.1:8000/api/health

# 4. If migration needed (forward only — expand-phase)
cd apps/api && uv run --project apps/api alembic upgrade head
```

### 4.3 Agent Kill Switch (Emergency)

```bash
# Via API (requires admin JWT):
curl -X POST http://127.0.0.1:8000/api/admin/agents/{agent_id}/disable \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason": "emergency_kill_switch", "duration_seconds": 3600}'

# Verify agent is stopped:
curl http://127.0.0.1:8000/api/admin/agents/{agent_id}/status \
  -H "Authorization: Bearer $ADMIN_JWT"
```

### 4.4 Rate Limit Emergency Tighten

```python
# In api/middleware/rate_limiting.py — change limit dynamically via feature flag:
# RATE_LIMIT_REQUESTS_PER_MINUTE (env var; hot-reloaded via Infisical)

# Example: tighten to 10 req/min globally during attack:
# In Infisical console: set RATE_LIMIT_REQUESTS_PER_MINUTE=10
# API picks up on next request (Infisical TTL: 30s)
```

---

## 5. Graceful Degradation Modes

| Failure                | Degradation                         | User experience                         | Recovery                       |
| ---------------------- | ----------------------------------- | --------------------------------------- | ------------------------------ |
| Gemma 4 unavailable    | S1 Jev only; S2 skipped             | Partial agent responses; no synthesis   | Auto-recover on timeout        |
| Jev S1 unavailable     | S2 Gemma only; no routing           | Slower responses; no destructive triage | Auto-recover on timeout        |
| pgvector index rebuild | keyword fallback (ATS gazetteer)    | Lower accuracy semantic search          | REINDEX completes async        |
| Chromium unavailable   | 503 on compile; templates available | Download not available                  | `playwright install chromium`  |
| MinIO unreachable      | Upload fails; download fails        | Upload error message                    | Service restart                |
| RLS GUC fails          | Fail-closed: 0 rows returned        | Empty results                           | Check `set_rls_session_vars()` |

---

_Deliverable DEL-ENT-P15-05 v1.0.0 — SRE — 2026-09-29_
