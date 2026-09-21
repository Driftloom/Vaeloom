# Module 05: Object Storage Architecture & S3 Key Partitioning
**Audit Identifier**: `AUD-M05-AI-07`
**Scope**: S3/MinIO key naming conventions, TLS encryption in transit, non-blocking I/O, and presigned access.

---

## 1. Storage Key Structure

Objects are stored in S3/MinIO using hierarchical, workspace-isolated prefixes:
```
storage/{workspace_id}/{document_id}/{filename}
```
Or for version snapshots:
```
storage/{workspace_id}/{document_id}/versions/{version_number}_{filename}
```

### Critical Security Properties:
- **No Global Flat Namespace**: Prevents directory traversal and unintentional key collisions.
- **Bucket-Level Isolation**: Workspace ID prefix allows applying S3 bucket policies or prefix-based IAM restrictions per enterprise customer.
- **TLS 1.3 Enforcement**: `StorageService` connects to object storage over HTTPS with TLS 1.3 encryption in transit.

---

## 2. Asynchronous Non-Blocking I/O

`StorageService` uses `asyncio.to_thread` or native `aioboto3` wrappers to ensure that file upload, streaming, and deletion do not block FastAPI's async event loop.

---

## 3. Verification Evidence

- `test_module05_storage.py`:
  - `test_storage_key_isolation_and_tls`: Confirms storage keys contain workspace ID prefix and enforce TLS.
  - `test_storage_service_non_blocking_io`: Verifies async non-blocking method signatures for `upload`, `download`, and `delete`.
