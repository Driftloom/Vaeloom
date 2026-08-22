"""DPIA retention evidence: retention_runs audit table.

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-22

Adds retention_runs table for DPIA F-10 purge evidence.
Each retention policy run (manual or daemon 02:00 UTC) logs:
- tenant_id / policy / started/finished / status / records_affected / error
Enables DPIA 4.6 to show purge logs, not just design.
On SQLite this is a no-op via create_all fallback.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.create_table(
            "retention_runs",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("tenant_id", sa.String(length=36), nullable=True),
            sa.Column("policy", sa.JSON, nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="running"),
            sa.Column("records_affected", sa.Integer, nullable=True),
            sa.Column("error", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("idx_retention_runs_tenant", "retention_runs", ["tenant_id"])
        op.create_index("idx_retention_runs_created", "retention_runs", ["created_at"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("idx_retention_runs_created", table_name="retention_runs")
        op.drop_index("idx_retention_runs_tenant", table_name="retention_runs")
        op.drop_table("retention_runs")
    except Exception:
        pass
