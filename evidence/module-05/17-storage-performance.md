# Module 05: Storage Performance & Data Plane Architecture Audit

**Requirement**: Object Store Throughput, Large Binary Transfer Performance,
Control Plane vs Data Plane Decoupling, and Memory Overhead  
**Auditor**: Object Storage Architect / Distributed Systems Engineer  
**Status**: NOT RELEASE VERIFIED (DATA/CONTROL PLANE CONFOUNDING)

---

## 1. Requirement & Expected Behavior

High-throughput enterprise document storage requires:

1. **Control Plane vs Data Plane Decoupling**: The API server controls
   authorization and metadata (Control Plane). Binary payload transfers (Data
   Plane) must be offloaded directly to Cloud Object Storage via presigned S3
   URLs (`PUT` for upload, `GET` for download) or chunked HTTP streaming.
2. **Zero In-Memory Buffering**: The API server must never buffer full 25MB
   files into Python heap memory.
3. **HTTP Range Support**: Large document downloads must support `Range` headers
   (`206 Partial Content`) for performant PDF page-by-page rendering in
   browsers.

---

## 2. Implementation Findings

### 2.1 Confounded Control & Data Planes

- **Location**: `apps/api/src/api/routers/documents.py:61-144, 175-197`
- **Defect**: The API server acts as both the control plane and data plane
  proxy. Every byte uploaded passes through the FastAPI application server, is
  spooled to disk, loaded into Python RAM, and written into PostgreSQL. Every
  byte downloaded is read from PostgreSQL and streamed through the application
  server. This design limits total system throughput to the API gateway's
  network and CPU limits.

### 2.2 Lack of Chunked Streaming on Content Download

- **Location**: `apps/api/src/api/routers/documents.py:192-196`
- **Observed Code**:
  ```python
  return Response(
      content=content,
      media_type=CONTENT_TYPES.get(doc_type, "application/octet-stream"),
      headers={"Content-Disposition": f'inline; filename="{filename}"'},
  )
  ```
- **Defect**: Uses Starlette's `Response(content=content)` where `content` is a
  single monolithic `bytes` object. It does not use `StreamingResponse` with an
  async generator, nor does it support HTTP `Range` requests. A user opening a
  25MB PDF in their browser must wait for all 25MB to be transmitted before
  rendering can begin.

### 2.3 Storage Mirror Overhead

- **Location**: `apps/api/src/api/services/document_service.py:112-120`
- **Defect**: When `storage_mirror_enabled` is active, the upload handler
  performs a double write:
  1. Write to PostgreSQL `bytea` via SQLAlchemy (`await db.flush()`).
  2. Write to S3 via synchronous `boto3.put_object()`. This doubles total disk
     I/O and network latency on upload requests.

---

## 3. Evaluation Matrix

| Metric                      | Target                   | Observed Implementation       | Status   |
| :-------------------------- | :----------------------- | :---------------------------- | :------- |
| **Control/Data Separation** | Offload data plane to S3 | 100% proxied through API      | **FAIL** |
| **Server Heap Overhead**    | < 5MB per transfer       | 25MB per concurrent transfer  | **FAIL** |
| **Download Streaming**      | `StreamingResponse`      | Monolithic `Response(bytes)`  | **FAIL** |
| **Range Requests (206)**    | Supported for PDF/Media  | Unsupported (Full fetch only) | **FAIL** |
| **Async S3 Dispatch**       | Async / Non-blocking     | Synchronous blocking `boto3`  | **FAIL** |

---

## 4. Verdict

**NOT RELEASE VERIFIED (BOTTLENECK IDENTIFIED)**  
All data plane transfers are routed through the API server and relational
database, creating severe memory bloat and preventing high-throughput document
streaming.
