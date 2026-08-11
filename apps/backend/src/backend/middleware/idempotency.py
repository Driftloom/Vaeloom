"""
Idempotency Middleware — replay protection for consequential POST/PATCH/PUT requests.

Requests carrying an `Idempotency-Key` header to a consequential endpoint are
recorded together with their response. Replays with the same key and identical
payload return the original response (marked with `Idempotency-Replayed: true`)
instead of re-executing the side effect. Replays with a different payload get 422.
"""
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from ..database import async_session_factory
from ..models.schema import IdempotencyRecord

logger = logging.getLogger("vaeloom-backend.middleware.idempotency")

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

        try:
            replayed = await self._replay(key, path, req_hash)
        except Exception:  # pragma: no cover - fail-open on lookup errors
            logger.exception("Idempotency lookup failed; passing through")
            replayed = None
        if replayed is not None:
            return replayed

        response = await call_next(request)
        try:
            body_bytes = await self._store(key, path, req_hash, response)
            response = Response(
                content=body_bytes,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
        except Exception:  # pragma: no cover - fail-open on store errors
            logger.exception("Idempotency store failed; passing response through")
        return response

    async def _replay(self, key: str, path: str, req_hash: str) -> Response | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(IdempotencyRecord).where(
                    IdempotencyRecord.idempotency_key == key,
                    IdempotencyRecord.request_path == path,
                    IdempotencyRecord.expires_at > datetime.now(timezone.utc),
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

    async def _store(self, key: str, path: str, req_hash: str, response: Response) -> bytes:
        body_bytes = b"".join([chunk async for chunk in response.body_iterator])
        body_text = body_bytes.decode("utf-8", errors="replace")
        now = datetime.now(timezone.utc)
        async with self._session_factory() as session:
            try:
                await session.execute(
                    delete(IdempotencyRecord).where(IdempotencyRecord.expires_at < now)
                )
                session.add(
                    IdempotencyRecord(
                        id=uuid.uuid4(),
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
