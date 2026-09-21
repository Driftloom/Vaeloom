# Module 05: Data Privacy & GDPR Deletion Consistency Audit

**Requirement**: Data Privacy Compliance, GDPR Article 17 ("Right to be
Forgotten"), Cryptographic Erasure, and Deletion Consistency  
**Auditor**: Enterprise Compliance Engineer / Privacy Architect  
**Status**: NOT RELEASE VERIFIED (CRITICAL PRIVACY DEFICITS)

---

## 1. Requirement & Expected Behavior

Enterprise document management must guarantee strict privacy compliance:

1. **Complete Deletion Cascade**: When a user exercises their GDPR "Right to be
   Forgotten" (`DELETE /gdpr/users/{id}`), deletion must atomically propagate
   across:
   - Relational database rows (`documents`, `document_versions`,
     `document_actions`, `document_chunks`)
   - Cloud Object Storage (deleting physical objects in S3/MinIO)
   - Vector database embeddings
   - Knowledge graphs and caches
2. **Zero Orphaned PII**: No residual copies, chunks, or physical storage blobs
   may remain after erasure.
3. **Soft-Delete Confidentiality**: Archiving a document must immediately
   withhold its contents from AI retrieval contexts.

---

## 2. Implementation Findings

### 2.1 Dead Code in `ErasureService`

- **Location**: `apps/api/src/api/services/erasure_service.py`
- **Observed**: `ErasureService.execute_erasure()` contains comprehensive logic
  designed to query `DocumentVersion.storage_key` and invoke
  `storage_service.delete()`. **However**, code search confirms that
  `ErasureService` is **never instantiated, imported, or called** by any API
  router, CLI command, or background task! It is completely dead code.

### 2.2 Production GDPR Service Leaves S3 Files Orphaned

- **Location**: `apps/api/src/api/services/gdpr.py:64-99, 157-183`
- **Observed Code**:
  ```python
  for table, fk_col in USER_TABLES:
      ...
      if fk_col == "workspace_id":
          result = await db.execute(
              text(f"DELETE FROM {table} WHERE {fk_col} IN (SELECT id FROM workspaces WHERE user_id = :uid)"),
              {"uid": user_id},
          )
  ```
- **Critical Privacy Defect**: The production GDPR deletion engine deletes rows
  from SQL tables, but **NEVER invokes `storage_service.delete()`**! **Impact**:
  When a user requests account erasure under GDPR Art. 17, their confidential
  PDF resumes, identity documents, and business files remain permanently stored
  on cloud object storage (S3/MinIO). This constitutes an active GDPR
  non-compliance violation.

### 2.3 `document_versions` Omitted from GDPR `USER_TABLES`

- **Location**: `apps/api/src/api/services/gdpr.py:64-99`
- **Observed**: `document_versions` is completely omitted from the `USER_TABLES`
  tuple. If database cascading foreign keys fail or are delayed, version records
  remain orphaned in the database.

### 2.4 Soft-Deleted PII Leaks into Agent Prompts

- **Location**: `apps/api/src/api/services/document_service.py:173-180`
- **Defect**: Archiving a document sets `deleted_at = now()`. However,
  `document_chunks` and `embeddings` are neither deleted nor marked inactive. An
  archived document containing sensitive PII (e.g. medical notes or compensation
  numbers) continues to be retrieved by AI agents and injected into chat
  completions.

---

## 3. Evaluation Matrix

| Vector                     | Requirement                         | Actual Status                    | Verdict           |
| :------------------------- | :---------------------------------- | :------------------------------- | :---------------- |
| **Object Storage Purge**   | Delete physical S3 objects on GDPR  | Never called; blobs remain       | **CRITICAL FAIL** |
| **Database Row Deletion**  | Delete all document/version rows    | Partially relying on DB cascades | **FAIL**          |
| **Vector Index Purge**     | Delete embeddings on archive/delete | Embeddings persist indefinitely  | **CRITICAL FAIL** |
| **Erasure Service Active** | Production wiring for erasure       | Dead code; 0 callers             | **FAIL**          |

---

## 4. Privacy & Compliance Verdict

**NOT RELEASE VERIFIED (CRITICAL PRIVACY VIOLATION)**  
GDPR account erasure leaves orphaned files permanently in object storage, and
soft-deleted documents continue to leak sensitive data through vector retrieval
pipelines.
