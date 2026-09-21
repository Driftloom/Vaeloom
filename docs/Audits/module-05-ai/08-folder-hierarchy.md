# Module 05: Folder Hierarchy & Directory Management
**Audit Identifier**: `AUD-M05-AI-08`
**Scope**: Folder models, parent-child DAG acyclicity, depth limits, and folder tree traversal.

---

## 1. Directory Architecture

Implemented via the `Folder` model (`api/models/schema.py`) and folder endpoints in `api/routers/documents.py`:
- `parent_id`: Nullable foreign key referencing another `Folder.id` within the same workspace.
- `workspace_id`: Enforces that parent and child folders reside strictly in the same workspace.
- `MAX_FOLDER_DEPTH = 10`: Enforces maximum folder nesting depth to prevent stack overflow in recursive tree queries.

---

## 2. API Endpoints

- `GET /api/v1/documents/folders?workspace_id=...`: Flat list of folders.
- `GET /api/v1/documents/folders/tree?workspace_id=...`: Hierarchical JSON tree structure consumed by frontend sidebar navigation.
- `POST /api/v1/documents/folders`: Create folder with optional `parent_id`.
- `PATCH /api/v1/documents/folders/{id}`: Rename or relocate folder with cycle detection.
- `DELETE /api/v1/documents/folders/{id}`: Delete folder (requires folder to be empty or cascades soft-delete).

---

## 3. Verification Evidence

- `test_module05_folders.py`:
  - `test_folder_depth_limit_enforcement`: Confirms folder nesting beyond depth 10 is rejected.
  - `test_folder_name_validation`: Validates folder names cannot contain traversal characters (`../`).
- `test_module05_frontend.py`:
  - `test_frontend_folder_tree_contract`: Confirms `/documents/folders/tree` returns valid nodes with `children`.
