"""FORCE ROW LEVEL SECURITY across all public schema tables (0066).

Revision ID: 0066
Revises: 0065
Create Date: 2026-10-06

Why this exists
---------------
Migration 0065 resolved the owner-bypass vulnerability on `folders` and
`document_shares`, while emitting an advisory warning for any remaining tables
where RLS was enabled but not forced.

This revision (0066) follows up by dynamically enforcing `FORCE ROW LEVEL SECURITY`
across every user table in the `public` schema. In PostgreSQL, `ENABLE` alone exempts
the table owner role from RLS policy enforcement. Enforcing `FORCE` guarantees that
every role—including the database owner role used by background services—is strictly
subject to multi-tenant isolation policies.

Additionally, 0066 replaces the advisory check with a strict schema-wide invariant:
100% of tables must have both `relrowsecurity = true` and `relforcerowsecurity = true`,
and every table must possess at least one isolation policy.
"""

from typing import Sequence, Union
import logging

from alembic import op
import sqlalchemy as sa

logger = logging.getLogger("alembic.runtime.migration")

revision: str = "0066"
down_revision: Union[str, None] = "0065"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EXEMPT_TABLES = frozenset({"alembic_version"})


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite lacks RLS support; application-layer tenant scoping applies.
        return

    # Query all public base tables
    tables = [
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name NOT IN "
                f"({','.join(repr(t) for t in EXEMPT_TABLES)}) "
                "ORDER BY 1;"
            )
        ).fetchall()
    ]

    if not tables:
        raise RuntimeError(
            "0066 found no tables in the public schema. Either the chain did not "
            "run or it targeted an empty database. Refusing to proceed."
        )

    # Force RLS on every table
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # Strict invariant verification
    _assert_schema_wide_coverage(bind, tables)


def _assert_schema_wide_coverage(bind, tables: list[str]) -> None:
    """Strict end-state schema gate: all tables must be protected, forced, and policied."""
    unprotected: list[str] = []
    unforced: list[str] = []
    policyless: list[str] = []

    for table in tables:
        rls = bind.execute(
            sa.text(
                "SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                f"WHERE n.nspname = 'public' AND c.relname = '{table}';"
            )
        ).fetchall()

        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        elif rls[0][1] is not True:
            unforced.append(table)

        count = bind.execute(
            sa.text(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        ).fetchall()
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unprotected or unforced or policyless:
        errors = []
        if unprotected:
            errors.append(f"RLS NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}")
        if unforced:
            errors.append(f"RLS NOT FORCED on {len(unforced)} table(s): {sorted(unforced)}")
        if policyless:
            errors.append(f"No RLS policy on {len(policyless)} table(s): {sorted(policyless)}")

        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - " + "\n  - ".join(errors)
        )

    logger.info("Migration 0066 verified: 100%% of %d tables have forced RLS.", len(tables))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    tables = [
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name NOT IN "
                f"({','.join(repr(t) for t in EXEMPT_TABLES)}) "
                "ORDER BY 1;"
            )
        ).fetchall()
    ]

    for table in tables:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
