# Observability/Reliability Verification

## Purpose

Verify OpenTelemetry instrumentation, Prometheus metrics, Correlation IDs,
request logging, and error tracking in prod environment.

## Source of truth

- Instrumentation configuration
- Docker-compose (Grafana/Alertmanager)

## Preconditions

- System under load in production-like environment.

## Test actors

- System

## Test scenarios

| Action                    | Expected                                                       | Actual     | Evidence |
| ------------------------- | -------------------------------------------------------------- | ---------- | -------- |
| Send distributed requests | `CorrelationIDMiddleware` traces request through microservices | UNVERIFIED | TBD      |
| Scrape `/metrics`         | Prometheus endpoint exposes accurate system metrics            | UNVERIFIED | TBD      |
| Inspect logs              | `RequestLoggingMiddleware` outputs valid JSON/pretty formats   | UNVERIFIED | TBD      |
| Trigger error condition   | Error tracked and correlated in observability stack            | UNVERIFIED | TBD      |
| View Grafana              | Dashboards display live data correctly                         | UNVERIFIED | TBD      |

## Rating dimensions

- Capability: UNVERIFIED
- Security: UNVERIFIED
- Reliability: UNVERIFIED

## Severity

P3

## Final status

UNVERIFIED

## Evidence references

- TBD
