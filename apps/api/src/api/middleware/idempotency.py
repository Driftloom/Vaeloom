"""
Idempotency Middleware — replay protection for consequential POST/PATCH/PUT requests.

Identity is (tenant_id, workspace_id, actor, key, path) — IDEM-SCOPE-01.
Same scope + key + identical payload replays the stored response
(`Idempotency-Replayed: true`); a different tenant/workspace/actor NEVER
observes another scope's result, even on key collision; a different payload
under the same identity gets 422.

Runs AFTER Auth+Tenant in the middleware stack (see main.py ordering) so
request.state carries authoritative scope. Requests without auth context
scope to '' sentinels (fail-closed per-scope isolation still holds: two
unauthenticated callers share only the ('','','') namespace on public
paths — and all consequential paths require auth).
"""
import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Request
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..database import async_session_factory
from ..models.schema import IdempotencyRecord

logger = logging.getLogger("vaeloom-api.middleware.idempotency")

IDEMPOTENCY_HEADER = "Idempotency-Key"
REPLAYED_HEADER = "Idempotency-Replayed"
RETENTION_HOURS = 24

CONSEQUENTIAL_PREFIXES = (
    "/api/v1/consent/grant",
    "/api/v1/consent/revoke/",
    "/api/v1/gdpr/delete",
)


def _is_consequential(path: str, method: str) -> bool:
    if method not in ("POST", "PUT", "PATCH"):
        return False
    if path.startswith(CONSEQUENTIAL_PREFIXES):
        return True
    return path.startswith("/api/v1/approvals")


def _scope_from_request(request: Request) -> tuple[str, str, str]:
    """Authoritative scope from middleware-populated request state.

    tenant/workspace from TenantMiddleware; actor (sub/user_id) from Auth.
    '' sentinel for absent values (never None: NULLs would defeat the UNIQUE
    scope constraint on PostgreSQL).
    """
    tenant = getattr(request.state, "tenant_id", None) or ""
    workspace = getattr(request.state, "workspace_id", None) or ""
    user = getattr(request.state, "user", None) or {}
    actor = (
        getattr(request.state, "user_id", None)
        or (user.get("sub") if isinstance(user, dict) else None)
        or (user.get("user_id") if isinstance(user, dict) else None)
        or ""
    )
    return str(tenant), str(workspace), str(actor)


def _request_hash(method: str, path: str, body: bytes) -> str:
    return hashlib.sha256(f"{method}|{path}|{body.decode('utf-8', errors='replace')}".encode()).hexdigest()


class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, session_factory=None):
        super().__init__(app)
        self._session_factory = session_factory or async_session_factory

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        key = request.headers.get(IDEMPOTENCY_HEADER)
        if not key or not _is_consequential(path, request.method):
            return await call_next(request)

        body = await request.body()
        req_hash = _request_hash(request.method, path, body)
        tenant_id, workspace_id, actor = _scope_from_request(request)

        try:
            replayed = await self._replay(key, path, req_hash, tenant_id, workspace_id, actor)
        except Exception:
            try:
                from ..config import settings as _idem_settings

                _fail_closed = bool(getattr(_idem_settings, "idempotency_fail_closed", False))
            except Exception:
                _fail_closed = False
            if _fail_closed:
                logger.error("Idempotency lookup failed; fail-closed 503 (consequential path)")
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Idempotency store unavailable — consequential request refused"},
                    headers={"Idempotency-Lookup": "failed"},
                )
            logger.exception("Idempotency lookup failed; passing through")
            replayed = None
        if replayed is not None:
            return replayed

        response = await call_next(request)
        # Consume the body once, up front: _store must never be the owner of
        # the only read (a store failure after a partial read would otherwise
        # leave an exhausted iterator and an empty body to the client).
        try:
            raw_body = b"".join([chunk async for chunk in response.body_iterator])
        except Exception:
            logger.exception("Idempotency body read failed; passing response through")
            return response
        try:
            await self._store(key, path, req_hash, response, tenant_id, workspace_id, actor, body_bytes=raw_body)
            response = Response(
                content=raw_body,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
        except Exception:
            # The side effect already executed, so a 503 here cannot prevent a
            # duplicate — it would only lie about what happened. Pass the real
            # bytes through but tag them so the caller knows replay protection
            # was NOT durably recorded and must retry with the same key.
            logger.exception("Idempotency store failed; passing response through (not durably recorded)")
            headers = dict(response.headers)
            headers["Idempotency-Stored"] = "false"
            response = Response(content=raw_body, status_code=response.status_code, headers=headers)
        return response

    async def _replay(
        self, key: str, path: str, req_hash: str,
        tenant_id: str, workspace_id: str, actor: str,
    ) -> Response | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.tenant_id == tenant_id,
                    IdempotencyRecord.workspace_id == workspace_id,
                    IdempotencyRecord.actor == actor,
                    IdempotencyRecord.idempotency_key == key,
                    IdempotencyRecord.request_path == path,
                    IdempotencyRecord.expires_at > datetime.now(UTC),
                )
            )
            record = result.scalar_one_or_none()
            if record is None:
                return None
            if record.request_hash != req_hash:
                return JSONResponse(
                    status_code=422,
                    content={"detail": "Idempotency key reused with a different request payload"},
                )
            try:
                content = json.loads(record.response_body)
            except json.JSONDecodeError:
                content = record.response_body
            return JSONResponse(
                status_code=record.status_code,
                content=content,
                headers={REPLAYED_HEADER: "true"},
            )

    async def _store(
        self, key: str, path: str, req_hash: str, response: Response,
        tenant_id: str, workspace_id: str, actor: str,
        body_bytes: bytes | None = None,
    ) -> bytes:
        if body_bytes is None:  # backward compat: consume when caller did not pre-read
            body_bytes = b"".join([chunk async for chunk in response.body_iterator])
        body_text = body_bytes.decode("utf-8", errors="replace")
        now = datetime.now(UTC)
        async with self._session_factory() as session:
            try:
                await session.execute(
                    delete(IdempotencyRecord).where(IdempotencyRecord.expires_at < now)
                )
                session.add(
                    IdempotencyRecord(
                        id=uuid.uuid4(),
                        tenant_id=tenant_id,
                        workspace_id=workspace_id,
                        actor=actor,
                        idempotency_key=key,
                        request_path=path,
                        request_hash=req_hash,
                        status_code=response.status_code,
                        response_body=body_text,
                        expires_at=now + timedelta(hours=RETENTION_HOURS),
                    )
                )
                await session.commit()
            except IntegrityError:
                await session.rollback()
        return body_bytes
