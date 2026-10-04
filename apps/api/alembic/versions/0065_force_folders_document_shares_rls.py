"""FORCE RLS on folders and document_shares (0065).

Revision ID: 0065
Revises: 0064
Create Date: 2026-10-04

Why this exists
---------------
`0036` walked `pg_tables` and applied both `ENABLE` and `FORCE ROW LEVEL
SECURITY` to every table that existed at that moment. `folders` and
`document_shares` did not: they are created by `0048`, eighteen revisions
later, and `0048` issues only `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

Postgres semantics make that gap exploitable. `ENABLE` alone still exempts the
*table owner*, so any connection authenticated as the owner reads and writes
every tenant's rows with the policies sitting inert. `FORCE` closes that: it
subjects the owner to the same policies as everyone else. This matters most for
`document_shares`, whose rows name two workspace ids and are the whole basis of
the cross-workspace access path in `document_service.get_document` — an owner
connection that bypasses `p_document_shares_isolation` can enumerate every
share pair across every tenant.

No new policies are added. The existing policies from `0048` already encode the
correct scope; they were simply not binding for the owner.

Because 0065 becomes the terminal revision, it also repeats the end-state
coverage guard that `0060` established and `0064` re-attached: every public
table must have RLS enabled and at least one policy.

`forcerowsecurity` is asserted for the two tables this revision owns, and
*reported* for every other table. Asserting FORCE schema-wide would be a new
invariant that no applied migration has ever claimed: tables created between
`0036` and `0064` picked up FORCE individually, and that set was never
reconciled against `pg_tables` as a whole. Failing the whole chain on an
unverified claim would be worse than the defect being fixed here, so the
schema-wide case is surfaced for a follow-up migration instead.
"""

from typing import Sequence, Union

import logging

from alembic import op
import sqlalchemy as sa

logger = logging.getLogger("alembic.runtime.migration")

revision: str = "0065"
down_revision: Union[str, None] = "0064"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FORCE_TABLES = ("folders", "document_shares")

EXEMPT_TABLES = frozenset({"alembic_version"})


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite has no row-level security; the suite relies on application-layer
        # scoping.
        return

    for table in FORCE_TABLES:
        if not _has_table(table):
            raise RuntimeError(
                f"{table} does not exist; 0048 must run before 0065. Refusing to "
                "record this revision as applied without its RLS forced."
            )
        # ENABLE is re-issued so the migration is self-contained rather than
        # depending on 0048 having succeeded.
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    _assert_coverage(bind)


def _assert_coverage(bind) -> None:
    """End-state guard, repeated because 0065 is now the terminal revision.

    Two severities, deliberately:

    * Hard failure for `unprotected` / `policyless` across the whole schema.
      That is the invariant `0060` introduced and every applied revision since
      has upheld, so regressing it means a real policy was lost.
    * Hard failure for `unforced` on the tables this revision owns. `ENABLE`
      without `FORCE` leaves the owner exempt, which is exactly the defect
      being closed, so failing to land the fix must not pass silently.
    * Advisory only for `unforced` elsewhere. See the module docstring: schema-wide
      FORCE has never been asserted by any applied migration, and tables created
      after `0036` took FORCE one at a time. Turning that unverified claim into a
      hard gate would risk failing a deploy over tables this revision never
      touched. It is logged so a follow-up migration can close the gap.
    """
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
            "0065 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

    unprotected: list[str] = []
    policyless: list[str] = []
    unforced_owned: list[str] = []
    unforced_other: list[str] = []
    for table in tables:
        # Identifier is interpolated because pg_tables/pg_policies have no
        # bind-parameter form for the relation name. Every value here comes from
        # information_schema for the connected database, not from user input.
        rls = bind.execute(
            sa.text(
                "SELECT rowsecurity, forcerowsecurity FROM pg_tables "
                f"WHERE schemaname = 'public' AND tablename = '{table}';"
            )
        ).fetchall()
        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        elif rls[0][1] is not True:
            (unforced_owned if table in FORCE_TABLES else unforced_other).append(table)
        count = bind.execute(
            sa.text(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        ).fetchall()
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unforced_other:
        logger.warning(
            "0065: %d table(s) have RLS enabled but not forced, so a table-owner "
            "connection bypasses their policies: %s. Not fatal here because "
            "schema-wide FORCE is not an invariant any applied migration has "
            "asserted. Cover them in a follow-up revision.",
            len(unforced_other),
            sorted(unforced_other),
        )

    if unprotected or policyless or unforced_owned:
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}"
            )
        if policyless:
            problems.append(
                f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}"
            )
        if unforced_owned:
            problems.append(
                f"row-level security NOT FORCED on {sorted(unforced_owned)} — this "
                "revision exists to force exactly these tables"
            )
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
            + "\n\nAdd the missing work in a new migration rather than editing an "
            "applied one."
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table in FORCE_TABLES:
        if not _has_table(table):
            continue
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        # RLS stays ENABLED. Disabling it would leave the table readable by every
        # role, which is strictly worse than the state this migration fixes.
