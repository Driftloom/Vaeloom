"""Capability usage telemetry columns on workspace_capabilities (0062).

Revision ID: 0062
Revises: 0060
Create Date: 2026-10-01

Why this exists
---------------
``category = 'skill'`` rows were pure metadata: the frontend shipped hard-coded
``usageCount`` literals in ``capabilities-data.ts`` and the API had nowhere to
record that a skill had actually been used. Usage telemetry has to be per
workspace (the whole point of ``workspace_capabilities``), so it belongs in the
row, not in the catalog. This migration adds ``usage_count``, ``last_used_at``
and ``installed_at`` so the count is measured rather than invented, plus the
``(workspace_id, category)`` index that every catalog-merge read needs.

``down_revision`` is ``0060``, not ``0061``
------------------------------------------
The chain is ``0059 -> 0061 -> 0060``: ``0060_verify_rls_coverage.py`` revises
``0061`` and is deliberately terminal — it verifies final RLS coverage on
PostgreSQL and raises if any table is unprotected, so it must stay the last
revision that runs. ``0061`` is *not* the head; ``alembic heads`` reports
``0060 (head)``. Attaching ``0062`` to ``0061`` would fork the chain and leave
two heads, which breaks ``alembic upgrade head`` in deploys and CI.

``_safe()`` fails loudly
------------------------
``0049``'s ``_safe`` rolls back to a savepoint, prints, and returns — the
silent-swallow behaviour that let the 2026-09 audit find 28 skipped statements on
a database that reported success. The savepoint structure is kept here so a
failure cannot poison the transaction, but the exception is re-raised so the
migration fails instead of printing a line. Nothing in this file is optional.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0062"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_POLICY = "p_capabilities_workspace_isolation"


def _safe(conn, sql: str) -> None:
    """Run ``sql`` under a savepoint, re-raising on failure.

    Same shape as ``0049``'s helper so a partial failure can be inspected, but
    unlike it the error propagates: a skipped DDL statement here would silently
    leave the capability table without telemetry or its index.
    """
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0062"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0062"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0062"))
        raise


def _existing_columns(bind) -> set[str]:
    inspector = sa.inspect(bind)
    if not inspector.has_table("workspace_capabilities"):
        raise RuntimeError(
            "0062 expected workspace_capabilities to exist; revision 0049 creates it. "
            "Refusing to create a partial telemetry schema."
        )
    return {c["name"] for c in inspector.get_columns("workspace_capabilities")}


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    cols = _existing_columns(bind)

    # SQLite rejects a non-constant DEFAULT in ALTER TABLE ADD COLUMN, so
    # func.now() has to become CURRENT_TIMESTAMP there.
    now_default = sa.text("now()") if is_pg else sa.text("CURRENT_TIMESTAMP")

    if "usage_count" not in cols:
        op.add_column(
            "workspace_capabilities",
            sa.Column(
                "usage_count",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
        )

    if "last_used_at" not in cols:
        op.add_column(
            "workspace_capabilities",
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "installed_at" not in cols:
        op.add_column(
            "workspace_capabilities",
            sa.Column(
                "installed_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=now_default,
            ),
        )

    op.create_index(
        "idx_capabilities_workspace_category",
        "workspace_capabilities",
        ["workspace_id", "category"],
    )

    # Re-assert the RLS posture 0049 established. ADD COLUMN and CREATE INDEX
    # cannot relax RLS, but an unguarded "it should still be there" is exactly the
    # assumption that hid the 2026-09 defects.
    if not is_pg:
        return

    run = lambda s: _safe(bind, s)  # noqa: E731
    run("ALTER TABLE workspace_capabilities ENABLE ROW LEVEL SECURITY")
    run("ALTER TABLE workspace_capabilities FORCE ROW LEVEL SECURITY")

    exists = bind.execute(
        sa.text("SELECT count(*) FROM pg_policies WHERE tablename = 'workspace_capabilities' AND policyname = :p"),
        {"p": _POLICY},
    ).scalar_one()
    if exists:
        return

    run(f"""
        CREATE POLICY {_POLICY} ON workspace_capabilities
        FOR ALL
        USING (
            workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            OR EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_capabilities.workspace_id
                AND (
                    w.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                    OR EXISTS (
                        SELECT 1 FROM workspace_users wu
                        WHERE wu.workspace_id = w.id
                        AND wu.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                    )
                )
            )
        )
    """)


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        _safe(bind, f"DROP POLICY IF EXISTS {_POLICY} ON workspace_capabilities")

    op.drop_index("idx_capabilities_workspace_category", table_name="workspace_capabilities")

    cols = _existing_columns(bind)
    for name in ("installed_at", "last_used_at", "usage_count"):
        if name in cols:
            op.drop_column("workspace_capabilities", name)

    if not is_pg:
        return

    # Restoring the policy after the drop keeps the table readable-by-nobody
    # window to zero rather than the length of the downgrade.
    _safe(bind, "ALTER TABLE workspace_capabilities ENABLE ROW LEVEL SECURITY")
    _safe(bind, "ALTER TABLE workspace_capabilities FORCE ROW LEVEL SECURITY")
    _safe(
        bind,
        f"""
        CREATE POLICY {_POLICY} ON workspace_capabilities
        FOR ALL
        USING (
            workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            OR EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_capabilities.workspace_id
                AND (
                    w.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                    OR EXISTS (
                        SELECT 1 FROM workspace_users wu
                        WHERE wu.workspace_id = w.id
                        AND wu.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
                    )
                )
            )
        )
        """,
    )