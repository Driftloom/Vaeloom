# Module 05: Document Versioning & Revision History
**Audit Identifier**: `AUD-M05-AI-09`
**Scope**: DocumentVersion schema, immutable revision snapshots, monotonic numbering, and version rollback.

---

## 1. Document Versioning Model

Document versioning is modeled via `DocumentVersion` in `api/models/schema.py`:
- `document_id`: UUID foreign key to parent `Document`.
- `version_number`: Strictly monotonic integer starting at 1.
- `storage_key`: Immutable S3 storage path for this specific revision's binary data.
- `checksum`: SHA-256 cryptographic hash of the revision content.
- `size_bytes`: Byte count of the file.
- `created_at`: UTC timestamp of version creation.
- `created_by`: UUID of the user who committed the revision.

---

## 2. API Endpoints

- `GET /api/v1/documents/{id}/versions?workspace_id=...`: List all revisions for a document ordered by `version_number DESC`.
- `POST /api/v1/documents/{id}/versions?workspace_id=...`: Upload a new revision; auto-increments version number and updates `Document.current_version`.
- `POST /api/v1/documents/{id}/versions/{version_number}/restore?workspace_id=...`: Restore a prior revision as the active document version.

---

## 3. Verification Evidence

- `test_module05_versions.py`:
  - `test_document_version_model_invariants`: Confirms version records maintain foreign key integrity, immutable checksums, and monotonically increasing version numbers.
