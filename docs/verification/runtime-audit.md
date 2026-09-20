# Runtime Engines Forensics: Messages API Worker & Temporal Workflows

## 1. Executive Summary

Forensic inspection of `apps/api/src/api/temporal/` and
`apps/api/src/api/workers/` reveals the existing execution engines for
asynchronous and long-running agent operations.

---

## 2. Temporal Workflows Inventory (`apps/api/src/api/temporal/`)

Contrary to previous unverified claims, **Temporal workflows and activities are
already implemented** in the repository across 2,800+ lines of Python code:

### 2.1 Implemented Workflows (`workflows.py`, 783 lines)

1. **`ApprovalWorkflow`**: Orchestrates human-in-the-loop approval wait states,
   timeout signals, and resume triggers.
2. **`DurableAgentRunWorkflow`**: Durable state machine for multi-step agent
   ReAct execution with automatic retry and checkpointing.
3. **`IngestDocumentWorkflow`**: Document parsing, chunking, OCR, entity
   extraction, and knowledge graph ingestion.
4. **`ConnectorSyncWorkflow`**: Long-running periodic synchronization with
   external connectors (Google Drive, Notion, GitHub).
5. **`EventTriggeredWorkflow`**: Event-driven agent execution triggered by
   webhooks or internal bus events.

### 2.2 Implemented Activities (`activities.py`, 1,230 lines)

- `parse_document`: PDF/DOCX parsing and OCR
- `extract_entities`: LLM-based entity and relationship extraction
- `write_memory`: Two-tier memory write
- `index_graph`: Knowledge graph node and edge creation
- `durable_agent_run`: ReAct agent execution activity
- `execute_approved_action`: Consumes approved tool payload and executes action
- `sync_connector`: External provider synchronization
- `check_quota` & `check_kill_switch`: Runtime policy and safety guards

---

## 3. Messages API Worker (`apps/api/src/api/workers/`)

- `background_daemon.py`: Standalone polling daemon consuming from Redis /
  internal queues.
- `background_envelope.py`: Envelope serialization for asynchronous message
  dispatch.
- **Gap**: The worker currently runs in the same container process as FastAPI,
  competing for CPU and memory during intensive LLM rendering and Playwright
  browser execution.

---

## 4. Target Architecture Migration for Runtimes

- Move Temporal workflows and activities into `runtimes/temporal-workflows/`.
- Decouple the worker daemon into `runtimes/messages-api-worker/` with
  independent containerization and auto-scaling.
