# CONT-P17 — 01 Telemetry / Context (WS-17.1, DEL-01)

## Verified live @ HEAD (server boot 2026-09-15, port 8001)

| Claim | Evidence |
| --- | --- |
| `/metrics` serves Prometheus exposition | HTTP 200, `http_requests_total{handler,method,status}` + `_created` live |
| Correlation propagation | `X-Request-ID` response header present (uuid4, e.g. `bc7eb5a0-…`); middleware `infrastructure/log.py:CorrelationIDMiddleware`, mounted in `main.py` |
| OTel setup | `infrastructure/opentelemetry.py:setup_opentelemetry()` + FastAPI auto-instrumentation (graceful-degrade try/except) |
| Structured logging + redaction | `logging.py` JSON formatter + `_redact` 9 keys; validator/qa/security paths redact |
| OTel collector config | `infra/monitoring/otelcol-config.yaml` present |

## Dual-run telemetry

Shadow flags live in `config.py`: `langgraph_shadow_mode`, `agent_shadow_enabled`
+ `agent_shadow_percent` (request_id hash rollout), `eval_shadow_enabled` —
per-tenant gradual autonomy with measurement before authority (track mission).
