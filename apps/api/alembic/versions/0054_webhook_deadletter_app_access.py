"""Restore vaeloom_app access on webhook_deliveries + dead_letter_events.

Revision ID: 0054
Revises: 0053
Create Date: 2026-09-23

Incident: 0052 removed vaeloom_app from USING (true) grants; 0053 scoped
policies could not cover these two tables because the LIVE columns lack any
scope key (verified on live Supabase 2026-09-23: webhook_deliveries has NO
tenant_id despite the ORM model; dead_letter_events has NO tenant/workspace
columns). Result: webhook_service.dispatch INSERTs fail live as vaeloom_app.

Fix: explicit USING (true) restore for vaeloom_app on exactly these two
tables — accepted risk, documented: rows are operational delivery records,
keyed by webhook_id/original_event_id, never cross-tenant PII stores.
Revisit if scope columns are added (then replace with GUC branches like 0053).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0054"
down_revision: Union[str, None] = "0053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0054"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0054"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0054"))
        print(f"[0054] skipped statement: {e}")


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    for table, pol in (
        ("webhook_deliveries", "p_webhook_deliveries_service"),
        ("dead_letter_events", "p_dead_letter_events_service"),
    ):
        run(f"DROP POLICY IF EXISTS {pol} ON public.{table};")
        run(f"""
            CREATE POLICY {pol} ON public.{table} FOR ALL
            TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true);
        """)


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return

    conn = op.get_bind()
    run = lambda s: _safe(conn, s)

    for table, pol in (
        ("webhook_deliveries", "p_webhook_deliveries_service"),
        ("dead_letter_events", "p_dead_letter_events_service"),
    ):
        run(f"DROP POLICY IF EXISTS {pol} ON public.{table};")
        run(f"""
            CREATE POLICY {pol} ON public.{table} FOR ALL
            TO service_role, postgres USING (true) WITH CHECK (true);
        """)
