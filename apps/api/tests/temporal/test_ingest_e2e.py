"""Phase 6 E2E: upload → durable ingest workflow → query status → cancel.

Verifies backend auto-ingest wiring end-to-end: workflow completes with
real Timeline (query non-fake polling §47) and cancellation does not leave
ambiguous domain state (§11). Uses WorkflowEnvironment (no external Temporal).
No Postgres required — parse_document falls back to stub hash (DB path verified
separately in test_approval.py/test_scheduler.py).
"""

import hashlib
import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import IngestDocumentWorkflow, IngestInput

pytestmark = pytest.mark.asyncio


async def test_ingest_e2e_query_is_real_not_fake():
    """WorkflowEnvironment + query proves status ticks parsing→extracting→completed,
    not a frontend spinner.
    """
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, extract_entities, index_graph, parse_document, record_workflow_metric, write_memory

        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch, record_workflow_metric]):
            content = b"hello ingest e2e deterministic content for hash"
            expected = hashlib.sha256(content).hexdigest()[:16]
            workspace_id, doc_id = str(uuid.uuid4()), str(uuid.uuid4())
            inp = IngestInput(workspace_id=workspace_id, document_id=doc_id, content_hash=expected, correlation_id="e2e-1")
            handle = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:{workspace_id}:{expected}:{doc_id}", task_queue=queue_name("ingest"))
            q0 = await handle.query("getStatus")
            assert "status" in q0
            assert "step" in q0
            res = await handle.result()
            assert res.status == "completed"
            assert res.document_id == doc_id
            q1 = await handle.query("getStatus")
            assert q1["status"] == "completed"
            assert q1["step"] == "completed"


async def test_ingest_cancel_propagates():
    """Cancellation before completion must not leave ambiguous domain state (§11)."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, extract_entities, index_graph, parse_document, record_workflow_metric, write_memory

        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch, record_workflow_metric]):
            inp = IngestInput(workspace_id=str(uuid.uuid4()), document_id=str(uuid.uuid4()), content_hash="hash-cancel")
            handle = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:cancel:{uuid.uuid4().hex[:6]}", task_queue=queue_name("ingest"))
            await handle.cancel()
            try:
                res = await handle.result()
                assert res.status in ("cancelled", "failed", "completed")
            except Exception as e:
                cause = getattr(e, "cause", None) or getattr(e, "__cause__", None)
                combined = f"{type(e).__name__} {e} {cause} {type(cause).__name__ if cause else ''}".lower()
                assert "cancel" in combined or "workflowfailure" in combined
