"""Shared JWT revocation state + residual RLS policy (AUTH-REV-01).

Revision ID: 0037
Revises: 0036

- auth_sessions.jti: per-token identifier so revocation can target the exact
  session row (previously only the full token string identified a row).
- revoked_user_cutoffs: server-side revoke-all watermark per user
  (previously process-local dict, invisible to other workers).
- iam_user_roles tenant policy via users join (residual from 0036 audit).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0037"
down_revision: Union[str, None] = "0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        try:
            conn.execute(sa.text(sql))
        except Exception as e:
            print(f"0037 skipped statement ({e}): {sql[:120]}")
        return
    conn.execute(sa.text("SAVEPOINT sp_0037"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0037"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0037"))
        print(f"0037 skipped statement ({e}): {sql[:120]}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"

    try:
        cols = {c["name"] for c in sa.inspect(bind).get_columns("auth_sessions")}
    except Exception:
        cols = set()
    if "jti" not in cols:
        op.add_column("auth_sessions", sa.Column("jti", sa.String(64), nullable=True))
    if is_pg:
        _safe(bind, "CREATE INDEX IF NOT EXISTS idx_auth_sessions_jti ON auth_sessions (jti)")
    else:
        try:
            op.create_index("idx_auth_sessions_jti", "auth_sessions", ["jti"])
        except Exception:
            pass

    try:
        has_cutoffs = bind.dialect.has_table(bind, "revoked_user_cutoffs")
    except Exception:
        has_cutoffs = False
    if not has_cutoffs:
        op.create_table(
            "revoked_user_cutoffs",
            sa.Column("user_id", sa.UUID(), primary_key=True, nullable=False),
            sa.Column("cutoff_unix", sa.BigInteger(), nullable=False),
            sa.Column(
                "created_at", sa.DateTime(timezone=True),
                server_default=sa.func.now(), nullable=False,
            ),
        )

    if is_pg:
        _safe(bind, "ALTER TABLE revoked_user_cutoffs ENABLE ROW LEVEL SECURITY")
        _safe(bind, "ALTER TABLE revoked_user_cutoffs FORCE ROW LEVEL SECURITY")
        # Cutoffs are user-owned watermarks; service reads them during auth.
        _safe(bind, "DROP POLICY IF EXISTS p_cutoffs_service ON revoked_user_cutoffs")
        _safe(
            bind,
            "CREATE POLICY p_cutoffs_service ON revoked_user_cutoffs "
            "FOR ALL USING (true) WITH CHECK (true)",
        )
        # Residual: iam_user_roles scoped through the user's tenant.
        _safe(bind, "DROP POLICY IF EXISTS p_iam_user_roles_tenant ON iam_user_roles")
        _safe(
            bind,
            "CREATE POLICY p_iam_user_roles_tenant ON iam_user_roles FOR ALL "
            "USING (EXISTS (SELECT 1 FROM users u WHERE u.id = user_id "
            "AND u.tenant_id::text = "
            "NULLIF(current_setting('app.tenant_id', true), ''))) "
            "WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = user_id "
            "AND u.tenant_id::text = "
            "NULLIF(current_setting('app.tenant_id', true), '')))",
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        _safe(bind, "DROP POLICY IF EXISTS p_cutoffs_service ON revoked_user_cutoffs")
        _safe(bind, "DROP POLICY IF EXISTS p_iam_user_roles_tenant ON iam_user_roles")
        _safe(bind, "DROP INDEX IF EXISTS idx_auth_sessions_jti")
    else:
        try:
            op.drop_index("idx_auth_sessions_jti", table_name="auth_sessions")
        except Exception:
            pass
    try:
        op.drop_column("auth_sessions", "jti")
    except Exception:
        pass
    try:
        op.drop_table("revoked_user_cutoffs")
    except Exception:
        pass
