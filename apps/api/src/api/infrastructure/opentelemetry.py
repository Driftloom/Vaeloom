import logging
import time

logger = logging.getLogger(__name__)

_has_opentelemetry = False
_tracer = None

try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _has_opentelemetry = True
except ImportError:
    pass


def setup_opentelemetry() -> None:
    if not _has_opentelemetry:
        logger.warning("OpenTelemetry packages not installed — tracing disabled")
        return

    resource = Resource.create({"service.name": "vaeloom-api"})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter()
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    global _tracer
    _tracer = trace.get_tracer(__name__)
    logger.info("OpenTelemetry initialized (service=vaeloom-api)")


def instrumement_fastapi(app) -> None:
    if not _has_opentelemetry:
        return
    FastAPIInstrumentor.instrument_app(app)


class TracedMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not _tracer:
            await self.app(scope, receive, send)
            return

        with _tracer.start_as_current_span("http_request") as span:
            span.set_attribute("http.method", scope.get("method", ""))
            span.set_attribute("http.path", scope.get("path", ""))


            start = time.monotonic()

            async def send_with_attributes(message):
                if message["type"] == "http.response.start":
                    span.set_attribute("http.status_code", message.get("status", 0))
                    span.set_attribute("http.duration_ms", (time.monotonic() - start) * 1000)
                await send(message)

            await self.app(scope, receive, send_with_attributes)
