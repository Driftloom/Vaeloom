"""Task queue catalogue (ADR-038 §29).

One worker pool per queue isolates backpressure: ingest burst must not
starve connector sync. Names match config temporal_task_queue_* so
deploy can override via env without code changes."""

from dataclasses import dataclass

from ..config import settings


@dataclass(frozen=True)
class QueueDef:
    name: str
    description: str
    max_concurrent_activities: int


TASK_QUEUES: dict[str, QueueDef] = {
    "ingest": QueueDef(
        name=getattr(settings, "temporal_task_queue_ingest", "vaeloom-ingest-q"),
        description="Document ingest: parse→extract→memory-write→index",
        max_concurrent_activities=20,
    ),
    "documents": QueueDef(
        name=getattr(settings, "temporal_task_queue_documents", "vaeloom-documents-q"),
        description="Document rendering (Playwright) — Chromium-capped",
        max_concurrent_activities=2,
    ),
    "agent": QueueDef(
        name=getattr(settings, "temporal_task_queue_agent", "vaeloom-agent-q"),
        description="Durable agent runs (wraps DurableAgentRunActivity → future LangGraph)",
        max_concurrent_activities=8,
    ),
    "connectors": QueueDef(
        name=getattr(settings, "temporal_task_queue_connectors", "vaeloom-connectors-q"),
        description="Connector sync/fetch (per-provider throttled)",
        max_concurrent_activities=6,
    ),
    "schedules": QueueDef(
        name=getattr(settings, "temporal_task_queue_schedules", "vaeloom-schedules-q"),
        description="Schedule dispatcher (lightweight)",
        max_concurrent_activities=4,
    ),
    "approvals": QueueDef(
        name=getattr(settings, "temporal_task_queue_approvals", "vaeloom-approvals-q"),
        description="Human-in-loop approval waits (signal-driven)",
        max_concurrent_activities=20,
    ),
    "memory": QueueDef(
        name=getattr(settings, "temporal_task_queue_memory", "vaeloom-memory-q"),
        description="Nightly consolidation/dedup graph writes",
        max_concurrent_activities=2,
    ),
    "events": QueueDef(
        name=getattr(settings, "temporal_task_queue_events", "vaeloom-events-q") if hasattr(settings, "temporal_task_queue_events") else "vaeloom-events-q",
        description="Event-triggered durable execution (causation/correlation tracked, dedup per event_id)",
        max_concurrent_activities=8,
    ),
}


def queue_name(key: str) -> str:
    return TASK_QUEUES[key].name
