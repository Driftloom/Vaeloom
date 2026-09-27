"""Create the webhooks and webhook_deliveries tables with RLS.

Revision ID: 0058
Revises: 0057
Create Date: 2026-09-27

Why this exists
---------------
`webhooks` and `webhook_deliveries` are ORM models (`models/schema.py`) and the
app has a live `webhooks` router, but **no migration in the chain ever created
them**. Eight migrations across five files (`0005`, `0010`, `0012` x2, `0013`,
`0053`, `0055`) apply RLS policies to these tables, and every one of those
statements was silently skipped by the `_safe()` wrapper on a fresh database
because the tables did not exist. The migration run still reported success.

So the failure mode was: green migrations, no tables, and an
`UndefinedTableError` at runtime the first time a webhook was used.

The column definitions mirror `models/schema.py` exactly. If a model and this
migration ever disagree, the model is the source of truth and this needs updating
in the same change.

Scoping
-------
`webhooks` carries `tenant_id` directly, so its policy is a tenant check.
`webhook_deliveries` has no tenant or workspace column of its own - it reaches the
tenant through `webhook_id` - so its policy has to join to the parent. A delivery
log is exactly the sort of table that leaks cross-tenant rows when a policy is
written against a column that does not exist, so the join is deliberate and the
test asserts the policy exists rather than trusting it.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0058"
down_revision: Union[str, None] = "0057"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    """Whether a table already exists.

    `dialect.has_table` needs a connection in this SQLAlchemy version; the
    inspector is the supported route and is what the rest of the chain uses.
    """
    return sa.inspect(op.get_bind()).has_table(name)


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    is_sqlite = _is_sqlite()

    if not _has_table("webhooks"):
        op.create_table(
            "webhooks",
            sa.Column("id", sa.UUID(), primary_key=True),
            sa.Column(
                "tenant_id",
                sa.UUID(),
                sa.ForeignKey("tenants.id"),
                nullable=False,
            ),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("url", sa.String(2048), nullable=False),
            sa.Column("secret", sa.String(512), nullable=False),
            sa.Column("events", sa.JSON(), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=True),
            sa.Column("retry_count", sa.Integer(), nullable=True),
            sa.Column("timeout_ms", sa.Integer(), nullable=True),
            sa.Column(
                "connector_id",
                sa.UUID(),
                sa.ForeignKey("connectors.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
        )
        op.create_index("idx_webhooks_tenant_id", "webhooks", ["tenant_id"])
        op.create_index("idx_webhooks_connector_id", "webhooks", ["connector_id"])

    if not _has_table("webhook_deliveries"):
        op.create_table(
            "webhook_deliveries",
            sa.Column("id", sa.UUID(), primary_key=True),
            sa.Column(
                "webhook_id",
                sa.UUID(),
                sa.ForeignKey("webhooks.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("event_type", sa.String(255), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=True),
            sa.Column("status", sa.String(20), nullable=True),
            sa.Column("status_code", sa.Integer(), nullable=True),
            sa.Column("response_body", sa.Text(), nullable=True),
            sa.Column("attempt", sa.Integer(), nullable=True),
            sa.Column("max_attempts", sa.Integer(), nullable=True),
            sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
        )
        op.create_index(
            "idx_webhook_deliveries_webhook_id", "webhook_deliveries", ["webhook_id"]
        )
        # The retry sweeper scans on (status, next_retry_at); without this it
        # table-scans the whole delivery log on every tick.
        op.create_index(
            "idx_webhook_deliveries_retry",
            "webhook_deliveries",
            ["status", "next_retry_at"],
        )

    if is_sqlite:
        # SQLite has no RLS; the test suite relies on application-layer scoping.
        return

    # RLS. Enabled and FORCED so the table owner is not exempt either.
    for table in ("webhooks", "webhook_deliveries"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = 'p_webhooks_tenant' AND tablename = 'webhooks'
        ) THEN
            CREATE POLICY p_webhooks_tenant ON webhooks FOR ALL
            TO vaeloom_app, service_role, postgres
            USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
            WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''));
        END IF;
    END $$;
    """)

    # No tenant column here, so the check has to reach the parent webhook. An
    # EXISTS subquery rather than a join so the policy stays a single expression.
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = 'p_webhook_deliveries_tenant'
              AND tablename = 'webhook_deliveries'
        ) THEN
            CREATE POLICY p_webhook_deliveries_tenant ON webhook_deliveries FOR ALL
            TO vaeloom_app, service_role, postgres
            USING (
                EXISTS (
                    SELECT 1 FROM webhooks w
                    WHERE w.id = webhook_deliveries.webhook_id
                      AND w.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM webhooks w
                    WHERE w.id = webhook_deliveries.webhook_id
                      AND w.tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
                )
            );
        END IF;
    END $$;
    """)


def downgrade() -> None:
    if not _is_sqlite():
        op.execute("DROP POLICY IF EXISTS p_webhook_deliveries_tenant ON webhook_deliveries;")
        op.execute("DROP POLICY IF EXISTS p_webhooks_tenant ON webhooks;")

    if _has_table("webhook_deliveries"):
        op.drop_index("idx_webhook_deliveries_retry", table_name="webhook_deliveries")
        op.drop_index("idx_webhook_deliveries_webhook_id", table_name="webhook_deliveries")
        op.drop_table("webhook_deliveries")
    if _has_table("webhooks"):
        op.drop_index("idx_webhooks_connector_id", table_name="webhooks")
        op.drop_index("idx_webhooks_tenant_id", table_name="webhooks")
        op.drop_table("webhooks")
