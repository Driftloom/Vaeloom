"""Learning admission ledger + idempotency anchor.

Revision ID: 0030
Revises: 0029
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
    CREATE TABLE IF NOT EXISTS learning_events (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        tenant_id UUID,
        event_id VARCHAR(128) NOT NULL,
        signal_type VARCHAR(50) NOT NULL DEFAULT 'trajectory',
        source VARCHAR(50) NOT NULL DEFAULT 'trajectory_feedback',
        payload JSON NOT NULL DEFAULT '{}',
        confidence FLOAT,
        status VARCHAR(20) NOT NULL DEFAULT 'admitted',
        reason VARCHAR(200) NOT NULL DEFAULT 'admitted',
        correlation_id VARCHAR(128),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    """))
    op.execute(sa.text("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_learning_events_ws_event'
        ) THEN
            ALTER TABLE learning_events ADD CONSTRAINT uq_learning_events_ws_event UNIQUE (workspace_id, event_id);
        END IF;
    END $$;
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_learning_events_workspace ON learning_events (workspace_id);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_learning_events_ws_status ON learning_events (workspace_id, status);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_learning_events_event_id ON learning_events (event_id);"))


def downgrade() -> None:
    try:
        op.drop_index("idx_learning_events_event_id", table_name="learning_events")
    except Exception:
        pass
    try:
        op.drop_index("idx_learning_events_ws_status", table_name="learning_events")
    except Exception:
        pass
    try:
        op.drop_index("idx_learning_events_workspace", table_name="learning_events")
    except Exception:
        pass
    try:
        op.drop_table("learning_events")
    except Exception:
        pass
