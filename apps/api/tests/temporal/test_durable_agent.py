"""DurableAgentRunWorkflow smoke — thin durable shell stays future-proof for LangGraph (§23)."""

import uuid

import pytest
from temporalio.worker import Worker

from api.temporal.queues import queue_name
from api.temporal.workflows import DurableAgentRequest, DurableAgentRunWorkflow

pytestmark = pytest.mark.asyncio


async def test_durable_agent_run_completes():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, durable_agent_run

        async with Worker(env.client, task_queue=queue_name("agent"), workflows=[DurableAgentRunWorkflow], activities=[durable_agent_run, check_kill_switch]):
            payload = DurableAgentRequest(workspace_id="ws-1", user_id="user-1", agent_id="memory", input={"q": "hello"}, correlation_id="cid-1")
            res = await env.client.execute_workflow(DurableAgentRunWorkflow.run, payload, id=f"durable_run:ws-1:user:{uuid.uuid4().hex[:6]}", task_queue=queue_name("agent"))
            assert res["status"] == "completed"
            assert "agent" in res


async def test_durable_agent_run_rejects_sensitive_keys():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, durable_agent_run

        async with Worker(env.client, task_queue=queue_name("agent"), workflows=[DurableAgentRunWorkflow], activities=[durable_agent_run, check_kill_switch]):
            # Legacy dict with sensitive key must now be rejected fail-closed (T-001)
            payload = {"agent_id": "memory", "workspace_id": "ws-1", "input": {"q": "hello"}, "api_key": "sk-secret-should-be-scrubbed"}
            try:
                await env.client.execute_workflow(DurableAgentRunWorkflow.run, payload, id=f"durable_run:ws-1:user:{uuid.uuid4().hex[:6]}", task_queue=queue_name("agent"))
                assert False, "should have raised WorkflowFailureError for secret payload"
            except Exception as e:
                cause = getattr(e, "cause", None) or getattr(e, "__cause__", None)
                combined = f"{e} {cause} {type(e).__name__} {type(cause).__name__ if cause else ''}".lower()
                assert "payload rejected" in combined or "secret" in combined or "api_key" in combined

