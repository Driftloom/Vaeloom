"""Tenant/workspace/actor-scoped HTTP idempotency (IDEM-SCOPE-01).

Revision ID: 0038
Revises: 0037

The old identity (key, path) was global: a key issued in workspace A could
replay workspace B's stored response. New identity is
(tenant_id, workspace_id, actor, key, path) with '' sentinel for absent
scope (NULLs are distinct in UNIQUE constraints and would silently allow
collisions). Existing rows: none live (verified 2026-09-11); the migration
backfills '' so the new constraint holds everywhere.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0038"
down_revision: Union[str, None] = "0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        try:
            conn.execute(sa.text(sql))
        except Exception as e:
            print(f"0038 skipped statement ({e}): {sql[:120]}")
        return
    conn.execute(sa.text("SAVEPOINT sp_0038"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0038"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0038"))
        print(f"0038 skipped statement ({e}): {sql[:120]}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    try:
        cols = {c["name"] for c in sa.inspect(bind).get_columns("idempotency_records")}
    except Exception:
        cols = set()

    if "tenant_id" not in cols:
        op.add_column("idempotency_records", sa.Column("tenant_id", sa.String(255), nullable=True))
    if "workspace_id" not in cols:
        op.add_column("idempotency_records", sa.Column("workspace_id", sa.String(255), nullable=True))
    if "actor" not in cols:
        op.add_column("idempotency_records", sa.Column("actor", sa.String(255), nullable=True))
    _safe(bind, "UPDATE idempotency_records SET tenant_id = '' WHERE tenant_id IS NULL")
    _safe(bind, "UPDATE idempotency_records SET workspace_id = '' WHERE workspace_id IS NULL")
    _safe(bind, "UPDATE idempotency_records SET actor = '' WHERE actor IS NULL")

    _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN tenant_id SET NOT NULL")
    _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN workspace_id SET NOT NULL")
    _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN actor SET NOT NULL")
    _safe(
        bind,
        "ALTER TABLE idempotency_records ALTER COLUMN tenant_id SET DEFAULT ''",
    )
    _safe(
        bind,
        "ALTER TABLE idempotency_records ALTER COLUMN workspace_id SET DEFAULT ''",
    )
    _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN actor SET DEFAULT ''")

    # Replace the global unique constraint with the scoped one.
    _safe(bind, "ALTER TABLE idempotency_records DROP CONSTRAINT IF EXISTS uq_idempotency_key_path")
    try:
        bind.dialect.has_table(bind, "idempotency_records")
        _safe(
            bind,
            "ALTER TABLE idempotency_records ADD CONSTRAINT uq_idempotency_scoped "
            "UNIQUE (tenant_id, workspace_id, actor, idempotency_key, request_path)",
        )
    except Exception:
        pass
    _safe(
        bind,
        "CREATE INDEX IF NOT EXISTS idx_idempotency_scope_expires "
        "ON idempotency_records (tenant_id, workspace_id, expires_at)",
    )
    if is_pg:
        _safe(bind, "ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY")
        _safe(bind, "ALTER TABLE idempotency_records FORCE ROW LEVEL SECURITY")
        _safe(bind, "DROP POLICY IF EXISTS p_idempotency_scope ON idempotency_records")
        _safe(
            bind,
            "CREATE POLICY p_idempotency_scope ON idempotency_records FOR ALL "
            "USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') "
            "AND workspace_id = NULLIF(current_setting('app.workspace_id', true), '')) "
            "WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') "
            "AND workspace_id = NULLIF(current_setting('app.workspace_id', true), ''))",
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        _safe(bind, "DROP POLICY IF EXISTS p_idempotency_scope ON idempotency_records")
        _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN actor DROP DEFAULT")
        _safe(
            bind,
            "ALTER TABLE idempotency_records ALTER COLUMN workspace_id DROP DEFAULT",
        )
        _safe(bind, "ALTER TABLE idempotency_records ALTER COLUMN tenant_id DROP DEFAULT")
        _safe(
            bind,
            "ALTER TABLE idempotency_records ADD CONSTRAINT uq_idempotency_key_path "
            "UNIQUE (idempotency_key, request_path)",
        )
        _safe(bind, "ALTER TABLE idempotency_records DROP CONSTRAINT IF EXISTS uq_idempotency_scoped")
    try:
        op.drop_column("idempotency_records", "actor")
    except Exception:
        pass
    try:
        op.drop_column("idempotency_records", "workspace_id")
    except Exception:
        pass
    try:
        op.drop_column("idempotency_records", "tenant_id")
    except Exception:
        pass
