"""Strict statement execution for migrations.

Why this module exists
----------------------
Sixteen migrations between `0033` and `0056` each carry their own private copy of
a savepoint helper that swallows any error and `print`s a line. Measured on a
fresh PostgreSQL 16 database, those copies silently skipped 28 statements and the
migration run still reported `exit 0`.

That is not a cosmetic problem. It is the direct cause of four separate defects
found in the 2026-09 audit:

* `webhooks` / `webhook_deliveries` were never created, while eight migrations
  applied RLS policies to them - every one skipped
* `document_actions` was created by `0048`, *after* `0028`/`0036` had already
  applied policies to it, so it ended up with no RLS and no policies at all
* `0057` could not apply, and the failure was buried in a log line
* the undeclared pgvector dependency surfaced only by accident

The legacy copies are left in place rather than rewritten, because they are not
uniform - some run on SQLite, some return early on it - and editing sixteen
already-applied migrations is a far larger risk than the problem it solves.

What replaces them
------------------
1. This module, for every new migration. It distinguishes the one failure mode
   that is genuinely expected - a *forward* reference to a table a later
   migration creates - from every other error, and re-raises the rest.
2. `0060_verify_rls_coverage.py`, which asserts at the end of the chain that
   every table actually has RLS and a policy. That converts "a skip nobody
   noticed" into "the deploy fails", regardless of which migration did the
   skipping.

Expected-forward-reference
--------------------------
`UndefinedTableError` on a `relation does not exist` message is tolerated, because
the chain is not ordered so that every table exists before the migrations that
secure it run. It is still recorded, and `0060` is what guarantees the table ends
up covered. Any other error - a syntax error, a missing function, a permission
problem, a duplicate object - is raised, because there is no benign reading of it.
"""

from __future__ import annotations

import logging

import sqlalchemy as sa

logger = logging.getLogger("alembic.strict")

# Migration id -> list of (statement, reason) for tolerated forward references.
# Reported by 0060 and by the CI invariant tests, never silently discarded.
TOLERATED_SKIPS: dict[str, list[tuple[str, str]]] = {}


def _is_forward_reference(exc: Exception) -> bool:
    """True only for a missing relation, the one legitimately expected failure.

    Classified on the message rather than the exception class, because the driver
    differs between environments: asyncpg raises `UndefinedTableError`, psycopg
    raises `ProgrammingError` or `UndefinedTable`, and SQLite raises
    `OperationalError`. Gating on the class name meant the same forward
    reference was fatal under one driver and tolerated under another.

    The message is still specific - it has to name a missing relation or table -
    so a syntax error, a missing function or a permission problem is never
    mistaken for an expected skip.
    """
    text = str(exc).lower()
    if "does not exist" not in text and "undefinedtable" not in text:
        return False
    return "relation" in text or "table" in text or "undefinedtable" in text


def strict_exec(migration_id: str, conn, sql: str, *, context: str = "") -> bool:
    """Run one statement in its own savepoint. Returns True if it applied.

    On failure the savepoint is rolled back so one bad statement cannot poison the
    rest of the migration, and then:

    * a missing relation is recorded in `TOLERATED_SKIPS` and logged at WARNING,
      because the chain legitimately references tables created later
    * anything else is re-raised, so the migration and the deploy fail

    `context` should name what the statement is for (e.g. "RLS policy on
    documents") so a tolerated skip is traceable without re-reading the SQL.
    """
    is_pg = conn.dialect.name == "postgresql"
    if not is_pg:
        conn.execute(sa.text(sql))
        return True

    savepoint = f"sp_strict_{migration_id}"
    conn.execute(sa.text(f"SAVEPOINT {savepoint}"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text(f"RELEASE SAVEPOINT {savepoint}"))
        return True
    except Exception as exc:
        conn.execute(sa.text(f"ROLLBACK TO SAVEPOINT {savepoint}"))
        if _is_forward_reference(exc):
            TOLERATED_SKIPS.setdefault(migration_id, []).append((sql[:200], str(exc)[:200]))
            logger.warning(
                "[%s] tolerated forward reference%s: %s",
                migration_id,
                f" ({context})" if context else "",
                exc,
            )
            return False
        logger.error(
            "[%s] statement FAILED and is not being tolerated%s: %s\nSQL: %s",
            migration_id,
            f" ({context})" if context else "",
            exc,
            sql[:400],
        )
        raise


def tolerated_skip_count() -> int:
    return sum(len(v) for v in TOLERATED_SKIPS.values())
