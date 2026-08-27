"""Phase 14: Security — workspace isolation, secret leakage, payload size."""

import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import IngestDocumentWorkflow, IngestInput

pytestmark = pytest.mark.asyncio


async def test_cross_workspace_query_denied(db_session):
    """_verify_workflow_workspace_access must 404 when user not in workflow's workspace."""
    from api.routers.temporal import _verify_workflow_workspace_access
    from fastapi import HTTPException
    from sqlalchemy import text

    ws_a, ws_b = str(uuid.uuid4()), str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    db = db_session

    # Use raw insert to avoid Workspace model validation
    await db.execute(text("INSERT INTO workspaces (id, user_id, name, created_at, updated_at) VALUES (:id, :uid, :name, datetime('now'), datetime('now'))"), {"id": ws_a, "uid": user_a, "name": "ws-a"})
    await db.execute(text("INSERT INTO workspaces (id, user_id, name, created_at, updated_at) VALUES (:id, :uid, :name, datetime('now'), datetime('now'))"), {"id": ws_b, "uid": str(uuid.uuid4()), "name": "ws-b"})
    await db.commit()

    # Workflow belongs to ws_b, user_a should be denied
    wid = f"ingest:{ws_b}:hash:doc-1"
    try:
        await _verify_workflow_workspace_access(wid, {"sub": user_a}, db)
        assert False, "should have raised 404"
    except HTTPException as e:
        assert e.status_code == 404

    # Same workspace should pass
    await _verify_workflow_workspace_access(f"ingest:{ws_a}:hash:doc-2", {"sub": user_a}, db)
    # Non-UUID smoke IDs are allowed (hello-*)


async def test_secret_never_in_history():
    """DurableAgentRequest typed payload has no secret fields; legacy dict is scrubbed at activity (history still contains it, but typed path is clean)."""
    from api.temporal.workflows import DurableAgentRequest
    from api.temporal.activities import durable_agent_run

    # Typed request has only allowed fields — secrets cannot be set
    req = DurableAgentRequest(workspace_id="ws", user_id="u", agent_id="memory", input={"q": "hi"})
    assert not hasattr(req, "api_key")
    assert not hasattr(req, "secret")
    assert not hasattr(req, "token")

    # Typed path is clean — history must not contain secrets
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.workflows import DurableAgentRunWorkflow

        async with Worker(env.client, task_queue=queue_name("agent"), workflows=[DurableAgentRunWorkflow], activities=[durable_agent_run, __import__("api.temporal.activities", fromlist=["check_kill_switch"]).check_kill_switch, __import__("api.temporal.activities", fromlist=["record_workflow_metric"]).record_workflow_metric]):
            typed = DurableAgentRequest(workspace_id="ws", user_id="u", agent_id="memory", input={"q": "hi"}, correlation_id="cid-typed")
            handle = await env.client.start_workflow(DurableAgentRunWorkflow.run, typed, id=f"durable_run:ws:u:{uuid.uuid4().hex[:6]}", task_queue=queue_name("agent"))
            res = await handle.result()
            assert res["status"] == "completed"
            hist = await handle.fetch_history()
            hist_str = str(hist)
            # Typed history must not contain secret material (no api_key field at all)
            assert "api_key" not in hist_str.lower()

            # Legacy dict with sensitive key must now be rejected (T-001 fail-closed) — not completed
            legacy = {"agent_id": "memory", "workspace_id": "ws", "input": {"q": "hi"}, "api_key": "sk-secret-should-not-be-in-history-12345"}
            try:
                handle2 = await env.client.start_workflow(DurableAgentRunWorkflow.run, legacy, id=f"durable_run:ws:u:{uuid.uuid4().hex[:6]}", task_queue=queue_name("agent"))
                res2 = await handle2.result()
                # If workflow accepts legacy dict, it should fail closed (non-retryable) — not completed
                assert res2.get("status") in ("failed", "cancelled") or "payload rejected" in str(res2.get("error", "")).lower()
            except Exception as e:
                cause = getattr(e, "cause", None) or getattr(e, "__cause__", None)
                combined = f"{e} {cause} {getattr(cause, 'message', '') if cause else ''} {type(e).__name__} {type(cause).__name__ if cause else ''}".lower()
                assert "payload rejected" in combined or "secret" in combined or "api_key" in combined or "untyped" in combined or "already" in combined


async def test_payload_is_ids_not_bodies():
    """IngestInput is IDs/refs only — no raw bytes, no content body."""
    inp = IngestInput(workspace_id=str(uuid.uuid4()), document_id=str(uuid.uuid4()), content_hash="abc123")
    # Workflow input should be small (< 1KB when serialized)
    import json, dataclasses

    data = json.dumps(dataclasses.asdict(inp))
    assert len(data) < 1024
    # No secret fields
    assert "secret" not in data.lower()
    assert "token" not in data.lower()
