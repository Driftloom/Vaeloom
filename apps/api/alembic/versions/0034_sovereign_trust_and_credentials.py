"""Create sovereign trust, verifiable credentials, and CRDT sync tables.

Revision ID: 0034
Revises: 0033
Create Date: 2026-09-09

Pillar 5 of PIOS Blueprint:
- Sovereign Identities with Ed25519 asymmetric cryptography and DIDs (did:vaeloom:<user-id>)
- W3C Verifiable Credentials with tamper-evident Ed25519 proofs
- Local-First Hybrid Logical Clock (HLC) CRDT synchronization ledger
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    """One statement per savepoint (PG): failures roll back only themselves."""
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        conn.execute(sa.text(sql))
        return
    conn.execute(sa.text("SAVEPOINT sp_0034"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0034"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0034"))
        print(f"0034 skipped statement ({e}): {sql[:120]}")


def _table_exists(bind, name: str) -> bool:
    try:
        return bool(bind.dialect.has_table(bind, name))
    except Exception:
        return False


def _index_exists(bind, name: str, table: str) -> bool:
    try:
        from sqlalchemy import inspect as _inspect

        return any(ix["name"] == name for ix in _inspect(bind).get_indexes(table))
    except Exception:
        return False


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    json_type = postgresql.JSONB() if is_pg else sa.JSON()
    bind = op.get_bind()

    # 1. Sovereign Identities table
    if not _table_exists(bind, "sovereign_identities"):
        op.create_table(
            "sovereign_identities",
            sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
            sa.Column("did", sa.String(255), unique=True, nullable=False),
            sa.Column("public_key", sa.Text(), nullable=False),
            sa.Column("encrypted_private_key", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
    if not _index_exists(bind, "idx_sovereign_identity_user_id", "sovereign_identities"):
        op.create_index("idx_sovereign_identity_user_id", "sovereign_identities", ["user_id"])
    if not _index_exists(bind, "idx_sovereign_identity_did", "sovereign_identities"):
        op.create_index("idx_sovereign_identity_did", "sovereign_identities", ["did"])

    # 2. Verifiable Credentials table
    if not _table_exists(bind, "verifiable_credentials"):
        op.create_table(
            "verifiable_credentials",
            sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
            sa.Column("credential_type", sa.String(100), nullable=False),
            sa.Column("subject_did", sa.String(255), nullable=False),
            sa.Column("issuer_did", sa.String(255), nullable=False),
            sa.Column("claims", json_type, nullable=False),
            sa.Column("proof", json_type, nullable=False),
            sa.Column("status", sa.String(20), server_default="ACTIVE", nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )
    for ix, cols in [
        ("idx_vc_user_status", ["user_id", "status"]),
        ("idx_vc_workspace_status", ["workspace_id", "status"]),
        ("idx_vc_credential_type", ["credential_type"]),
    ]:
        if not _index_exists(bind, ix, "verifiable_credentials"):
            op.create_index(ix, "verifiable_credentials", cols)

    # 3. CRDT Sync Deltas ledger
    if not _table_exists(bind, "crdt_sync_deltas"):
        op.create_table(
            "crdt_sync_deltas",
            sa.Column("id", sa.UUID(), primary_key=True, nullable=False),
            sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("workspace_id", sa.UUID(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
            sa.Column("client_id", sa.String(100), nullable=False),
            sa.Column("entity_type", sa.String(50), nullable=False),
            sa.Column("entity_id", sa.UUID(), nullable=False),
            sa.Column("hlc_timestamp", sa.String(100), nullable=False),
            sa.Column("operation", sa.String(20), nullable=False),
            sa.Column("encrypted_payload", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
    for ix, cols in [
        ("idx_crdt_workspace_entity", ["workspace_id", "entity_type", "hlc_timestamp"]),
        ("idx_crdt_user_hlc", ["user_id", "hlc_timestamp"]),
    ]:
        if not _index_exists(bind, ix, "crdt_sync_deltas"):
            op.create_index(ix, "crdt_sync_deltas", cols)

    # Enforce RLS on PostgreSQL — STRICT fail-closed (repaired 2026-09-11:
    # the original OR-user/OR-is_admin forms let user-scoped sessions read
    # foreign-workspace rows; is_admin GUC is never set by middleware).
    if is_pg:
        bind = op.get_bind()
        for tbl in ["sovereign_identities", "verifiable_credentials", "crdt_sync_deltas"]:
            _safe(bind, f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY")
            _safe(bind, f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY")

        _safe(bind, "DROP POLICY IF EXISTS p_sovereign_identities_user ON sovereign_identities")
        _safe(bind, """
            CREATE POLICY p_sovereign_identities_user ON sovereign_identities
            FOR ALL
            USING (user_id::text = NULLIF(current_setting('app.user_id', true), ''))
            WITH CHECK (user_id::text = NULLIF(current_setting('app.user_id', true), ''))
        """)

        _safe(bind, "DROP POLICY IF EXISTS p_verifiable_credentials_workspace ON verifiable_credentials")
        _safe(bind, """
            CREATE POLICY p_verifiable_credentials_workspace ON verifiable_credentials
            FOR ALL
            USING (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
            WITH CHECK (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
        """)

        _safe(bind, "DROP POLICY IF EXISTS p_crdt_sync_deltas_workspace ON crdt_sync_deltas")
        _safe(bind, """
            CREATE POLICY p_crdt_sync_deltas_workspace ON crdt_sync_deltas
            FOR ALL
            USING (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
            WITH CHECK (
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                AND user_id::text = NULLIF(current_setting('app.user_id', true), '')
            )
        """)


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute(sa.text("DROP POLICY IF EXISTS p_crdt_sync_deltas_workspace ON crdt_sync_deltas"))
        op.execute(sa.text("DROP POLICY IF EXISTS p_verifiable_credentials_workspace ON verifiable_credentials"))
        op.execute(sa.text("DROP POLICY IF EXISTS p_sovereign_identities_user ON sovereign_identities"))

    op.drop_table("crdt_sync_deltas")
    op.drop_table("verifiable_credentials")
    op.drop_table("sovereign_identities")
