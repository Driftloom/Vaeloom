"""Phase 12: Idempotency hardening — duplicate workflow ID collapses, no duplicate side effects."""

import uuid
import hashlib

import pytest
from temporalio.common import WorkflowIDReusePolicy
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import IngestDocumentWorkflow, IngestInput, ConnectorSyncWorkflow, EventTriggeredWorkflow, EventTriggerInput
from api.temporal.activities import SyncConnectorInput

pytestmark = pytest.mark.asyncio


async def test_ingest_duplicate_is_idempotent():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, parse_document, extract_entities, index_graph, record_workflow_metric, write_memory

        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch, record_workflow_metric]):
            ws, doc = str(uuid.uuid4()), str(uuid.uuid4())
            h = hashlib.sha256(b"same bytes").hexdigest()[:16]
            inp = IngestInput(workspace_id=ws, document_id=doc, content_hash=h)
            wid = f"ingest:{ws}:{h}:{doc}"
            h1 = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=wid, task_queue=queue_name("ingest"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
            await h1.result()
            # Duplicate with same deterministic ID must raise AlreadyStarted (REJECT_DUPLICATE)
            try:
                await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=wid, task_queue=queue_name("ingest"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
                assert False, "duplicate should raise AlreadyStarted"
            except Exception as e:
                msg = f"{type(e).__name__} {e}".lower()
                assert "already" in msg and "started" in msg


async def test_connector_sync_token_idempotent():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            ws, conn = str(uuid.uuid4()), str(uuid.uuid4())
            token = conn[:8]
            inp = SyncConnectorInput(workspace_id=ws, connector_id=conn, sync_token=token)
            wid = f"connector_sync:{ws}:{conn}:{token}"
            h1 = await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=wid, task_queue=queue_name("connectors"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
            await h1.result()
            try:
                await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=wid, task_queue=queue_name("connectors"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
                assert False
            except Exception as e:
                msg = f"{type(e).__name__} {e}".lower()
                assert "already" in msg and "started" in msg


async def test_event_idempotent_across_retries():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import handle_event

        async with Worker(env.client, task_queue=queue_name("events"), workflows=[EventTriggeredWorkflow], activities=[handle_event]):
            ws, eid = str(uuid.uuid4()), str(uuid.uuid4())
            inp = EventTriggerInput(event_type="document.created", event_id=eid, workspace_id=ws, correlation_id=str(uuid.uuid4()), causation_id=eid, payload={"path": "a.txt"})
            wid = f"event:{ws}:document.created:{eid}"
            h1 = await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=wid, task_queue=queue_name("events"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
            res1 = await h1.result()
            assert res1["status"] == "completed"
            try:
                await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=wid, task_queue=queue_name("events"), id_reuse_policy=WorkflowIDReusePolicy.REJECT_DUPLICATE)
                assert False
            except Exception as e:
                msg = f"{type(e).__name__} {e}".lower()
                assert "already" in msg and "started" in msg
