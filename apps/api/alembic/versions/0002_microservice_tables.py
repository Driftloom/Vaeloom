"""add microservice tables: analytics, audit, iam, knowledge-graph, notification-ext, recommendation, scheduler, plugin

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── Extend notifications with outgoing fields ───
    op.add_column("notifications", sa.Column("user_id", sa.UUID(), nullable=True))
    op.add_column("notifications", sa.Column("channel", sa.String(20), nullable=True))
    op.add_column("notifications", sa.Column("recipient", sa.String(500), nullable=True))
    op.add_column("notifications", sa.Column("subject", sa.String(500), nullable=True))
    op.add_column("notifications", sa.Column("status", sa.String(20), server_default="pending", nullable=False))
    op.add_column("notifications", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.alter_column("notifications", "workspace_id", nullable=True)

    # ─── Agent schedules ───
    op.create_table(
        "agent_schedules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("agent_id", sa.UUID(), nullable=False),
        sa.Column("cron", sa.String(100), nullable=False),
        sa.Column("input", postgresql.JSONB(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], name="fk_agent_schedules_agent_id", ondelete="CASCADE"),
    )

    # ─── Plugins ───
    op.create_table(
        "plugins",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("author", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("license", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("permissions", postgresql.JSONB(), nullable=False),
        sa.Column("capabilities", sa.ARRAY(sa.String(255)), nullable=False),
        sa.Column("hooks", sa.ARRAY(sa.String(255)), nullable=False),
        sa.Column("tags", sa.ARRAY(sa.String(255)), nullable=False),
        sa.Column("entry_point", sa.String(500), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("homepage", sa.String(1000), nullable=True),
        sa.Column("repository", sa.String(1000), nullable=True),
        sa.Column("icon", sa.String(1000), nullable=True),
        sa.Column("config_schema", postgresql.JSONB(), nullable=True),
        sa.Column("code", sa.Text(), nullable=True),
        sa.Column("min_app_version", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "plugin_executions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("plugin_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("output", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["plugin_id"], ["plugins.id"], name="fk_plugin_executions_plugin_id", ondelete="CASCADE"),
    )

    # ─── Analytics ───
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("properties", postgresql.JSONB(), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ─── Audit ───
    op.create_table(
        "audit_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("actor_id", sa.String(120), nullable=False),
        sa.Column("action", sa.String(120), nullable=False),
        sa.Column("resource", sa.String(80), nullable=False),
        sa.Column("resource_id", sa.String(120), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_events_tenant_action", "audit_events", ["tenant_id", "action"])
    op.create_index("idx_audit_events_created_at", "audit_events", ["created_at"])

    # ─── IAM ───
    op.create_table(
        "iam_users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "iam_user_roles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
        sa.ForeignKeyConstraint(["user_id"], ["iam_users.id"], name="fk_iam_user_roles_user_id", ondelete="CASCADE"),
    )

    # ─── Knowledge Graph ───
    op.create_table(
        "knowledge_nodes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("importance", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("properties", postgresql.JSONB(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "knowledge_edges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("relationship", sa.String(100), nullable=False),
        sa.Column("weight", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("properties", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["source_id"], ["knowledge_nodes.id"], name="fk_knowledge_edges_source_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_id"], ["knowledge_nodes.id"], name="fk_knowledge_edges_target_id", ondelete="CASCADE"),
    )
    op.create_index("idx_knowledge_edges_source", "knowledge_edges", ["source_id"])
    op.create_index("idx_knowledge_edges_target", "knowledge_edges", ["target_id"])

    # ─── Notification Templates & Subscribers ───
    op.create_table(
        "notification_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notification_subscribers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "notification_device_tokens",
        sa.Column("token", sa.String(500), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("token"),
    )

    # ─── Recommendation ───
    op.create_table(
        "recommendations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("items", postgresql.JSONB(), nullable=False),
        sa.Column("model_version", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "recommendation_feedback",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("recommendation_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.String(255), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("useful", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "user_preference_vectors",
        sa.Column("user_id", sa.String(255), nullable=False),
        sa.Column("tenant_id", sa.String(255), nullable=False),
        sa.Column("preference_vector", Vector(1536), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "tenant_id"),
    )

    # ─── Scheduler ───
    op.create_table(
        "scheduled_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("cron", sa.String(100), nullable=False),
        sa.Column("method", sa.String(10), nullable=True),
        sa.Column("url", sa.String(1000), nullable=True),
        sa.Column("event", sa.String(255), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("headers", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "job_executions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["job_id"], ["scheduled_jobs.id"], name="fk_job_executions_job_id", ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("job_executions")
    op.drop_table("scheduled_jobs")
    op.drop_table("user_preference_vectors")
    op.drop_table("recommendation_feedback")
    op.drop_table("recommendations")
    op.drop_table("notification_device_tokens")
    op.drop_table("notification_subscribers")
    op.drop_table("notification_templates")
    op.drop_index("idx_knowledge_edges_target")
    op.drop_index("idx_knowledge_edges_source")
    op.drop_table("knowledge_edges")
    op.drop_table("knowledge_nodes")
    op.drop_table("iam_user_roles")
    op.drop_table("iam_users")
    op.drop_index("idx_audit_events_created_at")
    op.drop_index("idx_audit_events_tenant_action")
    op.drop_table("audit_events")
    op.drop_table("analytics_events")
    op.drop_table("plugin_executions")
    op.drop_table("plugins")
    op.drop_table("agent_schedules")
    op.drop_column("notifications", "updated_at")
    op.drop_column("notifications", "status")
    op.drop_column("notifications", "subject")
    op.drop_column("notifications", "recipient")
    op.drop_column("notifications", "channel")
    op.drop_column("notifications", "user_id")
