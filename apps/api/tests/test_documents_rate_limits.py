"""Rate limits on the documents write paths.

What is asserted here is the CONTRACT the middleware reads: the override declared
on the registered endpoint. The HTTP 429 itself cannot be observed from this suite
because the test app does not mount `RateLimitMiddleware`.

1. The overrides are declared and discoverable. `@rate_limit` sits under the
   `@router.post` decorators on the intended handlers, and the value survives onto
   the registered `APIRoute` (both `/bulk` aliases share one handler, so both carry
   it).

2. `RateLimitMiddleware` can now READ them for an included router. It flattens
   `app.routes` through FastAPI's `_iter_included_route_candidates`, because
   `BaseHTTPMiddleware.dispatch` runs before routing leaves `scope["route"]` unset
   and `include_router` wraps everything in a lazy `_IncludedRouter` with no
   `.endpoint`. Previously the enforced budget silently fell back to the platform
   default on every decorated route while the response header advertised the
   decorator value — a header that lied about the limit in force.
"""
import pytest
from starlette.requests import Request

from api.middleware.rate_limit import RateLimitMiddleware, _resolve_rate_limit

UPLOAD = (30, 60)
BULK_UPLOAD = (5, 300)
PROCESS = (10, 300)

PLATFORM_DEFAULT_MAX = 60  # RateLimitMiddleware default used in this suite's probes


@pytest.fixture
def documents_app():
    """The documents router mounted the way production mounts it."""
    from fastapi import FastAPI

    from api.routers import documents

    app = FastAPI()
    app.include_router(documents.router, prefix="/api/v1/documents")
    return app


def _registered(app, path: str, method: str):
    """The APIRoute the router registered for `method path`.

    FastAPI 0.141 keeps `app.routes` as lazy `_IncludedRouter` objects with no
    `.endpoint`; `_iter_included_route_candidates` is the supported flattening.
    """
    from fastapi.routing import _iter_included_route_candidates

    for r in _iter_included_route_candidates(app.routes):
        if getattr(r, "path", None) == path and method in (getattr(r, "methods", set()) or set()):
            return r
    raise AssertionError(f"no route registered for {method} {path}")


def _limits_for(app, path: str, method: str) -> tuple[int, int]:
    """What the middleware resolves for a request scope, as dispatch sees it."""
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "root_path": "",
        "scheme": "http",
        "query_string": b"",
        "headers": [],
        "client": ("1.2.3.4", 1234),
        "server": ("test", 80),
        "app": app,
    }
    middleware = RateLimitMiddleware(
        app=None, requests_per_minute=PLATFORM_DEFAULT_MAX, window_seconds=60
    )
    return middleware._get_limits(Request(scope))


class TestDeclaredDocumentRateLimits:
    def test_single_upload_is_limited(self, documents_app):
        assert _resolve_rate_limit(_registered(documents_app, "", "POST").endpoint) == UPLOAD

    @pytest.mark.parametrize("path", ["/bulk/upload", "/bulk"])
    def test_bulk_upload_is_limited_on_both_aliases(self, documents_app, path):
        """Both registered paths share one handler and must share the ceiling.

        An override on only one of the two `@router.post` decorators would leave the
        older `/bulk` spelling unthrottled.
        """
        assert _resolve_rate_limit(_registered(documents_app, path, "POST").endpoint) == BULK_UPLOAD

    def test_process_is_limited(self, documents_app):
        route = _registered(documents_app, "/{document_id}/process", "POST")
        assert _resolve_rate_limit(route.endpoint) == PROCESS

    @pytest.mark.parametrize(
        "path,method,expected",
        [
            ("", "POST", UPLOAD),
            ("/bulk/upload", "POST", BULK_UPLOAD),
            ("/{document_id}/process", "POST", PROCESS),
        ],
    )
    def test_limit_is_stricter_than_the_platform_default(self, path, method, expected):
        """A write path must never be looser than the global default.

        The default is 60/minute; an upload or a parse costs far more than a
        metadata read, so an equal-or-larger budget would leave the endpoint
        effectively unthrottled.
        """
        max_requests, window = expected
        assert max_requests < PLATFORM_DEFAULT_MAX
        assert max_requests / window < PLATFORM_DEFAULT_MAX / 60

    @pytest.mark.parametrize(
        "path", ["", "/stats", "/search", "/folders", "/folders/tree"]
    )
    def test_reads_carry_no_override(self, documents_app, path):
        """The new limits must not silently throttle ordinary reads."""
        assert _resolve_rate_limit(_registered(documents_app, path, "GET").endpoint) is None

    def test_reads_resolve_to_the_platform_default(self, documents_app):
        assert _limits_for(documents_app, "/api/v1/documents", "GET") == (
            PLATFORM_DEFAULT_MAX,
            60,
        )

    def test_middleware_resolves_decorated_upload_limit(self, documents_app):
        assert _limits_for(documents_app, "/api/v1/documents", "POST") == UPLOAD

    def test_middleware_resolves_decorated_process_limit(self, documents_app):
        assert _limits_for(documents_app, "/api/v1/documents/{document_id}/process", "POST") == PROCESS

    @pytest.mark.asyncio
    async def test_decorated_limit_is_actually_enforced_end_to_end(self):
        """The unit tests above only read the declared config.

        This mounts the real middleware and proves the decorator's budget is the one
        enforced: 30/min must return 429 on request 31, not on request 61 (the
        platform default). A regression to the default would silently restore the
        unenforced state this suite previously pinned as an xfail.
        """
        from httpx import ASGITransport, AsyncClient

        from fastapi import FastAPI

        from api.middleware.rate_limit import RateLimitMiddleware
        from api.routers import documents

        app = FastAPI()
        app.add_middleware(RateLimitMiddleware, requests_per_minute=PLATFORM_DEFAULT_MAX, window_seconds=60)
        app.include_router(documents.router, prefix="/api/v1/documents")

        codes: list[int] = []
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            for _ in range(UPLOAD[0] + 4):
                res = await c.post(
                    "/api/v1/documents?workspace_id=ws", files={"file": ("a.txt", b"hi")}
                )
                codes.append(res.status_code)

        first_429 = next((i for i, code in enumerate(codes, 1) if code == 429), None)
        assert first_429 == UPLOAD[0] + 1, (
            f"expected 429 at request {UPLOAD[0] + 1}, got {first_429}; "
            f"codes={codes}"
        )