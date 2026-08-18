"""Fix memories RLS: composite → workspace-only

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-18 01:30:00.000000

P0-02 FIX: The memories table had a COMPOSITE RLS policy requiring both
workspace_id AND tenant_id. tenant_id is populated from the JWT claim, but
not all auth flows include it. This caused all memory queries to return
empty for users without tenant_id in their token.

Fix: Change memories to WORKSPACE_ONLY policy. Workspace isolation is
sufficient — each workspace belongs to one user via Workspace.user_id.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Drop the composite policy
    op.execute("DROP POLICY IF EXISTS p_memories_workspace ON memories")

    # Create workspace-only policy
    op.execute(
        "CREATE POLICY p_memories_workspace ON memories "
        "USING (workspace_id = current_setting('app.workspace_id', true)::uuid) "
        "WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid)"
    )

    # Ensure FORCE RLS
    op.execute("ALTER TABLE memories FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Restore composite policy
    op.execute("DROP POLICY IF EXISTS p_memories_workspace ON memories")

    op.execute(
        "CREATE POLICY p_memories_workspace ON memories "
        "USING (workspace_id = current_setting('app.workspace_id', true)::uuid "
        "AND tenant_id = current_setting('app.tenant_id', true)::uuid) "
        "WITH CHECK (workspace_id = current_setting('app.workspace_id', true)::uuid "
        "AND tenant_id = current_setting('app.tenant_id', true)::uuid)"
    )

    op.execute("ALTER TABLE memories FORCE ROW LEVEL SECURITY")
