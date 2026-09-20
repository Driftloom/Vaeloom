"""Create organizations, organization_members, marketplace_listings, workspace_plugin_installs.

Revision ID: 0043
Revises: 0042
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    # 1. organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("tenant_id", sa.UUID(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("parent_id", sa.UUID(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="organization"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_organizations_tenant", "organizations", ["tenant_id"])
    op.create_index("idx_organizations_workspace", "organizations", ["workspace_id"])
    op.create_index("idx_organizations_parent", "organizations", ["parent_id"])

    # 2. organization_members
    op.create_table(
        "organization_members",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("organization_id", sa.UUID(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )
    op.create_index("idx_org_members_org", "organization_members", ["organization_id"])
    op.create_index("idx_org_members_user", "organization_members", ["user_id"])

    # 3. marketplace_listings
    op.create_table(
        "marketplace_listings",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("plugin_id", sa.UUID(), sa.ForeignKey("plugins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), unique=True, nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("author", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0.0"),
        sa.Column("icon_url", sa.String(1000), nullable=True),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("rating", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("install_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("config_schema", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_marketplace_listings_category", "marketplace_listings", ["category"])
    op.create_index("idx_marketplace_listings_slug", "marketplace_listings", ["slug"])

    # 4. workspace_plugin_installs
    op.create_table(
        "workspace_plugin_installs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", sa.UUID(), sa.ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("installed_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("installed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workspace_id", "listing_id", name="uq_ws_plugin_install"),
    )
    op.create_index("idx_ws_plugin_installs_ws", "workspace_plugin_installs", ["workspace_id"])
    op.create_index("idx_ws_plugin_installs_listing", "workspace_plugin_installs", ["listing_id"])

    # Enable RLS on PostgreSQL
    if not is_sqlite:
        for tbl in ["organizations", "organization_members", "workspace_plugin_installs"]:
            op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")


def downgrade() -> None:
    op.drop_table("workspace_plugin_installs")
    op.drop_table("marketplace_listings")
    op.drop_table("organization_members")
    op.drop_table("organizations")
