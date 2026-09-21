"""Enterprise workspace and document lifecycle, folders, versioning, sharing, and security.

Revision ID: 0048
Revises: 0047
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0048"
down_revision: Union[str, None] = "0047"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0048"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0048"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0048"))
        print(f"0048 skipped statement ({e}): {sql[:140]}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 1. Create folders table
    op.create_table(
        "folders",
        sa.Column("id", sa.UUID(as_uuid=True) if is_pg else sa.String(36), primary_key=True),
        sa.Column(
            "workspace_id",
            sa.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_id",
            sa.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("folders.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_by", sa.UUID(as_uuid=True) if is_pg else sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_folders_workspace_id", "folders", ["workspace_id"])
    op.create_index("idx_folders_workspace_parent", "folders", ["workspace_id", "parent_id"])

    # 2. Add columns to documents table
    with op.batch_alter_table("documents") as batch_op:
        batch_op.add_column(
            sa.Column(
                "folder_id",
                sa.UUID(as_uuid=True) if is_pg else sa.String(36),
                sa.ForeignKey("folders.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.add_column(
            sa.Column("status", sa.String(50), server_default="ACTIVE", nullable=False)
        )
        batch_op.add_column(sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("detected_mime_type", sa.String(100), nullable=True))
        batch_op.add_column(
            sa.Column("scan_status", sa.String(50), server_default="CLEAN", nullable=False)
        )
        batch_op.add_column(sa.Column("scan_result", sa.String(255), nullable=True))
        batch_op.create_index("idx_documents_folder_id", ["folder_id"])
        batch_op.create_index("idx_documents_workspace_status", ["workspace_id", "status"])

    # 3. Add columns to document_actions table
    with op.batch_alter_table("document_actions") as batch_op:
        batch_op.add_column(
            sa.Column("actor_id", sa.UUID(as_uuid=True) if is_pg else sa.String(36), nullable=True)
        )
        batch_op.add_column(
            sa.Column("tenant_id", sa.UUID(as_uuid=True) if is_pg else sa.String(36), nullable=True)
        )
        batch_op.create_index("idx_document_actions_actor", ["actor_id"])

    # 4. Create document_shares table
    op.create_table(
        "document_shares",
        sa.Column("id", sa.UUID(as_uuid=True) if is_pg else sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_workspace_id",
            sa.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_workspace_id",
            sa.UUID(as_uuid=True) if is_pg else sa.String(36),
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("permission", sa.String(50), server_default="read", nullable=False),
        sa.Column("granted_by", sa.UUID(as_uuid=True) if is_pg else sa.String(36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_document_shares_doc", "document_shares", ["document_id"])
    op.create_index(
        "idx_document_shares_target",
        "document_shares",
        ["target_workspace_id", "document_id"],
    )

    # 5. PostgreSQL RLS Policies
    if is_pg:
        run = lambda s: _safe(bind, s)
        run("ALTER TABLE folders ENABLE ROW LEVEL SECURITY")
        run("ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY")

        # RLS for folders: user has access to the workspace
        run("""
            CREATE POLICY p_folders_workspace_isolation ON folders
            FOR ALL
            USING (
                workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
                OR EXISTS (
                    SELECT 1 FROM workspaces w
                    WHERE w.id = folders.workspace_id
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

        # RLS for document_shares: source or target workspace matches
        run("""
            CREATE POLICY p_document_shares_isolation ON document_shares
            FOR ALL
            USING (
                source_workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
                OR target_workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
            )
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    op.drop_table("document_shares")

    with op.batch_alter_table("document_actions") as batch_op:
        batch_op.drop_index("idx_document_actions_actor")
        batch_op.drop_column("tenant_id")
        batch_op.drop_column("actor_id")

    with op.batch_alter_table("documents") as batch_op:
        batch_op.drop_index("idx_documents_workspace_status")
        batch_op.drop_index("idx_documents_folder_id")
        batch_op.drop_column("scan_result")
        batch_op.drop_column("scan_status")
        batch_op.drop_column("detected_mime_type")
        batch_op.drop_column("expires_at")
        batch_op.drop_column("status")
        batch_op.drop_column("folder_id")

    op.drop_table("folders")
