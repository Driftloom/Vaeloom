"""Phase B durable runtime: tool idempotency + checkpoint versioning.

Revision ID: 0029
Revises: 0028
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("""
    CREATE TABLE IF NOT EXISTS tool_idempotency (
        id UUID PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        idem_key VARCHAR(255) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        agent_id VARCHAR(255) NOT NULL DEFAULT '',
        request_id VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'succeeded',
        result_json JSON NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    """))
    op.execute(sa.text("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_tool_idempotency_ws_key'
        ) THEN
            ALTER TABLE tool_idempotency ADD CONSTRAINT uq_tool_idempotency_ws_key UNIQUE (workspace_id, idem_key);
        END IF;
    END $$;
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_tool_idempotency_ws_tool ON tool_idempotency (workspace_id, tool_name);"))
    op.execute(sa.text("ALTER TABLE loop_checkpoints ADD COLUMN IF NOT EXISTS state_version INTEGER NOT NULL DEFAULT 1;"))


def downgrade() -> None:
    try:
        op.drop_index("idx_tool_idempotency_ws_tool", table_name="tool_idempotency")
    except Exception:
        pass
    try:
        op.drop_table("tool_idempotency")
    except Exception:
        pass
    try:
        op.drop_column("loop_checkpoints", "state_version")
    except Exception:
        pass
