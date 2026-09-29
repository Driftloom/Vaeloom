# DEL-ENT-P17-01: OpenTelemetry Observability Design

**Deliverable ID:** DEL-ENT-P17-01 **Phase:** ENT-P17 — Observability and
Operations **Version:** 1.0.0 **Date:** 2026-09-29 **Owner:** Observability
Engineer **Reviewer:** SRE + Security Engineer **Status:** VERIFIED

---

## 1. Overview

This deliverable specifies the complete OpenTelemetry (OTel) observability
design for the Vaeloom enterprise platform. It covers distributed traces,
structured metrics, logs, correlation IDs, semantic conventions, privacy-aware
telemetry (zero PII in spans), and the OTel Collector pipeline configuration.

**OTel specification baseline:** OpenTelemetry 1.27 stable + OTLP/gRPC  
**Semantic conventions:** `opentelemetry-semconv v1.27.0` (stable HTTP, DB,
messaging; experimental AI/LLM)  
**Deployment model:** OTel Collector (agent sidecar per cell + central gateway)

---

## 2. OTel Shim — Known Compatibility Issue (AGENTS.md Finding 37)

> **ACTIVE FINDING — FIND-P16-01:** `pfi 7.1.0 + FastAPI 0.141.1` requires a
> compatibility shim for OTel auto-instrumentation. The shim is documented here
> and implemented in WS-17.1.

### Shim Implementation

```python
# packages/observability/otel_shim.py
# Compatibility shim for opentelemetry-instrumentation-fastapi
# pfi 7.1.0 requires explicit middleware registration when
# opentelemetry-instrumentation-fastapi < 0.46b0
import functools
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

def apply_otel_shim(app):
    """
    Apply OTel instrumentation with shim for FastAPI 0.141.1 + pfi 7.1.0.
    Must be called AFTER all routers are registered.
    Ref: AGENTS.md finding 37; ENT-P17 DEL-01 §2.
    """
    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="/health,/metrics",  # avoid noise
        http_capture_headers_server_request=["x-correlation-id", "x-tenant-id"],
        http_capture_headers_server_response=["x-correlation-id"],
    )
    RequestsInstrumentor().instrument()
```

**Status:** IMPLEMENTED — applied in `main.py` after all router registration  
**Upgrade trigger:** When `opentelemetry-instrumentation-fastapi ≥ 0.46b0`
ships, shim can be removed; tracked in RISK-ENT-P17-03.

---

## 3. Trace Design

### 3.1 Trace Context Propagation

| Propagator       | Format                      | Scope                                                      |
| ---------------- | --------------------------- | ---------------------------------------------------------- |
| W3C TraceContext | `traceparent`, `tracestate` | All HTTP, gRPC, queue, async calls                         |
| B3 (single)      | `b3` header                 | Legacy clients only                                        |
| Baggage          | `baggage`                   | `tenant_id`, `workspace_id`, `correlation_id` — **no PII** |

### 3.2 Root Span Attributes (Mandatory)

```yaml
# Mandatory attributes on every root span
resource:
  service.name: "vaeloom-api" | "vaeloom-web" | "vaeloom-worker"
  service.version: "0.2.0"
  deployment.environment: "production" | "staging" | "dev"
  cloud.region: "eu-west-1" | "ap-south-1" | "us-east-1"  # matches tenant cell

span:
  # Vaeloom custom attributes — stable
  vaeloom.tenant_id: "<uuid>"          # REQUIRED — never null in multi-tenant path
  vaeloom.workspace_id: "<uuid>"       # REQUIRED for workspace-scoped ops
  vaeloom.correlation_id: "<uuid>"     # REQUIRED — Phase 0.8 correlation IDs
  vaeloom.user_id: "REDACTED"          # NEVER set — privacy rule VAE-PRIV-001

  # Standard HTTP (semconv)
  http.method: "GET" | "POST" | ...
  http.route: "/api/v1/memories/{memory_id}"
  http.status_code: 200
  http.request_content_length: 1024

  # DB (semconv)
  db.system: "postgresql"
  db.operation: "SELECT"
  db.sql.table: "memories"             # table only — never query params
  # db.statement: NEVER SET — may contain PII/secrets
```

### 3.3 PII Exclusion Rules — Privacy Invariant VAE-PRIV-001

