import time

from fastapi import Request
from prometheus_client import Counter, Gauge, Histogram
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    labelnames=["method", "path", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    labelnames=["method", "path"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

active_users = Gauge("active_users", "Currently active users")
audit_log_total = Counter("audit_log_total", "Total audit log entries created")
rate_limit_degraded_total = Counter(
    "rate_limit_degraded_total",
    "Requests passed without rate limiting because the limit store was down (fail-open)",
)


def inc_rate_limit_degraded() -> None:
    """Count fail-open passes (called best-effort from the rate limiter)."""
    rate_limit_degraded_total.inc()


import re

_UUID_PATTERN = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_NUMERIC_PATTERN = re.compile(r"/\d+(?=/|$)")


def normalize_metric_path(request: Request, response_status: int) -> str:
    """Normalize request path to prevent Prometheus cardinality explosion (CRIT-04).
    
    1. All 404 Not Found requests are grouped into '/404' to defeat URL scanning/fuzzing.
    2. Dynamic UUIDs and integer IDs in paths are normalized to '{id}' tokens.
    3. Static endpoint paths (e.g. /health, /health/ready, /metrics) are preserved.
    """
    if response_status == 404:
        return "/404"

    path = request.url.path
    path = _UUID_PATTERN.sub("{id}", path)
    path = _NUMERIC_PATTERN.sub("/{id}", path)
    return path


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        method = request.method
        start = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - start

        path = normalize_metric_path(request, response.status_code)

        http_requests_total.labels(
            method=method, path=path, status=response.status_code
        ).inc()
        http_request_duration_seconds.labels(method=method, path=path).observe(duration)

        return response
