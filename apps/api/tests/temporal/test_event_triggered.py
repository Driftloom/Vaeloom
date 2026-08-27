"""Phase 9: EventTriggeredWorkflow — causation/correlation + dedup + no infinite loop."""

import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import EventTriggeredWorkflow, EventTriggerInput

pytestmark = pytest.mark.asyncio


async def test_event_triggered_completes():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import handle_event

        async with Worker(env.client, task_queue=queue_name("events"), workflows=[EventTriggeredWorkflow], activities=[handle_event]):
            event_id, ws = str(uuid.uuid4()), str(uuid.uuid4())
            inp = EventTriggerInput(event_type="document.created", event_id=event_id, workspace_id=ws, correlation_id=str(uuid.uuid4()), causation_id=event_id, payload={"path": "hello.txt"}, schema_version=1)
            handle = await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=f"event:{ws}:document.created:{event_id}", task_queue=queue_name("events"))
            res = await handle.result()
            assert res["status"] == "completed"
            assert res["event_id"] == event_id


async def test_event_duplicate_id_is_idempotent():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import handle_event

        async with Worker(env.client, task_queue=queue_name("events"), workflows=[EventTriggeredWorkflow], activities=[handle_event]):
            event_id, ws = str(uuid.uuid4()), str(uuid.uuid4())
            inp = EventTriggerInput(event_type="connector.updated", event_id=event_id, workspace_id=ws, correlation_id=str(uuid.uuid4()), payload={}, schema_version=1)
            wid = f"event:{ws}:connector.updated:{event_id}"
            h1 = await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=wid, task_queue=queue_name("events"))
            await h1.result()
            # Duplicate start with same workflow ID should raise AlreadyStarted (dedup)
            try:
                await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=wid, task_queue=queue_name("events"))
                assert False, "duplicate should have raised AlreadyStarted"
            except Exception as e:
                msg = str(e)
                assert "AlreadyStarted" in msg or "WorkflowExecutionAlreadyStarted" in msg


async def test_event_carries_causation_correlation():
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import handle_event

        async with Worker(env.client, task_queue=queue_name("events"), workflows=[EventTriggeredWorkflow], activities=[handle_event]):
            corr = str(uuid.uuid4())
            inp = EventTriggerInput(event_type="deadline.created", event_id=str(uuid.uuid4()), workspace_id=str(uuid.uuid4()), correlation_id=corr, causation_id="cause-1", payload={"deadline": "2026-09-01"})
            handle = await env.client.start_workflow(EventTriggeredWorkflow.run, inp, id=f"event:{inp.workspace_id}:deadline.created:{inp.event_id}", task_queue=queue_name("events"))
            res = await handle.result()
            assert res["status"] == "completed"
            q = await handle.query("getStatus")
            assert q["status"] == "completed"
