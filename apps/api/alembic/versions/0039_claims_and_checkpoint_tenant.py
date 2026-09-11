"""Atomic tool-idempotency claims + checkpoint tenant binding
(IDEM-RACE-01, LOOP-RESUME-01).

Revision ID: 0039
Revises: 0038

- tool_idempotency.claim_token / lease_expires_at: support the atomic
  INSERT-claim protocol (winner owns execution; losers observe). Status
  values: 'claimed' (in-flight lease) | 'succeeded' (result stored) |
  'failed' (reclaimable). Legacy rows keep status 'succeeded'.
- loop_checkpoints.tenant_id: LoopState tenant binding for resume
  isolation parity with the graph path (LOOP-RESUME-01). Policy tightened to
  workspace AND tenant (no live rows; fail-closed for legacy NULLs).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0039"
down_revision: Union[str, None] = "0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        try:
            conn.execute(sa.text(sql))
        except Exception as e:
            print(f"0039 skipped statement ({e}): {sql[:120]}")
        return
    conn.execute(sa.text("SAVEPOINT sp_0039"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0039"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0039"))
        print(f"0039 skipped statement ({e}): {sql[:120]}")


def _cols(bind, table: str) -> set:
    try:
        return {c["name"] for c in sa.inspect(bind).get_columns(table)}
    except Exception:
        return set()


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"

    tc = _cols(bind, "tool_idempotency")
    if "claim_token" not in tc:
        op.add_column("tool_idempotency", sa.Column("claim_token", sa.String(64), nullable=True))
    if "lease_expires_at" not in tc:
        op.add_column(
            "tool_idempotency",
            sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        )
    _safe(bind, "CREATE INDEX IF NOT EXISTS idx_tool_idem_claim ON tool_idempotency (workspace_id, idem_key)")
    # Legacy success rows predate the claim protocol; normalize explicitly.
    _safe(
        bind,
        "UPDATE tool_idempotency SET status = 'succeeded' "
        "WHERE status NOT IN ('claimed', 'succeeded', 'failed')",
    )

    lc = _cols(bind, "loop_checkpoints")
    if "tenant_id" not in lc:
        op.add_column("loop_checkpoints", sa.Column("tenant_id", sa.String(255), nullable=True))
    _safe(bind, "CREATE INDEX IF NOT EXISTS idx_loop_ckpt_tenant ON loop_checkpoints (tenant_id)")
    # CAS-DEAD-01: backfill the version column from the JSON payload so the
    # atomic UPDATE-WHERE-version path matches legacy rows (NULL column never
    # equals, which would conflict every legacy writer).
    if is_pg:
        _safe(
            bind,
            "UPDATE loop_checkpoints SET state_version = (state_json->>'state_version')::int "
            "WHERE state_version IS NULL AND (state_json->>'state_version') IS NOT NULL",
        )
    else:
        _safe(
            bind,
            "UPDATE loop_checkpoints SET state_version = "
            "CAST(json_extract(state_json, '$.state_version') AS INTEGER) "
            "WHERE state_version IS NULL AND json_extract(state_json, '$.state_version') IS NOT NULL",
        )

    if is_pg:
        _safe(bind, "DROP POLICY IF EXISTS p_loop_checkpoints_workspace ON loop_checkpoints")
        _safe(
            bind,
            "CREATE POLICY p_loop_checkpoints_scope ON loop_checkpoints FOR ALL "
            "USING (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '') "
            "AND tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')) "
            "WITH CHECK (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '') "
            "AND tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))",
        )


def downgrade() -> None:
    bind = op.get_bind()
    is_pg = op.get_context().dialect.name == "postgresql"
    if is_pg:
        _safe(bind, "DROP POLICY IF EXISTS p_loop_checkpoints_scope ON loop_checkpoints")
        _safe(
            bind,
            "CREATE POLICY p_loop_checkpoints_workspace ON loop_checkpoints FOR ALL "
            "USING (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')) "
            "WITH CHECK (workspace_id::text = NULLIF(current_setting('app.workspace_id', true), ''))",
        )
        _safe(bind, "DROP INDEX IF EXISTS idx_loop_ckpt_tenant")
        _safe(bind, "DROP INDEX IF EXISTS idx_tool_idem_claim")
    for col in ("tenant_id",):
        try:
            op.drop_column("loop_checkpoints", col)
        except Exception:
            pass
    for col in ("claim_token", "lease_expires_at"):
        try:
            op.drop_column("tool_idempotency", col)
        except Exception:
            pass
