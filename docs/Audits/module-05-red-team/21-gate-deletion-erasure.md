# Gate 21 — Deletion/GDPR Erasure

## Verdict: PARTIAL

## Findings
| ID | Severity | File:Line | Description |
|---|---|---|---|
| 1 | P1 | `apps/api/src/api/services/erasure_service.py:79` | S3 object deletion swallows exceptions (`except Exception: pass`). If S3 is unreachable, the DB rows will be deleted but the files will be silently orphaned, violating GDPR erasure requirements. |
| 2 | P2 | `apps/api/tests/test_module05_deletion.py:11` | The test `test_erasure_service_cascade_receipt` mocks the database heavily and does not actually verify that data is completely unrecoverable across all stores. |

## Evidence
- In `ErasureService`, S3 deletion is wrapped in:
  ```python
  try:
      await storage_service.delete(row[0])
  except Exception:
      pass
  ```
- The test suite merely checks if a receipt is returned and asserts `mock_db.execute.call_count >= 5`. It does not perform a real integration test to prove data erasure.

## Conclusion
While the `ErasureService` attempts to cascade deletes to all stores, its silent failure on S3 deletion and lack of real integration tests means the GDPR erasure guarantee is flawed.
