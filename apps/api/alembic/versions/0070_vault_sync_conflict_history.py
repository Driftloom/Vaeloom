"""Vault sync conflict resolution history (0070).

Revision ID: 0070
Revises: 0069
Create Date: 2026-10-18

Why this exists
---------------
The active conflict ledger lives in ``connectors.config["conflicts"]`` and is
replaced wholesale on every client report. That is the right shape for a live
queue, but it is a forgetting store: resolving a conflict removes the entry, and
the next report overwrites the rest. Nothing could answer "what did I do with
this conflict?" after the fact, so the Corrections UI had to either guess or
show nothing once the queue drained.

This table is the durable record: one insert-once row per
``(connector_id, conflict_id)``. First recorded resolution wins; a repeated
resolve echoes the recorded row rather than mutating it; a stale client
re-report cannot resurrect a conflict the server already recorded as resolved.

``workspace_id`` is carried deliberately. The row is scoped by it, which is what
lets the same workspace-keyed RLS policy this schema already uses apply here
instead of the blanket one documented in
``docs/security/RLS-SERVICE-POLICY-EXPOSURE.md``.

Why both USING and WITH CHECK
-----------------------------
``USING`` governs only ``SELECT``/``UPDATE``/``DELETE``; a policy with ``USING``
alone leaves ``INSERT`` unconstrained. 0063 established both-clauses for its
tables and this revision follows it: the same predicate is written into both, so
a row cannot land in somebody else's workspace.

Why the text-comparison predicate
---------------------------------
``workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')``
is the spelling 0059/0063 already established: casting the column rather than
the setting avoids a uuid parse error when the session GUC holds a non-uuid, and
``NULLIF(..., '')`` means an unset GUC reads as NULL (unset fails closed)
instead of matching an empty-string row.

``strict_exec`` is used rather than a private ``_safe`` copy
-----------------------------------------------------------
``alembic/_strict_exec.py`` tolerates only a forward reference to a table a
later migration creates and re-raises everything else. The private swallowing
helpers in 0047/0052/0053 are what let the 2026-09 audit find 28 silently
skipped statements on a database that reported ``exit 0``.

This revision re-runs the coverage guard
----------------------------------------
``0060_verify_rls_coverage`` was written to be terminal, but every revision that
attaches after it moves it earlier in the chain where it cannot observe the new
table. ``_assert_coverage`` at the end of ``upgrade`` repeats the end-state
check — including ``FORCE ROW LEVEL SECURITY`` — so the property the audit
depended on survives this revision.

The invariant test ``test_head_includes_the_rls_coverage_guard`` in
``tests/test_migration_chain_pg.py`` asserts ``incomplete RLS coverage`` appears
in whatever file is the head, so this guard is load-bearing for CI as well as
for real databases.
"""

import importlib.util
import pathlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


def _load_strict_exec():
    """Import `alembic/_strict_exec.py` by path.

    The directory is named `alembic` but is not an importable package — the
    installed Alembic distribution owns that name on sys.path, so
    `from alembic._strict_exec import strict_exec` resolves against the
    library and raises ModuleNotFoundError. Loading by file path is what
    tests/test_migration_chain_pg.py does for the same reason.
    """
    path = pathlib.Path(__file__).resolve().parent.parent / "_strict_exec.py"
    spec = importlib.util.spec_from_file_location("alembic_strict_exec", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.strict_exec


strict_exec = _load_strict_exec()

revision: str = "0070"
down_revision: Union[str, None] = "0069"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MIGRATION_ID = "0070"

TABLE = "vault_sync_conflict_history"
POLICY = f"p_{TABLE}_workspace"
UNIQUE_NAME = "uq_vault_sync_conflict_history_connector_conflict"
INDEX_NAME = "idx_vault_sync_conflict_history_connector_detected"

# Workspace-only: this table has no tenant_id column (the connector it hangs
# from is already tenant-scoped), so the tenant arm of 0063's predicate has
# nothing to compare against here.
_SCOPED_PREDICATE = """
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
"""


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Cross-db convention (0051): native UUID on Postgres, String(36) on SQLite,
    # so the revision stays renderable on a dev database.
    uuid_col = sa.UUID(as_uuid=True) if is_pg else sa.String(36)

    inspector = sa.inspect(bind)
    if not inspector.has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", uuid_col, primary_key=True),
            sa.Column(
                "connector_id",
                uuid_col,
                sa.ForeignKey("connectors.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "workspace_id",
                uuid_col,
                sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("conflict_id", sa.String(length=200), nullable=False),
            sa.Column("file", sa.String(length=1000), nullable=False),
            sa.Column("conflict_file", sa.String(length=1000), nullable=False),
            sa.Column("local_head", sa.String(length=100), nullable=True),
            sa.Column("remote_head", sa.String(length=100), nullable=True),
            sa.Column("detected_at", sa.String(length=100), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("resolution", sa.String(length=20), nullable=False),
            sa.UniqueConstraint("connector_id", "conflict_id", name=UNIQUE_NAME),
        )
        op.create_index(INDEX_NAME, TABLE, ["connector_id", "detected_at"])
    else:
        indexes = [idx["name"] for idx in inspector.get_indexes(TABLE)]
        if INDEX_NAME not in indexes:
            op.create_index(INDEX_NAME, TABLE, ["connector_id", "detected_at"])

    if not is_pg:
        # SQLite has no RLS. The suite relies on application-layer scoping; the
        # CI workflow runs this revision against real PostgreSQL.
        return

    strict_exec(
        MIGRATION_ID, bind, f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;", context=f"RLS enable on {TABLE}"
    )
    strict_exec(
        MIGRATION_ID, bind, f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY;", context=f"RLS force on {TABLE}"
    )
    strict_exec(
        MIGRATION_ID,
        bind,
        f"""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = '{POLICY}' AND tablename = '{TABLE}'
        ) THEN
            CREATE POLICY {POLICY} ON {TABLE} FOR ALL
            TO vaeloom_app, service_role, postgres
            USING ({_SCOPED_PREDICATE})
            WITH CHECK ({_SCOPED_PREDICATE});
        END IF;
    END $$;
    """,
        context=f"RLS policy on {TABLE}",
    )

    _assert_coverage(bind)


EXEMPT_TABLES = frozenset({"alembic_version"})


def _assert_coverage(bind) -> None:
    """Re-run the end-state coverage guard, because 0060 is no longer terminal.

    Carried forward from ``0069_memory_workspace_isolation``, which carries it
    from ``0068``, ``0067`` and ``0066_force_schema_wide_rls``. Each appended
    revision moves the guard one step earlier in the chain, where it can no
    longer observe the newest change. Repeating it here is what stops this
    migration creating a table and leaving it unprotected with nothing
    downstream to notice.
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
            "0070 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

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
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}"
            )
        if unforced:
            problems.append(
                f"row-level security NOT FORCED on {len(unforced)} table(s): {sorted(unforced)}"
            )
        if policyless:
            problems.append(
                f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}"
            )
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
        )


def downgrade() -> None:
    """Exact reverse of ``upgrade``: drop the policy, the index, the table."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(f"DROP POLICY IF EXISTS {POLICY} ON {TABLE};")

    # Guarded to mirror upgrade(): a table this revision never created must not
    # turn a downgrade into an UndefinedTableError.
    inspector = sa.inspect(bind)
    if inspector.has_table(TABLE):
        op.drop_index(INDEX_NAME, table_name=TABLE)
        op.drop_table(TABLE)