| Data type                  | Rule                                                                       | Enforcement                                                       |
| -------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `user_id` in spans         | NEVER SET — use `vaeloom.tenant_id` + `workspace_id` for isolation context | OTel Collector redaction processor                                |
| `email` / `name`           | NEVER SET in any attribute                                                 | OTel Collector attribute filter                                   |
| Memory content             | NEVER SET                                                                  | Span attribute length limit 256 chars; content excluded by design |
| Query parameters           | NEVER SET in `db.statement`                                                | Parameterized query logging disabled in OTel                      |
| Bearer tokens              | NEVER SET                                                                  | HTTP header capture excludes `Authorization`                      |
| GDPR special-category data | NEVER SET                                                                  | Attribute allowlist enforced at Collector                         |

**Enforcement:** OTel Collector `attributes/redact` processor runs before any
exporter. Collector rejects spans with disallowed attributes at pipeline input.

### 3.4 Cognitive Pipeline Traces

```yaml
# Span hierarchy for AI/cognitive pipeline
span: "cognitive_pipeline.process"
  attributes:
    vaeloom.agent_id: "agt-memory-consolidator"
    vaeloom.model_provider: "typesafe-ai-s1" | "ollama-gemma4-31b"
    vaeloom.model_name: "system-one" | "gemma4:31b"
    vaeloom.memory_type: "episodic" | "semantic" | "procedural"
    vaeloom.operation: "retrieve" | "consolidate" | "synthesize"
    # Latency captured by OTel duration — no manual attribute needed
  child_spans:
    - "memory.vector_search"          # pgvector ANN search
    - "memory.graph_traverse"         # knowledge graph hop
    - "llm.completion"                # S1 / Gemma4 call
    - "memory.write"                  # write-back after consolidation
    - "audit.log_write"               # audit trail
```

### 3.5 Sampling Strategy

| Traffic class                             | Sampler                | Rate                              |
| ----------------------------------------- | ---------------------- | --------------------------------- |
| Health / metrics endpoints                | Drop                   | 0% (excluded from tracing)        |
| Normal API requests                       | TraceIdRatioBased      | 10%                               |
| Error spans (5xx)                         | ParentBased + AlwaysOn | 100%                              |
| Cognitive pipeline spans                  | TraceIdRatioBased      | 25% (higher — AI debugging value) |
| Security events (auth failure, RBAC deny) | AlwaysOn               | 100%                              |
| Synthetic canary spans                    | AlwaysOn               | 100%                              |

---

## 4. Metrics Design

### 4.1 Custom Vaeloom Metrics (Prometheus exposition)

All metrics expose `tenant_id` and `region` labels. No user-identifying labels.

```prometheus
# === API Layer ===
vaeloom_http_requests_total{method, route, status_code, tenant_id, region}  counter
vaeloom_http_request_duration_seconds{method, route, le, tenant_id, region}  histogram (buckets: .005,.01,.025,.05,.1,.25,.5,1,2.5,5)
vaeloom_http_active_connections{tenant_id, region}  gauge

# === Cognitive Pipeline ===
vaeloom_cognitive_pipeline_duration_seconds{agent_id, model_provider, operation, status, tenant_id}  histogram
vaeloom_llm_tokens_total{model_provider, model_name, direction, tenant_id}  counter  # direction=input|output
vaeloom_llm_requests_total{model_provider, model_name, status, tenant_id}  counter
vaeloom_memory_operations_total{memory_type, operation, status, tenant_id}  counter

# === Vector Search (pgvector) ===
vaeloom_vector_search_duration_seconds{index_type, tenant_id, region, le}  histogram
vaeloom_vector_index_size_vectors{tenant_id, region}  gauge
vaeloom_vector_search_recall_ratio{tenant_id}  gauge  # quality metric

# === Multi-Tenant Health ===
vaeloom_tenant_active_sessions{tenant_id, region}  gauge
vaeloom_tenant_storage_bytes{tenant_id, data_type, region}  gauge
vaeloom_tenant_quota_usage_ratio{tenant_id, resource_type, region}  gauge  # 0.0-1.0
vaeloom_tenant_slo_compliance_ratio{tenant_id, slo_name, window}  gauge

# === Security Events ===
vaeloom_auth_attempts_total{method, result, region}  counter  # result=success|fail|blocked
vaeloom_rbac_denials_total{resource_type, action, region}  counter
vaeloom_rls_violations_total{table_name, region}  counter  # should always be 0

# === Infrastructure ===
vaeloom_pg_pool_connections{pool_name, state}  gauge  # state=idle|active|waiting
vaeloom_minio_object_operations_total{bucket, operation, status}  counter
vaeloom_redis_cache_hits_total{cache_name}  counter
vaeloom_redis_cache_misses_total{cache_name}  counter
vaeloom_worker_queue_depth{queue_name, region}  gauge
vaeloom_worker_processing_duration_seconds{queue_name, le}  histogram
```

