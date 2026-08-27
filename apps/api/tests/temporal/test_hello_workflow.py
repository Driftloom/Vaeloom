"""Temporal smoke: HelloWorkflow + IngestDocumentWorkflow success path.

Uses WorkerEnv in-process (no external server) so suite passes in CI
without TEMPORAL_ENABLED. Deterministic time-skip covers timers.
"""

import asyncio
import uuid

import pytest
from temporalio.worker import Worker

from api.temporal.activities import ALL_ACTIVITIES
from api.temporal.queues import queue_name
from api.temporal.workflows import HelloWorkflow, IngestDocumentWorkflow, IngestInput


pytestmark = pytest.mark.asyncio


async def test_hello_workflow():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("agent"), workflows=[HelloWorkflow], activities=[]):
            res = await env.client.execute_workflow(HelloWorkflow.run, "world", id=f"hello-{uuid.uuid4().hex[:8]}", task_queue=queue_name("agent"))
            assert res == "hello world"


async def test_ingest_workflow_success():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=ALL_ACTIVITIES):
            inp = IngestInput(workspace_id="ws-smoke", document_id="doc-1", content_hash="hash-abc", correlation_id="cid-1")
            res = await env.client.execute_workflow(
                IngestDocumentWorkflow.run, inp, id=f"ingest:ws-smoke:hash-abc:doc-1-{uuid.uuid4().hex[:4]}", task_queue=queue_name("ingest")
            )
            assert res.status == "completed"
            assert res.document_id == "doc-1"


async def test_ingest_query_getStatus():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=ALL_ACTIVITIES):
            inp = IngestInput(workspace_id="ws-q", document_id="doc-q", content_hash="h-q")
            handle = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:ws-q:h-q:doc-q-{uuid.uuid4().hex[:4]}", task_queue=queue_name("ingest"))
            # query while running / after completion
            status = await handle.query("getStatus")
            assert "status" in status
            await handle.result()
            status2 = await handle.query("getStatus")
            assert status2["status"] == "completed"

