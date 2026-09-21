"""Connector config versioning (0050): version counter + encrypted history log.

Revision ID: 0050
Revises: 0049
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0050"
down_revision: Union[str, None] = "0049"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    if is_pg:
        with op.batch_alter_table("connectors") as batch:
            batch.add_column(sa.Column("config_version", sa.Integer(), nullable=False, server_default="1"))
            batch.add_column(sa.Column("config_history", sa.JSON(), nullable=True))
    else:
        with op.batch_alter_table("connectors") as batch:
            batch.add_column(sa.Column("config_version", sa.Integer(), nullable=True))
            batch.add_column(sa.Column("config_history", sa.JSON(), nullable=True))
        bind.execute(sa.text("UPDATE connectors SET config_version = 1 WHERE config_version IS NULL"))


def downgrade() -> None:
    with op.batch_alter_table("connectors") as batch:
        batch.drop_column("config_history")
        batch.drop_column("config_version")
