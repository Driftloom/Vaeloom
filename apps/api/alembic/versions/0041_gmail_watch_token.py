"""Gmail watch channel-token column + fixed scope helper (OP-RLS-01).

Revision ID: 0041
Revises: 0040

- gmail_watches.channel_token exists in the ORM model but is missing live
  (schema drift): the Gmail webhook's verification query 500s. Additive
  nullable column, zero risk to existing rows.
- (Re)creates app_gmail_watch_scope with channel columns as text (the 0040
  version failed: it assumed uuid channel columns).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0041"
down_revision: Union[str, None] = "0040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        try:
            conn.execute(sa.text(sql))
        except Exception as e:
            print(f"0041 skipped statement ({e}): {sql[:120]}")
        return
    conn.execute(sa.text("SAVEPOINT sp_0041"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0041"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0041"))
        print(f"0041 skipped statement ({e}): {sql[:120]}")


def _cols(bind, table: str) -> set:
    try:
        return {c["name"] for c in sa.inspect(bind).get_columns(table)}
    except Exception:
        return set()


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    if "channel_token" not in _cols(bind, "gmail_watches"):
        op.add_column("gmail_watches", sa.Column("channel_token", sa.String(255), nullable=True))
    if is_pg:
        _safe(bind, "DROP FUNCTION IF EXISTS app_gmail_watch_scope(text, text)")
        _safe(
            bind,
            """
            CREATE FUNCTION app_gmail_watch_scope(cid text, tok text)
            RETURNS TABLE(workspace_id uuid, tenant_id uuid)
            LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
            $$ SELECT CASE WHEN w.workspace_id ~ '^[0-9a-fA-F-]{36}$'
                     THEN w.workspace_id::uuid END,
                   (SELECT u.tenant_id FROM public.users u
                    JOIN public.workspaces x ON x.user_id = u.id
                    WHERE x.id::text = w.workspace_id)
               FROM public.gmail_watches w
               WHERE w.channel_id = cid AND w.channel_token = tok AND w.status = 'ACTIVE'
               LIMIT 1 $$
            """,
        )
        _safe(bind, "GRANT EXECUTE ON FUNCTION app_gmail_watch_scope(text, text) TO vaeloom_app")


def downgrade() -> None:
    bind = op.get_bind()
    if op.get_context().dialect.name == "postgresql":
        _safe(bind, "DROP FUNCTION IF EXISTS app_gmail_watch_scope(text, text)")
    try:
        op.drop_column("gmail_watches", "channel_token")
    except Exception:
        pass
