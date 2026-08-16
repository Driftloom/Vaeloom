import ipaddress
import logging

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, JSONResponse

from ..config import settings

logger = logging.getLogger(__name__)


def _parse_allowlist(raw: str) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    networks = []
    for entry in raw.split(","):
        entry = entry.strip()
        if entry:
            try:
                networks.append(ipaddress.ip_network(entry, strict=False))
            except ValueError as e:
                logger.warning("Invalid CIDR in IP_ALLOWLIST: %s — %s", entry, e)
    return networks


ALLOWLIST_BYPASS_PATHS = frozenset({
    "/health",
    "/health/ready",
    "/health/startup",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/v1/auth/signup",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
})
ALLOWLIST_BYPASS_PREFIXES = frozenset({
    "/api/v1/auth/sso/",
})


class IPAllowlistMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowlist_raw: str | None = None):
        super().__init__(app)
        raw = allowlist_raw if allowlist_raw is not None else getattr(settings, "ip_allowlist", "")
        self.allowlist = _parse_allowlist(raw) if raw else []

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if path in ALLOWLIST_BYPASS_PATHS:
            return await call_next(request)
        for prefix in ALLOWLIST_BYPASS_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)
        if not self.allowlist:
            return await call_next(request)

        client_ip = self._resolve_client_ip(request)
        if client_ip and self._is_allowed(client_ip):
            return await call_next(request)

        logger.warning("IP not allowlisted: %s (path=%s)", client_ip, path)
        return JSONResponse(
            status_code=403,
            content={"detail": "Access denied: IP not allowlisted"},
            headers={"X-IP-Allowlist": "denied"},
        )

    def _resolve_client_ip(self, request: Request) -> str | None:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return None

    def _is_allowed(self, client_ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(client_ip)
        except ValueError:
            return False
        for net in self.allowlist:
            if addr in net:
                return True
        return False
