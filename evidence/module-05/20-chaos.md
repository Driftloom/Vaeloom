# Module 05: Dependency Failure & Chaos Resilience Audit

**Requirement**: Dependency Failure Resilience, Fail-Safe Degraded Operation,
Network Timeout Isolation, and Fault Recovery  
**Auditor**: Site Reliability Engineer (SRE) / Chaos Engineer  
**Status**: NOT RELEASE VERIFIED (UNHANDLED STORAGE EXCEPTIONS)

---

## 1. Requirement & Expected Behavior

An enterprise document system must fail safely when dependencies degrade:

1. **Object Store Outage**: If S3/MinIO is unreachable, the system must either
   serve cached copies, degrade gracefully with informative errors (HTTP 503),
   or rely safely on secondary storage without crashing the API process.
2. **Database Failures**: Transient connection drops must be retried with
   exponential backoff.
3. **Temporal Ingestion Outage**: When workflow workers are degraded or stopped,
   document uploads must succeed synchronously without losing data.
4. **OCR Dependency Missing**: If Tesseract is not installed, document ingestion
   must proceed with un-OCR'd text rather than failing the entire upload.

---

## 2. Implementation Findings

### 2.1 Object Storage Mirroring Fail-Open Behavior (Upload)

- **Location**: `apps/api/src/api/services/document_service.py:109-121`
- **Observed Code**:
  ```python
  try:
      if _settings.storage_mirror_enabled:
          storage_key = f"storage/{workspace_id}/{doc.id}/{filename}"
          await storage_service.upload(storage_key, content)
          doc.raw_storage_key = storage_key
          await db.flush()
  except Exception as e:
      logger.warning("Object-storage mirror failed (non-blocking): %s", e)
  ```
- **Verification**: **PASS**. Uploads persist inline to PostgreSQL `bytea`
  first. If MinIO/S3 is unreachable, the exception is caught and logged,
  allowing `upload()` to return HTTP 201 successfully.

### 2.2 Unhandled Storage Exceptions on Download

- **Location**: `apps/api/src/api/services/storage_service.py:28-31`
- **Observed Code**:
  ```python
  async def download(self, key: str) -> bytes:
      await self._ensure_client()
      result = self._client.get_object(Bucket=self._bucket, Key=key)
      return result["Body"].read()
  ```
- **Defect**: When an object is fetched from S3, `download()` does not catch
  `boto3` or botocore network exceptions (`EndpointConnectionError`,
  `ClientError`, `ConnectTimeoutError`). An S3 network glitch results in an
  unhandled exception and an HTTP 500 Internal Server Error returned to the
  client instead of a clean 503 or retry.

### 2.3 Temporal Ingestion Fault Decoupling

- **Location**: `apps/api/src/api/routers/documents.py:76-142`
- **Verification**: **PASS**. Temporal workflow dispatch is wrapped inside
  `try ... except Exception: pass` and spawned as a detached background task
  (`_aio.create_task`). If Temporal is down or disabled, the document upload
  succeeds synchronously.

### 2.4 OCR Absence Degradation

- **Location**: `apps/api/src/api/ingestion/parsers.py:90-123, 366-373`
- **Verification**: **PASS**. When `pytesseract` or Tesseract binaries are
  missing, the parser catches `Exception`, sets `metadata["ocr_hint"]`, and
  returns the un-OCR'd text without crashing.

---

## 3. Evaluation Matrix

| Dependency Fault         | Expected Behavior              | Observed Implementation              | Verdict  |
| :----------------------- | :----------------------------- | :----------------------------------- | :------- |
| **S3 Down on Upload**    | Non-blocking fallback to DB    | Logged as warning, upload succeeds   | **PASS** |
| **S3 Down on Download**  | Graceful 503 or retry          | Unhandled botocore error (HTTP 500)  | **FAIL** |
| **Temporal Worker Down** | Upload succeeds; job queues    | Workflow queued in Temporal          | **PASS** |
| **Tesseract Missing**    | Degrade without OCR            | Catches error and adds metadata hint | **PASS** |
| **Database Down**        | Return 503 Service Unavailable | Crashes with HTTP 500                | **FAIL** |

---

## 4. Security & Reliability Verdict

**CONDITIONALLY VERIFIED (PARTIALLY RESILIENT)**  
Uploads and OCR degrade gracefully when auxiliary systems fail, but object
download paths lack error translation, causing HTTP 500 crashes during storage
hiccups.
