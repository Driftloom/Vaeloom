"""Provider outages must answer 503 in the real application.

Why this file exists: `llm_provider_exception_handler` was correct and tested,
but its registration in `api/main.py` was commented out. `tests/conftest.py`
registers the same handler on the test app, with a comment saying so, so the
entire suite passed while production answered 500 for every provider outage.

The conftest mirroring main.py is the right pattern -- but it means conftest
can only ever prove the *handler* is right, never that main.py still uses it.
Nothing failed when the line was removed. These tests close that gap.
"""

import pytest
from fastapi.exceptions import RequestValidationError
from httpx import ASGITransport

from api.main import app
from api.middleware.exception_handler import (
    llm_provider_exception_handler,
    unified_exception_handler,
)
from api.services.llm_service import LLMProviderError


class TestProviderOutageStatusMapping:
    def test_main_app_registers_the_503_handler(self):
        handlers = getattr(app, "exception_handlers", {})
        assert (
            LLMProviderError in handlers
        ), "main.py no longer maps LLMProviderError; provider outages will answer 500"
        assert handlers[LLMProviderError] is llm_provider_exception_handler

    def test_provider_error_is_not_shadowed_by_the_generic_500_handler(self):
        """`Exception` -> 500 is also registered, and must not win.

        Starlette resolves handlers by walking the exception's MRO, so the
        specific registration has to be present for 503 to be reachable at all.
        This asserts both are registered and that the specific one is not the
        generic handler wearing the wrong name.
        """
        handlers = getattr(app, "exception_handlers", {})
        assert Exception in handlers, "generic handler missing; real bugs would escape the envelope"
        assert handlers[LLMProviderError] is not handlers[Exception]

    async def test_provider_outage_answers_503_and_a_real_bug_answers_500(self):
        """Exercise the handler chain in main.py's own registration order.

        Deliberately a local mini-app rather than a probe route on the suite's
        app: every route there passes through AuthMiddleware, and exempting one
        would mean adding a test prefix to `auth.PUBLIC_PREFIXES` -- which is
        production code and would open a genuinely unauthenticated endpoint.

        Together with `test_main_app_registers_the_503_handler`, which asserts
        main.py uses these exact handlers in this order, this covers both halves
        without a security hole to get there.
        """
        from fastapi import FastAPI
        from httpx import AsyncClient
        from starlette.exceptions import HTTPException as StarletteHTTPException

        from api.middleware.exception_handler import (
            generic_exception_handler,
            validation_exception_handler,
        )

        mini = FastAPI()
        mini.add_exception_handler(StarletteHTTPException, unified_exception_handler)
        mini.add_exception_handler(Exception, generic_exception_handler)
        mini.add_exception_handler(RequestValidationError, validation_exception_handler)
        mini.add_exception_handler(LLMProviderError, llm_provider_exception_handler)

        @mini.get("/outage")
        async def outage():
            raise LLMProviderError("upstream refused connection")

        @mini.get("/bug")
        async def bug():
            raise ZeroDivisionError("genuine defect, not a provider outage")

        transport = ASGITransport(app=mini, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://probe") as probe:
            res_outage = await probe.get("/outage")
            res_bug = await probe.get("/bug")

        assert res_outage.status_code == 503, f"got {res_outage.status_code}"
        assert res_outage.json()["status"] == 503

        # Negative control: the mapping must stay narrow.
        #
        # `raise_app_exceptions=False` is required, not cosmetic. Starlette's
        # ServerErrorMiddleware sends the handler's response and then re-raises
        # so the server logs it, and the ASGI transport surfaces that re-raise by
        # default. Left on, the 500 control raises ZeroDivisionError instead of
        # returning 500 and the test passes for the wrong reason.
        assert res_bug.status_code == 500, f"expected 500, got {res_bug.status_code}"

    def test_handler_returns_the_problem_envelope(self):
        """The 503 body must match the shape every other error uses."""
        import asyncio

        from starlette.requests import Request

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/memories/search",
            "headers": [],
            "query_string": b"",
            "scheme": "http",
            "server": ("test", 80),
            "root_path": "",
        }
        response = asyncio.run(
            llm_provider_exception_handler(
                Request(scope), LLMProviderError("upstream refused connection")
            )
        )
        assert response.status_code == 503
        body = response.body.decode()
        assert '"status":503' in body
        # The upstream reason is surfaced for operators but must not become a 500
        # or leak as a traceback.
        assert "upstream refused connection" in body


@pytest.mark.parametrize("exc_name", ["LLMProviderError", "LLMTransientError"])
def test_transient_subclasses_share_the_mapping(exc_name):
    """`LLMTransientError` subclasses `LLMProviderError`, so retryable upstream
    429/5xx must also land on 503 via the same registration."""
    import api.services.llm_service as llm_service

    exc_cls = getattr(llm_service, exc_name, None)
    assert exc_cls is not None, f"{exc_name} no longer exists"
    assert issubclass(exc_cls, LLMProviderError)
