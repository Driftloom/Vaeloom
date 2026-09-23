import logging
import uuid

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from ..config import settings

logger = logging.getLogger(__name__)

#: Base URI for stable machine-readable error types (RFC 7807 `type`).
ERROR_TYPE_BASE = "https://api.vaeloom.app/errors"

#: Media type for all error responses (Loop 4 cutover). The web client parses
#: bodies with res.json() regardless of content-type (verified in api.ts),
#: and legacy detail keys are preserved — so this is wire-compatible.
PROBLEM_MEDIA_TYPE = "application/problem+json"

_STATUS_TITLES = {
    400: ("bad-request", "Bad Request"),
    401: ("unauthorized", "Unauthorized"),
    403: ("forbidden", "Forbidden"),
    404: ("not-found", "Not Found"),
    409: ("conflict", "Conflict"),
    413: ("payload-too-large", "Payload Too Large"),
    422: ("validation-error", "Validation Error"),
    429: ("rate-limited", "Too Many Requests"),
    500: ("internal-error", "Internal Server Error"),
    503: ("unavailable", "Service Unavailable"),
}


def problem_envelope(
    status_code: int,
    message: object,
    details: object = None,
    request: Request | None = None,
) -> dict:
    """RFC 7807 superset envelope (Loop 3).

    Adds stable ``type``/``title``/``status``/``instance`` fields WITHOUT
    removing the existing ``success``/``error`` shape — the web client parses
    ``error.message``/``detail`` today, so this is purely additive. See
    ``docs/backend/error-contract.md`` for the migration path.
    """
    slug, title = _STATUS_TITLES.get(status_code, ("error", "Error"))
    body: dict = {
        "success": False,
        "error": {
            "code": status_code,
            "message": message,
            "details": details,
        },
        "type": f"{ERROR_TYPE_BASE}/{slug}",
        "title": title,
        "status": status_code,
    }
    if request is not None:
        try:
            body["instance"] = str(request.url.path)
        except Exception:
            pass
    return body


async def unified_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=problem_envelope(exc.status_code, exc.detail, None, request),
        media_type=PROBLEM_MEDIA_TYPE,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """422s in the same envelope (FastAPI's default ``{"detail": [...]}`` shape
    is preserved verbatim under ``detail`` for backward compatibility).

    Pydantic v2 error dicts carry ``ctx.error`` (an exception instance) which
    is not JSON-serializable — stringify the context so the handler itself
    can never 500 on a 422.
    """
    import json as _json

    raw_errors = exc.errors()
    try:
        details = _json.loads(_json.dumps(raw_errors, default=str))
    except Exception:
        details = [{"msg": str(e) for e in raw_errors}]
    return JSONResponse(
        status_code=422,
        content={
            **problem_envelope(422, "Validation failed", details, request),
            "detail": details,
        },
        media_type=PROBLEM_MEDIA_TYPE,
    )


def denial(
    status_code: int,
    detail: str,
    request: Request | None = None,
    headers: dict | None = None,
) -> JSONResponse:
    """Middleware denial with the same envelope (Loop 3).

    Middleware short-circuits before exception handlers, so denials here build
    the envelope directly. Legacy ``detail`` key is preserved verbatim —
    clients parsing ``detail`` keep working. Pass-through ``headers`` keeps
    Retry-After / X-IP-Allowlist behavior intact.
    """
    return JSONResponse(
        status_code=status_code,
        content={
            **problem_envelope(status_code, detail, None, request),
            "detail": detail,
        },
        headers=headers,
        media_type=PROBLEM_MEDIA_TYPE,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    correlation_id = getattr(request.state, "correlation_id", None) or str(uuid.uuid4())
    logger.exception("Unhandled exception  correlation_id=%s  path=%s  method=%s", correlation_id, request.url.path, request.method)
    error = problem_envelope(500, "Internal server error", None, request)
    # Only leak the correlation_id in non-production (debug) mode (FIND-SEC-015).
    if getattr(settings, "debug", False):
        error["error"]["correlation_id"] = correlation_id
    return JSONResponse(status_code=500, content=error, media_type=PROBLEM_MEDIA_TYPE)
