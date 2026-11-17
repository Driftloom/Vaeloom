"""
Idempotency Middleware — replay protection for consequential POST/PATCH/PUT requests.

Identity is (tenant_id, workspace_id, actor, key, path) — IDEM-SCOPE-01.
Same scope + key + identical payload replays the stored response
(`Idempotency-Replayed: true`); a different tenant/workspace/actor NEVER
observes another scope's result, even on key collision; a different payload
under the same identity gets 422.

Runs AFTER Auth+Tenant in the middleware stack (see main.py ordering) so
`scope["state"]` carries authoritative scope. Requests without auth context
scope to '' sentinels (fail-closed per-scope isolation still holds: two
unauthenticated callers share only the ('','','') namespace on public
paths — and all consequential paths require auth).

Pure ASGI, not BaseHTTPMiddleware: the response is captured instead of
forwarded, so the inner app finishes — including FastAPI dependency teardown,
which is where `get_db` commits — before `_store` opens its own session. The
BaseHTTPMiddleware version stored while the request transaction still held the
SQLite write lock, so the store's expired-row DELETE hit "database is locked"
and replay protection was silently lost (Idempotency-Stored: false).
"""
import hashlib
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from starlette.datastructures import Headers
from starlette.requests import ClientDisconnect
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ..database import async_session_factory
from ..models.schema import IdempotencyRecord

logger = logging.getLogger("vaeloom-api.middleware.idempotency")

IDEMPOTENCY_HEADER = "Idempotency-Key"
REPLAYED_HEADER = "Idempotency-Replayed"
STORED_HEADER = "Idempotency-Stored"
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


def _scope_from_asgi(scope: Scope) -> tuple[str, str, str]:
    """Authoritative scope from middleware-populated ASGI state.

    tenant/workspace from TenantMiddleware; actor (sub/user_id) from Auth.
    '' sentinel for absent values (never None: NULLs would defeat the UNIQUE
    scope constraint on PostgreSQL).
    """
    state: dict[str, Any] = scope.get("state") or {}
    tenant = state.get("tenant_id") or ""
    workspace = state.get("workspace_id") or ""
    user = state.get("user") or {}
    actor = (
        state.get("user_id")
        or (user.get("sub") if isinstance(user, dict) else None)
        or (user.get("user_id") if isinstance(user, dict) else None)
        or ""
    )
    return str(tenant), str(workspace), str(actor)


def _request_hash(method: str, path: str, body: bytes) -> str:
    return hashlib.sha256(f"{method}|{path}|{body.decode('utf-8', errors='replace')}".encode()).hexdigest()


async def _read_request_body(receive: Receive) -> bytes:
    """Buffer the request body so it can be replayed to the inner app."""
    chunks: list[bytes] = []
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            raise ClientDisconnect()
        chunks.append(message.get("body", b""))
        if not message.get("more_body", False):
            return b"".join(chunks)


def _replaying_receive(body: bytes, receive: Receive) -> Receive:
    """Serve the buffered body once, then defer to the real receiver."""
    replayed = False

    async def replay() -> Message:
        nonlocal replayed
        if not replayed:
            replayed = True
            return {"type": "http.request", "body": body, "more_body": False}
        return await receive()

    return replay


def _append_header(start_message: Message, name: str, value: str) -> None:
    encoded_name = name.lower().encode("latin-1")
    headers = [
        (key, val)
        for key, val in (start_message.get("headers") or [])
        if key.lower() != encoded_name
    ]
    headers.append((encoded_name, value.encode("latin-1")))
    start_message["headers"] = headers


class IdempotencyMiddleware:
    def __init__(self, app: ASGIApp, session_factory=None):
        self.app = app
        self._session_factory = session_factory or async_session_factory

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        method = scope.get("method", "")
        key = Headers(scope=scope).get(IDEMPOTENCY_HEADER)
        if not key or not _is_consequential(path, method):
            await self.app(scope, receive, send)
            return

        body = await _read_request_body(receive)
        req_hash = _request_hash(method, path, body)
        tenant_id, workspace_id, actor = _scope_from_asgi(scope)

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
                await JSONResponse(
                    status_code=503,
                    content={"detail": "Idempotency store unavailable — consequential request refused"},
                    headers={"Idempotency-Lookup": "failed"},
                )(scope, receive, send)
                return
            logger.exception("Idempotency lookup failed; passing through")
            replayed = None
        if replayed is not None:
            await replayed(scope, receive, send)
            return

        messages: list[Message] = []
        start_message: Message | None = None

        async def capture(message: Message) -> None:
            nonlocal start_message
            if message["type"] == "http.response.start":
                start_message = message
            messages.append(message)

        # The inner app runs to completion here, so FastAPI tears down the
        # dependency stack (and `get_db` commits) before we touch the DB.
        await self.app(scope, _replaying_receive(body, receive), capture)

        if start_message is None:
            # No response start (e.g. non-HTTP path leaked through): forward as-is.
            for message in messages:
                await send(message)
            return

        raw_body = b"".join(
            message.get("body", b"")
            for message in messages
            if message["type"] == "http.response.body"
        )
        captured_response = Response(
            content=raw_body,
            status_code=start_message.get("status", 200),
        )
        try:
            await self._store(
                key, path, req_hash, captured_response,
                tenant_id, workspace_id, actor, body_bytes=raw_body,
            )
            _append_header(start_message, STORED_HEADER, "true")
        except Exception:
            # The side effect already executed, so a 503 here cannot prevent a
            # duplicate — it would only lie about what happened. Pass the real
            # bytes through but tag them so the caller knows replay protection
            # was NOT durably recorded and must retry with the same key.
            logger.exception("Idempotency store failed; passing response through (not durably recorded)")
            _append_header(start_message, STORED_HEADER, "false")

        for message in messages:
            await send(message)

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
