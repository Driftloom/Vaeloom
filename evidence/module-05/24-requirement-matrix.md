# Module 05: Enterprise Requirement Traceability Matrix

**Module**: Module 05 — Workspace & Documents  
**Auditor**: Enterprise Security & Quality Assurance Architecture  
**Verification Date**: 2026-09-21  
**Status**: NOT RELEASE VERIFIED (CRITICAL GAPS & SECURITY DEFECTS)

---

## 1. Executive Summary

This requirement traceability matrix maps all **22 Core and Enterprise
requirements** of Module 05 against the actual codebase implementation in
`apps/api` and `apps/web`. Each requirement is audited across its specification,
implementation artifacts, automated test coverage, performance and security
metrics, evidence documentation, and formal compliance status.

### Summary Metrics

- **Total Requirements Audited**: 22
- **Fully Verified & Production Ready**: 1 (Workspace CRUD base, with caveats)
- **Partially Implemented (Significant Gaps)**: 8
- **Completely Missing / Unimplemented**: 7
- **Insecure / Compromised Implementation**: 6

---

## 2. Requirement Traceability Matrix

| Req #      | Requirement Name                       | Category   | Implementation Files & Lines                                                                                 | Test Coverage & Health                     | Observed Metrics / Flaws                                                                                                                                  | Evidence Reference                                             | Status                            |
| :--------- | :------------------------------------- | :--------- | :----------------------------------------------------------------------------------------------------------- | :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- | :-------------------------------- |
| **REQ-01** | Workspace CRUD                         | Core       | `routers/workspaces.py:31-105`<br>`services/workspace_service.py:27-142`                                     | `test_workspaces.py` (20 pass, 1 fail)     | Base CRUD works; connector endpoint crashes (`ImportError`); soft-delete cleans workspace_users; no `tenant_id` column in `workspaces`.                   | `01-workspace-security.md`<br>`21-regression.md`               | **FAIL** (Regression)             |
| **REQ-02** | Workspace Settings / Preferences       | Core       | `routers/workspaces.py:82-95`<br>`schemas/workspace.py:26-30`                                                | Covered in `test_workspaces.py`            | JSON `settings` column supports dictionary updates. Missing schema validation for enterprise policy flags.                                                | `01-workspace-security.md`                                     | **PARTIAL**                       |
| **REQ-03** | Document Upload                        | Core       | `routers/documents.py:84-124`<br>`services/document_service.py:44-84`<br>`services/storage_service.py:36-70` | Covered in `test_documents.py`             | 25MB RAM buffering (`await file.read()`); unvalidated MIME types; path traversal via absolute slash; cleartext S3 transport (`use_ssl=False`).            | `02-document-upload-security.md`<br>`03-storage-security.md`   | **INSECURE**                      |
| **REQ-04** | Document Listing                       | Core       | `routers/documents.py:65-81`<br>`services/document_service.py:86-101`                                        | Covered in `test_documents.py`             | Scoped by `workspace_id` and `deleted_at IS NULL`. Lacks server-side pagination (returns unpaginated arrays).                                             | `04-document-authorization.md`<br>`15-database-performance.md` | **PARTIAL**                       |
| **REQ-05** | Document Content Retrieval             | Core       | `routers/documents.py:175-201`<br>`services/document_service.py:103-125`                                     | `test_documents.py` (1 failed: 403 != 404) | **CRITICAL LOCKOUT**: `_verify_workspace_access` checks `Workspace.user_id == uid`, blocking all Workspace members. Stored XSS via inline HTML.           | `04-document-authorization.md`<br>`21-regression.md`           | **INSECURE / BROKEN**             |
| **REQ-06** | Document Archiving (Soft Delete)       | Core       | `routers/documents.py:127-141`<br>`services/document_service.py:127-146`                                     | Covered in `test_documents.py`             | Sets `deleted_at`. Creates `DocumentAction(action_type="archive")`. Lacks `actor_id` in audit row.                                                        | `04-document-authorization.md`<br>`23-audit-logging.md`        | **PARTIAL**                       |
| **REQ-07** | Document Restoration                   | Core       | `routers/documents.py:144-157`<br>`services/document_service.py:148-167`                                     | Covered in `test_documents.py`             | Clears `deleted_at`. Creates `DocumentAction(action_type="restore")`. No permission check beyond owner.                                                   | `04-document-authorization.md`<br>`23-audit-logging.md`        | **PARTIAL**                       |
| **REQ-08** | Document Action History                | Core       | `routers/documents.py:160-172`<br>`models/schema.py:312-327`                                                 | Covered in `test_documents.py`             | Lists `DocumentAction` records. Schema completely lacks `actor_id`, `user_id`, or `tenant_id`. Non-repudiation impossible.                                | `23-audit-logging.md`                                          | **INSECURE**                      |
| **REQ-09** | Document Action Undo                   | Core       | `routers/documents.py:204-222`<br>`services/document_service.py:203-241`                                     | Covered in `test_documents.py`             | State machine does not verify intervening mutations; can clobber subsequent renames or deletes. No concurrency lock.                                      | `19-concurrency.md`                                            | **PARTIAL / UNSTABLE**            |
| **REQ-10** | Document Metadata PATCH                | Core       | `routers/documents.py:127-141`<br>`services/document_service.py:169-201`                                     | Covered in `test_documents.py`             | Only supports updating `path` (rename). Cannot update tags, descriptions, custom metadata, or MIME overrides.                                             | `02-document-upload-security.md`                               | **PARTIAL**                       |
| **REQ-11** | Folder / Directory Structure           | Enterprise | **NONE** (`schema.py` has no `folders` table)                                                                | **0 tests**                                | Simulated entirely by string splitting on `/` in frontend. No folder ACLs, no folder move, no folder deletion cascade.                                    | `05-folder-security.md`                                        | **NOT IMPLEMENTED**               |
| **REQ-12** | Document Versioning                    | Enterprise | `models/schema.py:292-310`<br>`ingestion/pipeline.py:84-118`                                                 | Ingestion pipeline tests only              | Schema has `DocumentVersion`, but `routers/documents.py` exposes **ZERO** version endpoints. Unreachable from API/UI. Race condition on `version_number`. | `06-versioning.md`<br>`19-concurrency.md`                      | **NOT IMPLEMENTED** (Dead Schema) |
| **REQ-13** | File-Type Allowlist                    | Enterprise | `routers/documents.py:91-94`                                                                                 | No negative test for malicious MIME        | Client-supplied `file.content_type` accepted without inspection. Zero magic byte inspection (libmagic/puremagic missing). Executables accepted.           | `02-document-upload-security.md`<br>`09-malware-scanning.md`   | **INSECURE**                      |
| **REQ-14** | Maximum File-Size Enforcement          | Enterprise | `middleware/body_size_limit.py`<br>`routers/documents.py:95`                                                 | Covered in middleware tests                | Middleware aborts stream at 25MB, but router buffers entire 25MB into RAM with `await file.read()`. High OOM risk under concurrency.                      | `02-document-upload-security.md`<br>`16-api-performance.md`    | **PARTIAL**                       |
| **REQ-15** | Document Sharing Between Workspaces    | Enterprise | `ingestion/dedup.py:42-56`                                                                                   | **0 sharing tests**                        | No explicit sharing ACLs. Naive cross-tenant deduplication causes **Cross-Tenant Document Hijacking** when content hashes match.                          | `07-sharing-security.md`                                       | **INSECURE / CRITICAL VULN**      |
| **REQ-16** | Document Expiration Policies           | Enterprise | **NONE** (`models/schema.py` has no `expires_at`)                                                            | `services/retention.py`                    | `Document` model lacks expiration timestamp. `retention.py` explicitly rejects `documents` table (`ValueError`).                                          | `08-expiration.md`                                             | **NOT IMPLEMENTED**               |
| **REQ-17** | Virus & Malware Scanning               | Enterprise | **NONE**                                                                                                     | **0 tests**                                | Zero ClamAV, ICAP, or AWS GuardDuty integration. EICAR test string accepted with HTTP 201 and stored in S3.                                               | `09-malware-scanning.md`                                       | **NOT IMPLEMENTED / HAZARD**      |
| **REQ-18** | OCR for Scanned Documents              | Enterprise | `temporal/activities.py:parse_document`<br>`ingestion/parsers.py:155-195`                                    | Disconnected unit tests                    | OCR parser (`parsers.py`) exists in isolation but is completely bypassed by Temporal activity stub. Raw binary `%PDF...` fed to LLM prompt.               | `10-ocr.md`                                                    | **NOT IMPLEMENTED / BROKEN**      |
| **REQ-19** | Full-Text Document Search              | Enterprise | `alembic/versions/0026_tsvector_documents.py`<br>`routers/documents.py`                                      | **0 search tests**                         | TSVector column exists in Postgres but is never updated or queried by API. Algolia search tool lacks workspace filtering.                                 | `11-search.md`                                                 | **NOT IMPLEMENTED / LEAK**        |
| **REQ-20** | Bulk Upload                            | Enterprise | Frontend `files/page.tsx:495, 514`                                                                           | **0 backend bulk tests**                   | No backend batch upload API (`POST /documents/bulk`). Frontend drag-and-drop silently drops all files after `files[0]` with no user error.                | `14-bulk-operations.md`<br>`18-ui-ux.md`                       | **NOT IMPLEMENTED / DATA LOSS**   |
| **REQ-21** | Bulk Download                          | Enterprise | **NONE**                                                                                                     | **0 tests**                                | No ZIP archiving service or batch download endpoint (`POST /documents/bulk-download`). Users must download files one by one.                              | `14-bulk-operations.md`                                        | **NOT IMPLEMENTED**               |
| **REQ-22** | Vector RAG & Agent Grounding Isolation | Enterprise | `agents/document_agent/handler.py`<br>`agents/workspace_agent/handler.py`                                    | Mock tests only                            | Agents return hardcoded mock citations (`doc_arch_01`, `doc_dr_01`) without querying DB. Soft-deleted documents leak into embeddings.                     | `12-vector-rag-security.md`<br>`13-agent-boundary.md`          | **INSECURE / FABRICATED**         |

