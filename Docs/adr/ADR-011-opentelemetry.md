# ADR-011: OpenTelemetry for Observability

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom requires distributed tracing across the backend, agent execution monitoring, infrastructure metrics, and structured logging with correlation IDs. The observability stack must integrate with FastAPI, SQLAlchemy, Redis, and LLM providers without vendor lock-in.

Options considered: OpenTelemetry, Prometheus client only, Datadog APM, Sentry, New Relic.

## Decision

Use **OpenTelemetry** for distributed tracing and metrics, with **Prometheus** for infrastructure metrics and **structlog** for structured logging.

Stack:
- `opentelemetry-distro` + `opentelemetry-exporter-otlp` for trace export to any OTLP-compatible backend
- `opentelemetry-instrumentation-fastapi` for automatic HTTP trace generation
- `prometheus-fastapi-instrumentator` for metrics endpoint at `/metrics`
- `structlog` for JSON-formatted structured logging with correlation IDs
- `CorrelationIDMiddleware` injects `X-Correlation-ID` into every request and log entry
- `MetricsMiddleware` tracks request duration, counts by endpoint/status/method

## Consequences

**Positive:**
- Vendor-neutral — traces can be exported to Datadog, Grafana Tempo, Honeycomb, or any OTLP backend
- Automatic instrumentation covers FastAPI routes, HTTPX outgoing calls, and SQLAlchemy queries
- Correlation IDs connect logs, traces, and metrics for every request
- Prometheus metrics endpoint is standard — integrates with Grafana dashboards out of the box
- `structlog` structured logs are machine-parseable (JSON) in production and human-readable (pretty) in development

**Negative:**
- OpenTelemetry adds ~5-10ms per request even when sampling is disabled
- Agent execution traces require manual span creation in each handler — not automatic
- OTLP exporter requires a collector deployment for production (otel-collector sidecar or DaemonSet)
- Metrics cardinality must be monitored — high-cardinality labels (user_id in tags) can overwhelm Prometheus
