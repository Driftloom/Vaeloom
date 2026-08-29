# CONT-P05 — 02 Service Contracts

**Deliverable:** `DEL-CONT-P05-02` | **Version:** 1.0 | **Date:** 2026-08-29 |
**Commit:** `bd7adc6` | **Owners:** Solution Architect + API/UX

## 1 OpenAPI Status

- **Current:** `docs/backend/openapi.yaml` **110 paths** (787053a was 99,
  bd7adc6 adds `contracts.py` typed outputs, no breaking).
- **Spec:** `OpenAPI 3.2.0` pinned (`INF-05-source-register` EXT-08), generated
  from `api/routers` 27 files via `scripts/docs_audit_phase10.py`.
- **Validation:** `pnpm --filter web typecheck 0`, `rg "openapi" 110`,
  `api-client` `transformKeys` snake→camel consistent.

## 2 Typed Graph Contracts (backward-compatible, additive)

| Contract            | Location                                     | Fields                                                                                                                         | Bounds | Consumer                               |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------- |
| `RoutingDecision`   | `api/graph/contracts.py:7` + `routing.py:32` | `primary_intent, secondary_intents, confidence 0..1, candidate_agents, policy_filtered, final_agent, provenance, explain, v:1` | 4KB    | `route_node → metadata.route_decision` |
| `AgentHandoff`      | `contracts.py:45` + `state.py:60` `handoff`  | `source/target/ws/user/req/task/objective/context_refs 8/allowed_tools/scopes/reason/provenance/v:1`                           | 8KB    | `agent_node` validate                  |
| `EvaluationResult`  | `contracts.py:86` + `nodes.py:513`           | `task_completion…provenance_complete, score 0..1, replan_required, reason, v:1`                                                | 2KB    | `evaluate_node`                        |
| `FinalAgentResult`  | `contracts.py:115`                           | `status completed/failed/cancelled/waiting_approval, agent, summary, rag_status`                                               | 20KB   | `finalize_node`                        |
| `VaeloomGraphState` | `state.py:60`                                | 16→18 fields (+handoff/evaluation) `20KB/20 msgs×4KB/rag 8KB`                                                                  | 20KB   | `StateGraph 10`                        |

**Compatibility:** all `v1` additive, invalid `model output → failed` never
bypass (`validate_*`).

## 3 Control Plane → Cell Contracts (expand–contract)

- **Durable execution:** `POST /temporal/workflows/durable-agent`
  (`routers/temporal.py:322`)
  `payload {workspace_id,user_id,agent_id,input,request_id,correlation_id}`
  validated `validate_no_secrets + 20KB`, `REJECT_DUPLICATE`
  `durable_run:{ws}:{user}:{req}` 10m, returns
  `{workflow_id,run_id,status:accepted}`.
- **Ingest:** `POST /temporal/workflows/ingest`
  `workflow_id ingest:{ws}:{hash}:{doc}` 2h.
- **Connector sync:** `POST /temporal/workflows/connector-sync`
  `{ws,connector_id,sync_token 32}` `connector_sync:{ws}:{id}:{token}` 30m.
- **Status/cancel/signal:** `GET /temporal/workflows/{id}` + `POST /cancel` +
  `POST /signal/{decision|updateProgress}` allowlist
  (`routers/temporal.py:125`).
- **Migration control plane (future W2):**
  `POST /migration/cells/{cellId}/replicate` +
  `GET /migration/cells/{cellId}/reconciliation` — `NOT_IMPLEMENTED` behind
  `feature_flag` per-cell, `expand–contract` not dual-write.

## 4 Service Boundaries

| Service     | Truth                                                        | Projection                                                     | Sync/Async                                | Contract             |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------- | -------------------- |
| `workspace` | `workspaces` + `workspace_users` (FK `workspace_id CASCADE`) | —                                                              | sync `TenantContext SET app.*`            | `RLS 42/42`          |
| `document`  | `documents` rows                                             | `document_chunk` + `embedding Vector 1536` + `knowledge_nodes` | async `IngestDocumentWorkflow 4 steps`    | `ParseDocumentInput` |
| `memory`    | `Entity canonical_name` dedup `0.85`                         | `Memory` + `pgvector`                                          | sync `execute` + async `write_memory`     | `Entity`             |
| `agent`     | `AGENT_REGISTRY 22` handler                                  | `VaeloomGraphState` + `AgentHandoff`                           | sync `DurableAgentRunActivity 120s hb30s` | `RoutingDecision`    |
| `connector` | `connectors token_ref EncryptedString`                       | `MCP discovery 300s`                                           | async `ConnectorSyncWorkflow 300s hb30s`  | `SyncConnectorInput` |

**Idempotency:** `Idempotency-Key sha256(ws:req:tool:params)` in
`tool_execute` + `REJECT_DUPLICATE` on all workflow IDs — effectively-once via
idempotent side effects.

## 5 Backward Compatibility Horizon

All current contracts are additive `v1`; `openapi 110` is superset of `99`.
Future enterprise dual-run (W2 tenant cells) will use per-tenant `feature_flag`
(`feature-flags.ts 4 flags` + `config enterprise_routes_enabled false`) with
`shadow` `LANGGRAPH_SHADOW_MODE` pattern (`20` parity) — no breaking change
until `CONT-P19` design-partner pilot with `REQUIRES_STAKEHOLDER_DECISION`
procurement (BQ-06 deferred).

---

_Version 1.0 2026-08-29 — reviewers: Solution/API/UX, `openapi` 110 validated
via `rg`, graph typed contracts `64 tests`._
