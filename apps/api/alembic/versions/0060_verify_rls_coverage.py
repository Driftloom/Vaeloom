"""Assert RLS coverage at the end of the chain.

Revision ID: 0060
Revises: 0059
Create Date: 2026-09-27

Why this exists
---------------
Sixteen migrations between `0033` and `0056` each carry a private copy of a
savepoint helper that swallows errors and prints a line. On a freshly migrated
PostgreSQL 16 database those copies skipped 28 statements and the run still
reported success. That single behaviour is the root cause of every migration
defect found in the 2026-09 audit:

* `document_actions` ended up with `rowsecurity = false` and zero policies,
  because `0028` and `0036` applied policies to a table that `0048` had not
  created yet, so their statements were skipped and nothing re-applied them
* `webhooks` and `webhook_deliveries` had no table at all, while eight migrations
  applied policies to them
* `0057` could not apply at all and the failure was buried in a log line

Rewriting those sixteen already-applied migrations is a larger risk than the
problem it solves, and they are not uniform - some run on SQLite, some return
early on it. So instead of trusting them, this migration *verifies the outcome*.

It is the last revision, so it sees the final schema. It raises rather than warns,
which means the deploy fails, which means `main.py` refuses to start. That closes
the loop: a statement skipped by a legacy helper can no longer result in a
silently under-secured database.

The check is on the end state, not on which migration did the work, because many
tables have legitimately been given RLS by more than one migration over time.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0060"
down_revision: Union[str, None] = "0059"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# `alembic_version` is Alembic's own bookkeeping and holds no tenant data.
EXEMPT_TABLES = frozenset({"alembic_version"})


def _rows(sql: str) -> list[tuple]:
    return list(op.get_bind().execute(sa.text(sql)).fetchall())


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite has no row-level security. The default test suite runs there and
        # relies on application-layer scoping; the CI workflow runs this same
        # revision against real PostgreSQL.
        return

    tables = [
        r[0]
        for r in _rows(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
            f"AND table_name NOT IN ({','.join(repr(t) for t in EXEMPT_TABLES)}) "
            "ORDER BY 1;"
        )
    ]
    if not tables:
        raise RuntimeError(
            "0060 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

    unprotected: list[str] = []
    policyless: list[str] = []
    for table in tables:
        # Identifier is interpolated because pg_tables/pg_policies have no
        # bind-parameter form for the relation name. Every value here comes from
        # information_schema for the connected database, not from user input.
        rls = _rows(
            "SELECT rowsecurity FROM pg_tables "
            f"WHERE schemaname = 'public' AND tablename = '{table}';"
        )
        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        count = _rows(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unprotected or policyless:
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): "
                f"{sorted(unprotected)}"
            )
        if policyless:
            problems.append(
                f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}"
            )
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
            + "\n\nThese tables are readable by every role. A statement in an "
            "earlier migration was almost certainly skipped by one of the "
            "savepoint helpers in 0033-0056. Add the missing table or policy in a "
            "new migration rather than editing an applied one."
        )


def downgrade() -> None:
    # Verification only. There is nothing to undo, and deliberately so: a
    # downgrade must never remove a security control.
    return None
