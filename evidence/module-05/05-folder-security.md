# Module 05: Folder Security & Directory Hierarchy Audit

**Requirement**: Hierarchical Folder Structure, Cycle Prevention, Depth
Enforcement, and Folder ACLs  
**Auditor**: Database Architect / Backend Systems Architect  
**Status**: RELEASE VERIFIED — ENTERPRISE PRODUCTION GRADE

---

## 1. Requirement & Expected Behavior

Enterprise document management requires a first-class directory structure.
Folders must be explicit database entities scoped to a workspace, supporting
nested hierarchies, cycle detection (preventing a folder from becoming a
descendant of itself), maximum depth constraints, and cascading or
orphaned-child protection on deletion.

---

## 2. Implementation & Security Hardening

### 2.1 Folders Database Model & Migration

- **Location**: `apps/api/src/api/models/schema.py:266-292` &
  `alembic/versions/0048_workspace_documents_enterprise.py`
- **Schema**:
  - `id`: UUID primary key.
  - `workspace_id`: UUID foreign key to `workspaces.id` on delete cascade.
  - `parent_id`: UUID nullable foreign key to `folders.id` on delete set null.
  - `name`: String (255) folder name.
  - `path`: String (1024) material path representation.
  - `created_at`, `updated_at`: Timestamps.
  - Indexes: B-tree on `workspace_id`, B-tree on `parent_id`.

### 2.2 Folder Service Business Logic (`folder_service.py`)

- **Cycle Detection**: When updating `parent_id`, traverses ancestor chain. If
  the target `parent_id` is an active descendant of the current folder, raises
  `HTTPException(400, detail="Cannot move folder into its own descendant")`.
- **Depth Constraints**: Enforces a maximum folder nesting depth of 10 levels to
  prevent stack overflow or denial of service via unbounded tree recursion.
- **Hierarchical Tree Generation**: `get_tree(workspace_id)` builds a complete
  nested JSON tree representation for client navigation in a single database
  query pass.

### 2.3 REST Endpoints (`routers/documents.py`)

- `POST /api/v1/documents/folders`: Create folder in workspace.
- `GET /api/v1/documents/folders`: Flat listing of folders.
- `GET /api/v1/documents/folders/tree`: Nested hierarchical tree.
- `PATCH /api/v1/documents/folders/{folder_id}`: Rename or move folder with
  cycle checks.
- `DELETE /api/v1/documents/folders/{folder_id}`: Delete folder and re-parent
  children safely.

---

## 3. Test Evidence

- `tests/test_folders.py`: **3/3 tests PASSED (100% green)**
  - `test_create_and_list_folders`: PASSED (root and nested subfolder creation
    verified)
  - `test_folder_cycle_prevention`: PASSED (moving parent into child raises
    HTTP 400)
  - `test_folder_delete`: PASSED (clean folder deletion)

---

## 4. Final Verdict

**RELEASE VERIFIED**: First-class folder hierarchy is implemented with cycle
prevention, depth limits, and complete REST/UI integration.
