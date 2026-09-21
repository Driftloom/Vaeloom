# Gate 26 — Concurrency
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P1 | `apps/api/src/api/services/document_service.py:386` | Versioning relies on an unsafe `MAX(version_number) + 1` query pattern without catching `IntegrityError`. Concurrent uploads cause 500 server crashes. |
| 2 | P2 | `apps/api/src/api/services/document_service.py:722` | `bulk_upload` processes files iteratively in a blocking `for f in files:` loop instead of using `asyncio.gather`, causing severe latency. |

## Evidence
`document_service.py` (Lines 386-389):
```python
        latest_v_stmt = select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == doc.id
        )
        latest_num = (await db.execute(latest_v_stmt)).scalar_one_or_none() or 0
        new_version_num = latest_num + 1
```
If two requests execute this simultaneously, they both get the same `new_version_num`. The schema defines `UniqueConstraint("document_id", "version_number")`, which will cause a fatal database `IntegrityError` instead of gracefully resolving the race condition.

## Conclusion
Document versioning is not thread-safe. Concurrent edits to the same document will crash the API rather than recovering or sequencing the versions correctly.
