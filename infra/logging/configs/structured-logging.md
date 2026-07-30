# Structured Logging

Vaeloom uses structured JSON logging across all services. Every log entry includes:

## Standard Fields

| Field | Type | Description | Example |
|---|---|---|---|
| `timestamp` | ISO8601 | Event time | `2026-07-17T10:30:00Z` |
| `level` | string | Log level | `info`, `warn`, `error` |
| `service` | string | Service name | `vaeloom-api` |
| `trace_id` | string | Distributed trace ID | `abc123` |
| `span_id` | string | Span within trace | `def456` |
| `message` | string | Human-readable message | `User logged in successfully` |
| `tenant_id` | UUID | Tenant context | `uuid` |
| `user_id` | UUID | User context | `uuid` |
| `duration_ms` | number | Operation duration | `42` |
| `error` | object | Error details | `{ type, message, stack }` |

## Log Levels

| Level | Usage |
|---|---|
| `debug` | Development diagnostics |
| `info` | Normal operations |
| `warn` | Unexpected but handled |
| `error` | Failures requiring attention |
| `fatal` | Service cannot continue |
