# Temporal Operational Runbook (ADR-038)

## What is durable?

- **DWW (Temporal history)** stores workflow step/timer/signal/pending-approval
 lifecycle. Recovery survives worker/API/Temporal restarts.
- **Domain state** (application status, memory records, document state, approval
 row, audit) lives in app Postgres (`api/models/schema`) — source of truth per
 §45.

## Q: What is running / failed / stuck?

Via UI or CLI:

```bash
tctl --address vaeloom-temporal:7233 namespace list
tctl workflow list --query 'ExecutionStatus="Running"'
tctl workflow list --query 'WorkflowType="ApprovalWorkflow" AND ExecutionStatus="Running"'
# reason
tctl workflow show --workflow-id ingest:ws:hash:doc --run-id <run>
# schedules stuck
tctl schedule list
```

Prometheus (`/metrics`):

- `temporal_workflow_started_total{workflow_type,task_queue}`
- `temporal_workflow_failed_total{workflow_type,reason}`
- `temporal_activity_failed_total{activity_type,reason}`
- `temporal_schedule_execution_total{schedule_id,status}`

Grafana: panel `Temporal Workflow Duration p95` joins
`temporal_workflow_duration_seconds`.

## Safe operations

| Action | Command | Who may |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| cancel ingestion | `POST /api/v1/temporal/workflows/{id}/cancel` (workspace-scoped, 401/404 else) | owner/approver |
| approve/reject | `POST /api/v1/approvals/{id}/approve` (also signals workflow) | workspace member |
| retry failed ingestion | re-POST `POST /api/v1/temporal/workflows/ingest` — deterministic ID returns `already_started` if still durable | owner |
| restart worker | `kubectl rollout restart deploy/vaeloom-temporal-worker` — workflows resume via history | SRE |

Never `tctl workflow terminate` from runbook without audit note — prefer API
cancel path.

## Failure recovery drills (§28, exercised in tests)

| Drill | Verified in |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| kill worker mid-activity → retry → completed | `tests/temporal/test_ingest_workflow.py::test_worker_restart_resumes` (WorkerEnv time-skip) |
| Temporal restart mid-workflow | UI restart + re-hydrate via history |
| OAuth revoked during connector sync → PAUSED | activity returns `human_action_required` not retry loop |
| duplicate ingest `POST` | deterministic ID → `AlreadyStarted` → idempotent 200 |

If a workflow stays `Running` with heartbeat timeout: check worker logs
(`Failed to heartbeat`), then
`temporal workflow list --query 'ActivityStatus=Running'` to find stalled
activity.

## Rollback (§18 decommission gate not passed — dual-write phase)

- Flip `TEMPORAL_ENABLED=false` → API reverts to `background_daemon` +
 `queue-worker` for schedules.
- No data loss: Postgres remains canonical; histories are read-only archival.
- Remove Temporal only after §43 checklist (all migrated jobs verified, no
 `bull:{queue}:*` consumer, Grafana stable 7d).
