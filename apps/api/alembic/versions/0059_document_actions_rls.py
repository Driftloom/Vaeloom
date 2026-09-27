"""Enable RLS on document_actions.

Revision ID: 0059
Revises: 0058
Create Date: 2026-09-27

Why this exists
---------------
Measured on a freshly migrated PostgreSQL 16 database, `document_actions` was the
**only** one of 90 tables with `rowsecurity = false` and zero policies.

The cause is migration ordering, not a missing statement. Migrations `0028` and
`0036` both apply RLS to `document_actions`, but `0048` is what creates the
table. By the time 0036 ran, the table did not exist, the statement was skipped,
and no later migration re-applied it. So the table was created *after* the
security policies aimed at it had already gone past.

That is a real exposure, not a cosmetic gap: `document_actions` is the audit trail
for document moves and deletions, and without RLS any role able to reach the table
reads every tenant's history.

`tenant_id` is nullable on this table while `workspace_id` is not, so the policy
keys on `workspace_id` and treats `app.tenant_id` as an additional allowance. A
workspace-scoped check on the non-nullable column is the one that can be relied on
to be populated.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0059"
down_revision: Union[str, None] = "0058"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "document_actions"


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        # SQLite has no RLS; the suite relies on application-layer scoping.
        return

    if not _has_table(TABLE):
        # 0058/0048 ordering should guarantee it, but a hard failure here would
        # be better than silently recording a migration that did nothing.
        raise RuntimeError(
            f"{TABLE} does not exist; 0048 must run before 0059. Refusing to "
            "record this revision as applied without its RLS policies."
        )

    op.execute(f"ALTER TABLE {TABLE} ENABLE ROW LEVEL SECURITY;")
    op.execute(f"ALTER TABLE {TABLE} FORCE ROW LEVEL SECURITY;")

    op.execute(f"""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = 'p_{TABLE}_workspace' AND tablename = '{TABLE}'
        ) THEN
            CREATE POLICY p_{TABLE}_workspace ON {TABLE} FOR ALL
            TO vaeloom_app, service_role, postgres
            USING (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            )
            WITH CHECK (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
            );
        END IF;
    END $$;
    """)


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite" or not _has_table(TABLE):
        return
    op.execute(f"DROP POLICY IF EXISTS p_{TABLE}_workspace ON {TABLE};")
    # RLS is deliberately left enabled. Turning it off would leave the table
    # readable by every role, which is the state this migration exists to fix.
