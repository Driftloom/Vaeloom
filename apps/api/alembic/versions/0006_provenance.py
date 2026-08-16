"""Provenance

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-16 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Provenance columns on embeddings
    op.add_column(
        "embeddings", sa.Column("dimensions", sa.Integer(), nullable=True)
    )
    op.add_column(
        "embeddings",
        sa.Column("source_table", sa.String(100), nullable=True),
    )

    # Lifecycle columns on documents
    op.add_column(
        "documents",
        sa.Column(
            "retention_policy",
            sa.String(50),
            server_default="user_driven",
            nullable=False,
        ),
    )
    op.add_column(
        "documents",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Consent columns on users
    op.add_column(
        "users",
        sa.Column("consent_version", sa.String(20), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "consent_granted_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    # Consent columns on workspaces
    op.add_column(
        "workspaces",
        sa.Column("consent_version", sa.String(20), nullable=True),
    )
    op.add_column(
        "workspaces",
        sa.Column(
            "consent_granted_at", sa.DateTime(timezone=True), nullable=True
        ),
    )

    # OAuth columns on connectors
    op.add_column(
        "connectors",
        sa.Column("oauth_scopes", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "connectors",
        sa.Column(
            "refresh_token_rotated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("connectors", "refresh_token_rotated_at")
    op.drop_column("connectors", "oauth_scopes")

    op.drop_column("workspaces", "consent_granted_at")
    op.drop_column("workspaces", "consent_version")

    op.drop_column("users", "consent_granted_at")
    op.drop_column("users", "consent_version")

    op.drop_column("documents", "deleted_at")
    op.drop_column("documents", "retention_policy")

    op.drop_column("embeddings", "source_table")
    op.drop_column("embeddings", "dimensions")
