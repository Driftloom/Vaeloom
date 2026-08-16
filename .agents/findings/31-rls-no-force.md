# Finding: No FORCE ROW LEVEL SECURITY

| Metadata     | Value                                   |
| ------------ | --------------------------------------- |
| **ID**       | FIND-RLS-003                            |
| **Severity** | P1-HIGH                                 |
| **Status**   | OPEN                                    |
| **Source**   | RLS Audit                               |
| **File**     | `alembic/versions/0005_rls_expanded.py` |

## Description

The Alembic migration uses only `ENABLE ROW LEVEL SECURITY`:

```python
f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"
```

Per PostgreSQL docs, table owners bypass RLS unless `FORCE ROW LEVEL SECURITY`
is set. Since the application likely connects as the table owner (or a
superuser), RLS would be bypassed even if the policies were correct and the GUCs
were set.

## Impact

- RLS is ineffective if app connects as table owner
- Security control provides false sense of protection

## Remediation

Add `ALTER TABLE {table} FORCE ROW LEVEL SECURITY` after each
`ENABLE ROW LEVEL SECURITY`.
