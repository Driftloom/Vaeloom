"""Supabase Security Advisor / Linter hardening (0055).

Revision ID: 0055
Revises: 0054
Create Date: 2026-09-23

Remediates Supabase Database Linter & Security Advisor findings:
1. 0008_rls_enabled_no_policy on public.outbox_events:
   Enables & forces RLS on public.outbox_events and installs p_outbox_events_service
   for service_role, postgres, vaeloom_app. Default-denies anon and authenticated.
2. 0028_anon_security_definer_function_executable & 0029_authenticated_security_definer_function_executable:
   Revokes execute from PUBLIC, anon, authenticated and drops unused SECURITY DEFINER
   helper functions auth_lookup_user_by_email and auth_lookup_session_by_token from public schema.
   (The backend performs pre-auth lookups using transaction-scoped GUCs app.lookup_email
   and app.lookup_token against RLS-protected tables; these functions are redundant attack surface).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0055"
down_revision: Union[str, None] = "0054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0055"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0055"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0055"))
        print(f"[0055] skipped statement: {e}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    # 1. Remediate rls_enabled_no_policy on outbox_events
    run("ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;")
    run("ALTER TABLE public.outbox_events FORCE ROW LEVEL SECURITY;")
    run("DROP POLICY IF EXISTS p_outbox_events_service ON public.outbox_events;")
    run("""
        CREATE POLICY p_outbox_events_service ON public.outbox_events FOR ALL
        TO service_role, postgres, vaeloom_app
        USING (true)
        WITH CHECK (true);
    """)

    # 2. Remediate anon/authenticated executable SECURITY DEFINER functions
    # Revoke from anon, authenticated, and PUBLIC, then drop functions
    run("REVOKE EXECUTE ON FUNCTION public.auth_lookup_user_by_email(text) FROM anon, authenticated, PUBLIC;")
    run("REVOKE EXECUTE ON FUNCTION public.auth_lookup_session_by_token(text) FROM anon, authenticated, PUBLIC;")
    run("DROP FUNCTION IF EXISTS public.auth_lookup_user_by_email(text);")
    run("DROP FUNCTION IF EXISTS public.auth_lookup_session_by_token(text);")


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    run("DROP POLICY IF EXISTS p_outbox_events_service ON public.outbox_events;")
