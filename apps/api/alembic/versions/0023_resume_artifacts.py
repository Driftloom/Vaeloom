"""Resume artifacts: compiled PDF/DOCX/HTML outputs for resume variants.

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-23

Creates resume_artifacts table (bytes stored inline; documents are small)
with workspace RLS, consistent with the other 42 tenant-scoped tables.
On SQLite this is a no-op (create_all handles schema).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    try:
        return op.get_context().dialect.name == "postgresql"
    except Exception:
        return False


def upgrade() -> None:
    if not _is_postgres():
        return

    op.create_table(
        "resume_artifacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_id", UUID(as_uuid=True), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("artifact_kind", sa.String(30), nullable=False, server_default="resume"),
        sa.Column("template_slug", sa.String(50), nullable=True),
        sa.Column("format", sa.String(10), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("media_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_resume_artifacts_resume_id", "resume_artifacts", ["resume_id"])
    op.create_index("idx_resume_artifacts_workspace_id", "resume_artifacts", ["workspace_id"])

    # RLS — fail-closed workspace isolation (pattern from 0020)
    for stmt in (
        "ALTER TABLE resume_artifacts ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE resume_artifacts FORCE ROW LEVEL SECURITY",
    ):
        try:
            op.execute(sa.text(stmt))
        except Exception:
            pass

    try:
        op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_resume_artifacts' AND tablename = 'resume_artifacts') THEN
                CREATE POLICY workspace_isolation_resume_artifacts ON resume_artifacts
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
        END $$;
        """))
    except Exception:
        pass


def downgrade() -> None:
    if not _is_postgres():
        return
    try:
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_resume_artifacts ON resume_artifacts"))
    except Exception:
        pass
    op.drop_index("idx_resume_artifacts_workspace_id", table_name="resume_artifacts")
    op.drop_index("idx_resume_artifacts_resume_id", table_name="resume_artifacts")
    op.drop_table("resume_artifacts")
