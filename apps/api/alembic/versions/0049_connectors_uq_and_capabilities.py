"""Connectors workspace-name unique constraint and sovereign workspace capabilities.

Revision ID: 0049
Revises: 0048
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0049"
down_revision: Union[str, None] = "0048"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0049"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0049"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0049"))
        print(f"0049 skipped statement ({e}): {sql[:140]}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Update unique constraint on connectors (workspace_id, name)
    if is_pg:
        run = lambda s: _safe(bind, s)
        run("ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_workspace_id_type_key")
        run("ALTER TABLE connectors DROP CONSTRAINT IF EXISTS uq_connectors_workspace_type")
        run("ALTER TABLE connectors ADD CONSTRAINT uq_connectors_workspace_name UNIQUE (workspace_id, name)")
    else:
        # SQLite batch alter
        try:
            with op.batch_alter_table("connectors") as batch_op:
                try:
                    batch_op.drop_constraint("uq_connectors_workspace_type", type_="unique")
                except Exception:
                    pass
                try:
                    batch_op.create_unique_constraint("uq_connectors_workspace_name", ["workspace_id", "name"])
                except Exception:
                    pass
        except Exception:
            pass

    # 2. Create workspace_capabilities table
    json_col = postgresql.JSONB() if is_pg else sa.JSON()
    uuid_col = sa.UUID(as_uuid=True) if is_pg else sa.String(36)

    op.create_table(
        "workspace_capabilities",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column(
            "workspace_id",
            uuid_col,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant_id", uuid_col, nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True, server_default=""),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0.0"),
        sa.Column("status", sa.String(50), nullable=False, server_default="ACTIVE"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true" if is_pg else "1")),
        sa.Column("author", sa.String(255), nullable=False, server_default="Workspace Member"),
        sa.Column("type", sa.String(50), nullable=False, server_default="custom"),
        sa.Column("runtime", sa.String(50), nullable=False, server_default="system"),
        sa.Column("config", json_col, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("workspace_id", "name", "category", name="uq_capabilities_workspace_name_category"),
    )
    op.create_index(
        "idx_capabilities_workspace_id",
        "workspace_capabilities",
        ["workspace_id"],
    )

    # 3. PostgreSQL RLS Policies
    if is_pg:
        run = lambda s: _safe(bind, s)
        run("ALTER TABLE workspace_capabilities ENABLE ROW LEVEL SECURITY")
        run("ALTER TABLE workspace_capabilities FORCE ROW LEVEL SECURITY")
        run("""
            CREATE POLICY p_capabilities_workspace_isolation ON workspace_capabilities
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

    op.drop_table("workspace_capabilities")

    if is_pg:
        run = lambda s: _safe(bind, s)
        run("ALTER TABLE connectors DROP CONSTRAINT IF EXISTS uq_connectors_workspace_name")
        run("ALTER TABLE connectors ADD CONSTRAINT connectors_workspace_id_type_key UNIQUE (workspace_id, type)")
