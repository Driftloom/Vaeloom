# CONT-P08 — 02 Event / Webhook / Job

**Deliverable:** `DEL-CONT-P08-02` | **Version:** 1.0 | **Date:** 2026-08-29

## Async Job Resources

| Job                       | Queue          | Operations                                | Progress                                                            | Cancel                                | Result                                           | Retry                                    | Evidence                          |
| ------------------------- | -------------- | ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ | ---------------------------------------- | --------------------------------- |
| `IngestDocumentWorkflow`  | `ingest 20`    | `POST /temporal/workflows/ingest`         | `getStatus step parsing/extracting/writing_memory/indexing` `query` | `POST /cancel` `is_cancelled` `hb15s` | `IngestResult status completed memories_created` | `3× exp 1→8s` `non_retryable ValueError` | `temporal 40` `test_ingest_e2e 2` |
| `DurableAgentRunWorkflow` | `agent 8`      | `POST /temporal/workflows/durable-agent`  | `getStatus` `langgraph 10 nodes`                                    | `handle.cancel` → `cancelled`         | `result.summary` + `rag_status`                  | `2×` `120s hb30s`                        | `test_langgraph_integration 6`    |
| `ConnectorSyncWorkflow`   | `connectors 6` | `POST /temporal/workflows/connector-sync` | `progress 0→100` `heartbeat 30s`                                    | `cancel`                              | `SyncConnectorResult`                            | `3×` `300s hb30s`                        | `test_connector_sync 3`           |

## Webhook

- Verification `X-Hook-Secret` `HMAC sha256` (`webhooks.py`), `url_guard` `SSRF`
  `https-only + global-IP` (`utils/url_guard.py`).
- Deduplication `event_id` `event:{ws}:{type}:{id}` `REJECT_DUPLICATE`
  `EventTriggeredWorkflow` `dedup 8` (`workflows.py:504`).
- Order `causation_id/correlation_id` tracked, never re-emit same type
  (`handle_event` prevents loop).
- Replay `Temporal history` + `DLQ dead_letter_events` + reconciliation ledger
  `workload_identity, lag`.

---

_Version 1.0 2026-08-29 — `temporal/queues 8` `workflows 6` `11 activities`._
