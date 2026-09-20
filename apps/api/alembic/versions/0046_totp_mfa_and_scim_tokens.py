"""Add TOTP MFA fields to users, create tenant_scim_tokens and consent_records tables.

Revision ID: 0046
Revises: 0045
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0046"
down_revision: Union[str, None] = "0045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. Update users table with MFA fields
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false" if not is_sqlite else "0")))
        batch_op.add_column(sa.Column("mfa_secret", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("mfa_recovery_codes", sa.JSON(), nullable=True, server_default=sa.text("'{}'" if not is_sqlite else "'{}'")))

    # 2. Create tenant_scim_tokens table
    op.create_table(
        "tenant_scim_tokens",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default="SCIM Token"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false" if not is_sqlite else "0")),
    )
    op.create_index("idx_tenant_scim_tokens_hash", "tenant_scim_tokens", ["token_hash"], unique=True)
    op.create_index("idx_tenant_scim_tokens_tenant", "tenant_scim_tokens", ["tenant_id"])

    # 3. Create consent_records table
    op.create_table(
        "consent_records",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("scope", sa.String(50), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_consent_records_user", "consent_records", ["user_id"])
    op.create_index("idx_consent_records_tenant", "consent_records", ["tenant_id"])
    op.create_index("idx_consent_records_user_scope", "consent_records", ["user_id", "scope"])

    # 4. RLS policies if PostgreSQL
    if not is_sqlite:
        op.execute("ALTER TABLE tenant_scim_tokens ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE tenant_scim_tokens FORCE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY tenant_scim_tokens_tenant_isolation ON tenant_scim_tokens
            FOR ALL
            USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
        """)

        op.execute("ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE consent_records FORCE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY p_consent_records_service ON consent_records
            FOR ALL
            USING (true)
            WITH CHECK (true);
        """)

        # Add pre-auth service policies for email tokens and onboarding states
        op.execute("""
            DROP POLICY IF EXISTS p_email_tokens_service ON email_verification_tokens;
            CREATE POLICY p_email_tokens_service ON email_verification_tokens
            FOR ALL
            USING (true)
            WITH CHECK (true);
        """)
        op.execute("""
            DROP POLICY IF EXISTS p_onboarding_states_service ON onboarding_states;
            CREATE POLICY p_onboarding_states_service ON onboarding_states
            FOR ALL
            USING (true)
            WITH CHECK (true);
        """)


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    if not is_sqlite:
        op.execute("DROP POLICY IF EXISTS p_onboarding_states_service ON onboarding_states;")
        op.execute("DROP POLICY IF EXISTS p_email_tokens_service ON email_verification_tokens;")
        op.execute("DROP POLICY IF EXISTS p_consent_records_service ON consent_records;")
        op.execute("DROP POLICY IF EXISTS tenant_scim_tokens_tenant_isolation ON tenant_scim_tokens;")

    op.drop_index("idx_consent_records_user_scope", table_name="consent_records")
    op.drop_index("idx_consent_records_tenant", table_name="consent_records")
    op.drop_index("idx_consent_records_user", table_name="consent_records")
    op.drop_table("consent_records")

    op.drop_index("idx_tenant_scim_tokens_tenant", table_name="tenant_scim_tokens")
    op.drop_index("idx_tenant_scim_tokens_hash", table_name="tenant_scim_tokens")
    op.drop_table("tenant_scim_tokens")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("mfa_recovery_codes")
        batch_op.drop_column("mfa_secret")
        batch_op.drop_column("mfa_enabled")
