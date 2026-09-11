"""Worker scope-resolution helpers (OP-RLS-01 daemon/webhook support).

Revision ID: 0040
Revises: 0039

Background paths (daemon scans, Gmail webhook, queue worker) legitimately
start without GUC context. These SECURITY DEFINER helpers resolve a narrow
scope from an already-authenticated credential (agent row, channel token)
so workers can establish RLS context without a privileged role:

- app_agent_scope(agent_id): tenant/workspace/user owning an agent row.
- app_gmail_watch_scope(channel_id, token_hash): workspace+tenant for a
  verified Gmail watch channel (the channel token is the credential).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0040"
down_revision: Union[str, None] = "0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        try:
            conn.execute(sa.text(sql))
        except Exception as e:
            print(f"0040 skipped statement ({e}): {sql[:120]}")
        return
    conn.execute(sa.text("SAVEPOINT sp_0040"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0040"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0040"))
        print(f"0040 skipped statement ({e}): {sql[:120]}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    _safe(bind, "DROP FUNCTION IF EXISTS app_agent_scope(uuid)")
    _safe(
        bind,
        """
        CREATE FUNCTION app_agent_scope(a uuid)
        RETURNS TABLE(tenant_id uuid, workspace_id uuid, user_id uuid)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
        $$ SELECT tenant_id, workspace_id, user_id FROM public.agents WHERE id = a $$
        """,
    )
    _safe(bind, "DROP FUNCTION IF EXISTS app_gmail_watch_scope(text, text)")
    _safe(
        bind,
        """
        CREATE FUNCTION app_gmail_watch_scope(cid text, tok text)
        RETURNS TABLE(workspace_id uuid, tenant_id uuid)
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
        $$ SELECT w.workspace_id,
               (SELECT u.tenant_id FROM public.users u
                JOIN public.workspaces x ON x.user_id = u.id
                WHERE x.id = w.workspace_id)
           FROM public.gmail_watches w
           WHERE w.channel_id = cid AND w.channel_token = tok AND w.status = 'ACTIVE'
           LIMIT 1 $$
        """,
    )
    _safe(bind, "GRANT EXECUTE ON FUNCTION app_agent_scope(uuid) TO vaeloom_app")
    _safe(bind, "GRANT EXECUTE ON FUNCTION app_gmail_watch_scope(text, text) TO vaeloom_app")


def downgrade() -> None:
    bind = op.get_bind()
    if op.get_context().dialect.name != "postgresql":
        return
    _safe(bind, "DROP FUNCTION IF EXISTS app_agent_scope(uuid)")
    _safe(bind, "DROP FUNCTION IF EXISTS app_gmail_watch_scope(text, text)")
