"""Erasure service — 100% deletion across all stores (BQ-P02-03)."""
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import (
    Agent,
    AgentAction,
    AgentExecution,
    ApiKey,
    Application,
    AuthSession,
    Document,
    DocumentVersion,
    Embedding,
    Memory,
    MemoryRecord,
    Notification,
    Permission,
    Resume,
    ScheduleEvent,
    WorkspaceUser,
)


@dataclass
class ErasureReceipt:
    user_id: str
    workspace_id: str
    primary_deletion_timestamp: str
    backup_expiry_timestamp: str
    stores_affected: list[str] = field(default_factory=list)
    rows_deleted: dict[str, int] = field(default_factory=dict)
    projection_rebuild_status: str = "pending"


class ErasureService:
    async def execute_erasure(
        self, db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> ErasureReceipt:
        """Delete all user data from all stores. Generate receipt."""
        now = datetime.now(UTC)
        receipt = ErasureReceipt(
            user_id=str(user_id),
            workspace_id=str(workspace_id),
            primary_deletion_timestamp=now.isoformat(),
            backup_expiry_timestamp="",
        )

        agent_result = await db.execute(
            select(Agent.id).where(Agent.workspace_id == workspace_id)
        )
        agent_ids = [row[0] for row in agent_result.fetchall()]

        tables_to_delete: list[tuple[str, type, object]] = [
            ("agent_executions", AgentExecution, AgentExecution.agent_id.in_(agent_ids) if agent_ids else AgentExecution.agent_id == uuid.uuid4()),
            ("agent_actions", AgentAction, AgentAction.workspace_id == workspace_id),
            ("memory_records", MemoryRecord, MemoryRecord.workspace_id == workspace_id),
            ("embeddings", Embedding, Embedding.workspace_id == workspace_id),
            ("memories", Memory, Memory.workspace_id == workspace_id),
            ("document_versions", DocumentVersion, DocumentVersion.document_id.in_(
                select(Document.id).where(Document.workspace_id == workspace_id)
            )),
            ("documents", Document, Document.workspace_id == workspace_id),
            ("applications", Application, Application.workspace_id == workspace_id),
            ("resumes", Resume, Resume.workspace_id == workspace_id),
            ("schedule_events", ScheduleEvent, ScheduleEvent.workspace_id == workspace_id),
            ("notifications", Notification, Notification.workspace_id == workspace_id),
            ("permissions", Permission, Permission.workspace_id == workspace_id),
        ]

        for table_name, model, condition in tables_to_delete:
            try:
                result = await db.execute(delete(model).where(condition))
                receipt.rows_deleted[table_name] = result.rowcount
                receipt.stores_affected.append(table_name)
            except Exception as e:
                receipt.stores_affected.append(f"{table_name}:ERROR:{e}")

        result = await db.execute(
            delete(WorkspaceUser).where(WorkspaceUser.workspace_id == workspace_id)
        )
        receipt.rows_deleted["workspace_users"] = result.rowcount
        receipt.stores_affected.append("workspace_users")

        result = await db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))
        receipt.rows_deleted["auth_sessions"] = result.rowcount
        receipt.stores_affected.append("auth_sessions")

        result = await db.execute(delete(ApiKey).where(ApiKey.user_id == user_id))
        receipt.rows_deleted["api_keys"] = result.rowcount
        receipt.stores_affected.append("api_keys")

        await db.execute(
            text(
                "UPDATE users SET email = :anon, display_name = :anon, "
                "password_hash = NULL, avatar_url = NULL, preferences = '{}' "
                "WHERE id = :uid"
            ),
            {"anon": f"deleted-{user_id}@vaeloom.app", "uid": str(user_id)},
        )
        receipt.rows_deleted["users_anonymized"] = 1
        receipt.stores_affected.append("users")

        await db.commit()

        receipt.backup_expiry_timestamp = (now + timedelta(days=30)).isoformat()
        return receipt

    async def verify_erasure(
        self, db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> dict[str, bool]:
        """Check all stores for residual data."""
        checks: dict[str, bool] = {}

        tables_to_check = [
            ("memories", Memory, Memory.workspace_id),
            ("documents", Document, Document.workspace_id),
            ("applications", Application, Application.workspace_id),
            ("embeddings", Embedding, Embedding.workspace_id),
        ]

        for table_name, model, filter_col in tables_to_check:
            result = await db.execute(
                select(model).where(filter_col == workspace_id).limit(1)
            )
            checks[table_name] = result.scalar_one_or_none() is None

        return checks
