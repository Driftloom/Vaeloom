# Gate 25 — Chaos Engineering
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P0 | `apps/api/src/api/routers/documents.py:151` | Vector index Trigger.dev dispatch is wrapped in a disconnected `asyncio.create_task()` and `try-except pass`. If ingestion fails, it fails open, silently dropping the document from vector search. |
| 2 | P1 | `apps/api/src/api/services/document_service.py:166` | S3 object storage fallback is explicitly fail-open. Exceptions are caught and ignored, leaving a DB record with a `None` `raw_storage_key`. |

## Evidence
`documents.py`:
```python
        if is_trigger_enabled():
            import asyncio as _aio
            async def _start_trigger() -> None:
                try: ...
                except Exception as ex:
                    logger.warning(f"Trigger.dev document ingest dispatch failed: {ex}")
            _aio.create_task(_start_trigger())
    except Exception:
        pass
```
`document_service.py`:
```python
        try:
            if getattr(_settings, "storage_mirror_enabled", False):
                await storage_service.upload(storage_key, content)
                doc.raw_storage_key = storage_key
        except Exception as e:
            logger.warning("Object-storage upload failed (non-blocking): %s", e)
```

## Conclusion
The system fails to handle component outages gracefully. Vector indexing and object storage failures result in silent data corruption (orphaned records, missing embeddings) rather than failing closed with a 500/503 response.
