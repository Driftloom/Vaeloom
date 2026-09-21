# Module 05: Document Sharing & Cross-Tenant Deduplication Security Audit

**Requirement**: Granular Document Sharing, Expiration & Revocation, Consent
Verification, and Cross-Tenant Deduplication Isolation  
**Auditor**: Zero-Trust Architect / Adversarial Security Engineer  
**Status**: NOT RELEASE VERIFIED (CRITICAL VULNERABILITY IDENTIFIED)

---

## 1. Requirement & Expected Behavior

Enterprise document sharing between workspaces must adhere to strict zero-trust
standards:

1. **Explicit Sharing Entity**: Document sharing must be modeled via a dedicated
   relation (`document_shares`) capturing source workspace, target
   workspace/user, permissions (`VIEW`, `DOWNLOAD`, `EDIT`), expiration
   timestamps, and revocation states.
2. **Zero Implicit Tenant Membership**: Sharing a document must never grant the
   recipient implicit membership in the source workspace or tenant.
3. **Immediate Revocation**: Revoking a share must instantaneously terminate
   document listing, retrieval, downloads, and agent vector retrieval.
4. **Deduplication Boundary**: File content deduplication must **never** cross
   workspace or tenant boundaries. A file uploaded by Workspace A must never
   attach to or overwrite a document belonging to Workspace B.

---

## 2. Implementation Findings

### 2.1 Complete Absence of Document Sharing Infrastructure

- **Location**: `apps/api/src/api/models/schema.py` and
  `apps/api/src/api/routers/documents.py`
- **Observed**:
  - There is **no document sharing table** (`document_shares`,
    `workspace_shares`, etc.).
  - The `Permission` model (`schema.py:973-991`) governs only agent-to-tool
    execution scopes (`agent_name`, `action_type`), not resource-level
    permissions.
  - The document router exposes no sharing endpoints
    (`POST /documents/{id}/share`, `DELETE /documents/{id}/share/{sid}`).
  - Document sharing between workspaces is completely un-implemented.

### 2.2 CRITICAL Cross-Tenant Document Hijacking via `check_dedup`

- **Location**: `apps/api/src/api/ingestion/dedup.py:42-56`
- **Observed Code**:
  ```python
  async with scoped_session(workspace_id=workspace_id, require=False) as session:
      version_stmt = (
          select(DocumentVersion)
          .where(DocumentVersion.checksum == content_hash)
          .limit(1)
      )
      version_result = await session.execute(version_stmt)
      existing_version = version_result.scalar_one_or_none()

      if existing_version:
          doc_stmt = select(Document).where(Document.id == existing_version.document_id)
          doc_result = await session.execute(doc_stmt)
          existing_doc = doc_result.scalar_one_or_none()
          if existing_doc:
              return str(existing_doc.id)
  ```
- **Vulnerability Breakdown**:
  1. **Unscoped Version Query**: `DocumentVersion` contains no `workspace_id`.
     The query performs a global lookup on
     `DocumentVersion.checksum == content_hash` without joining `Document` or
     filtering by `workspace_id` in application code.
  2. **Cross-Tenant Collision & Hijack**:
     - Suppose Tenant A uploads `contract.pdf` (checksum `a1b2c3d4`).
     - Later, Tenant B uploads a file with the identical checksum `a1b2c3d4`
       (e.g. standard vendor NDA, template, or public document).
     - `check_dedup()` executes and finds `existing_version` belonging to Tenant
       A!
     - It returns Tenant A's `existing_doc.id` to Tenant B's pipeline.
     - In `apps/api/src/api/ingestion/pipeline.py:54-83`, Tenant B's pipeline
       fetches Tenant A's document, increments its version counter, attaches
       Tenant B's version to Tenant A's document, and overwrites Tenant A's
       `updated_at` and `metadata_`!
  3. **Defense-in-Depth Failure**:
     - While PostgreSQL RLS on `document_versions`
       (`0036_least_privilege_rls.py:176`) attempts a subquery join on
       `current_setting('app.workspace_id')`, in any runtime context where RLS
       is bypassed, unconfigured, or in SQLite local development/testing,
       **Tenant B directly hijacks Tenant A's document entity**.
     - Relying on RLS as the _sole_ line of defense while querying an unscoped
       global table in application code violates zero-trust defense-in-depth
       principles.

---

## 3. Test & Verification Evidence

- **Reproduction Scenario**:
  1. Ingest document in Workspace 1: `wid1`, filename `"shared_spec.md"`, bytes
     `b"# Universal Specification"`.
  2. Ingest document in Workspace 2: `wid2`, filename `"my_notes.md"`, bytes
     `b"# Universal Specification"`.
  3. In SQLite / non-RLS session: `check_dedup` in `wid2` returns the UUID of
     the document created in `wid1`.
  4. Result: Workspace 2 pipeline mutates Workspace 1's document instead of
     creating an isolated document in Workspace 2.

---

## 4. Evaluation Matrix

| Vector                      | Enterprise Requirement                 | Observed Implementation                    | Status            |
| :-------------------------- | :------------------------------------- | :----------------------------------------- | :---------------- |
| **Cross-Workspace Share**   | Formal share entity with explicit ACLs | Non-existent                               | **FAIL**          |
| **Share Expiration**        | Scheduled expiration timestamp         | Non-existent                               | **FAIL**          |
| **Revocation Behavior**     | Instantaneous cache & search purge     | Non-existent                               | **FAIL**          |
| **Deduplication Isolation** | Workspace-scoped hash matching         | Global unscoped query on `DocumentVersion` | **CRITICAL FAIL** |
| **Zero-Trust Defense**      | App-tier + DB-tier dual enforcement    | App-tier omits `workspace_id` filter       | **CRITICAL FAIL** |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (CRITICAL VULNERABILITY)**  
Document sharing is unmodeled, and content hash deduplication in `dedup.py`
contains a critical cross-tenant data corruption vulnerability.
