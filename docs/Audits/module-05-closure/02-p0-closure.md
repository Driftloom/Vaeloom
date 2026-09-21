# Module 05 — P0 Vulnerability Remediation & Closure Report

Date: 2026-09-22 Auditor: Principal Security Architect & AI Systems Engineer
Status: **ALL 8 P0 BLOCKERS CLOSED & VERIFIED WITH RUNTIME TESTS**

---

### P0-01: Stored XSS via HTML / SVG Uploads

- **Original Vulnerability:** `ALLOWED_EXTENSIONS` permitted `.html` and `.svg`.
  Uploading script-bearing SVG/HTML files allowed execution of arbitrary
  JavaScript within user sessions.
- **Root Cause:** `apps/api/src/api/services/file_security_service.py` lines
  24-25 included `"html"` and `"svg"`, and `inspect_file` explicitly treated
  them as safe.
- **Remediation Applied:**
  1. Removed `html` and `svg` from `ALLOWED_EXTENSIONS`.
  2. Defined
     `ACTIVE_CONTENT_EXTENSIONS = {"html", "htm", "svg", "xhtml", "xml"}`.
  3. Added immediate rejection in `inspect_file()` for any active content
     extension.
  4. Implemented `_contains_active_content()` for polyglot script payload
     detection in images.
- **Runtime Verification:**
  `tests/integration/module05/test_upload_security.py::test_html_upload_blocked`
  (PASSED), `test_svg_upload_blocked` (PASSED).
- **Status:** **CLOSED**

---

### P0-02: RBAC `required_roles` Never Passed to `_verify_workspace_access`

- **Original Vulnerability:** Route handlers called
  `_verify_workspace_access(workspace_id, user_id, db)` without passing
  `required_roles`, causing the internal role check (`if required_roles:`) to
  never fire. As a result, even users with `VIEWER` role could execute upload,
  rename, and archive operations.
- **Root Cause:** `apps/api/src/api/routers/documents.py` call sites omitted
  `required_roles`.
- **Remediation Applied:**
  1. Introduced permission constants:
     - `_ROLES_WRITE = ("owner", "admin", "editor", "member")`
     - `_ROLES_MUTATE = ("owner", "admin", "editor")`
     - `_ROLES_ADMIN = ("owner", "admin")`
  2. Wired `required_roles=_ROLES_WRITE` to `upload_document` and `bulk_upload`.
  3. Wired `required_roles=_ROLES_MUTATE` to `rename_document`,
     `archive_document`, `restore_document`, and `undo_document_action`.
- **Runtime Verification:**
  `tests/integration/module05/test_rbac_matrix.py::test_viewer_cannot_upload`
  (PASSED with 403 Forbidden).
- **Status:** **CLOSED**

---

### P0-03: Share Privilege Escalation (Read-only Share Mutating Documents)

- **Original Vulnerability:** When accessing a document via `DocumentShare`,
  `get_document()` verified share existence but never checked
  `share.permission`. Users in recipient workspaces with `read` permission could
  rename, archive, or create new versions.
- **Root Cause:** `apps/api/src/api/services/document_service.py:228-241`
  returned the document without validating whether the requested operation was a
  read or a mutation.
- **Remediation Applied:**
  1. Added `required_permission: str = "read"` parameter to `get_document()`.
  2. If `required_permission in ("write", "admin")`, checked
     `share.permission.lower() in ("write", "admin")`, raising
     `HTTPException(403)` on read-only shares.
  3. Passed `required_permission="write"` in `rename()`, `archive()`,
     `restore()`, `create_version()`, and `restore_version()`.
- **Runtime Verification:**
  `tests/integration/module05/test_rbac_matrix.py::test_read_only_share_cannot_rename_or_archive`
  (PASSED with 403 Forbidden).
- **Status:** **CLOSED**

---

### P0-04: Prompt Injection in DocumentAgent RAG Synthesis

- **Original Vulnerability:** `synthesize_documents()` directly concatenated raw
  document excerpts into the LLM prompt without XML fences, instruction
  boundaries, or injection sanitization.
- **Root Cause:** `apps/api/src/api/agents/document_agent/handler.py` lines
  80-86 formatted excerpts into a free-text template.
- **Remediation Applied:**
  1. Added `SYSTEM_PROMPT` defining all retrieved document content as
     `UNTRUSTED DATA` that must never override instructions or trigger tool
     calls.
  2. Enclosed all document excerpts in `<document_context id="...">` XML fences
     with HTML-escaped `<` and `>` characters to prevent fence breakouts.
  3. Added proactive scan for prompt injection patterns (`ignore all previous`,
     `[inst]`, etc.) and sanitized flagged excerpts.
- **Runtime Verification:**
  `tests/adversarial/module05/test_prompt_injection.py` (7/7 tests PASSED).
- **Status:** **CLOSED**

---

### P0-05: Upload Size Limit Missing at Router Level

- **Original Vulnerability:** 25MB limit was only checked inside
  `document_service.upload()` while streaming chunks from `UploadFile`.
  Memory-buffered uploads could consume server memory before service checks
  fired.
- **Root Cause:** `apps/api/src/api/routers/documents.py` lacked pre-validation
  on `file.size`.
- **Remediation Applied:** Added
  `if file.size is not None and file.size > _MAX_UPLOAD_BYTES: raise HTTPException(413)`
  in `upload_document`.
- **Runtime Verification:**
  `tests/integration/module05/test_upload_security.py::test_oversized_file_rejected_at_router`
  (PASSED with 413 Payload Too Large).
- **Status:** **CLOSED**

---

### P0-06: Cache Keys Not Namespaced by Workspace / Tenant

- **Original Vulnerability:** `CacheService` used un-scoped string keys,
  allowing identical queries from different workspaces or tenants to collide and
  leak cached document summaries.
- **Root Cause:** `apps/api/src/api/services/cache_service.py` lacked a
  zero-trust namespacing helper.
- **Remediation Applied:** Added
  `CacheService.make_key(tenant_id, workspace_id, resource, *params)` returning
  `cache:{tenant_id}:{workspace_id}:{resource}:{params_hash}`.
- **Runtime Verification:** `tests/integration/module05/test_cache_isolation.py`
  (4/4 tests PASSED).
- **Status:** **CLOSED**

---

### P0-07: Version Number Race Condition

- **Original Vulnerability:** Version numbering used `MAX(version_number) + 1`
  without concurrency locks or unique database constraints, allowing concurrent
  uploads to create duplicate versions or crash.
- **Root Cause:** Missing `UNIQUE(document_id, version_number)` constraint in
  database migrations.
- **Remediation Applied:** Added
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_version ON document_versions (document_id, version_number)`
  in migration 0010.
- **Runtime Verification:**
  `tests/integration/module05/test_version_concurrency.py` (PASSED).
- **Status:** **CLOSED**

---

### P0-08: Missing `document_versions` Database Migration

- **Original Vulnerability:** The `DocumentVersion` SQLAlchemy model was used in
  application code, but no database migration script created the
  `document_versions` table, causing schema drift.
- **Root Cause:** Migration series ended at `0008_document_content.py` (and
  `0009_feature_flags.py`), omitting tables for document versions, folders, and
  shares.
- **Remediation Applied:** Created
  `apps/api/src/api/migrations/0010_document_versions_folders_shares.py` with
  idempotent creation for `document_versions`, `folders`, `document_shares`, and
  missing `documents` columns.
- **Runtime Verification:**
  `tests/integration/module05/test_version_concurrency.py::test_migration_0010_registered`
  (PASSED).
- **Status:** **CLOSED**
