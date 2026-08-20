"""BYOK Provider Keys - Bring Your Own LLM API Keys

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-20

Enables per-user and per-workspace encrypted provider keys (openai, anthropic, etc.)
with resolution priority workspace > user > system.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        # SQLite: create_all handles it via Base.metadata.create_all in lifespan
        return

    op.create_table(
        "provider_keys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("encrypted_key", sa.Text, nullable=False),
        sa.Column("key_hint", sa.String(20), nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("is_valid", sa.Boolean, nullable=True),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validation_error", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "workspace_id", "provider", name="uq_provider_keys_user_ws_provider"),
    )
    op.create_index("idx_provider_keys_user_provider", "provider_keys", ["user_id", "provider"])
    op.create_index("idx_provider_keys_workspace_provider", "provider_keys", ["workspace_id", "provider"])
    op.create_index("idx_provider_keys_user_ws", "provider_keys", ["user_id", "workspace_id"])


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.drop_index("idx_provider_keys_user_ws", table_name="provider_keys")
    op.drop_index("idx_provider_keys_workspace_provider", table_name="provider_keys")
    op.drop_index("idx_provider_keys_user_provider", table_name="provider_keys")
    op.drop_table("provider_keys")
