"""ApprovalWorkflow signal path + timeout.

Verifies §12 durable wait + signal (not poll) and workspace-scoped signal auth
at API layer (unit below covers workflow contract; API 403 covered in integration).
"""

import uuid

import pytest
from temporalio.worker import Worker

from api.temporal.queues import queue_name
from api.temporal.workflows import ApprovalWorkflow, ApprovalWorkflowInput

pytestmark = pytest.mark.asyncio


async def test_approval_approve_signal():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("approvals"), workflows=[ApprovalWorkflow], activities=[__import__("api.temporal.activities", fromlist=["execute_approved_action"]).execute_approved_action]):
            approval_id = uuid.uuid4().hex[:8]
            handle = await env.client.start_workflow(ApprovalWorkflow.run, ApprovalWorkflowInput(approval_id=approval_id, timeout_seconds=60), id=f"approval:ws:{approval_id}-a", task_queue=queue_name("approvals"))
            # workflow is waiting_approval
            q0 = await handle.query("getProposal")
            assert q0["status"] == "waiting_approval"
            await handle.signal("decision", {"decision": "APPROVED", "actor": "user-1", "approval_id": approval_id})
            res = await handle.result()
            assert res["status"] == "APPROVED"


async def test_approval_reject_signal():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("approvals"), workflows=[ApprovalWorkflow], activities=[__import__("api.temporal.activities", fromlist=["execute_approved_action"]).execute_approved_action]):
            approval_id = uuid.uuid4().hex[:8]
            handle = await env.client.start_workflow(ApprovalWorkflow.run, ApprovalWorkflowInput(approval_id=approval_id, timeout_seconds=60), id=f"approval:ws:{approval_id}-b", task_queue=queue_name("approvals"))
            await handle.signal("decision", {"decision": "REJECTED", "actor": "user-1", "approval_id": approval_id})
            res = await handle.result()
            assert res["status"] == "REJECTED"


async def test_approval_timeout_expires():
    from temporalio.testing import WorkflowEnvironment

    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(env.client, task_queue=queue_name("approvals"), workflows=[ApprovalWorkflow], activities=[__import__("api.temporal.activities", fromlist=["execute_approved_action"]).execute_approved_action]):
            approval_id = uuid.uuid4().hex[:8]
            handle = await env.client.start_workflow(ApprovalWorkflow.run, ApprovalWorkflowInput(approval_id=approval_id, timeout_seconds=1), id=f"approval:ws:{approval_id}-c", task_queue=queue_name("approvals"))
            # advance virtual clock past 1s timeout
            await env.sleep(2)
            res = await handle.result()
            assert res["status"] == "expired"

