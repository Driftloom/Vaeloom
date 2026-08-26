"""Resume sources: Overleaf-style Typst/LaTeX source files per resume.

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-26

Creates resume_sources table for split-pane Monaco editor (Typst/LaTeX).
JSON stays canonical (resumes.content); this holds the live source file
(main.typ) that WASM compiles in 50ms. One resume → one main file in MVP,
but schema supports multiple paths (e.g., includes).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0024"
down_revision: Union[str, None] = "0023"
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
        "resume_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("resume_id", UUID(as_uuid=True), sa.ForeignKey("resumes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("path", sa.String(500), nullable=False, server_default="main.typ"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("lang", sa.String(20), nullable=False, server_default="typst"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_resume_sources_resume_id", "resume_sources", ["resume_id"])
    op.create_index("idx_resume_sources_workspace_id", "resume_sources", ["workspace_id"])
    op.create_index("idx_resume_sources_resume_path", "resume_sources", ["resume_id", "path"])

    for stmt in (
        "ALTER TABLE resume_sources ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE resume_sources FORCE ROW LEVEL SECURITY",
    ):
        try:
            op.execute(sa.text(stmt))
        except Exception:
            pass

    try:
        op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_resume_sources' AND tablename = 'resume_sources') THEN
                CREATE POLICY workspace_isolation_resume_sources ON resume_sources
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
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_resume_sources ON resume_sources"))
    except Exception:
        pass
    op.drop_index("idx_resume_sources_resume_path", table_name="resume_sources")
    op.drop_index("idx_resume_sources_workspace_id", table_name="resume_sources")
    op.drop_index("idx_resume_sources_resume_id", table_name="resume_sources")
    op.drop_table("resume_sources")
