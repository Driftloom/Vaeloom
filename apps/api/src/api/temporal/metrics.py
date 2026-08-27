"""Temporal Prometheus metrics (§24).

Keeps metric names distinct from http_requests_total so dashboards can
join workflow telemetry with app telemetry without collision.
"""

try:
    from prometheus_client import Counter, Histogram, Gauge

    temporal_workflow_started = Counter("temporal_workflow_started_total", "Workflows started", ["workflow_type", "task_queue"])
    temporal_workflow_completed = Counter("temporal_workflow_completed_total", "Workflows completed", ["workflow_type", "task_queue", "status"])
    temporal_workflow_failed = Counter("temporal_workflow_failed_total", "Workflows failed", ["workflow_type", "reason"])
    temporal_activity_started = Counter("temporal_activity_started_total", "Activities started", ["activity_type"])
    temporal_activity_failed = Counter("temporal_activity_failed_total", "Activities failed", ["activity_type", "reason"])
    temporal_activity_retried = Counter("temporal_activity_retried_total", "Activity retries", ["activity_type"])
    temporal_schedule_executions = Counter("temporal_schedule_execution_total", "Schedule dispatches", ["schedule_id", "status"])
    temporal_approval_wait_seconds = Histogram("temporal_approval_wait_seconds", "Approval signal wait", buckets=(5, 30, 60, 300, 900, 3600))
    temporal_workflow_duration_seconds = Histogram("temporal_workflow_duration_seconds", "Workflow duration", ["workflow_type"], buckets=(0.1, 1, 5, 10, 30, 60, 120, 300))
    temporal_active_workflows = Gauge("temporal_active_workflows", "Active workflows by queue", ["task_queue"])
    HAS_METRICS = True

    def _inc_workflow_started(workflow_type: str, task_queue: str) -> None:
        try:
            temporal_workflow_started.labels(workflow_type=workflow_type, task_queue=task_queue).inc()
        except Exception:
            pass

    def _inc_workflow_completed(workflow_type: str, task_queue: str, status: str) -> None:
        try:
            temporal_workflow_completed.labels(workflow_type=workflow_type, task_queue=task_queue, status=status).inc()
        except Exception:
            pass

    def _inc_activity_started(activity_type: str) -> None:
        try:
            temporal_activity_started.labels(activity_type=activity_type).inc()
        except Exception:
            pass

    def _inc_activity_failed(activity_type: str, reason: str = "exception") -> None:
        try:
            temporal_activity_failed.labels(activity_type=activity_type, reason=reason).inc()
        except Exception:
            pass

except Exception:  # pragma: no cover
    HAS_METRICS = False
    temporal_workflow_started = temporal_workflow_completed = temporal_workflow_failed = None  # type: ignore
    temporal_activity_started = temporal_activity_failed = temporal_activity_retried = None  # type: ignore
    temporal_schedule_executions = None  # type: ignore
    temporal_approval_wait_seconds = temporal_workflow_duration_seconds = temporal_active_workflows = None  # type: ignore

    def _inc_workflow_started(workflow_type: str, task_queue: str) -> None:  # type: ignore[no-redef]
        return None

    def _inc_workflow_completed(workflow_type: str, task_queue: str, status: str) -> None:  # type: ignore[no-redef]
        return None

    def _inc_activity_started(activity_type: str) -> None:  # type: ignore[no-redef]
        return None

    def _inc_activity_failed(activity_type: str, reason: str = "exception") -> None:  # type: ignore[no-redef]
        return None
