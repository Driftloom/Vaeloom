"""Enterprise Registries (0056): tool_registry, model_registry, policy_registry, prompt_versions, evaluation_records.

Revision ID: 0056
Revises: 0055
Create Date: 2026-09-24

Establishes authoritative database-backed registries for:
- Tools (declarative schema, risk, capabilities, permissions)
- Models (catalog, tiers, provider config, cost, health)
- Policies (guardrails, approval conditions, dynamic thresholds)
- Prompts (versioned templates, tenant overrides, canary percentages)
- Evaluations (agent run metrics, groundedness, latency, cost tracking)

Enables full PostgreSQL Row-Level Security (RLS) on all 5 tables.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0056"
down_revision: Union[str, None] = "0055"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _safe_pg(conn, sql: str) -> None:
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0056"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0056"))
    except Exception as e:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0056"))
        print(f"[0056] skipped pg statement: {e}")


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    uuid_col = sa.UUID(as_uuid=True) if is_pg else sa.String(36)
    json_col = postgresql.JSONB() if is_pg else sa.JSON()

    # 1. tool_registry
    op.create_table(
        "tool_registry",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("tool_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0.0"),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, server_default="general"),
        sa.Column("input_schema", json_col, nullable=False),
        sa.Column("output_schema", json_col, nullable=False),
        sa.Column("required_permissions", json_col, nullable=False),
        sa.Column("data_scopes", json_col, nullable=False),
        sa.Column("risk_level", sa.String(50), nullable=False, server_default="LOW"),
        sa.Column("side_effects", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("idempotent", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("retry_policy", json_col, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("tenant_scope", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("workspace_scope", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("tenant_id", uuid_col, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", uuid_col, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_tool_registry_tool_id", "tool_registry", ["tool_id"])
    op.create_index("idx_tool_registry_lookup", "tool_registry", ["tool_id", "is_active", "workspace_id"])

    # 2. model_registry
    op.create_table(
        "model_registry",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("model_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(100), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="latest"),
        sa.Column("tier", sa.String(50), nullable=False, server_default="balanced"),
        sa.Column("context_window", sa.Integer(), nullable=False, server_default="128000"),
        sa.Column("cost_per_1k_input", sa.Float(), nullable=False, server_default="0.001"),
        sa.Column("cost_per_1k_output", sa.Float(), nullable=False, server_default="0.002"),
        sa.Column("capabilities", json_col, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("health_status", sa.String(50), nullable=False, server_default="healthy"),
        sa.Column("latency_p95_ms", sa.Float(), nullable=True),
        sa.Column("tenant_id", uuid_col, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", uuid_col, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_model_registry_model_id", "model_registry", ["model_id"])
    op.create_index("idx_model_registry_lookup", "model_registry", ["tier", "health_status", "is_active"])

    # 3. policy_registry
    op.create_table(
        "policy_registry",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("policy_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False),
        sa.Column("target", sa.String(100), nullable=False, server_default="*"),
        sa.Column("rules", json_col, nullable=False),
        sa.Column("risk_threshold", sa.String(50), nullable=False, server_default="MEDIUM"),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tenant_id", uuid_col, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", uuid_col, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_policy_registry_policy_id", "policy_registry", ["policy_id"])
    op.create_index("idx_policy_registry_scope", "policy_registry", ["scope", "target", "is_active"])

    # 4. prompt_versions
    op.create_table(
        "prompt_versions",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("prompt_id", sa.String(100), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0.0"),
        sa.Column("agent_scope", sa.String(100), nullable=False, server_default="*"),
        sa.Column("template", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("variables", json_col, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("canary_percentage", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("tenant_id", uuid_col, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", uuid_col, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_prompt_versions_prompt_id", "prompt_versions", ["prompt_id"])
    op.create_index("idx_prompt_versions_lookup", "prompt_versions", ["prompt_id", "is_active", "agent_scope"])

    # 5. evaluation_records
    op.create_table(
        "evaluation_records",
        sa.Column("id", uuid_col, primary_key=True),
        sa.Column("eval_id", sa.String(100), nullable=False),
        sa.Column("execution_id", sa.String(100), nullable=True),
        sa.Column("agent_name", sa.String(100), nullable=False),
        sa.Column("intent", sa.String(100), nullable=False),
        sa.Column("accuracy_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("groundedness_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("tool_selection_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("verdict", sa.String(50), nullable=False, server_default="PASS"),
        sa.Column("metrics", json_col, nullable=False),
        sa.Column("tenant_id", uuid_col, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("workspace_id", uuid_col, sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_eval_records_eval_id", "evaluation_records", ["eval_id"])
    op.create_index("idx_eval_records_agent_verdict", "evaluation_records", ["agent_name", "verdict", "created_at"])

    # PostgreSQL RLS Enforcement
    if is_pg:
        conn = bind
        tables = [
            "tool_registry",
            "model_registry",
            "policy_registry",
            "prompt_versions",
            "evaluation_records",
        ]
        for tbl in tables:
            _safe_pg(conn, f"ALTER TABLE public.{tbl} ENABLE ROW LEVEL SECURITY;")
            _safe_pg(conn, f"ALTER TABLE public.{tbl} FORCE ROW LEVEL SECURITY;")
            _safe_pg(conn, f"DROP POLICY IF EXISTS p_{tbl}_service ON public.{tbl};")
            _safe_pg(conn, f"""
                CREATE POLICY p_{tbl}_service ON public.{tbl} FOR ALL
                TO service_role, postgres, vaeloom_app
                USING (true)
                WITH CHECK (true);
            """)
            _safe_pg(conn, f"DROP POLICY IF EXISTS p_{tbl}_tenant_isolation ON public.{tbl};")
            _safe_pg(conn, f"""
                CREATE POLICY p_{tbl}_tenant_isolation ON public.{tbl} FOR ALL
                TO authenticated
                USING (
                    workspace_id IS NULL OR 
                    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
                )
                WITH CHECK (
                    workspace_id IS NULL OR 
                    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
                );
            """)


def downgrade() -> None:
    op.drop_table("evaluation_records")
    op.drop_table("prompt_versions")
    op.drop_table("policy_registry")
    op.drop_table("model_registry")
    op.drop_table("tool_registry")
