# Finding: Alembic Migration References Non-Existent Columns

| Metadata     | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| **ID**       | FIND-RLS-002                                                             |
| **Severity** | P0-CRITICAL                                                              |
| **Status**   | RESOLVED (verified 2026-08-28 — superseded by 0013/0019/0020; RLS 42/42) |
| **Source**   | RLS Audit                                                                |
| **File**     | `alembic/versions/0005_rls_expanded.py`                                  |

## Description

The Alembic RLS migration (`0005_rls_expanded.py`) creates policies referencing
both `workspace_id` AND `tenant_id` on every table in `SCOPED_TABLES`. But many
tables don't have both columns:

| Table            | Has `tenant_id`? | Has `workspace_id`? | Policy works? |
| ---------------- | ---------------- | ------------------- | ------------- |
| `events`         | YES              | **NO**              | FAILS         |
| `api_keys`       | YES              | **NO**              | FAILS         |
| `usage_records`  | YES              | **NO**              | FAILS         |
| `subscriptions`  | YES              | **NO**              | FAILS         |
| `auth_sessions`  | **NO**           | **NO**              | FAILS         |
| `embeddings`     | **NO**           | YES                 | FAILS         |
| `memory_records` | **NO**           | YES                 | FAILS         |
| `resumes`        | **NO**           | YES                 | FAILS         |

## Impact

- Alembic migration almost certainly fails on PostgreSQL
- Exception is caught silently at `main.py:88`
- Falls back to custom runner which only covers 4 tables

## Remediation

Create per-table policies matching actual column presence. Use a policy factory
that checks which columns exist.