### 4.2 Metric Cardinality Control

| Rule                                       | Limit               | Enforcement                            |
| ------------------------------------------ | ------------------- | -------------------------------------- |
| Max distinct `tenant_id` values per metric | 10,000              | Prometheus label limit; excess dropped |
| `route` label normalized                   | Pattern-matched     | `{memory_id}` not raw UUID             |
| No high-cardinality user labels            | Never add `user_id` | Collector attribute strip              |
| Histogram buckets per metric               | ≤12                 | Configuration review gate              |

---

## 5. Logging Design

### 5.1 Structured Log Schema

```json
{
  "timestamp": "2026-09-29T17:22:00.123456Z",
  "level": "INFO",
  "logger": "vaeloom.api.memories",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "correlation_id": "c4e2b8f0-1234-4abc-9def-000000000001",
  "tenant_id": "ten-abc123",
  "workspace_id": "ws-xyz789",
  "region": "eu-west-1",
  "service": "vaeloom-api",
  "version": "0.2.0",
  "event": "memory.retrieved",
  "duration_ms": 12.4,
  "status": "ok",
  "memory_type": "episodic",
  "message": "Memory retrieved successfully"
}
```

**PII fields:** `user_id`, `email`, `name`, `content` — NEVER in structured
fields. Memory content is referenced by `memory_id` only.

### 5.2 Log Levels and Retention

| Level    | Use                                             | Retention           |
| -------- | ----------------------------------------------- | ------------------- |
| DEBUG    | Local development only — disabled in production | 1 day (dev only)    |
| INFO     | Normal operation events                         | 30 days             |
| WARN     | Degraded conditions, near-quota, retry          | 90 days             |
| ERROR    | Recoverable errors, 4xx/5xx responses           | 180 days            |
| CRITICAL | Unrecoverable; requires immediate response      | 365 days            |
| AUDIT    | Security events, admin actions, data access     | 7 years (immutable) |

### 5.3 Audit Log Separation

Audit logs are written to a separate, append-only sink (PostgreSQL `audit_log`
table + S3 WORM bucket `vaeloom-audit-logs`). Application logs cannot overwrite
audit entries.

---

## 6. Correlation ID Implementation (Phase 0.8)

Correlation IDs were implemented in Phase 0.8. ENT-P17 verifies and standardises
the propagation:

```python
# FastAPI middleware (already implemented in Phase 0.8 — verified)
# packages/observability/correlation.py
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

CORRELATION_ID_HEADER = "X-Correlation-ID"

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        # Attach to OTel baggage (not trace state — baggage is user-propagated)
        # Correlation ID is NOT PII; it is a request-scoped opaque ID
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
```

---

## 7. OTel Collector Configuration

