from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestOpenTelemetrySetup:
    def test_setup_noop_when_not_installed(self):
        with patch("api.infrastructure.opentelemetry._has_opentelemetry", False):
            from api.infrastructure.opentelemetry import setup_opentelemetry, instrumement_fastapi

            result = setup_opentelemetry()
            assert result is None

            result = instrumement_fastapi(MagicMock())
            assert result is None

    def test_setup_when_installed(self):
        with (
            patch("api.infrastructure.opentelemetry._has_opentelemetry", True),
            patch("api.infrastructure.opentelemetry.OTLPSpanExporter") as mock_exporter,
            patch("api.infrastructure.opentelemetry.BatchSpanProcessor") as mock_processor,
            patch("api.infrastructure.opentelemetry.TracerProvider") as mock_provider,
            patch("api.infrastructure.opentelemetry.trace") as mock_trace,
        ):
            from api.infrastructure.opentelemetry import setup_opentelemetry

            setup_opentelemetry()

            mock_trace.set_tracer_provider.assert_called_once()
            mock_trace.get_tracer.assert_called_once_with("api.infrastructure.opentelemetry")

    def test_instrumement_calls_instrumentor(self):
        mock_app = MagicMock()
        with (
            patch("api.infrastructure.opentelemetry._has_opentelemetry", True),
            patch("api.infrastructure.opentelemetry.FastAPIInstrumentor") as mock_instr,
        ):
            from api.infrastructure.opentelemetry import instrumement_fastapi

            instrumement_fastapi(mock_app)
            mock_instr.instrument_app.assert_called_once_with(mock_app)

    def test_instrumement_noop_when_not_installed(self):
        mock_app = MagicMock()
        with (
            patch("api.infrastructure.opentelemetry._has_opentelemetry", False),
            patch("api.infrastructure.opentelemetry.FastAPIInstrumentor") as mock_instr,
        ):
            from api.infrastructure.opentelemetry import instrumement_fastapi

            instrumement_fastapi(mock_app)
            mock_instr.instrument_app.assert_not_called()


@pytest.mark.asyncio
class TestTracedMiddleware:
    async def test_middleware_calls_through_when_no_tracer(self):
        from api.infrastructure.opentelemetry import TracedMiddleware

        async def mock_app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b"ok"})

        middleware = TracedMiddleware(mock_app)

        scope = {"type": "http", "method": "GET", "path": "/test"}
        receive = MagicMock()
        sent = []

        async def tracking_send(msg):
            sent.append(msg)

        await middleware(scope, receive, tracking_send)
        assert len(sent) >= 2

    async def test_middleware_sets_span_attributes(self):
        from api.infrastructure.opentelemetry import TracedMiddleware

        async def mock_app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200})
            await send({"type": "http.response.body", "body": b"ok"})

        middleware = TracedMiddleware(mock_app)

        mock_span = MagicMock()
        mock_tracer = MagicMock()
        mock_tracer.start_as_current_span.return_value.__enter__.return_value = mock_span

        scope = {"type": "http", "method": "POST", "path": "/api/v1/test"}
        receive = MagicMock()
        sent = []

        async def tracking_send(msg):
            sent.append(msg)

        with patch("api.infrastructure.opentelemetry._tracer", mock_tracer):
            await middleware(scope, receive, tracking_send)

        mock_span.set_attribute.assert_any_call("http.method", "POST")
        mock_span.set_attribute.assert_any_call("http.path", "/api/v1/test")
