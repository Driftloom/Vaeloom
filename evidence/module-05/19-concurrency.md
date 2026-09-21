# Module 05: Concurrency & State Machine Integrity Audit

**Requirement**: Race Condition Prevention, Optimistic/Pessimistic Concurrency,
State Machine Determinism, and Atomic Transitions  
**Auditor**: Distributed Systems Engineer / Backend Security Architect  
**Status**: NOT RELEASE VERIFIED (CRITICAL RACE CONDITIONS IDENTIFIED)

---

## 1. Requirement & Expected Behavior

Enterprise multi-user systems require strict concurrency controls:

1. **Version Generation**: Generating sequential version numbers (`v1`, `v2`,
   `v3`) must be atomic, preventing duplicate version numbers or lost updates.
2. **Action Undo Integrity**: Undoing an action must ensure the document has not
   undergone intervening mutations, locking the target rows
   (`SELECT FOR UPDATE`) to prevent race conditions.
3. **Archive × Restore Determinism**: Simultaneous archive and restore
   operations must resolve deterministically without corrupting document status.
4. **Optimistic Locking on Metadata**: `PATCH /documents/{id}` and
   `PATCH /workspaces/{id}` must support concurrency tokens (`ETag` / `version`)
   to prevent silent overwrite of concurrent edits.

---

## 2. Implementation Findings

### 2.1 Non-Atomic Version Number Generation

- **Location**: `apps/api/src/api/ingestion/pipeline.py:61-77`
- **Observed Code**:
  ```python
  version_result = await session.execute(
      select(func.max(DocumentVersion.version_number))
      .where(DocumentVersion.document_id == document_id)
  )
  max_version = version_result.scalar() or 0
  next_version = max_version + 1

  new_version = DocumentVersion(
      document_id=document_id,
      version_number=next_version,
      ...
  )
  session.add(new_version)
  ```
- **Concurrency Defect**: There is no row lock (`with_for_update()`) on
  `Document`. If two concurrent ingestion tasks process revisions of the same
  document simultaneously, both read the same `max_version` (e.g. `1`), compute
  `next_version = 2`, and attempt to insert `(document_id, 2)`. The second
  insert crashes with an unhandled database `IntegrityError` due to
  `UniqueConstraint("document_id", "version_number")`.

### 2.2 Unsafe Undo State Transitions & Intervening Mutation Clobbering

- **Location**: `apps/api/src/api/services/document_service.py:224-252`
  (`undo_action`)
- **Observed Code**:
  ```python
  if action.action_type == ACTION_RENAME:
      doc.path = action.old_path or doc.path
  elif action.action_type == ACTION_ARCHIVE:
      doc.deleted_at = None
  elif action.action_type == ACTION_RESTORE:
      doc.deleted_at = action.old_deleted_at
  action.undone_at = datetime.now(UTC)
  ```
- **Concurrency Defects**:
  1. **Zero Row Locking**: Neither `Document` nor `DocumentAction` is queried
     with row locks. Two concurrent calls to `POST /actions/{id}/undo` can
     execute lines 236–237 simultaneously before `action.undone_at` is written,
     causing duplicate undo processing.
  2. **Intervening State Blindness**: `undo_action` does not check whether the
     action being undone is the latest active mutation.
     - Sequence: `A.txt` → Rename to `B.txt` (Action 1) → Rename to `C.txt`
       (Action 2).
     - User calls `undo(Action 1)`: The code sets `doc.path = Action 1.old_path`
       (`A.txt`).
     - `C.txt` is silently destroyed and clobbered back to `A.txt`, leaving
       Action 2 orphaned and corrupting document history.

### 2.3 Simultaneous Archive and Restore Races

- **Location**: `apps/api/src/api/services/document_service.py:173-187`
- **Defect**: `archive()` and `restore()` check `doc.deleted_at is None` or
  `doc.deleted_at is not None` without database row locking. Concurrent
  `archive()` and `restore()` calls execute non-deterministically based on
  connection pool scheduling, producing erratic `DocumentAction` records.

---

## 3. Evaluation Matrix

| Concurrency Scenario          | Expected Behavior                 | Observed Implementation      | Verdict           |
| :---------------------------- | :-------------------------------- | :--------------------------- | :---------------- |
| **Concurrent Version Upload** | Sequential versions without crash | Crash on `UniqueConstraint`  | **CRITICAL FAIL** |
| **Concurrent Undo Calls**     | Single execution, 409 on second   | Race condition (no row lock) | **FAIL**          |
| **Intervening Undo**          | Reject undo of non-latest action  | Overwrites subsequent states | **HIGH FAIL**     |
| **Archive × Restore Race**    | Serializable state transition     | Non-deterministic overwrite  | **FAIL**          |
| **Optimistic Lock on PATCH**  | ETag / version mismatch rejection | Last-write-wins overwrite    | **FAIL**          |

---

## 4. Security Verdict

**NOT RELEASE VERIFIED (DATA INTEGRITY RISK)**  
The document lifecycle engine lacks row-level database locking, optimistic
concurrency controls, and state-machine validation, permitting data clobbering
under multi-user concurrency.
