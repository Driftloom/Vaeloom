# Gate 27 — Security Boundary Matrix
## Verdict: FAIL
## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P0 | `apps/api/src/api/services/document_service.py:247` | Privilege Escalation: Action methods (`rename`, `archive`, `restore`) retrieve documents using `get_document`, which grants access based on *any* active `DocumentShare`. The system fails to verify if the share permission is `read` vs `read_write`, allowing a read-only guest to rename or archive the file. |
| 2 | P1 | `apps/api/src/api/middleware/tenant.py:71` | RLS isolation uses a blanket `try/except Exception: pass` when setting PostgreSQL GUCs, allowing requests to silently bypass row-level security if the query fails. |

## Evidence
`document_service.py` (Line 234):
```python
            share = (await db.execute(share_stmt)).scalar_one_or_none()
            if share:
                # Return document from source workspace if active share
                shared_doc_res = await db.execute(select(Document).where(Document.id == doc_id))
```
`get_document` does not check `share.permission`. 

Then in `rename` (Line 256):
```python
        doc = await self.get_document(document_id, workspace_id, db)
        old_path = doc.path
        clean_path = file_security_service.sanitize_filename(new_path)
        ...
        doc.path = clean_path
```
A viewer from another workspace can mutate the core document because authorization boundaries are bypassed.

## Conclusion
Workspace boundaries are fatally breached via the sharing mechanism. A "read-only" share grants full mutation capabilities on the source document, completely violating the zero-trust architecture.
