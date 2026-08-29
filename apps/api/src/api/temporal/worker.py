"""Temporal worker entrypoints.

Single module implements both:
- `python -m api.temporal.worker` — production worker polling configured queues.
- `python -m api.temporal.worker --dry-run` — validates activity/workflow registration without connecting.

Queues (§29) live separately so ingest burst does not starve connectors.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import timedelta

logger = logging.getLogger(__name__)


async def _run(dry_run: bool = False) -> None:
    if dry_run:
        from .activities import ALL_ACTIVITIES
        from .workflows import HAS_TEMPORAL

        print(f"dry-run ok: temporal_sdk={'present' if HAS_TEMPORAL else 'absent'} activities={len(ALL_ACTIVITIES)}")
        for a in ALL_ACTIVITIES:
            print(f" - {getattr(a, '__name__', str(a))}")
        return
    # Expose Prometheus metrics for worker (T-005) — best-effort, fail-open if port in use
    try:
        from prometheus_client import start_http_server

        start_http_server(9090)
        logger.info("Temporal worker metrics exposed on :9090/metrics")
    except Exception as e:
        logger.debug(f"Worker metrics server not started: {e}")

    from .activities import ALL_ACTIVITIES
    from .queues import TASK_QUEUES
    from .workflows import ApprovalWorkflow, ConnectorSyncWorkflow, DurableAgentRunWorkflow, EventTriggeredWorkflow, HelloWorkflow, IngestDocumentWorkflow

    try:
        from temporalio.client import Client
        from temporalio.worker import Worker
    except Exception as e:
        print(f"temporalio not installed: {e}", file=sys.stderr)
        sys.exit(2)

    from ..config import settings

    host = getattr(settings, "temporal_host", "localhost:7233")
    namespace = getattr(settings, "temporal_namespace", "default")

    client = await Client.connect(host, namespace=namespace)
    print(f"connected temporal host={host} ns={namespace}")

    # ── Distributed tracing interceptor (F-TRC-01) ────────────────────
    interceptors = []
    try:
        from .interceptors import TracingInterceptor

        ti = TracingInterceptor()
        if hasattr(ti, "activity_inbound"):
            interceptors.append(ti)
            print("tracing interceptor attached")
    except Exception as e:
        logger.debug("tracing interceptor not available: %s", e)

    # One Worker per task queue sharing the same client connection.
    workers: list[Worker] = []
    queue_defs = {
        "ingest": ([IngestDocumentWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("parse_document", "extract_entities", "write_memory", "index_graph", "check_kill_switch", "record_workflow_metric")]),
        "approvals": ([ApprovalWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("execute_approved_action", "record_workflow_metric")]),
        "agent": ([DurableAgentRunWorkflow, HelloWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("durable_agent_run", "check_kill_switch", "check_quota", "record_workflow_metric")]),
        "connectors": ([ConnectorSyncWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("sync_connector", "check_kill_switch", "record_workflow_metric")]),
        "events": ([EventTriggeredWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("handle_event", "record_workflow_metric")]),
        "schedules": ([DurableAgentRunWorkflow], [a for a in ALL_ACTIVITIES if a.__name__ in ("durable_agent_run", "check_kill_switch", "check_quota", "record_workflow_metric")]),
    }

    for qkey, (wfs, acts) in queue_defs.items():
        qname = TASK_QUEUES[qkey].name
        max_conc = TASK_QUEUES[qkey].max_concurrent_activities
        # Fill gaps with at least one activity if empty (keep worker valid)
        if not acts and not wfs:
            continue
        w = Worker(client, task_queue=qname, workflows=wfs, activities=acts, max_concurrent_activities=max_conc, graceful_shutdown_timeout=timedelta(seconds=30), interceptors=interceptors or [])  # type: ignore[arg-type]
        workers.append(w)
        print(f"worker queue={qname} max_conc={max_conc} workflows={[c.__name__ for c in wfs]} activities={[a.__name__ for a in acts]}")

    if not workers:
        print("no workers configured", file=sys.stderr)
        return

    # Run all workers concurrently until cancelled.
    await asyncio.gather(*(w.run() for w in workers))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="validate registration without connecting")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    asyncio.run(_run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
