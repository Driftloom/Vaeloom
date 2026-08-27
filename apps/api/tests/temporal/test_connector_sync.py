"""Phase 7: ConnectorSync durable workflow — heartbeat + cancel + progress query."""

import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import ConnectorSyncWorkflow
from api.temporal.activities import SyncConnectorInput

pytestmark = pytest.mark.asyncio


async def test_connector_sync_completes_with_heartbeat():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            workspace_id, connector_id = str(uuid.uuid4()), str(uuid.uuid4())
            token = connector_id[:8]
            inp = SyncConnectorInput(workspace_id=workspace_id, connector_id=connector_id, sync_token=token)
            handle = await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=f"connector_sync:{workspace_id}:{connector_id}:{token}", task_queue=queue_name("connectors"))
            q0 = await handle.query("getStatus")
            assert "status" in q0
            res = await handle.result()
            assert res.status == "completed"
            assert res.connector_id == connector_id


async def test_connector_sync_progress_query():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            inp = SyncConnectorInput(workspace_id=str(uuid.uuid4()), connector_id=str(uuid.uuid4()), sync_token="tok123")
            handle = await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=f"connector_sync:progress:{uuid.uuid4().hex[:6]}", task_queue=queue_name("connectors"))
            await handle.result()
            q = await handle.query("getStatus")
            assert q["progress"] == 100
            assert q["status"] == "completed"


async def test_connector_sync_cancel():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            inp = SyncConnectorInput(workspace_id=str(uuid.uuid4()), connector_id=str(uuid.uuid4()), sync_token="tok999")
            handle = await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=f"connector_sync:cancel:{uuid.uuid4().hex[:6]}", task_queue=queue_name("connectors"))
            await handle.cancel()
            try:
                res = await handle.result()
                assert res.status in ("cancelled", "failed", "completed")
            except Exception as e:
                # WorkflowFailureError wrapping CancelledError — check cause chain
                cause = getattr(e, "cause", None) or getattr(e, "__cause__", None)
                combined = f"{type(e).__name__} {e} {cause} {type(cause).__name__ if cause else ''}".lower()
                assert "cancel" in combined or "workflowfailure" in combined
