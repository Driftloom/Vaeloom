"""Add content column to document_versions (0061).

Revision ID: 0061
Revises: 0060
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0061"
down_revision: Union[str, None] = "0060"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    blob_type = sa.LargeBinary() if dialect == "postgresql" else sa.BLOB()
    
    # Check if column already exists
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("document_versions")]
    if "content" not in cols:
        with op.batch_alter_table("document_versions") as batch:
            batch.add_column(sa.Column("content", blob_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("document_versions")]
    if "content" in cols:
        with op.batch_alter_table("document_versions") as batch:
            batch.drop_column("content")
