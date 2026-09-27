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


def _users_id_type():
    """Type ``user_id`` from the real ``users.id`` column.

    A foreign key requires the two columns to have identical types, and the type
    of ``users.id`` is not knowable from this repository:

    * ``0001_initial_schema.py`` declares it ``sa.UUID()``, so a database built by
      this chain has ``uuid`` and a hard-coded ``sa.UUID()`` happens to work.
    * the managed instance rejects it outright -
      ``foreign key constraint "password_reset_tokens_user_id_fkey" cannot be
      implemented`` - which means that ``users.id`` is some other type there,
      most likely ``varchar``/``text``, because ``public.users`` was created
      outside this chain.

    So the column type is read from the target instead of assumed. That makes the
    migration correct on both shapes without anyone having to remember which one
    it is deploying against.

    A missing ``users`` table falls back to ``sa.UUID()``: it cannot happen on a
    valid database, and raising a second, unrelated error would hide the real
    problem.
    """
    try:
        inspector = sa.inspect(op.get_bind())
        columns = {c["name"]: c for c in inspector.get_columns("users")}
    except Exception:
        return sa.UUID()
    existing = columns.get("id")
    if existing is None or existing.get("type") is None:
        return sa.UUID()
    return existing["type"]


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    users_id_type = _users_id_type()

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        # Typed from the referenced column rather than hard-coded: a mismatch here
        # is precisely what made this migration fail on the managed instance.
        sa.Column("user_id", users_id_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
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
