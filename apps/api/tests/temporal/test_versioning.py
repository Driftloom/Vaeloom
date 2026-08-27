"""Replayer versioning test — proves patched() compat (§17).

Records a history via WorkflowEnvironment, then replays with Replayer.
If workflow code breaks determinism/patching, replay fails.
"""

import uuid

import pytest
from temporalio.worker import Replayer, Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import HelloWorkflow, IngestDocumentWorkflow, IngestInput

pytestmark = pytest.mark.asyncio


async def test_replayer_ingest_history():
    # Step 1: capture history by running workflow
    from temporalio.client import WorkflowHistory

    async with await WorkflowEnvironment.start_time_skipping() as env:
        # Collect only our ingest activities for replay
        from api.temporal.activities import check_kill_switch, extract_entities, index_graph, parse_document, record_workflow_metric, write_memory

        async with Worker(env.client, task_queue=queue_name("ingest"), workflows=[IngestDocumentWorkflow], activities=[parse_document, extract_entities, write_memory, index_graph, check_kill_switch, record_workflow_metric]):
                inp = IngestInput(workspace_id="ws-replay", document_id="doc-replay", content_hash="hash-replay")
                handle = await env.client.start_workflow(IngestDocumentWorkflow.run, inp, id=f"ingest:ws-replay:hash-replay:doc-replay-{uuid.uuid4().hex[:4]}", task_queue=queue_name("ingest"))
                await handle.result()
                # Fetch history for replayer
                hist = await handle.fetch_history()
                history = hist  # type: ignore[assignment]

        # Step 2: replay with Replayer (no server, pure determinism check)
        replayer = Replayer(workflows=[IngestDocumentWorkflow])
        # Replayer expects WorkflowHistory or JSON; pass fetched history
        await replayer.replay_workflow(history)


async def test_replayer_hello():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("agent"), workflows=[HelloWorkflow], activities=[]):
            handle = await env.client.start_workflow(HelloWorkflow.run, "world", id=f"hello-replay-{uuid.uuid4().hex[:4]}", task_queue=queue_name("agent"))
            await handle.result()
            hist = await handle.fetch_history()
        replayer = Replayer(workflows=[HelloWorkflow])
        await replayer.replay_workflow(hist)
