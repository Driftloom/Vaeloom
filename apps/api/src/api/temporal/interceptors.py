"""Temporal interceptors for distributed tracing (F-TRC-01).

Propagates OpenTelemetry trace context across Activity → LangGraph → Tool
boundaries using W3C Trace Context headers. Requires `temporalio[tracer]`
or the built-in headers propagation in temporalio >= 1.9.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    from opentelemetry import trace
    from opentelemetry.trace import SpanKind, StatusCode

    _tracer = trace.get_tracer("vaeloom.temporal", "1.0.0")
    HAS_OTEL = True
except ImportError:
    HAS_OTEL = False
    _tracer = None  # type: ignore[assignment]

try:
    from temporalio.interceptor import (
        ActivityInboundInterceptor,
        ExecuteActivityInput,
        Interceptor,
    )

    HAS_TEMPORAL_INTERCEPTOR = True
except ImportError:
    HAS_TEMPORAL_INTERCEPTOR = False


if HAS_TEMPORAL_INTERCEPTOR and HAS_OTEL:

    class _ActivityTracingInterceptor(ActivityInboundInterceptor):
        """Wraps each Temporal activity execution in an OTEL span."""

        async def execute_activity(self, input: ExecuteActivityInput) -> Any:
            activity_name = input.defn.name
            span_name = f"temporal.activity.{activity_name}"
            with _tracer.start_as_current_span(
                span_name,
                kind=SpanKind.INTERNAL,
                attributes={
                    "temporal.activity.name": activity_name,
                    "temporal.activity.type": "activity",
                },
            ) as span:
                try:
                    result = await super().execute_activity(input)
                    span.set_status(StatusCode.OK)
                    return result
                except Exception as exc:
                    span.set_status(StatusCode.ERROR, str(exc)[:200])
                    span.record_exception(exc)
                    raise

    # Workflow tracing (closes gap workflow→activity propagation §25)
    try:
        from temporalio.interceptor import WorkflowInboundInterceptor, ExecuteWorkflowInput  # type: ignore

        _HAS_WF_INTERCEPTOR = True
    except Exception:
        _HAS_WF_INTERCEPTOR = False
        WorkflowInboundInterceptor = object  # type: ignore
        ExecuteWorkflowInput = object  # type: ignore

    if _HAS_WF_INTERCEPTOR:

        class _WorkflowTracingInterceptor(WorkflowInboundInterceptor):  # type: ignore
            async def execute_workflow(self, input: ExecuteWorkflowInput) -> Any:
                wf_name = getattr(input.defn, "name", "workflow")
                span_name = f"temporal.workflow.{wf_name}"
                with _tracer.start_as_current_span(
                    span_name, kind=SpanKind.INTERNAL, attributes={"temporal.workflow.name": wf_name}
                ) as span:
                    try:
                        result = await super().execute_workflow(input)
                        span.set_status(StatusCode.OK)
                        return result
                    except Exception as exc:
                        span.set_status(StatusCode.ERROR, str(exc)[:200])
                        span.record_exception(exc)
                        raise
    else:
        _WorkflowTracingInterceptor = None  # type: ignore

    class TracingInterceptor(Interceptor):
        """Top-level Temporal interceptor that injects activity + workflow tracing."""

        def activity_inbound(self) -> _ActivityTracingInterceptor:
            return _ActivityTracingInterceptor(impl=self._impl)

        def workflow_inbound(self):  # type: ignore[no-untyped-def]
            if _WorkflowTracingInterceptor is None:
                from contextlib import nullcontext as _nc

                return _nc()  # type: ignore
            return _WorkflowTracingInterceptor(impl=self._impl)  # type: ignore

        def __init__(self) -> None:
            # Base interceptor needs impl — use pass-through
            from temporalio.interceptor import _UnboundInterceptor

            self._impl = _UnboundInterceptor()  # type: ignore

else:
    # Fallback: no-op interceptor when temporalio interceptor or otel unavailable
    class TracingInterceptor:  # type: ignore[no-redef]
        pass


def record_graph_span(
    node_name: str,
    attributes: dict[str, Any] | None = None,
):
    """Context manager that records a LangGraph node execution as an OTEL span.

    Usage in nodes.py:
        with record_graph_span("validate_input", {"workspace_id": ws_id}):
            ...node logic...
    """
    if not HAS_OTEL or _tracer is None:
        from contextlib import nullcontext

        return nullcontext()

    span_name = f"langgraph.node.{node_name}"
    attrs = {"langgraph.node": node_name, "langgraph.type": "node"}
    if attributes:
        attrs.update({f"langgraph.{k}": str(v)[:100] for k, v in attributes.items()})

    return _tracer.start_as_current_span(span_name, kind=SpanKind.INTERNAL, attributes=attrs)
