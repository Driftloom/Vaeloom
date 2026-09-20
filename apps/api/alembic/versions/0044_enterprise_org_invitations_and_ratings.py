"""Add organization_invitations, marketplace_reviews, and organization policies.

Revision ID: 0044
Revises: 0043
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. Update organizations table
    with op.batch_alter_table("organizations") as batch_op:
        batch_op.add_column(sa.Column("allowed_domains", sa.JSON(), nullable=True, server_default="[]"))
        batch_op.add_column(sa.Column("default_role", sa.String(50), nullable=False, server_default="member"))

    # 2. organization_invitations
    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("invited_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_org_invitations_org", "organization_invitations", ["organization_id"])
    op.create_index("idx_org_invitations_tenant", "organization_invitations", ["tenant_id"])
    op.create_index("idx_org_invitations_email", "organization_invitations", ["email"])
    op.create_index("idx_org_invitations_token", "organization_invitations", ["token_hash"], unique=True)

    # 3. marketplace_reviews
    op.create_table(
        "marketplace_reviews",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("listing_id", sa.UUID(), sa.ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("review", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("listing_id", "user_id", name="uq_listing_user_review"),
    )
    op.create_index("idx_marketplace_reviews_listing", "marketplace_reviews", ["listing_id"])
    op.create_index("idx_marketplace_reviews_user", "marketplace_reviews", ["user_id"])

    # 4. RLS policies on PostgreSQL
    if not is_sqlite:
        op.execute("ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY org_invitations_tenant_isolation ON organization_invitations
            AS RESTRICTIVE
            USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
            WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
        """)

        op.execute("ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE marketplace_reviews FORCE ROW LEVEL SECURITY;")
        op.execute("""
            CREATE POLICY marketplace_reviews_public_read ON marketplace_reviews
            AS PERMISSIVE
            FOR SELECT USING (true);
        """)


def downgrade() -> None:
    op.drop_table("marketplace_reviews")
    op.drop_table("organization_invitations")
    with op.batch_alter_table("organizations") as batch_op:
        batch_op.drop_column("default_role")
        batch_op.drop_column("allowed_domains")
