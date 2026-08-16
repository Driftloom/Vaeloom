# Finding: Prometheus Import Has No Guard

| Metadata     | Value                        |
| ------------ | ---------------------------- |
| **ID**       | FIND-MAIN-003                |
| **Severity** | P1-HIGH                      |
| **Status**   | OPEN                         |
| **Source**   | main.py Audit                |
| **File**     | `apps/api/src/api/main.py:7` |

## Description

`from prometheus_fastapi_instrumentator import Instrumentator` is imported
unconditionally at module level. If the package is not installed, the entire
application fails to start. Unlike `opentelemetry.py` which wraps imports in
try/except, the Prometheus import has no guard.

## Evidence

```python
from prometheus_fastapi_instrumentator import Instrumentator  # hard crash if missing
```

Compare with `infrastructure/opentelemetry.py`:

```python
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
except ImportError:
    FastAPIInstrumentor = None  # graceful degradation
```

## Impact

- Application crashes on startup if `prometheus-fastapi-instrumentator` is not
  installed
- No graceful degradation for observability

## Remediation

Wrap in try/except with graceful fallback, matching the OTel pattern.
