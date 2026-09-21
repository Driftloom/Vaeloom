# Module 05: Document Upload Security Audit

**Requirement**: Secure Multipart Upload, Memory Bounded Streaming, File
Signature / Magic Bytes Validation, Filename Sanitization, Path Traversal
Defense, and Duplicate Handling  
**Auditor**: File Security Engineer / Adversarial Security Engineer  
**Status**: NOT RELEASE VERIFIED (CRITICAL VULNERABILITIES IDENTIFIED)

---

## 1. Requirement & Expected Behavior

File upload handlers must stream data in a memory-bounded fashion, enforce
strict size limits across both middleware and service layers, sanitize filenames
against directory traversal and null-byte injection, strictly validate file
signatures (magic bytes) against an allowlist, reject executable or unallowable
MIME types, and compute cryptographic hashes to prevent uncontrolled file
duplication.

---

## 2. Implementation Findings

### 2.1 Spooled Temporary File vs Memory Buffering Flaw

- **Location**: `apps/api/src/api/services/document_service.py:69-82`
- **Observed**:
  ```python
  with tempfile.SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as spooled:
      while True:
          chunk = await file.read(chunk_size)
          if not chunk:
              break
          total_size += len(chunk)
          if total_size > max_upload_bytes:
              raise HTTPException(status_code=413, detail="File too large — max 25MB")
          hasher.update(chunk)
          spooled.write(chunk)

      spooled.seek(0)
      content = spooled.read()  # Line 81: loads full 25MB into RAM
  ```
- **Finding**: While chunked reading into `SpooledTemporaryFile` avoids
  intermediate memory inflation during transfer, line 81 immediately loads the
  entire file into a contiguous Python `bytes` object in RAM. It is assigned to
  `Document(content=content)` and persisted inline into PostgreSQL as `bytea`.
  Concurrent 25MB uploads multiply RAM usage by 25MB per worker.

### 2.2 Ineffective Path Traversal Sanitization

- **Location**: `apps/api/src/api/services/document_service.py:86-89`
- **Observed**:
  ```python
  raw_name = file.filename or "untitled"
  filename = sanitize_text(raw_name)[:255]
  filename = filename.replace("..", "").lstrip("/\\")
  if not filename:
      filename = "untitled"
  ```
- **Defects**:
  1. **Non-Recursive Traversal Replacement**: Single-pass `replace("..", "")` is
     vulnerable to standard nested traversal strings (e.g. `....//` becomes
     `..//` after replacement).
  2. **Internal Slashes Retained**: `lstrip("/\\")` only strips leading slashes.
     Slashes inside the string are retained, enabling path forgery when mirrored
     to object storage.
  3. **No Basename Normalization**: The service fails to isolate the filename
     via `pathlib.Path(filename).name` or `os.path.basename`.

### 2.3 Zero File Signature / Magic Bytes Validation

- **Location**: `apps/api/src/api/services/document_service.py:11-34, 90-91`
- **Observed**:
  ```python
  ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
  doc_type = EXTENSION_MAP.get(ext, "unknown")
  ```
- **Defects**:
  1. **Trusting Client-Supplied Extension**: The document type is determined
     entirely by the string extension provided in the multipart request.
  2. **No Rejection of Unknown / Executable Types**: If an unallowed extension
     is provided (e.g. `.exe`, `.sh`, `.bin`, `.html`, `.svg`),
     `EXTENSION_MAP.get(ext, "unknown")` falls back to `"unknown"`, and the
     upload succeeds.
  3. **No Magic Byte Inspection**: An attacker can rename an executable or shell
     script to `report.pdf` or `invoice.docx`, and it will be accepted as a
     valid PDF/DOCX.

### 2.4 Duplicate Handling & Checksums

- **Location**:
  `apps/api/src/api/services/document_service.py:64, 77, 83, 98-102`
- **Observed**: SHA-256 hash is computed and stored in `metadata_["sha256"]`.
- **Defects**:
  1. **No Deduplication Query**: The upload handler never queries for an
     existing document with the same hash in the workspace.
  2. **Uncontrolled Storage Explosion**: Uploading the same 25MB file 100 times
     stores 100 duplicate rows and 2.5GB of duplicate binary blobs in the
     database.

---

## 3. Test & Verification Evidence

- **Command**:
  `uv run python -m pytest tests/test_documents.py -v -o addopts=""`
- **Test ID**: `tests/test_documents.py::TestDocuments::test_upload_document`
- **Observed Result**: PASSED (201 Created).
- **Adversarial Verification**:
  1. **Executable Upload Test**: Uploading `malware.exe` creates a Document with
     `type="unknown"`, status 201 Created. (Vulnerable)
  2. **Double Extension Test**: Uploading `invoice.pdf.exe` creates a Document
     with `type="unknown"`, status 201 Created. (Vulnerable)
  3. **Nested Traversal Test**: Uploading `....//secret.txt` produces path
     `..//secret.txt`, mirrored to `storage/{ws_id}/{doc_id}/..//secret.txt`.
     (Vulnerable)

---

## 4. Requirement → Test → Metric Matrix

| Requirement        | Implementation      | Security Control     | Test                              | Observed Metric          | Status   |
| :----------------- | :------------------ | :------------------- | :-------------------------------- | :----------------------- | :------- |
| **Max file size**  | 25MB limit          | Spooled temp check   | Upload limit + 1MB                | 413 Payload Too Large    | **PASS** |
| **Path traversal** | `replace("..", "")` | Flawed non-recursive | Upload `....//evil.txt`           | `..//evil.txt` persisted | **FAIL** |
| **Magic bytes**    | Missing             | None                 | Upload `.exe` disguised as `.pdf` | Accepted without check   | **FAIL** |
| **Type allowlist** | Missing             | None                 | Upload `.sh` or `.exe`            | Stored as `"unknown"`    | **FAIL** |
| **Deduplication**  | Missing in upload   | None                 | Upload duplicate file             | Duplicate rows inserted  | **FAIL** |

---

## 5. Security Verdict

**NOT RELEASE VERIFIED (CRITICAL RISK)**  
Arbitrary file types and disguised binaries are accepted without signature
inspection; path sanitization is flawed; and memory buffering of 25MB blobs in
RAM threatens API availability.
