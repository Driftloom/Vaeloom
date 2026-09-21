# GATE 35 — Deployment/Migration Safety

## Key Findings

1. **Are document-related migrations reversible?**
   - Migration `0008_document_content.py` introduces the `content` column to `documents` and creates the `document_actions` table.
   - The downgrade function is provided and correctly drops the table and column. However, dropping the `content` column results in irrecoverable data loss for any inline documents.

2. **Are there missing indexes?**
   - In `apps/api/src/api/models/schema.py`, the `Document` model completely lacks a `__table_args__` section. This means there are no indexes on `workspace_id`, `folder_id`, or `path`. Any queries filtering by `workspace_id` will result in full table scans.
   - The `DocumentChunk` model also lacks indexes for `document_id`.

3. **Is there a migration for `document_versions`?**
   - No. There is no trace of `document_versions` being created in the migrations directory (e.g., in `0008` or any other migration), despite it existing in the schema and being heavily relied upon by `document_service.py`. This means the application will fail at runtime if `metadata.create_all()` is not used.

4. **Version Race Condition**
   - `apps/api/src/api/services/document_service.py` calculates the next version using:
     ```python
     latest_num = (await db.execute(latest_v_stmt)).scalar_one_or_none() or 0
     new_version_num = latest_num + 1
     ```
   - This is prone to race conditions under concurrent uploads. While a `UniqueConstraint("document_id", "version_number")` exists, it will cause 500 Server Errors rather than gracefully handling the race via optimistic locking or retry logic.

## Verdict: P0 (Critical/Blocker)
Missing migration for `document_versions` guarantees production failure. Missing indexes on `documents.workspace_id` will destroy performance and database stability at scale.
