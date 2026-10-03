"""Audit events immutable append-only RLS and mutation trigger (0064).

Revision ID: 0064
Revises: 0063
Create Date: 2026-10-03

Why this exists
---------------
Audit events must form an authentic, tamper-evident, append-only audit trail
to satisfy NIST SP 800-207 and CISA Zero Trust requirements.
Previously, migration 0036 applied a blanket `FOR ALL` RLS policy to `audit_events`,
which allowed tenant roles to execute UPDATE and DELETE statements against their own logs.

This revision:
1. Replaces the `FOR ALL` policy with dedicated `FOR SELECT` and `FOR INSERT` policies.
2. Revokes UPDATE and DELETE privileges on `audit_events` from `vaeloom_app`.
3. Attaches an immutable trigger on `audit_events` that raises a hard exception
   if any UPDATE or DELETE is attempted.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0064"
down_revision: Union[str, None] = "0063"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TENANT_PREDICATE = "tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # 1. Drop existing permissive FOR ALL policy
    op.execute("DROP POLICY IF EXISTS p_audit_events_tenant ON audit_events;")

    # 2. Add append-only + read-only policies for tenants
    op.execute(
        f"CREATE POLICY p_audit_events_tenant_select ON audit_events "
        f"FOR SELECT USING ({TENANT_PREDICATE});"
    )
    op.execute(
        f"CREATE POLICY p_audit_events_tenant_insert ON audit_events "
        f"FOR INSERT WITH CHECK ({TENANT_PREDICATE});"
    )

    # 3. Explicitly revoke UPDATE and DELETE from runtime app role
    op.execute("REVOKE UPDATE, DELETE ON audit_events FROM vaeloom_app;")

    # 4. Kernel-level trigger enforcing absolute immutability on audit_events
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_events is an immutable, append-only log: UPDATE and DELETE operations are forbidden.';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;")
    op.execute(
        """
        CREATE TRIGGER trg_audit_events_immutable
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_events_mutation();
        """
    )

    _assert_coverage(bind)


def _assert_coverage(bind) -> None:
    """Re-run the end-state coverage guard, because 0064 is the terminal migration.

    `0060_verify_rls_coverage` was written to be the last revision so it could see
    the finished schema and raise if any table lacked RLS or a policy. Attaching
    subsequent migrations moves that guard earlier in the chain. Repeating the same
    end-state assertion here restores the property the audit depended on: a table or
    policy modification cannot leave the schema unprotected with nothing after it to notice.
    """
    tables = [
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name <> 'alembic_version' ORDER BY 1;"
            )
        ).fetchall()
    ]
    if not tables:
        raise RuntimeError(
            "0064 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

    unprotected: list[str] = []
    policyless: list[str] = []
    for table in tables:
        rls = bind.execute(
            sa.text(
                "SELECT rowsecurity FROM pg_tables "
                f"WHERE schemaname = 'public' AND tablename = '{table}';"
            )
        ).fetchall()
        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        count = bind.execute(
            sa.text(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        ).fetchall()
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unprotected or policyless:
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}"
            )
        if policyless:
            problems.append(f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}")
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute("DROP TRIGGER IF EXISTS trg_audit_events_immutable ON audit_events;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_events_mutation();")
    op.execute("DROP POLICY IF EXISTS p_audit_events_tenant_select ON audit_events;")
    op.execute("DROP POLICY IF EXISTS p_audit_events_tenant_insert ON audit_events;")
    op.execute(
        f"CREATE POLICY p_audit_events_tenant ON audit_events "
        f"FOR ALL USING ({TENANT_PREDICATE}) WITH CHECK ({TENANT_PREDICATE});"
    )
    op.execute("GRANT UPDATE, DELETE ON audit_events TO vaeloom_app;")
