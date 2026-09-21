# Module 05: Bulk Upload & Bulk Download Operations Audit

**Requirement**: Multi-File Batch Ingestion, Aggregate Size Limits, Partial
Failure Resilience, Bulk Download ZIP Streaming, and Decompression Bomb
Defenses  
**Auditor**: Distributed Systems Engineer / Backend Security Architect  
**Status**: NOT RELEASE VERIFIED (UNIMPLEMENTED IN BACKEND & FRONTEND)

---

## 1. Requirement & Expected Behavior

Enterprise workflows mandate robust bulk file management:

1. **Bulk Upload API**: Ingest multiple files in a single atomic or streaming
   batch request with aggregate size validation, individual file failure
   isolation (partial success reporting), and progress tracking.
2. **Bulk Download API**: Export selected documents or entire directories as an
   on-the-fly streaming ZIP archive with individual resource authorization
   checks, archive-bomb defenses, and safe filename normalization.
3. **Frontend Batch Handling**: Multi-file drag-and-drop queue with per-file
   progress bars, multi-select table checkboxes, and batch action toolbars.

---

## 2. Implementation Findings

### 2.1 Backend Bulk Upload & Download Endpoints are Non-Existent

- **Location**: `apps/api/src/api/routers/documents.py`
- **Observed**:
  - `POST /documents`: Accepts only a single `UploadFile = File(...)`.
  - There is **no bulk upload endpoint** (e.g. `POST /documents/bulk`).
  - There is **no bulk download endpoint** (e.g. `POST /documents/bulk/download`
    or `GET /documents/export`).
  - To download 50 documents, a client must make 50 individual HTTP GET
    requests.

### 2.2 Frontend Silently Drops Multiple Files

- **Location**:
  `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:495, 514`
- **Observed Code**:
  ```tsx
  // Drag and drop handler
  const file = e.dataTransfer.files?.[0];
  if (!file) return;
  void uploadFile(file);

  // File input change handler
  const file = e.target.files?.[0];
  if (!file) return;
  void uploadFile(file);
  ```
- **Critical UX & Data Loss Defect**:
  - Both event handlers index only `files?.[0]`.
  - The hidden `<input type="file" ... />` lacks the `multiple` attribute.
  - If a user selects or drags 20 files onto the browser window, **19 files are
    silently discarded** with zero user warning or error message!

### 2.3 Absence of Selection State in UI

- **Location**:
  `apps/web/src/app/workspace/[workspaceId]/files/page.tsx:590-740`
- **Observed**: The files table renders standard table rows without selection
  checkboxes. There is no concept of a selected document set, bulk archive, or
  bulk download.

---

## 3. Test & Verification Evidence

- **Router Grep**: `grep -rn "bulk" apps/api/src/api/routers/documents.py` -> 0
  matches.
- **Frontend File Drop Probe**: Simulating a drop event with 3 `File` objects in
  Playwright/Jest:
  - Only `file[0]` is processed by `uploadFile()`.
  - `file[1]` and `file[2]` trigger no network requests and emit no warnings.

---

## 4. Evaluation Matrix

| Vector                  | Requirement                     | Actual Status                | Verdict           |
| :---------------------- | :------------------------------ | :--------------------------- | :---------------- |
| **Bulk Upload Route**   | `POST /documents/bulk`          | Non-existent                 | **FAIL**          |
| **Partial Failure Map** | Report per-file success/failure | Non-existent                 | **FAIL**          |
| **Bulk Download Route** | Streaming ZIP export            | Non-existent                 | **FAIL**          |
| **Zip Bomb Defense**    | Aggregate size & ratio limit    | Non-existent                 | **FAIL**          |
| **Multi-File Dropzone** | Process all dropped items       | Silently drops `files[1..N]` | **CRITICAL FAIL** |
| **Multi-Select Table**  | Checkbox selection toolbar      | Missing in web UI            | **FAIL**          |

---

## 5. Security & Functional Verdict

**NOT RELEASE VERIFIED (COMPLETE ABSENCE)**  
Bulk upload and bulk download are completely missing from the backend API, and
the web frontend silently discards files when users attempt multi-file uploads.
