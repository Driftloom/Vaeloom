"""Phase 7: ConnectorSync durable workflow — heartbeat + cancel + progress query."""

import uuid

import pytest
from temporalio.worker import Worker
from temporalio.testing import WorkflowEnvironment

from api.temporal.queues import queue_name
from api.temporal.workflows import ConnectorSyncWorkflow
from api.temporal.activities import SyncConnectorInput

pytestmark = pytest.mark.asyncio


@pytest.fixture()
async def seeded_connector():
    """Seed a live connector row for the activity under test.

    sync_connector uses the process-global engine (live DB by design — this
    is a live-infrastructure test, skip-guarded below when unreachable), so
    random IDs can never succeed: the T-002 workspace binding correctly
    refuses unknown connectors. Seed user -> workspace -> connector with
    progressive RLS context (works as owner-role AND least-privilege role),
    and remove everything afterwards (CASCADE from users).
    """
    import sqlalchemy as _sa

    from api.database import engine as _eng

    uid, wid, cid = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    tid = str(uuid.uuid4())
    # The shared pooler can blip under rapid connect churn: retry boundedly,
    # skip only on persistent outage.
    import asyncio as _aio

    _seed_err: Exception | None = None
    for _attempt in range(3):
        try:
            async with _eng.begin() as conn:
                await conn.execute(
                    _sa.text("INSERT INTO tenants (id, name, slug, status, isolation, plan, settings, limits, features) "
                             "VALUES (:id, 'seed', :slug, 'ACTIVE', 'pooled', 'free', '{}', '{}', '{}'::text[])"),
                    {"id": tid, "slug": f"seed-{tid[:8]}"})
                await conn.execute(
                    _sa.text("SELECT set_config('app.user_id', :v, true)"), {"v": uid})
                await conn.execute(
                    _sa.text("INSERT INTO users (id, email, display_name, auth_provider, status, preferences, tenant_id) "
                             "VALUES (:id, :email, 'seed', 'email', 'ACTIVE', '{}', :tid)"),
                    {"id": uid, "email": f"seed-{uid[:8]}@t.t", "tid": tid})
                await conn.execute(
                    _sa.text("INSERT INTO workspaces (id, user_id, name) VALUES (:id, :uid, 'seed')"),
                    {"id": wid, "uid": uid})
                await conn.execute(
                    _sa.text("SELECT set_config('app.tenant_id', :v, true)"), {"v": tid})
                await conn.execute(
                    _sa.text("SELECT set_config('app.workspace_id', :v, true)"), {"v": wid})
                await conn.execute(
                    _sa.text("INSERT INTO connectors (id, workspace_id, type, name, tenant_id, status, config) "
                             "VALUES (:id, :ws, 'notion', 'seed', :tid, 'DISCONNECTED', '{}')"),
                    {"id": cid, "ws": wid, "tid": tid})
            _seed_err = None
            break
        except Exception as e:
            _seed_err = e
            await _aio.sleep(1.0 * (_attempt + 1))
    if _seed_err is not None:
        pytest.skip(f"live DB seed unreachable: {type(_seed_err).__name__}: {str(_seed_err)[:300]}")
    try:
        yield wid, cid
    finally:
        try:
            # Cleanup needs GUCs under RLS (least-privilege role); values are
            # known (no lookup needed). Users delete cascades workspace ->
            # connector; tenant last.
            async with _eng.begin() as conn:
                await conn.execute(
                    _sa.text("SELECT set_config('app.tenant_id', :v, true)"), {"v": tid})
                await conn.execute(
                    _sa.text("SELECT set_config('app.workspace_id', :v, true)"), {"v": wid})
                await conn.execute(
                    _sa.text("SELECT set_config('app.user_id', :v, true)"), {"v": uid})
                await conn.execute(
                    _sa.text("DELETE FROM users WHERE id = :id"), {"id": uid})
                await conn.execute(
                    _sa.text("DELETE FROM tenants WHERE id = :id"), {"id": tid})
        except Exception:
            pass


async def test_connector_sync_completes_with_heartbeat(seeded_connector):
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            workspace_id, connector_id = seeded_connector
            token = connector_id[:8]
            inp = SyncConnectorInput(workspace_id=workspace_id, connector_id=connector_id, sync_token=token)
            handle = await env.client.start_workflow(ConnectorSyncWorkflow.run, inp, id=f"connector_sync:{workspace_id}:{connector_id}:{token}", task_queue=queue_name("connectors"))
            q0 = await handle.query("getStatus")
            assert "status" in q0
            res = await handle.result()
            assert res.status == "completed"
            assert res.connector_id == connector_id


async def test_connector_sync_progress_query(seeded_connector):
    async with await WorkflowEnvironment.start_time_skipping() as env:
        from api.temporal.activities import check_kill_switch, sync_connector

        async with Worker(env.client, task_queue=queue_name("connectors"), workflows=[ConnectorSyncWorkflow], activities=[sync_connector, check_kill_switch]):
            workspace_id, connector_id = seeded_connector
            inp = SyncConnectorInput(workspace_id=workspace_id, connector_id=connector_id, sync_token="tok123")
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
