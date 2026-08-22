"""Durable scheduling: agent_schedules.last_run_at for claim/catch-up.

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-22

Adds last_run_at to agent_schedules so the background daemon can:
- dedup claims across multiple API instances (Redis SETNX + DB fallback)
- run bounded missed-run catch-up on startup
On SQLite this is a no-op via create_all fallback.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.add_column("agent_schedules", sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column("agent_schedules", "last_run_at")
    except Exception:
        pass
