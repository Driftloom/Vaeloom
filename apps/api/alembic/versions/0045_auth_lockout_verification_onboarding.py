"""Add email_verified, failed_login_attempts, locked_until to users, create email_verification_tokens and onboarding_states, add family_id and user_agent to auth_sessions.

Revision ID: 0045
Revises: 0044
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0045"
down_revision: Union[str, None] = "0044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. Update users table
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false" if not is_sqlite else "0")))
        batch_op.add_column(sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))

    # 2. Update auth_sessions table
    with op.batch_alter_table("auth_sessions") as batch_op:
        batch_op.add_column(sa.Column("user_agent", sa.String(500), nullable=True))
        batch_op.add_column(sa.Column("family_id", sa.UUID(), nullable=True))
        batch_op.create_index("idx_auth_sessions_family_id", ["family_id"])

    # 3. Create email_verification_tokens table
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_email_verification_token_hash", "email_verification_tokens", ["token_hash"], unique=True)
    op.create_index("idx_email_verification_user_id", "email_verification_tokens", ["user_id"])

    # 4. Create onboarding_states table
    op.create_table(
        "onboarding_states",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_step", sa.String(50), nullable=False, server_default="PROFILE"),
        sa.Column("completed_steps", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.text("false" if not is_sqlite else "0")),
        sa.Column("step_data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_onboarding_states_tenant_id", "onboarding_states", ["tenant_id"])
    op.create_index("idx_onboarding_states_workspace_id", "onboarding_states", ["workspace_id"])

    # 5. RLS policies on PostgreSQL
    if not is_sqlite:
        op.execute("ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE email_verification_tokens FORCE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE onboarding_states ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE onboarding_states FORCE ROW LEVEL SECURITY;")

        op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE policyname = 'p_email_tokens_user' AND tablename = 'email_verification_tokens'
            ) THEN
                CREATE POLICY p_email_tokens_user ON email_verification_tokens
                USING (user_id::text = current_setting('app.user_id', true));
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE policyname = 'p_onboarding_tenant_user' AND tablename = 'onboarding_states'
            ) THEN
                CREATE POLICY p_onboarding_tenant_user ON onboarding_states
                USING (
                    user_id::text = current_setting('app.user_id', true)
                    OR (tenant_id IS NOT NULL AND tenant_id::text = current_setting('app.tenant_id', true))
                )
                WITH CHECK (
                    user_id::text = current_setting('app.user_id', true)
                );
            END IF;
        END $$;
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if not is_sqlite:
        op.execute("DROP POLICY IF EXISTS p_onboarding_tenant_user ON onboarding_states;")
        op.execute("DROP POLICY IF EXISTS p_email_tokens_user ON email_verification_tokens;")

    op.drop_index("idx_onboarding_states_workspace_id", table_name="onboarding_states")
    op.drop_index("idx_onboarding_states_tenant_id", table_name="onboarding_states")
    op.drop_table("onboarding_states")

    op.drop_index("idx_email_verification_user_id", table_name="email_verification_tokens")
    op.drop_index("idx_email_verification_token_hash", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")

    with op.batch_alter_table("auth_sessions") as batch_op:
        batch_op.drop_index("idx_auth_sessions_family_id")
        batch_op.drop_column("family_id")
        batch_op.drop_column("user_agent")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("locked_until")
        batch_op.drop_column("failed_login_attempts")
        batch_op.drop_column("email_verified")
