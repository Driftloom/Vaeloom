# Module 05: Folder Security & Directory Structure Audit

**Requirement**: Hierarchical Folder Structure, Folder CRUD, Referential
Integrity, Path Traversal Defense, and Circular Reference Prevention  
**Auditor**: Database Architect / Backend Security Engineer  
**Status**: NOT RELEASE VERIFIED (FEATURE UNIMPLEMENTED / ZERO-TRUST GAP)

---

## 1. Requirement & Expected Behavior

Enterprise workspaces require a formal directory hierarchy:

- First-class folder entities with unique IDs, parent references, workspace
  isolation, and hierarchical path resolution.
- Folder CRUD endpoints (`POST /folders`, `GET /folders`, `PATCH /folders/{id}`,
  `DELETE /folders/{id}`).
- Atomic move operations with circular-reference validation (preventing a folder
  from being moved into its own descendant).
- Depth limits and orphan prevention.
- Folder-level authorization inheritance.

---

## 2. Implementation Findings

### 2.1 Complete Absence of Folder Data Model

- **Location**: `apps/api/src/api/models/schema.py:266-293`
- **Observed**:
  - The database schema contains **NO `folders` table**.
  - `Document` contains **NO `folder_id` column** or foreign key.
  - No Alembic migrations define folder tables, indexes, or parent-child
    constraints.

### 2.2 Complete Absence of Folder API Endpoints

- **Location**: `apps/api/src/api/routers/`
- **Observed**:
  - `routers/documents.py`: Zero folder endpoints.
  - `routers/workspaces.py`: Zero folder endpoints.
  - No endpoints exist to create, list, rename, move, or delete folders.

### 2.3 Virtual "Folder" Simulation via Path String Slicing

- **Location**:
  - `apps/api/src/api/agents/workspace_agent/handler.py:68-71`:
    ```python
    parts = [p for p in path.split("/") if p]
    folder = parts[0] if len(parts) > 1 else "root"
    categories[folder] = categories.get(folder, 0) + 1
    ```
  - `apps/api/src/api/tools/executor.py:1529-1532` (`move_file` tool):
    ```python
    filename = doc.path.rsplit("/", 1)[-1]
    new_path = f"{target_folder.rstrip('/')}/{filename}"
    doc.path = new_path
    meta["folder"] = target_folder
    ```
- **Security Deficiencies**:
  1. **No Referential Integrity**: Moving or renaming a directory requires
     updating arbitrary string paths across unbounded document rows. If a server
     crashes mid-update, the directory structure is corrupted.
  2. **No Depth Limits**: Clients or agents can create arbitrarily nested
     virtual paths (e.g. `a/b/c/.../z`), risking path-length overflows and query
     degradation.
  3. **No Circular Reference Protection**: Because folders do not exist as
     entities, circular parent-child loops cannot be formally modeled or
     prevented.
  4. **No Folder-Level ACLs**: Access cannot be scoped to specific project
     folders; permissions apply only to the entire workspace.

---

## 3. Test & Verification Evidence

- **Code Search**:
  - Query: `class Folder(` across `apps/api/src/api` -> 0 matches.
  - Query: `folder_id` across `apps/api/src/api` -> 0 matches.
  - Query: `@router.post("/folders")` -> 0 matches.
- **Frontend Inspection**:
  `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:13` calls
  `getFileName(path)` and flattens all documents into a single flat list. No
  directory tree or folder navigation exists in the web UI.

---

## 4. Evaluation Matrix

| Capability              | Enterprise Requirement              | Actual Implementation        | Status   |
| :---------------------- | :---------------------------------- | :--------------------------- | :------- |
| **Folder Table**        | Relational `folders` table          | Non-existent                 | **FAIL** |
| **Folder CRUD**         | REST endpoints for folder lifecycle | Non-existent                 | **FAIL** |
| **Document FK**         | `Document.folder_id`                | Stored as string in `path`   | **FAIL** |
| **Circular Prevention** | Tree cycle validation               | None                         | **FAIL** |
| **Atomic Folder Move**  | Atomic parent update                | Iterative string replacement | **FAIL** |
| **Folder UI Tree**      | Accessible treeview navigation      | Flat file list only          | **FAIL** |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (UNIMPLEMENTED)**  
Folders exist only as unstructured string segments within file paths. True
enterprise folder hierarchy, atomic directory movements, and folder-level access
control do not exist.
