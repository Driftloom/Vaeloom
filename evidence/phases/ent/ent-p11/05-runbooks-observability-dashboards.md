# ENT-P11 — 05 Production Runbooks, Observability & Dashboards

> **Phase:** `ENT-P11` (Backend Implementation)  
> **Deliverable:** `DEL-ENT-P11-05` (v1.0)  
> **Owner:** Principal Site Reliability Engineer (SRE) & Observability
> Specialist  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. OpenTelemetry Distributed Tracing & Telemetry Architecture

The Vaeloom backend implements full OpenTelemetry distributed tracing and
metrics instrumentation across all API requests, database queries, and async
background workers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OPENTELEMETRY TRACE FLOW                        │
├────────────────────────────────────────────────────────────────────────┤
│  Client Request (traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-...) │
│       │                                                                │
│       ▼                                                                │
│  FastAPI Gateway Span (http.method=POST, http.target=/resumes/tailor)  │
│       │                                                                │
│       ├─► DB Span (db.system=postgresql, db.name=vaeloom, rls=active)  │
│       ├─► Cognitive Span (ai.system=1, provider=typesafe-jev, latency) │
│       ├─► Cognitive Span (ai.system=2, provider=ollama-gemma4, tokens) │
│       └─► Worker Span (queue=document-compilation, job_id=job_01J8...) │
└────────────────────────────────────────────────────────────────────────┘
```

### Metrics Endpoint (`GET /metrics`):

FastAPI exports Prometheus-compatible metrics scraping:

- `http_requests_total{method, endpoint, status}`: Request counters partitioned
  by status code.
- `http_request_duration_seconds{endpoint, quantile}`: p50, p90, p99 latency
  histograms.
- `db_pool_connections_active`: Real-time active connections in Supavisor pool.
- `bullmq_queue_waiting_jobs{queue}`: Queue backlog depth across compilation and
  extraction queues.

---

## 2. Core Grafana Production Dashboards

### Dashboard 1: API Gateway Throughput & Latency

- **Panels:** Request Rate (RPS), Error Rate (HTTP 4xx / 5xx), p95 Latency by
  Endpoint, Rate-Limited Requests (HTTP 429).
- **Alert Rules:** Trigger PagerDuty alert if HTTP 5xx error rate exceeds $1\%$
  for 3 consecutive minutes.

### Dashboard 2: Two-Tier Cognitive Engine Health

- **Panels:** System 1 (TypeSafe Jev) sub-50ms routing latency, System 2
  (Gemma 4) token generation speed, HITL approval queue depth.
- **Alert Rules:** Trigger alert if System 2 p95 response time exceeds 15
  seconds or circuit breaker trips to local container.

### Dashboard 3: Database & Connection Pool Sizing

- **Panels:** Active connections vs maximum pool limit (60), replication lag
  ($\le 15\text{s}$), table bloat on `cognitive_memories`.
- **Alert Rules:** Alert if active database connections exceed $85\%$ of pool
  capacity for $>2\text{ minutes}$.

---

## 3. Critical SRE Operational Runbooks

### Runbook 1: PostgreSQL Connection Pool Exhaustion Recovery

1. **Diagnosis:** `GET /health` reports 503 or latency spikes; Prometheus
   reports `db_pool_connections_active >= 55`.
2. **Immediate Remediation:**
   ```bash
   # Terminate idle-in-transaction connections older than 60s
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'idle in transaction' AND state_change < current_timestamp - INTERVAL '60 seconds';
   ```
3. **Escalation:** Verify Supavisor pooler restart and autoscale read replicas.

### Runbook 2: LLM Provider Outage & Circuit Breaker Failover

1. **Diagnosis:** System 2 Ollama Cloud API returns 502/504 errors; circuit
   breaker trips.
2. **Automated Action:** Gateway automatically redirects traffic to local
   fallback container (`http://localhost:11434` with model `gemma4:12b`).
3. **Verification:** Inspect `/metrics` ensuring `llm_fallback_requests_total`
   increments while candidate tailoring continues without disruption.

### Runbook 3: BullMQ Queue Backlog & Dead Letter Queue (DLQ) Replay

1. **Diagnosis:**
   `bullmq_queue_waiting_jobs{queue="document-compilation"} > 200`.
2. **Action:** Scale Playwright worker pods in Kubernetes from 4 to 12 replicas.
3. **DLQ Replay:**
   ```bash
   # Inspect and retry failed jobs
   pnpm exec nx run api:dlq-replay --queue=document-compilation --max=50
   ```

---

_Signed: Principal Site Reliability Engineer (SRE) & Observability Specialist —
2026-09-29_
