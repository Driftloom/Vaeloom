# ADR-038: Temporal Durable Execution (Ingestion + Approval Signals + Schedules Migration)

| Metadata       | Value                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                                                                   |
| **Date**       | 2026-08-27                                                                                                                 |
| **Deciders**   | Principal distributed-systems engineer (Temporal hardening track)                                                          |
| **Related**    | ADR-033 (daemon/queue durability), ADR-031 (sanitization), ADR-030 (secrets), ADR-026 (PaaS-first), ADR-028 (BullMQ event) |
| **Supersedes** | Execution model of ADR-033; does **not** remove queue-worker until §43 gate passes                                         |

## Context

After the 2026-08-27 audit the system has **no Temporal** (`temporalio` absent
from `pyproject`, no `temporal` service in either compose, no `infra/temporal`,
K8s has only `queue-worker`+`redis`). Durability today is
`background_daemon SETNX vaeloom:daemon:claim:{slot} EX120 + BullMQ hashes bull:{queue}:{wait|delayed|failed}`
(`background_daemon.py:92,102`, `queue_worker.py:55`) plus `LoopState`
filesystem JSON checkpoints (`orchestrator/state.py:67`) and `agent_approvals`
rows (`services/approval.py`). This is sufficient for cron claims but not for
long-running human-in-the-loop workflows: approvals poll
`fetch_pending_approvals`, execution loss on worker crash is retried at job
granularity with no signal wait, and payload secrets would have been forced into
history if naively migrated.

Temporal is the right substrate for durable
lifecycle/retries/timers/signals/queries/visibility. The constraint is **not a
rewrite**: domain logic, auth/RBAC, memory, model routing, connector creds and
product APIs must remain in application services, and the future LangGraph
topology must not be baked into workflows (§23).

## Decision

### 1. Self-hosted Temporal (PaaS-first) + Python SDK

- Dependency: `temporalio==1.9.x` (pinned; `grpcio` wheels cover win32 CI). No
  server-in-process; composer adds `temporal` + `temporal-ui` + `temporal-db`
  (dedicated Postgres, separate from app `postgres:5432`) +
  `temporal-admin-tools`. Prod overlay adds `infra/kubernetes/apps/temporal/*`
  or Temporal Cloud toggle (`TEMPORAL_CLOUD_NAMESPACE/KEY`).
- Namespace `vaeloom` (dev/prod split via `TEMPORAL_NAMESPACE`). Task queues per
  workflow class rather than one fat queue (concurrency/backpressure isolated).

### 2. Temporal boundary (normative)

```
API routers (auth, CSRF, RLS, idempotency, audit in middleware — never in Temporal)
  → application services (memory_service, knowledge_graph_service, document_builder, llm_service/model_router, connector_ext_service)
    → Temporal workflows (state, timers, signals, queries, retry/timeout orchestration)
      → Activities (DB writes, embeddings, Playwright, external fetches, notifications, audit writes)
Future: DurableAgentRunWorkflow → DurableAgentRunActivity → LangGraph graph
```

Workflows must **not** contain domain branching, model prompts, or graph
traversal rules; they own workflow ID policy, retry/timeout policy,
cancellation, signals/queries, versioning.

### 3. Workflow/activity catalogue (shipped in this ADR, §5 gate)

| Workflow                       | Queue                 | ID strategy                                                                                             | Signals/Queries                                                 |
| ------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `IngestDocumentWorkflow`       | `vaeloom-ingest-q`    | `ingest:{workspace}:{content_hash}:{doc_id}` (§7 idempotent)                                            | `q: getStatus`, `cancel`                                        |
| `DurableAgentRunWorkflow`      | `vaeloom-agent-q`     | `durable_run:{workspace}:{user}:{request_id}`                                                           | `q: getStatus`, approve via signal proxy                        |
| `ApprovalWorkflow`             | `vaeloom-approvals-q` | `approval:{workspace}:{approval_id}`                                                                    | `s: decision(approved/rejected, actor, note)`, `q: getProposal` |
| Scheduled — migrated (Phase 8) | `vaeloom-schedules-q` | Temporal **Schedules** `sched:{workspace}:{schedule_id}` spec `cron+UTC jitter ±60s`, `BUFFER_ONE/SKIP` | lifecycle `create/update/pause/resume/delete`                   |

Activities (representative; each has explicit input/output, timeout, retry,
audit/logging/metrics/tracing per §8-§10, payloads are IDs/refs per §16):

