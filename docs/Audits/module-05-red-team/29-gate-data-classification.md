# Gate 29 — Data Classification
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P0 | `apps/api/src/api/services/file_security_service.py:87` | No PII scrubbing or secret redaction is performed on actual uploaded document content. |
| 2 | P1 | `apps/api/src/api/services/file_security_service.py:210` | HTML and SVG files are explicitly allowed, posing a severe XSS risk when combined with the frontend viewer. |

## Evidence
While `test_module05_privacy.py` claims to verify secret scrubbing, it actually only tests `api.temporal.validation.validate_no_secrets` and `api.logging._redact`. These functions strictly apply to JSON payloads sent to Temporal workflow histories and logger outputs.

The `document_service.upload()` method passes the raw `content` directly into the database:
```python
        # 3. Server-side file verification (magic bytes, executable rejection, malware scan)
        verdict = file_security_service.inspect_file(
            filename=filename,
            content=content,
            declared_mime=getattr(file, "content_type", None),
        )
```
No masking is applied before `doc = Document(..., content=content)`.

## Conclusion
The assertion that sensitive data is scrubbed before storage is false. PII and secrets inside uploaded files (e.g., passwords in CSVs or PDFs) are saved in plaintext to the database and vector index.
