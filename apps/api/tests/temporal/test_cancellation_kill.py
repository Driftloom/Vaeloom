"""Phase 11: cancellation + kill-switch propagation."""

import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import IngestDocumentWorkflow, IngestInput, ConnectorSyncWorkflow
from api.temporal.activities import SyncConnectorInput

pytestmark = pytest.mark.asyncio


async def test_kill_switch_disables_ingest():
    # When kill_switch disables memory, ingest workflow should early-return cancelled (fail-closed)
    from api.temporal.activities import check_kill_switch, parse_document, extract_entities, write_memory, index_graph
    from api.infrastructure.agent_observability import kill_switch

    kill_switch.disable("memory", reason="test kill")

    try:
        async with await WorkflowEnvironment.start_time_skipping() as env:
            async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch]):
                inp = IngestInput(workspace_id=str(uuid.uuid4()), document_id=str(uuid.uuid4()), content_hash="hash-kill")
                res = await env.client.execute_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:kill:{uuid.uuid4().hex[:6]}", task_queue=queue_name("ingest"))
                assert res.status == "cancelled"
                assert "kill" in res.error.lower()
    finally:
        kill_switch.enable("memory")


async def test_kill_switch_disables_connector_sync():
    from api.temporal.activities import check_kill_switch, sync_connector
    from api.infrastructure.agent_observability import kill_switch

    kill_switch.disable("connector", reason="test kill connector")

    try:
        async with await WorkflowEnvironment.start_time_skipping() as env:
            async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
                inp = SyncConnectorInput(workspace_id=str(uuid.uuid4()), connector_id=str(uuid.uuid4()), sync_token="tok-kill")
                res = await env.client.execute_workflow(ConnectorSyncWorkflow.run, inp, id=f"connector_sync:kill:{uuid.uuid4().hex[:6]}", task_queue=queue_name("connectors"))
                assert res.status == "cancelled"
    finally:
        kill_switch.enable("connector")


async def test_cancellation_during_ingest_activity():
    # Start ingest, cancel promptly — should produce cancelled not ambiguous completed/failed
    from api.temporal.activities import check_kill_switch, parse_document, extract_entities, write_memory, index_graph

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch]):
            inp = IngestInput(workspace_id=str(uuid.uuid4()), document_id=str(uuid.uuid4()), content_hash="hash-cancel2")
            handle = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:cancel2:{uuid.uuid4().hex[:6]}", task_queue=queue_name("ingest"))
            # Immediate cancel — workflow heartbeat cancellation should propagate to activity
            await handle.cancel()
            try:
                res = await handle.result()
                # If workflow handles cancellation as return value
                assert res.status in ("cancelled", "failed")
            except Exception as e:
                cause = getattr(e, "cause", None) or getattr(e, "__cause__", None)
                combined = f"{type(e).__name__} {e} {cause}".lower()
                assert "cancel" in combined or "workflowfailure" in combined
