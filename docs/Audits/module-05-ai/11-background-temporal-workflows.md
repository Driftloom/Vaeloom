# Module 05: Background Ingestion & Temporal Workflows
**Audit Identifier**: `AUD-M05-AI-11`
**Scope**: Asynchronous document ingestion orchestration, state transitions, retry policies, and emergency kill switches.

---

## 1. Temporal Ingestion Pipeline

Implemented in `IngestDocumentWorkflow` (`api/temporal/workflows.py`):
1. **Activity 1: `check_kill_switch`**: Checks whether document ingestion or background tasks are disabled globally or per workspace.
2. **Activity 2: `parse_document`**: Extracts text via PyMuPDF or Tesseract OCR from S3 binary storage.
3. **Activity 3: `extract_entities`**: Runs entity recognition to extract topics, organizations, and concepts.
4. **Activity 4: `write_memory`**: Stores extracted text into `Memory` and `MemoryRecord` tables with document provenance.
5. **Activity 5: `index_graph`**: Links extracted entities to the workspace knowledge graph.

---

## 2. Ingestion State Machine

`Document.status` transitions monotonically:
```
[UPLOADED] ──> [PARSING] ──> [EMBEDDING] ──> [READY]
     │              │               │
     └──> [ERROR] <─┴───────────────┘
     │
     └──> [QUARANTINED] (if malware or malicious injection detected)
```

---

## 3. Verification Evidence

- `test_module05_background.py`:
  - `test_background_state_transitions`: Verifies valid document status transitions from `UPLOADED` to `READY`.
  - `test_background_workflow_kill_switch`: Verifies that tripping the background kill switch halts workflow execution before consuming LLM/embedding resources.
