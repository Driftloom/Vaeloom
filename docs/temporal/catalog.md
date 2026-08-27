# Temporal Workflow & Activity Catalog (ADR-038)

## Task Queues

| Queue                  | Env var                          | Purpose                             | Concurrency |
| ---------------------- | -------------------------------- | ----------------------------------- | ----------- |
| `vaeloom-ingest-q`     | `TEMPORAL_TASK_QUEUE_INGEST`     | ingest parse→extract→write→index    | 10          |
| `vaeloom-documents-q`  | `TEMPORAL_TASK_QUEUE_DOCUMENTS`  | Playwright compiles                 | 2           |
| `vaeloom-agent-q`      | `TEMPORAL_TASK_QUEUE_AGENT`      | durable agent runs (LangGraph seam) | 8           |
| `vaeloom-connectors-q` | `TEMPORAL_TASK_QUEUE_CONNECTORS` | connector sync/fetch                | 6           |
| `vaeloom-schedules-q`  | `TEMPORAL_TASK_QUEUE_SCHEDULES`  | schedule dispatcher                 | 4           |
| `vaeloom-approvals-q`  | `TEMPORAL_TASK_QUEUE_APPROVALS`  | human approval signal wait          | 20          |
| `vaeloom-memory-q`     | `TEMPORAL_TASK_QUEUE_MEMORY`     | nightly consolidation               | 2           |

## Workflows

| Workflow                  | ID                                                       | Queue        | Signals / Queries                                                                  |
| ------------------------- | -------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `IngestDocumentWorkflow`  | `ingest:{workspace}:{content_hash}:{document_id}`        | ingest-q     | `getStatus{status,step,error}` query; cancel via `cancel` + kill-switch `memory`   |
| `DurableAgentRunWorkflow` | `durable_run:{workspace}:{user}:{request_id}`            | agent-q      | `getStatus` query; typed `DurableAgentRequest`, cancel + `connector` kill-switch   |
| `ConnectorSyncWorkflow`   | `connector_sync:{workspace}:{connector_id}:{sync_token}` | connectors-q | `getStatus{status,progress}` query; `updateProgress` signal; heartbeat 30s, cancel |
| `EventTriggeredWorkflow`  | `event:{workspace}:{event_type}:{event_id}`              | events-q     | `getStatus{status,handled}` query; dedup `REJECT_DUPLICATE`                        |
| `ApprovalWorkflow`        | `approval:{workspace}:{approval_id}`                     | approvals-q  | `decision` signal, `getProposal` query, `timeout=3600s`, cancel                    |
| `HelloWorkflow`           | ad-hoc                                                   | agent-q      | smoke infra test                                                                   |

## Activities

| Activity                  | Timeout       | Retry                 | Idempotency                                                                          |
| ------------------------- | ------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `parse_document`          | 60s / hb 15s  | transient 3× exp 1→8s | `SELECT id,content,path WHERE id AND workspace_id` + sha256; no raw bytes in history |
| `extract_entities`        | 45s           | 3×                    | ref-based                                                                            |
| `write_memory`            | 10s           | 3×                    | `workspace+canonical_name` uniqueness guard                                          |
| `index_graph`             | 10s           | 2×                    | doc_id ref                                                                           |
| `durable_agent_run`       | 120s / hb 30s | 2×                    | `DurableAgentRequest` typed, no secrets, kill-switch `check_kill_switch`             |
| `execute_approved_action` | 30s           | 2×                    | approval_id, permission re-checked §14                                               |
| `sync_connector`          | 300s / hb 30s | 3× exp 2→30s          | `sync_token` dedup, heartbeat `progress`                                             |
| `handle_event`            | 60s           | 3×                    | `event_id` dedup `REJECT_DUPLICATE`, causation/correlation                           |
| `check_kill_switch`       | 5s            | 1×                    | read-only `AgentKillSwitch.is_enabled`                                               |
| `record_workflow_metric`  | 5s            | 1×                    | metric `temporal_workflow_completed{workflow_type,task_queue,status}`                |

## Retry classes (no global policy)

Transient (network/5xx/429) — exp 1→8s ≤3; Permanent (4xx/validation) — 1
attempt; Human-action (OAuth/approval) — PAUSED not retried; Model failure —
retry then downgrade via `ModelDowngradeFallback`.

## Payload rule

Workflow inputs = IDs/refs only (`document_id`, `workspace_id`, `content_hash`,
`approval_id`). Secrets resolved inside activities via `SecretManager` — never
in history. Large bodies stay in Postgres/MinIO; codec compression only for
small payloads.

## Versioning

`workflow.patched("ingest-v1")` / `approval-v1` / `durable-agent-v1` (SDK 1.9
replaces `get_version`). Test with `WorkflowReplayer` on fixtures in
`tests/temporal/fixtures/histories/*.json`.