---

## 3. Requirement Status Distribution

```
================================================================================
REQUIREMENT STATUS DISTRIBUTION (22 TOTAL REQUIREMENTS)
================================================================================
Verified & Production Ready :  1  ( 4.5%)  [REQ-01 Base]
Partially Implemented       :  8  (36.4%)  [REQ-02, 04, 06, 07, 09, 10, 14, 18]
Completely Missing          :  7  (31.8%)  [REQ-11, 12, 16, 17, 19, 20, 21]
Insecure / Critical Defect  :  6  (27.3%)  [REQ-03, 05, 08, 13, 15, 22]
================================================================================
OVERALL COMPLIANCE SCORE    : 18.2% (Pass Rate)
================================================================================
```

---

## 4. Requirement Verification Sign-off

- **Audit Sign-off**: Rejected for Enterprise Release.
- **Root Blockers**:
  1. `REQ-05`: Non-owner members locked out from accessing document content.
  2. `REQ-15`: Cross-tenant document hijacking vulnerability via global content
     hash deduplication.
  3. `REQ-01`: Unhandled `ImportError` on workspace connector listing endpoint.
  4. `REQ-17` & `REQ-13`: Complete absence of malware scanning and MIME type
     verification.
  5. `REQ-11`, `REQ-12`, `REQ-19`, `REQ-20`, `REQ-21`: Enterprise-tier features
     (folders, versions, full-text search, bulk upload/download) are absent or
     dead code.
