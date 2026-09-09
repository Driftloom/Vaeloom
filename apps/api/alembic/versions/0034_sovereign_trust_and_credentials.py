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


def upgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    json_type = postgresql.JSONB() if is_pg else sa.JSON()

    # 1. Sovereign Identities table
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
    op.create_index("idx_sovereign_identity_user_id", "sovereign_identities", ["user_id"])
    op.create_index("idx_sovereign_identity_did", "sovereign_identities", ["did"])

    # 2. Verifiable Credentials table
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
    op.create_index("idx_vc_user_status", "verifiable_credentials", ["user_id", "status"])
    op.create_index("idx_vc_workspace_status", "verifiable_credentials", ["workspace_id", "status"])
    op.create_index("idx_vc_credential_type", "verifiable_credentials", ["credential_type"])

    # 3. CRDT Sync Deltas ledger
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
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_crdt_workspace_entity", "crdt_sync_deltas", ["workspace_id", "entity_type", "hlc_timestamp"])
    op.create_index("idx_crdt_user_hlc", "crdt_sync_deltas", ["user_id", "hlc_timestamp"])

    # Enforce RLS on PostgreSQL
    if is_pg:
        for tbl in ["sovereign_identities", "verifiable_credentials", "crdt_sync_deltas"]:
            op.execute(sa.text(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY"))
            op.execute(sa.text(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY"))

        op.execute(sa.text("""
            CREATE POLICY p_sovereign_identities_user ON sovereign_identities
            FOR ALL
            USING (
                user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
            WITH CHECK (
                user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
        """))

        op.execute(sa.text("""
            CREATE POLICY p_verifiable_credentials_workspace ON verifiable_credentials
            FOR ALL
            USING (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
            WITH CHECK (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
        """))

        op.execute(sa.text("""
            CREATE POLICY p_crdt_sync_deltas_workspace ON crdt_sync_deltas
            FOR ALL
            USING (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
            WITH CHECK (
                workspace_id::text = current_setting('app.workspace_id', true)
                OR user_id::text = current_setting('app.user_id', true)
                OR current_setting('app.is_admin', true) = 'true'
            )
        """))


def downgrade() -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        op.execute(sa.text("DROP POLICY IF EXISTS p_crdt_sync_deltas_workspace ON crdt_sync_deltas"))
        op.execute(sa.text("DROP POLICY IF EXISTS p_verifiable_credentials_workspace ON verifiable_credentials"))
        op.execute(sa.text("DROP POLICY IF EXISTS p_sovereign_identities_user ON sovereign_identities"))

    op.drop_table("crdt_sync_deltas")
    op.drop_table("verifiable_credentials")
    op.drop_table("sovereign_identities")
