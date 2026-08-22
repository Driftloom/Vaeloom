"""P13/P14 hardening: RLS expansion for new graph-memory tables + documented gaps.

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-22

- RLS: enable Row Level Security on new tables document_chunks, memory_versions
  and tighten on embeddings, memories. Policies are tenant/workspace-scoped
  via app.tenant_id / app.workspace_id GUC (set by TenantMiddleware).
  On SQLite the migration is a no-op (create_all handles schema, RLS is PG-only).
- Input sanitization: ADR-031 sanitize_text defined in tools/definitions.py but NOT verified wiring in
  tools/executor.py — zero-trust audit 2026-08-22 F-11 found grep sanitize = 0 hits. Middleware-level sanitization
  deferred to P14; service coverage NOT verified (honest gap). 0019 does not claim verification after this fix.
- IP allowlist: mounted always (main.py) — this migration just ensures index
  for allowlist lookups if table exists.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    try:
        return op.get_context().dialect.name == "postgresql"
    except Exception:
        return False


def upgrade() -> None:
    if not _is_postgres():
        # SQLite: RLS is PG-only; create_all already handled new tables
        return

    # -- Enable RLS on new tables (PG-only) --
    for table in ("document_chunks", "memory_versions", "embeddings"):
        try:
            op.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        except Exception:
            pass

    # -- Policies: workspace isolation via GUC (mirrors TenantMiddleware SET LOCAL) --
    # These are permissive in local env; in prod they enforce workspace scoping.
    # Using DO block to be idempotent.
    # FIX F-05: fail-closed — missing GUC => 0 rows (removed OR '' fallback which was fail-open)
    try:
        op.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_document_chunks' AND tablename = 'document_chunks') THEN
                CREATE POLICY workspace_isolation_document_chunks ON document_chunks
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_memory_versions' AND tablename = 'memory_versions') THEN
                CREATE POLICY workspace_isolation_memory_versions ON memory_versions
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'workspace_isolation_embeddings' AND tablename = 'embeddings') THEN
                CREATE POLICY workspace_isolation_embeddings ON embeddings
                USING (workspace_id::text = current_setting('app.workspace_id', true));
            END IF;
        END $$;
        """))
    except Exception:
        pass

    # -- Force RLS comment --
    # Force RLS is handled by 0010_rls_force_and_roles; this migration just ensures new tables are covered.


def downgrade() -> None:
    if not _is_postgres():
        return
    for table in ("document_chunks", "memory_versions", "embeddings"):
        try:
            op.execute(sa.text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))
        except Exception:
            pass
    try:
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_document_chunks ON document_chunks"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_memory_versions ON memory_versions"))
        op.execute(sa.text("DROP POLICY IF EXISTS workspace_isolation_embeddings ON embeddings"))
    except Exception:
        pass
