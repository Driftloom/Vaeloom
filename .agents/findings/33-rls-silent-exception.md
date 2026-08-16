# Finding: Silent Exception Swallowing in set_rls_session_vars

| Metadata     | Value                                         |
| ------------ | --------------------------------------------- |
| **ID**       | FIND-RLS-005                                  |
| **Severity** | P2-MEDIUM                                     |
| **Status**   | OPEN                                          |
| **Source**   | RLS Audit                                     |
| **File**     | `apps/api/src/api/middleware/tenant.py:58-59` |

## Description

The `set_rls_session_vars()` function catches all exceptions and passes
silently:

```python
except Exception:
    pass  # SQLite or non-PostgreSQL — ignore
```

If the `SET` command fails for any reason (wrong role, missing permission,
connection pool issue), the failure is invisible. No logging, no alerting, no
metric.

## Impact

- RLS failures are invisible
- Security control degrades silently
- No operational visibility into tenant isolation health

## Remediation

Replace `pass` with logging:

```python
except Exception as e:
    logger.debug(f"RLS GUC set skipped (likely SQLite): {e}")
```
