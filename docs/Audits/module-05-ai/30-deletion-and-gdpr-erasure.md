# Module 05: Cascading GDPR Erasure & Deletion Consistency
**Audit Identifier**: `AUD-M05-AI-30`
**Scope**: Soft-delete archiving vs hard deletion, `ErasureService` cascading multi-store purge, and S3 object cleanup.

---

## 1. Deletion Lifecycle

Vaeloom supports two distinct deletion modes:
1. **User Soft-Delete (Archive)**:
   - Sets `Document.status = "ARCHIVED"`.
   - Preserves document rows, version history, and storage files.
   - Reversible via `POST /documents/{id}/restore` or action undo.
2. **GDPR / Tenant Hard Erasure**:
   - Implemented in `ErasureService` (`api/services/erasure_service.py`).
   - Completely purges data across all physical stores:
     - Deletes raw objects and version files in S3/MinIO.
     - Revokes OAuth connector tokens.
     - Cascades database row deletions across `relationships`, `entities`, `document_chunks`, `document_actions`, `document_shares`, `document_versions`, `documents`, `folders`, `embeddings`, and `memories`.
   - Generates cryptographically verifiable `ErasureReceipt`.

---

## 2. Verification Evidence

- `test_module05_deletion.py`:
  - `test_erasure_service_cascade_receipt`: Validates multi-store cascade and receipt generation.
  - `test_document_soft_delete_vs_hard_delete`: Validates status semantics for archived documents.
