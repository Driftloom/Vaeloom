import logging
import re
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import ChatMessage, Conversation
from ..schemas.conversation import (
    ConversationCreate,
    ConversationUpdate,
    MessageCreate,
)
from ..utils.sanitize import sanitize_text

logger = logging.getLogger(__name__)


class ConversationService:
    async def create_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        dto: ConversationCreate,
        tenant_id: str | None = None,
    ) -> Conversation:
        # Timestamps are stamped in Python rather than left to now() so that two
        # conversations created inside the same database-clock tick still order
        # deterministically for the newest-first list.
        now = datetime.now(UTC)
        conversation = Conversation(
            workspace_id=workspace_id,
            tenant_id=_uuid_or_none(tenant_id),
            title=sanitize_text(dto.title) if dto.title else None,
            agent_name=sanitize_text(dto.agent_name) if dto.agent_name else None,
            created_at=now,
            updated_at=now,
        )
        db.add(conversation)
        await db.flush()
        await db.refresh(conversation)
        return conversation

    async def list_conversations(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        page: int,
        page_size: int,
        search: str | None = None,
    ) -> tuple[list[tuple[Conversation, int]], int]:
        base = select(Conversation).where(Conversation.workspace_id == workspace_id)
        count_stmt = select(func.count(Conversation.id)).where(
            Conversation.workspace_id == workspace_id
        )
        if search:
            base = base.where(Conversation.title.ilike(f"%{search}%"))
            count_stmt = count_stmt.where(Conversation.title.ilike(f"%{search}%"))

        total = (await db.execute(count_stmt)).scalar_one()
        rows = await db.execute(
            base.order_by(Conversation.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        conversations = list(rows.scalars().all())
        counts = await self._message_counts(db, [c.id for c in conversations])
        return [(c, counts.get(c.id, 0)) for c in conversations], total

    async def get_conversation(
        self, db: AsyncSession, workspace_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Conversation:
        """Fetch a conversation scoped to the workspace, or 404.

        Scoping by workspace_id in the WHERE clause is what keeps a guessed id
        from resolving: the row either belongs to the caller's workspace or it
        does not exist as far as this caller is concerned.
        """
        row = await db.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.workspace_id == workspace_id,
            )
        )
        conversation = row.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation

    async def update_conversation(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
        dto: ConversationUpdate,
    ) -> Conversation:
        conversation = await self.get_conversation(db, workspace_id, conversation_id)
        conversation.title = sanitize_text(dto.title)
        conversation.updated_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(conversation)
        return conversation

    async def delete_conversation(
        self, db: AsyncSession, workspace_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> None:
        conversation = await self.get_conversation(db, workspace_id, conversation_id)
        await db.delete(conversation)
        await db.flush()

    async def list_messages(
        self, db: AsyncSession, conversation_id: uuid.UUID
    ) -> list[ChatMessage]:
        rows = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation_id)
            .order_by(ChatMessage.seq.asc(), ChatMessage.created_at.asc())
        )
        return list(rows.scalars().all())

    async def create_message(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        conversation_id: uuid.UUID,
        dto: MessageCreate,
        tenant_id: str | None = None,
    ) -> tuple[ChatMessage, bool]:
        """Insert a message, or return the existing row for a repeated client_id.

        The client retries writes, so a blind INSERT would leave a duplicate row
        behind every retry. The unique (conversation_id, client_id) constraint is
        the arbiter: on IntegrityError the transaction is rolled back to the
        savepoint and the stored row is read back.
        """
        existing = await db.execute(
            select(ChatMessage).where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.client_id == dto.client_id,
            )
        )
        found = existing.scalar_one_or_none()
        if found is not None:
            return found, False

        # Read inside the same transaction that inserts, so two turns written back
        # to back cannot claim the same position.
        next_seq = (
            await db.execute(
                select(func.coalesce(func.max(ChatMessage.seq), -1) + 1).where(
                    ChatMessage.conversation_id == conversation_id
                )
            )
        ).scalar_one()

        message = ChatMessage(
            conversation_id=conversation_id,
            workspace_id=workspace_id,
            tenant_id=_uuid_or_none(tenant_id),
            seq=next_seq,
            client_id=dto.client_id,
            role=dto.role,
            text=dto.text,
            status=dto.status,
            agent_name=dto.agent_name,
            confidence=dto.confidence,
            tool_calls=dto.tool_calls,
            citations=dto.citations,
            proposals=dto.proposals,
            questions=dto.questions,
            action_chips=dto.action_chips,
            attachments=dto.attachments,
            plan=dto.plan,
            phases=dto.phases,
            error_=dto.error,
            latency_ms=dto.latency_ms,
            highway=dto.highway,
            s1_latency_ms=dto.s1_latency_ms,
            s2_latency_ms=dto.s2_latency_ms,
            workflow_id=dto.workflow_id,
            reply_to=dto.reply_to,
        )
        try:
            async with db.begin_nested():
                db.add(message)
                await db.flush()
        except IntegrityError:
            # Lost the race with a concurrent retry of the same client_id.
            row = await db.execute(
                select(ChatMessage).where(
                    ChatMessage.conversation_id == conversation_id,
                    ChatMessage.client_id == dto.client_id,
                )
            )
            duplicate = row.scalar_one_or_none()
            if duplicate is None:
                raise
            return duplicate, False

        await db.refresh(message)
        # Touch the parent so the list endpoint's newest-first ordering reflects
        # the turn that was just appended.
        conversation = await self.get_conversation(db, workspace_id, conversation_id)
        conversation.updated_at = datetime.now(UTC)

        # Level 2: Extract & persist cognitive memory from user chat turn into dynamic memory
        if dto.role == "user" and dto.text and len(dto.text.strip()) > 10:
            await self._extract_chat_cognitive_memory(
                db=db,
                workspace_id=workspace_id,
                tenant_id=tenant_id,
                text=dto.text,
                client_id=dto.client_id,
            )

        await db.flush()
        return message, True

    async def _extract_chat_cognitive_memory(
        self,
        db: AsyncSession,
        workspace_id: uuid.UUID,
        tenant_id: str | None,
        text: str,
        client_id: str,
    ) -> None:
        """Autonomously ingest user thoughts, preferences, decisions, and notes from chat into dynamic memory (memories table)."""
        from .memory_service import memory_service
        from ..schemas.memory import MemoryCreate

        cleaned = (text or "").strip()
        if len(cleaned) < 15:
            return

        # Skip slash commands and pure greeting noise
        if cleaned.startswith("/") or cleaned.lower() in ("hi", "hello", "hey", "thanks", "thank you", "bye"):
            return

        cues = [
            "remember", "note that", "take note", "keep in mind", "save this", "store this",
            "prefer", "preference", "target", "goal", "decided", "decision", "skill",
            "our architecture", "my stack", "salary", "requirement", "work as", "experience with",
            "don't like", "dislike", "favorite", "priority", "deadline", "milestone", "project"
        ]
        has_cue = any(re.search(r"\b" + re.escape(c) + r"\b", cleaned, re.IGNORECASE) for c in cues)
        # Ingest if either it contains an explicit memory/preference cue OR is a substantial thought (> 50 chars)
        if not has_cue and len(cleaned) < 50:
            return

        lowered = cleaned.lower()
        mem_type = "note"
        if "prefer" in lowered or "preference" in lowered or "favorite" in lowered:
            mem_type = "preference"
        elif "decid" in lowered or "decision" in lowered:
            mem_type = "decision"
        elif "insight" in lowered or "learned" in lowered:
            mem_type = "insight"
        elif "goal" in lowered or "target" in lowered or "priority" in lowered:
            mem_type = "insight"
        elif "skill" in lowered or "stack" in lowered or "tech" in lowered:
            mem_type = "skill"

        first_line = cleaned.splitlines()[0].strip().lstrip("#-•* ")
        clean_title = re.sub(
            r"^(?:please\s+)?(?:remember(?:\s+that)?|note(?:\s+that)?|keep in mind(?:\s+that)?)\s*[:,-]?\s*",
            "",
            first_line,
            flags=re.IGNORECASE,
        ).strip()
        title = clean_title[:60] if len(clean_title) > 8 else f"Chat Note: {cleaned[:40]}"
        summary = cleaned[:160]

        dto = MemoryCreate(
            title=title,
            content=cleaned,
            summary=summary,
            type=mem_type,
            domain="general",
            tags=["chat", "memory"],
            source_type="chat",
            source_label=f"Chat message ({client_id[:8]})",
            metadata={"client_id": client_id, "channel": "chat"},
        )

        try:
            await memory_service.create_memory(
                db=db,
                dto=dto,
                tenant_id=tenant_id,
                user_id=None,
                workspace_id=workspace_id,
            )
            logger.info("Synthesized chat cognitive memory '%s' for workspace %s", title, workspace_id)
        except Exception as err:
            logger.warning("Chat cognitive memory extraction failed non-fatally: %s", err)

    async def clear_messages(
        self, db: AsyncSession, workspace_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> None:
        await self.get_conversation(db, workspace_id, conversation_id)
        rows = await db.execute(
            select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
        )
        for row in list(rows.scalars().all()):
            await db.delete(row)
        await db.flush()

    async def _message_counts(self, db: AsyncSession, conversation_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not conversation_ids:
            return {}
        rows = await db.execute(
            select(ChatMessage.conversation_id, func.count(ChatMessage.id))
            .where(ChatMessage.conversation_id.in_(conversation_ids))
            .group_by(ChatMessage.conversation_id)
        )
        return dict(rows.all())


def _uuid_or_none(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        # A non-uuid tenant claim must not be stored as a uuid; tenant_id is
        # nullable and RLS treats NULL as "workspace scope only".
        return None


conversation_service = ConversationService()
