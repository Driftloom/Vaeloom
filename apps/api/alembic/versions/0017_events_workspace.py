"""Add workspace_id to events for server-side filtering (3B)

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-21

Adds workspace_id UUID FK to events for honest workspace scoping.
Before: GET /events was user-scoped only, frontend did client-side
payload.workspaceId filter which leaked across workspaces.
After: GET /events?workspace_id= filters at DB level.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    # Add workspace_id column to events
    if not _has_column("events", "workspace_id"):
        op.add_column(
            "events",
            sa.Column("workspace_id", UUID(as_uuid=True), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        )
        # Backfill: set workspace_id from payload->>'workspaceId' or payload->>'workspace_id' where possible, else first workspace of user
        # For existing rows, try to extract from payload, otherwise leave NULL (will be visible as global until migrated)
        try:
            op.execute(
                """
                UPDATE events
                SET workspace_id = (
                    SELECT w.id::text::uuid
                    FROM workspaces w
                    WHERE w.user_id = events.user_id
                    LIMIT 1
                )
                WHERE workspace_id IS NULL
                AND payload ? 'workspaceId' = false
                AND payload ? 'workspace_id' = false
                """
            )
        except Exception:
            pass
        # Update from payload where present
        try:
            # Postgres JSON extraction
            op.execute(
                """
                UPDATE events
                SET workspace_id = NULLIF(payload->>'workspaceId', '')::uuid
                WHERE payload ? 'workspaceId' AND payload->>'workspaceId' ~ '^[0-9a-fA-F-]{36}$'
                """
            )
            op.execute(
                """
                UPDATE events
                SET workspace_id = NULLIF(payload->>'workspace_id', '')::uuid
                WHERE workspace_id IS NULL AND payload ? 'workspace_id' AND payload->>'workspace_id' ~ '^[0-9a-fA-F-]{36}$'
                """
            )
        except Exception:
            pass

    # Create index for filtering
    try:
        op.create_index("idx_events_workspace_id", "events", ["workspace_id"])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index("idx_events_workspace_id", table_name="events")
    except Exception:
        pass
    if _has_column("events", "workspace_id"):
        op.drop_column("events", "workspace_id")
