# Module 05: Memory Integration & Provenance Linking
**Audit Identifier**: `AUD-M05-AI-23`
**Scope**: MemoryRecord schema, source document foreign keys, chunk offset provenance, and audit trails.

---

## 1. Provenance Architecture

Implemented in `api/models/schema.py` (`Memory`, `MemoryRecord`, `DocumentChunk`):
- Every semantic fact extracted from a document points to the source entity:
  - `Memory.source_type = "document"` or `"document_chunk"`.
  - `Memory.source_id = Document.id` or `DocumentChunk.id`.
- This ensures full auditability: any fact retrieved by an agent can be traced back to the exact file, version, and character offset that produced it.

---

## 2. Verification Evidence

- `test_module05_memory.py`:
  - `test_memory_provenance_linking`: Verifies that memory entries created during document ingestion accurately retain `source_type`, `source_id`, and `workspace_id`.
