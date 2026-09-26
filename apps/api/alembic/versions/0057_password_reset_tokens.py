"""Create password_reset_tokens table with RLS.

Revision ID: 0057
Revises: 0056
Create Date: 2026-09-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0057"
down_revision: Union[str, None] = "0056"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. Create password_reset_tokens table
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_pwd_reset_token_hash", "password_reset_tokens", ["token_hash"], unique=True)
    op.create_index("idx_pwd_reset_user_id", "password_reset_tokens", ["user_id"])

    # 2. RLS policies on PostgreSQL
    if not is_sqlite:
        op.execute("ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;")

        op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE policyname = 'p_password_reset_tokens_scoped' AND tablename = 'password_reset_tokens'
            ) THEN
                CREATE POLICY p_password_reset_tokens_scoped ON password_reset_tokens FOR ALL
                TO vaeloom_app, service_role, postgres
                USING (
                    token_hash = NULLIF(current_setting('app.lookup_token_hash', true), '')
                    OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
                )
                WITH CHECK (
                    token_hash = NULLIF(current_setting('app.lookup_token_hash', true), '')
                    OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
                );
            END IF;
        END $$;
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if not is_sqlite:
        op.execute("DROP POLICY IF EXISTS p_password_reset_tokens_scoped ON password_reset_tokens;")
    op.drop_index("idx_pwd_reset_user_id", table_name="password_reset_tokens")
    op.drop_index("idx_pwd_reset_token_hash", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
