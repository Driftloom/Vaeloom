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
    #
    # KNOWN BROKEN ON POSTGRESQL — do not ship without fixing first.
    #
    # Applying this migration to a PostgreSQL database fails with:
    #   asyncpg.exceptions.DatatypeMismatchError:
    #   foreign key constraint "password_reset_tokens_user_id_fkey" cannot be implemented
    #   DETAIL: Key columns "user_id" and "id" are of incompatible types
    #
    # `users.id` is declared sa.UUID() in 0001_initial_schema.py, so on any
    # database built by this chain the types match. The failure means the target
    # database's `users.id` is not the type this chain declares — most likely
    # varchar/text, because `public.users` was created outside the chain (SQL
    # editor, or an earlier hand-written schema).
    #
    # The fix is to type this column from the referenced one rather than
    # assuming: reflect `users.id` through sa.inspect(op.get_bind()) and use the
    # returned type for `user_id`. That was attempted and reverted — the
    # reflection reported varchar while PostgreSQL reported uuid for the same
    # column, so the mismatch was not reproduced and the correct source of truth
    # is still unconfirmed. Do not "fix" this by hard-coding another type.
    #
    # SQLite does not enforce foreign key column types, which is why the
    # security suite (SQLite, tables created from the ORM models rather than
    # from migrations) never exercised this path.
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