`ParseDocumentActivity(60s/15s hb)`, `ExtractEntitiesActivity`,
`WriteMemoryActivity(10s, idempotent `workspace+canonical_name` check)`,
`IndexGraphActivity`,
`LLMCompletionActivity(90s, transient 3× then ModelDowngrade)`,
`ConnectorFetchActivity(30s/10s hb, 429-aware)`,
`CompileDocumentActivity(35s/10s hb, Chromium)`, `RecordAuditActivity`.

Retry classes (§9): transient (network/5xx/429 — exp 1s→8s+jitter ≤3 attempts),
permanent (4xx/validation — 0 retry), human-action-required (OAuth/approval →
`PAUSED` not retry), model-failure (retry then provider fallback). One global
retry policy is forbidden.

### 4. Idempotency & security invariants

- Deterministic workflow IDs as above; external side-effects double-guarded by
  DB idempotency keys (`content_hash`, `workspace+canonical_name` uniqueness,
  `connector token_ref` per ADR-030). History never carries secrets/OAuth/PII
  raw — only `{connector_id, secret_name, document_id}` refs resolved inside
  activities via `SecretManager` (§15). Payloads are compressed references;
  large bodies remain in Postgres/MinIO.
- Authorization re-checked in every consequential activity (§14) via
  `TenantContext` (RLS GUCs), not trusted from workflow start memo.
  Cross-workspace `signal/query/cancel` rejects 403 (enforced at API
  `client.signalWorkflow` gateway).

### 5. Schedules migration path (§18/§19, no big-bang)

`background_daemon`+`queue_worker` **stay** during shadow. For each
`agent_schedules`/`scheduled_jobs` row created or migrated:

1. create Temporal Schedule `spec.cron+UTC` with deterministic `scheduleId`
2. run shadow dual-write (Temporal + existing claim/enqueue) one window
3. assert parity (`schedule execution succeeded/failed/expired` metrics)
4. flip `temporal_schedules_enabled` per-workspace
5. background_daemon stops claiming that schedule id (guard
   `temporal_schedules_enabled` skip)
6. delete old path only after §43 evidence (no consumers, no consumers redis
   key).

Degraded Redis-less inline mode degrades to Temporal local
`TestWorkflowEnvironment` for tests, not to external polling.

### 6. Approval signal protocol (§12)

Proposal row stays the **domain source of truth** (audit, expiry). The workflow
owns the **wait**:
`await workflow.waitCondition(lambda: decision is not None, timeout=expires_at)`
— not `sleep/poll`. API `POST /approvals/{id}/decision` validates
`workspace ∈ user_workspaces` then `client.signalWorkflow("decision", ...)`.
Rejection/cancellation propagates `CancelledError` tocompensate
`workflow_runs status=CANCELLED + audit` with no ambiguous state.

### 7. Observability & versioning (§17/§24-§27)

Prom `temporal_workflow_*` + `temporal_activity_*` + `schedule_execution_*` +
`approval_wait_duration` labelled
`workflowType/activityType/agent/connector/provider`. Structured logs include
`workflowId/runId/activityId/workspaceId/correlationId/attempt`. OTel trace
`http_request → temporal.client.start → workflow → activity → llm/pg/redis`.
Versioning via `workflow.getVersion("ingest-v1", 1, 2)` tested with
`WorkflowReplayer`.

## Alternatives Considered

- **Stay on daemon+queue-worker only**: insufficient for human
  wait/cancellation/versioning; rejected for approval and long-run use-cases.
- **Immediate Temporal Cloud only**: operational cost before durability proven;
  rejected in favor of self-host default with Cloud toggle.
- **One task queue**: rejected — burst in ingest starves connector sync (§29).

## Consequences

- New infra to operate (`temporal`, `temporal-db`, `temporal-ui`); app readiness
  now depends on `TEMPORAL_HOST` by default in non-local (fail-closed), local
  can degrade flag `temporal_enabled=false`.
- Workflow histories are durable recovery; `~/.vaeloom/state/*.json` checkpoints
  remain for short interactive runs, not replaced for every chat turn.
- Future LangGraph inserts cleanly behind `DurableAgentRunActivity` — no
  workflow rewrite required.

## Verification

- Doc: this ADR + `docs/temporal/*` catalogue/runbook reviewed in gate §20.
- Tests: `tests/temporal/test_hello_workflow.py` smoke +
  `tests/temporal/test_ingest_workflow.py` `TestWorkflowEnvironment`
  determinism + approval signal test + replayer version test in CI job
  `temporal-check`.
- Infra: `docker compose --profile temporal up` health `temporal:7233`
  reachable; worker liveness
  `python -m api.temporal.worker --task-queue vaeloom-ingest-q --dry-run`.