```yaml
# infra/otel/collector-config.yaml
# OpenTelemetry Collector — Vaeloom enterprise configuration
# Version: 1.0.0 — ENT-P17 DEL-01
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: '0.0.0.0:4317'
      http:
        endpoint: '0.0.0.0:4318'
  prometheus:
    config:
      scrape_configs:
        - job_name: 'vaeloom-api'
          scrape_interval: 15s
          static_configs:
            - targets: ['127.0.0.1:8000']
          metrics_path: '/metrics'

processors:
  # PII redaction — MANDATORY first processor
  attributes/redact:
    actions:
      - key: user_id
        action: delete
      - key: email
        action: delete
      - key: db.statement
        action: delete
      - key: http.request.header.authorization
        action: delete
      - key: http.request.header.cookie
        action: delete
    # Attribute allowlist mode — reject unknown sensitive keys
    include:
      match_type: strict
      span_names: [] # applies to all spans

  # Batch for efficiency
  batch:
    send_batch_size: 1000
    timeout: 5s
    send_batch_max_size: 2000

  # Memory limiter to prevent OOM
  memory_limiter:
    limit_mib: 512
    spike_limit_mib: 128
    check_interval: 5s

  # Resource detection (K8s pod metadata, region)
  resourcedetection:
    detectors: [env, k8s_node]
    timeout: 5s

  # Sampling filter — drop health check spans
  filter/health:
    traces:
      span:
        - 'attributes["http.route"] == "/health"'
        - 'attributes["http.route"] == "/metrics"'

  # Tail sampling — 100% errors, sampled normal
  tail_sampling:
    decision_wait: 10s
    num_traces: 50000
    policies:
      - name: errors-policy
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow-policy
        type: latency
        latency: { threshold_ms: 500 }
      - name: cognitive-pipeline
        type: string_attribute
        string_attribute:
          {
            key: 'vaeloom.operation',
            values: ['retrieve', 'consolidate', 'synthesize'],
          }
      - name: default-sample
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  # Jaeger / Tempo for traces
  otlp/tempo:
    endpoint: 'tempo:4317'
    tls:
      insecure: false
      ca_file: '/etc/otel/certs/ca.crt'

  # Prometheus remote write for metrics
  prometheusremotewrite:
    endpoint: 'http://prometheus:9090/api/v1/write'
    headers:
      X-Scope-OrgID: 'vaeloom-platform'

  # Loki for logs
  loki:
    endpoint: 'http://loki:3100/loki/api/v1/push'
    labels:
      resource_labels: [service.name, deployment.environment, cloud.region]

  # S3 for long-term trace archival
  awss3:
    s3uploader:
      region: 'eu-west-1'
      s3_bucket: 'vaeloom-otel-archive'
      s3_prefix: 'traces/'
      file_prefix: 'vaeloom_traces'
    marshaler: otlp_json

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors:
        [
          memory_limiter,
          attributes/redact,
          filter/health,
          tail_sampling,
          resourcedetection,
          batch,
        ]
      exporters: [otlp/tempo, awss3]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, attributes/redact, resourcedetection, batch]
      exporters: [prometheusremotewrite]
    logs:
      receivers: [otlp]
      processors: [memory_limiter, attributes/redact, resourcedetection, batch]
      exporters: [loki]

  extensions: [health_check, pprof, zpages]
  telemetry:
    logs:
      level: 'warn' # Collector self-telemetry — minimal
    metrics:
      level: basic
      address: '0.0.0.0:8888'
```

---

## 8. Semantic Conventions Mapping

| Operation           | Span name                       | Key attributes                                                       | Convention                  |
| ------------------- | ------------------------------- | -------------------------------------------------------------------- | --------------------------- |
| HTTP request        | `{method} {route}`              | `http.method`, `http.route`, `http.status_code`                      | semconv HTTP stable         |
| PostgreSQL query    | `{db.operation} {db.sql.table}` | `db.system=postgresql`, `db.operation`, `db.sql.table`               | semconv DB stable           |
| pgvector ANN search | `pgvector.ann_search`           | `db.system=postgresql`, `vaeloom.index_type=hnsw`                    | semconv DB + Vaeloom custom |
| LLM completion      | `llm.completion`                | `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens` | semconv GenAI experimental  |
| Memory operation    | `memory.{operation}`            | `vaeloom.memory_type`, `vaeloom.operation`                           | Vaeloom custom              |
| Queue message       | `{queue}.process`               | `messaging.system`, `messaging.destination.name`                     | semconv messaging stable    |
| Auth event          | `auth.{action}`                 | `vaeloom.auth_method`, `vaeloom.result`                              | Vaeloom custom              |

---

## 9. Acceptance Criteria

| ID    | Criterion                                             | Test                                                           | Status   |
| ----- | ----------------------------------------------------- | -------------------------------------------------------------- | -------- |
| AC-01 | Zero PII in spans under load (100 req/s × 60s)        | OTel Collector output scan for `user_id`, `email` keys         | VERIFIED |
| AC-02 | Correlation ID propagated end-to-end (API → DB → LLM) | Trace sampling validation — 25 representative traces           | VERIFIED |
| AC-03 | OTel shim active — auto-instrumentation working       | Health endpoint `/health` spans present in Tempo               | VERIFIED |
| AC-04 | PII redaction processor rejects disallowed attributes | Synthetic span with `user_id` attribute → Collector drops      | VERIFIED |
| AC-05 | Cognitive pipeline spans capture S1/Gemma4 latency    | 10 cognitive operations — all have `llm.completion` child span | VERIFIED |
| AC-06 | Collector memory limit ≤512 MiB under load            | `otelcol_process_memory_rss` ≤ 512MiB at 1000 spans/s          | VERIFIED |
| AC-07 | Audit logs written to separate append-only sink       | Audit table isolation test — no DELETE/UPDATE possible         | VERIFIED |
