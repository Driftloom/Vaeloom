# Module 05: Closure Verification 2.0 — Storage Runtime Proof & S3 Mirroring

**Audit Date:** 2026-09-22  
**Target Module:** Document Storage & Blob Mirroring  
**Standard:** Zero-Trust Enterprise Forensics  
**Status:** PROVEN (Dual Engine: S3 Offload + LargeBinary DB Fallback)

---

## 1. Executive Summary

Document contents in Vaeloom follow an enterprise dual-storage strategy:

1. **Metadata & Small Documents ($<1\text{MB}$)**: Stored inline within
   PostgreSQL `documents.content` (`LargeBinary`) for atomic transactional
   rollbacks and instant snapshotting.
2. **Large Assets & Historical Versions ($>1\text{MB}$)**: Automatically
   offloaded to Object Storage (MinIO / S3) under tenant-partitioned object keys
   `storage/{workspace_id}/{document_id}/{filename}` with an immutable SHA-256
   integrity checksum.

```text
========================================================================================
Storage Mechanism        Key Path Pattern                                 Integrity Hash
========================================================================================
Primary MinIO S3 Bucket  vaeloom-test-bucket/storage/{ws_id}/{id}/{file}  SHA-256 (64 hex)
Inline Database Mirror   documents.content (LargeBinary)                  Byte-for-byte exact
Presigned Download URLs  Direct S3 GET (TTL: 300s)                        Signed SigV4
Local Filesystem Spool   ./storage/{ws_id}/                               Fallback on S3 Error
----------------------------------------------------------------------------------------
```

---

## 2. Automated Storage Tests (`test_documents.py` & `test_version_locking.py`)

1. **`test_large_file_s3_offloading_and_retrieval`**:
   - Generates a synthetic 2MB PDF document.
   - Uploads via `DocumentService.upload()`.
   - Proves that `document.storage_key` is populated with the S3 URI and
     `document.size_bytes == 2097152`.
   - Retrieves content via `DocumentService.get_content()` and verifies
     byte-for-byte fidelity against the original upload.
2. **`test_upload_stores_content_and_fetches_it`**:
   - Uploads standard test document (`"hello world"` bytes).
   - Verifies HTTP 200 response on `GET /documents/{id}/content` with headers:
     - `Content-Disposition: inline; filename="test.txt"`
     - `Content-Type: text/plain; charset=utf-8`
3. **`test_mirror_failure_still_uploads`**:
   - Simulates S3 network failure during upload.
   - Proves fail-open resilience: Document upload succeeds via PostgreSQL
     LargeBinary storage without dropping the user's file.
