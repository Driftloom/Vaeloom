# Module 05: Frontend UI/UX Architecture & API Contracts
**Audit Identifier**: `AUD-M05-AI-26`
**Scope**: Next.js 15 client integration, typed contracts (`api-client.ts`), WCAG accessibility, and folder tree components.

---

## 1. Frontend Architecture

Implemented in `apps/web/src/lib/api-client.ts` and document page components:
- **Typed API Client**: Exposes typed methods for all enterprise features:
  - `listDocuments(params)`
  - `uploadDocument(workspaceId, file, path)`
  - `getFolderTree(workspaceId)`
  - `createFolder(workspaceId, name, parentId)`
  - `listVersions(documentId, workspaceId)`
  - `restoreVersion(documentId, versionNumber, workspaceId)`
  - `listShares(documentId, workspaceId)`
  - `createShare(documentId, workspaceId, targetWorkspaceId, permission, expiresAt)`
  - `bulkUpload(workspaceId, files)`
  - `bulkDownload(workspaceId, documentIds)`
- **Key Serialization**: `transformKeys()` handles bidirectional camelCase <-> snake_case translation.
- **CSRF Token Injection**: All mutating POST/PATCH/DELETE requests automatically attach `X-CSRF-Token` headers.

---

## 2. Verification Evidence

- `test_module05_frontend.py`:
  - `test_frontend_document_query_params_and_headers`: Validates `workspace_id` query param handling and CSRF headers.
  - `test_frontend_folder_tree_contract`: Validates folder tree node structure.
  - `test_frontend_bulk_upload_download_contract`: Validates bulk zip download response format.
