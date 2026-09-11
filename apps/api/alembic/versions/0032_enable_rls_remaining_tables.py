"""Enable and force Row Level Security across remaining policy-bearing tables.

Revision ID: 0032
Revises: 0031
Create Date: 2026-09-09

SUPERSEDED by 0036 (verified 2026-09-11): this migration never successfully
applied to any environment (it aborts live on PG operator type errors, and
its `except: pass` pattern cannot prevent whole-transaction aborts). Every
table listed below is re-decided in 0036 with corrected casts, savepoint
isolation, and explicit fail-closed semantics. This body is intentionally a
no-op to preserve the revision chain; do NOT re-add statements here, add
them (with savepoints) to a new revision instead.
"""
from typing import Sequence, Union

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Historical intent (absorbed by 0036): audit_events, analytics_events,
# learning_events, loop_checkpoints, plugins, plugin_executions,
# document_versions, agent_executions, agent_schedules, approval_decision,
# webhook_deliveries, gmail_watches, retention_runs, auth_sessions.


def upgrade() -> None:
    # No-op: superseded by 0036_least_privilege_rls.
    return


def downgrade() -> None:
    # No-op: nothing was ever applied by this revision.
    return
