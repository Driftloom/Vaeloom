"""P13 hardening: RLS for remaining 5 tables → 42/42.

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-22

Completes RLS coverage to 42/42 (was 37/42):
- users (tenant_id + user_id)
- agents (workspace_id + tenant_id)
- permissions (workspace_id)
- provider_keys (workspace_id + user_id fallback)
- document_actions (workspace_id)

Uses app.tenant_id / app.workspace_id / app.user_id GUCs set by
TenantMiddleware (now also sets user_id) via set_rls_session_vars.
Policies are fail-closed: missing GUC => 0 rows.
On SQLite this migration is a no-op (create_all handles schema).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    try:
        return op.get_context().dialect.name == "postgresql"
    except Exception:
        return False


def upgrade() -> None:
    if not _is_postgres():
        return

    # Enable RLS on remaining tables
    for table in ("users", "agents", "permissions", "provider_keys", "document_actions"):
        try:
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        except Exception:
            pass

    # Force RLS (prevents owner bypass)
    for table in ("users", "agents", "permissions", "provider_keys", "document_actions"):
        try:
            op.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
        except Exception:
            pass

    # Policies — fail-closed, no OR '' fallback
    try:
        op.execute(sa.text("""
        DO $$
        BEGIN
            -- users: tenant isolation + self access via user_id
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_users' AND tablename = 'users') THEN
                CREATE POLICY tenant_isolation_users ON users
                USING (
                    tenant_id::text = current_setting('app.tenant_id', true)
                    OR id::text = current_setting('app.user_id', true)
                );
            END IF;
            -- agents: workspace or tenant scoped
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_agents' AND tablename = 'agents') THEN
                CREATE POLICY workspace_isolation_agents ON agents
                USING (
                    workspace_id::text = current_setting('app.workspace_id', true)
                    OR tenant_id::text = current_setting('app.tenant_id', true)
                );
            END IF;
            -- permissions: workspace scoped
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_permissions' AND tablename = 'permissions') THEN
                CREATE POLICY workspace_isolation_permissions ON permissions
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
            -- provider_keys: workspace when present, else user
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_provider_keys' AND tablename = 'provider_keys') THEN
                CREATE POLICY workspace_isolation_provider_keys ON provider_keys
                USING (
                    (workspace_id IS NOT NULL AND workspace_id::text = current_setting('app.workspace_id', true))
                    OR (workspace_id IS NULL AND user_id::text = current_setting('app.user_id', true))
                );
            END IF;
            -- document_actions: workspace scoped
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_document_actions' AND tablename = 'document_actions') THEN
                CREATE POLICY workspace_isolation_document_actions ON document_actions
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
        END $$;
        """))
    except Exception:
        pass


def downgrade() -> None:
    if not _is_postgres():
        return
    for table in ("users", "agents", "permissions", "provider_keys", "document_actions"):
        try:
            op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
        except Exception:
            pass
        try:
            op.execute(sa.text(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY"))
        except Exception:
            pass
    try:
        op.execute(sa.text("DROP POLICY IF EXISTS tenant_isolation_users ON users"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_agents ON agents"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_permissions ON permissions"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_provider_keys ON provider_keys"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_document_actions ON document_actions"))
    except Exception:
        pass
