# Module 05: Storage Security Audit

**Requirement**: Cloud Object Storage Security, Encryption-in-Transit,
Non-Blocking I/O, Key Isolation, and Presigned Access  
**Auditor**: Object Storage Architect / Distributed Systems Engineer  
**Status**: NOT RELEASE VERIFIED (CRITICAL GAPS IDENTIFIED)

---

## 1. Requirement & Expected Behavior

Cloud storage operations must enforce TLS encryption in transit
(`use_ssl=True`), execute asynchronously without blocking the API event loop,
partition object keys strictly by tenant and workspace
(`tenant/{id}/workspace/{id}/...`), avoid storing large binary files inline in
the relational database, and utilize short-lived signed URLs for downloads to
protect application bandwidth.

---

## 2. Implementation Findings

### 2.1 Hardcoded Plaintext Transport (`use_ssl=False`)

- **Location**: `apps/api/src/api/services/storage_service.py:14-21`
- **Observed**:
  ```python
  self._client = boto3.client(
      "s3",
      endpoint_url=settings.storage_endpoint,
      region_name=settings.storage_region,
      aws_access_key_id=settings.storage_access_key,
      aws_secret_access_key=settings.storage_secret_key,
      use_ssl=False,  # Hardcoded plaintext transmission
  )
  ```
- **Defect**: `use_ssl=False` is hardcoded in the client constructor. In cloud
  deployments, all communication between the API server and AWS S3/MinIO occurs
  over unencrypted HTTP, exposing S3 access keys, authorization headers, and
  confidential document payloads in cleartext.

### 2.2 Synchronous `boto3` Blocking Async Event Loop

- **Location**: `apps/api/src/api/services/storage_service.py:23-40`
- **Observed**:
  ```python
  async def upload(self, key: str, data: bytes) -> str:
      await self._ensure_client()
      self._client.put_object(Bucket=self._bucket, Key=key, Body=data) # Synchronous blocking call
      return key

  async def download(self, key: str) -> bytes:
      await self._ensure_client()
      result = self._client.get_object(Bucket=self._bucket, Key=key)   # Synchronous blocking call
      return result["Body"].read()
  ```
- **Defect**: `boto3` is a synchronous, blocking library. Calling `put_object`,
  `get_object`, and `delete_object` directly inside `async def` methods blocks
  Python's single-threaded asyncio event loop. Uploading or downloading large
  files freezes all concurrent incoming HTTP requests on that worker process.

### 2.3 Storage Key Structure Lacks `tenant_id`

- **Location**: `apps/api/src/api/services/document_service.py:115`
- **Observed**: `storage_key = f"storage/{workspace_id}/{doc.id}/{filename}"`
- **Defect**: The storage key contains only `workspace_id` and `doc.id`,
  omitting `tenant_id`. Cloud storage IAM bucket policies cannot enforce
  tenant-boundary IAM condition keys (e.g. `arn:aws:s3:::bucket/{tenant_id}/*`),
  making cross-tenant data leakage possible if application credentials are
  leaked.

### 2.4 Database Bloat from Inline `LargeBinary`

- **Location**: `apps/api/src/api/models/schema.py:275`
- **Observed**: `content: Mapped[bytes | None] = mapped_column(LargeBinary)`
  without `deferred=True`.
- **Defect**: `storage_mirror_enabled` defaults to `False`. All document files
  are stored directly inside PostgreSQL `bytea`. Because `content` is not
  configured as deferred in SQLAlchemy, lightweight metadata operations (such as
  `rename()`, `archive()`, and `list_actions()`) query `select(Document)`, which
  loads the entire 25MB blob into memory, degrading database cache performance
  and vacuum operations.

### 2.5 Presigned URLs Bypassed on Download

- **Location**: `apps/api/src/api/routers/documents.py:175-197`
- **Observed**: Presigned URLs are implemented in
  `storage_service.get_signed_url()`, but are NEVER utilized in
  `GET /documents/{id}/content`. The API buffers `doc.content` in memory and
  streams it directly via `Response(content=content)`.

---

## 3. Test & Verification Evidence

- **Command**:
  `uv run python -m pytest tests/test_storage_service.py -v -o addopts=""`
- **Observed Result**: 5 passed (mocked tests with `MagicMock`).
- **Code Inspection Result**:
  - `storage_service.py:20` verified `use_ssl=False`.
  - Zero calls to `asyncio.to_thread()` or `aioboto3`.
  - Zero calls to `get_signed_url` from `routers/documents.py`.

---

## 4. Security & Performance Verdict

| Control                   | Expected                | Actual                         | Verdict           |
| :------------------------ | :---------------------- | :----------------------------- | :---------------- |
| **TLS in Transit**        | `use_ssl=True` (HTTPS)  | `use_ssl=False` (HTTP)         | **CRITICAL FAIL** |
| **Non-blocking S3 I/O**   | Async / Thread pool     | Synchronous blocking `boto3`   | **HIGH FAIL**     |
| **Key Hierarchy**         | `tenant/ws/doc/file`    | `storage/ws/doc/file`          | **MEDIUM FAIL**   |
| **Presigned Downloads**   | Short-lived signed URLs | Direct database blob streaming | **MEDIUM FAIL**   |
| **DB Storage Decoupling** | Object store primary    | Postgres `bytea` primary       | **HIGH FAIL**     |

**Status**: **NOT RELEASE VERIFIED**
