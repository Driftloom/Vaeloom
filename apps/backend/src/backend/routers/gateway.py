import asyncio
import hashlib
import hmac
import json
import time
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from starlette.responses import StreamingResponse

from ..config import settings

router = APIRouter()

ROUTE_TABLE = {
    "/api/auth":           ("AUTH_SERVICE_URL", 3020),
    "/api/iam":            ("IAM_SERVICE_URL", 3120),
    "/api/rbac":           ("RBAC_SERVICE_URL", 3170),
    "/api/memory":         ("MEMORY_STORE_URL", 3010),
    "/api/kg":             ("KNOWLEDGE_GRAPH_URL", 3030),
    "/api/search":         ("SEARCH_SERVICE_URL", 3050),
    "/api/agents":         ("AGENT_ENGINE_URL", 3060),
    "/api/events":         ("EVENT_BUS_URL", 3040),
    "/api/documents":      ("DOCUMENT_INGESTION_URL", 3110),
    "/api/connectors":     ("CONNECTOR_SERVICE_URL", 3100),
    "/api/integrations":   ("INTEGRATION_SERVICE_URL", 3130),
    "/api/plugins":        ("PLUGIN_SERVICE_URL", 3160),
    "/api/notifications":  ("NOTIFICATION_SERVICE_URL", 3150),
    "/api/billing":        ("BILLING_SERVICE_URL", 3090),
    "/api/analytics":      ("ANALYTICS_SERVICE_URL", 3070),
    "/api/audit":          ("AUDIT_SERVICE_URL", 3080),
    "/api/scheduler":      ("JOB_SCHEDULER_URL", 3140),
    "/api/recommendations":("RECOMMENDATION_SERVICE_URL", 3180),
}


class CircuitState:
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class ServiceCircuitBreaker:
    def __init__(self, threshold: int = 5, reset_timeout: float = 30.0):
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self._failures: dict[str, int] = {}
        self._state: dict[str, str] = {}
        self._last_open: dict[str, float] = {}

    def _service_key(self, host: str, port: int) -> str:
        return f"{host}:{port}"

    def get_state(self, host: str, port: int) -> str:
        key = self._service_key(host, port)
        state = self._state.get(key, CircuitState.CLOSED)
        if state == CircuitState.OPEN:
            elapsed = time.monotonic() - self._last_open.get(key, 0)
            if elapsed >= self.reset_timeout:
                self._state[key] = CircuitState.HALF_OPEN
                return CircuitState.HALF_OPEN
        return state

    def record_success(self, host: str, port: int):
        key = self._service_key(host, port)
        self._failures[key] = 0
        self._state[key] = CircuitState.CLOSED

    def record_failure(self, host: str, port: int):
        key = self._service_key(host, port)
        self._failures[key] = self._failures.get(key, 0) + 1
        if self._failures[key] >= self.threshold:
            self._state[key] = CircuitState.OPEN
            self._last_open[key] = time.monotonic()

    def reset(self, host: str, port: int):
        key = self._service_key(host, port)
        self._failures[key] = 0
        self._state[key] = CircuitState.CLOSED


circuit_breaker = ServiceCircuitBreaker()


def _resolve_target(path: str):
    matched_prefix = ""
    matched_config = None
    for prefix, config in ROUTE_TABLE.items():
        if path.startswith(prefix) and len(prefix) > len(matched_prefix):
            matched_prefix = prefix
            matched_config = config
    if not matched_config:
        return None, None, None, None
    env_key, default_port = matched_config
    env_value = getattr(settings, env_key.lower(), None) if hasattr(settings, env_key.lower()) else None
    if env_value:
        scheme_rest = env_value.split("://", 1)
        scheme = scheme_rest[0] if len(scheme_rest) > 1 else "http"
        host_port = scheme_rest[1] if len(scheme_rest) > 1 else scheme_rest[0]
        host = host_port.split(":")[0]
        port = int(host_port.split(":")[1]) if ":" in host_port else default_port
        host_with_port = f"{host}:{port}"
        base_url = f"{scheme}://{host_with_port}"
    else:
        host = matched_prefix.split("/")[-1].replace("api-", "").replace("-", "")
        base_url = f"http://service-{host}:{default_port}"
    return base_url, matched_prefix, host, default_port


def _generate_service_token() -> str:
    payload = {
        "service_name": "api-gateway",
        "exp": int(time.time()) + 60,
        "iat": int(time.time()),
        "jti": str(uuid.uuid4()),
    }
    header = json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    payload_b64 = json.dumps(payload, separators=(",", ":")).encode()
    header_b64 = _base64url_encode(header)
    payload_b64_str = _base64url_encode(payload_b64)
    message = f"{header_b64}.{payload_b64_str}".encode()
    signature = hmac.new(settings.jwt_secret.encode(), message, hashlib.sha256).digest()
    sig_b64 = _base64url_encode(signature)
    return f"{header_b64}.{payload_b64_str}.{sig_b64}"


def _base64url_encode(data: bytes) -> str:
    return data.hex()


WHITELIST_HEADERS = {"content-type", "authorization", "x-request-id", "x-tenant-id", "x-user-id"}


@router.api_route("/internal/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def gateway_handler(request: Request, path: str):
    full_path = f"/{path}"
    base_url, matched_prefix, host, port = _resolve_target(full_path)

    if not base_url:
        raise HTTPException(status_code=502, detail="No route configured for this path")

    state = circuit_breaker.get_state(host, port)
    if state == CircuitState.OPEN:
        raise HTTPException(status_code=503, detail=f"Service {host}:{port} is unavailable (circuit open)")

    remaining_path = full_path[len(matched_prefix):] if matched_prefix else full_path
    target_url = f"{base_url}{remaining_path}"

    query_params = dict(request.query_params)
    filtered_headers = {}
    for key, value in request.headers.items():
        if key.lower() in WHITELIST_HEADERS:
            filtered_headers[key] = value

    filtered_headers["x-service-auth"] = _generate_service_token()

    body = await request.body()

    last_error = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.request(
                    method=request.method,
                    url=target_url,
                    headers=filtered_headers,
                    params=query_params,
                    content=body or None,
                )
            circuit_breaker.record_success(host, port)
            response_headers = {}
            for key, value in resp.headers.items():
                if key.lower() not in {"transfer-encoding", "content-encoding", "content-length"}:
                    response_headers[key] = value
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=response_headers,
                media_type=resp.headers.get("content-type"),
            )
        except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError) as e:
            last_error = e
            circuit_breaker.record_failure(host, port)
            if attempt < 2:
                await asyncio.sleep(0.2 * (attempt + 1))
            else:
                raise HTTPException(status_code=502, detail=f"Upstream {host}:{port} unreachable: {str(e)}")
        except httpx.HTTPStatusError as e:
            circuit_breaker.record_success(host, port)
            return Response(
                content=e.response.content,
                status_code=e.response.status_code,
                media_type=e.response.headers.get("content-type"),
            )

    raise HTTPException(status_code=502, detail=str(last_error))
