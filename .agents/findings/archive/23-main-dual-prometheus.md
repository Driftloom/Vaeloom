# Finding: Dual Prometheus Instrumentation

| Metadata     | Value                              |
| ------------ | ---------------------------------- |
| **ID**       | FIND-MAIN-004                      |
| **Severity** | P2-MEDIUM                          |
| **Status**   | RESOLVED                           |
| **Source**   | main.py Audit                      |
| **File**     | `apps/api/src/api/main.py:152-153` |

## Description

Both `Instrumentator` (prometheus-fastapi-instrumentator, line 152) and
`MetricsMiddleware` (infrastructure/metrics.py, line 130) produce Prometheus
metrics. `Instrumentator` auto-instruments all routes with standard HTTP
metrics. `MetricsMiddleware` adds custom counters/histograms with path labels.
This creates metric duplication and potential cardinality issues.

## Impact

- Double-counted metrics
- High-cardinality path labels on `http_requests_total` from MetricsMiddleware
- Confusion about which metrics source is authoritative

## Remediation

Choose one instrumentation approach. If both are needed, ensure they use
distinct metric names and labels.
