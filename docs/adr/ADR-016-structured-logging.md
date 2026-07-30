# ADR-016: Structured Logging with structlog

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom requires structured, machine-parseable logs for production debugging, audit trails, and observability integration. Logs must include correlation IDs, tenant context, agent execution traces, and be filterable by severity without regex parsing of unstructured text.

Options considered: structlog, standard logging with JSON formatter, Loguru, python-json-logger.

## Decision

Use **structlog** for structured logging with a JSON formatter in production and pretty-printing in development.

Configuration:
- `structlog.processors` chain: `add_log_level` → `TimeStamper` → `add_correlation_id` → `JSONRenderer`
- Correlation ID injected via `CorrelationIDMiddleware` using `structlog.thread_local.clear()` per request
- Formatters: `JSONRenderer` in production, `ConsoleRenderer` in development (auto-detected from `service_environment`)
- Logger initialized once in `setup_logging()` at application startup
- `get_logger(__name__)` pattern used throughout — bound loggers with module context

## Consequences

**Positive:**
- JSON logs integrate directly with OpenTelemetry, CloudWatch, Datadog, and Grafana Loki without log shippers
- Correlation IDs in every log entry enable end-to-end request tracing across services
- Structured key-value pairs (`event="agent_execution"`, `agent_id="...", `duration_ms=1234`) are queryable
- Development pretty-printing with colors and timestamps improves DX
- Thread-local context ensures multi-tenant isolation in logging

**Negative:**
- structlog requires explicit processor configuration — misconfiguration can silently drop log fields
- Thread-local context must be explicitly cleared between requests (handled by middleware, but easy to forget)
- Some third-party libraries use standard logging — must configure `structlog.stdlib.LoggerFactory` for compatibility
- JSON log output is less human-readable without a log shipper or terminal formatter
