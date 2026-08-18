"""Fix FK cascades and add missing indexes

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-18 01:35:00.000000

P1-05 FIX: Add missing FK indexes on frequently queried columns.
P1-06 FIX: Add ondelete CASCADE/SET NULL to FK columns that block deletion.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # ── Missing FK indexes ──────────────────────────────────────────
    indexes = [
        ("idx_auth_sessions_user_id", "auth_sessions", "user_id"),
        ("idx_api_keys_user_id", "api_keys", "user_id"),
        ("idx_integrations_user_id", "integrations", "user_id"),
        ("idx_memories_user_id", "memories", "user_id"),
        ("idx_memories_connector_id", "memories", "connector_id"),
        ("idx_memory_records_source_document_id", "memory_records", "source_document_id"),
        ("idx_applications_resume_version_id", "applications", "resume_version_id"),
        ("idx_webhook_deliveries_webhook_id", "webhook_deliveries", "webhook_id"),
        ("idx_events_user_id", "events", "user_id"),
        ("idx_notifications_user_id", "notifications", "user_id"),
    ]
    for idx_name, table, col in indexes:
        if op.get_bind().dialect.has_table(op.get_bind(), table):
            op.create_index(idx_name, table, [col])

    # ── FK cascade fixes ────────────────────────────────────────────
    # memories.user_id → SET NULL on user delete (soft-delete memory)
    op.execute(
        "ALTER TABLE memories DROP CONSTRAINT IF EXISTS fk_memories_user_id, "
        "ADD CONSTRAINT fk_memories_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
    )
    # memories.workspace_id → CASCADE on workspace delete
    op.execute(
        "ALTER TABLE memories DROP CONSTRAINT IF EXISTS fk_memories_workspace_id, "
        "ADD CONSTRAINT fk_memories_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE"
    )
    # agents.workspace_id → CASCADE on workspace delete
    op.execute(
        "ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_workspace_id, "
        "ADD CONSTRAINT fk_agents_workspace_id FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE"
    )
    # agents.user_id → SET NULL on user delete
    op.execute(
        "ALTER TABLE agents DROP CONSTRAINT IF EXISTS fk_agents_user_id, "
        "ADD CONSTRAINT fk_agents_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL"
    )


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return

    # Drop indexes
    index_names = [
        "idx_auth_sessions_user_id", "idx_api_keys_user_id",
        "idx_integrations_user_id", "idx_memories_user_id",
        "idx_memories_connector_id", "idx_memory_records_source_document_id",
        "idx_applications_resume_version_id", "idx_webhook_deliveries_webhook_id",
        "idx_events_user_id", "idx_notifications_user_id",
    ]
    for idx_name in index_names:
        op.execute(f"DROP INDEX IF EXISTS {idx_name}")

    # Revert FK cascades to no action (PostgreSQL default)
    for table, col, ref_table in [
        ("memories", "user_id", "users"),
        ("memories", "workspace_id", "workspaces"),
        ("agents", "workspace_id", "workspaces"),
        ("agents", "user_id", "users"),
    ]:
        constraint_name = f"fk_{table}_{col}"
        op.execute(
            f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint_name}, "
            f"ADD CONSTRAINT {constraint_name} FOREIGN KEY ({col}) REFERENCES {ref_table}(id)"
        )
