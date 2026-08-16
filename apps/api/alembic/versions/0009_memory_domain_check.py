"""Add CHECK constraint on memories.domain for 6-memory taxonomy

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-17 00:00:00.000000

The ORM defines memories.domain as a plain String(100) with no validation.
Per ADR-022 and the 6-memory taxonomy (profile, document, career, episodic,
preference, working), a CHECK constraint is required to prevent arbitrary values.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALID_MEMORY_DOMAINS = (
    "profile",
    "document",
    "career",
    "episodic",
    "preference",
    "working",
)


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Backfill any NULL or invalid domain values to 'document' (safest default)
    domain_values = "', '".join(VALID_MEMORY_DOMAINS)
    op.execute(
        f"UPDATE memories SET domain = 'document' "
        f"WHERE domain IS NULL OR domain NOT IN ('{domain_values}')"
    )

    # Add CHECK constraint
    op.execute(
        f"ALTER TABLE memories "
        f"ADD CONSTRAINT chk_memories_domain "
        f"CHECK (domain IN ('{domain_values}'))"
    )


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    op.execute("ALTER TABLE memories DROP CONSTRAINT IF EXISTS chk_memories_domain")
