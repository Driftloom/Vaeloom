import contextlib
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Memory
from ..schemas.memory import MemoryCreate, MemoryQuery, MemorySearch, MemoryUpdate
from ..utils.sanitize import sanitize_text
from .llm_service import LLMProviderError, llm_service


class MemoryService:
    async def create_memory(
        self, db: AsyncSession, dto: MemoryCreate, tenant_id: str | None, user_id: str | None
    ) -> Memory:
        content_for_embedding = dto.content or dto.title or dto.summary or ""
        embedding = None
        if content_for_embedding.strip():
            try:
                embedding = await llm_service.generate_embedding(
                    content_for_embedding,
                    user_id=user_id,
                    workspace_id=str(dto.workspace_id) if dto.workspace_id else None,
                    db=db,
                )
            except LLMProviderError:
                embedding = None

        memory = Memory(
            id=uuid.uuid4(),
            type=dto.type,
            domain=dto.domain,
            title=sanitize_text(dto.title),
            summary=sanitize_text(dto.summary),
            content=sanitize_text(dto.content),
            content_hash=llm_service.compute_content_hash(content_for_embedding) if content_for_embedding else None,
            size=len(content_for_embedding) if content_for_embedding else 0,
            embedding=embedding,
            metadata_=dto.metadata or {},
            tags=dto.tags,
            tenant_id=tenant_id,
            user_id=user_id,
            workspace_id=dto.workspace_id,
            source_type=dto.source_type,
            source_uri=dto.source_uri,
            source_label=dto.source_label,
            connector_id=dto.connector_id,
            supersedes_id=dto.supersedes_id,
        )
        if dto.supersedes_id:
            await self._mark_superseded(db, dto.supersedes_id, tenant_id)
        db.add(memory)
        await db.flush()
        await db.refresh(memory)
        return memory

    async def list_memories(self, db: AsyncSession, query: MemoryQuery, tenant_id: str | None) -> tuple[list[Memory], int]:
        stmt = select(Memory)
        count_stmt = select(func.count(Memory.id))

        # Status handling: default "active" means exclude superseded/deleted unless requested
        conditions: list[Any] = []
        if query.status and query.status != "all":
            if query.include_superseded and query.status == "active":
                conditions.append(Memory.status.in_(["READY", "active", "superseded"]))
            else:
                conditions.append(Memory.status == query.status)
        elif query.status == "all":
            pass
        else:
            conditions.append(Memory.status == (query.status or "active"))

        if query.type:
            conditions.append(Memory.type == query.type)
        if query.domain:
            conditions.append(Memory.domain == query.domain)
        if tenant_id:
            conditions.append(Memory.tenant_id == tenant_id)
        if query.workspace_id:
            try:
                ws_uuid = uuid.UUID(query.workspace_id)
                conditions.append(Memory.workspace_id == ws_uuid)
            except (ValueError, TypeError):
                pass
        if query.tags:
            conditions.append(Memory.tags.overlap(query.tags))

        stmt = stmt.where(*conditions).order_by(Memory.created_at.desc())
        count_stmt = count_stmt.where(*conditions)

        offset = (query.page - 1) * query.page_size
        stmt = stmt.offset(offset).limit(query.page_size)

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        memories = list(result.scalars().all())

        return memories, total

    async def get_memory(self, db: AsyncSession, memory_id: uuid.UUID, tenant_id: str | None) -> Memory | None:
        stmt = select(Memory).where(Memory.id == memory_id)
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def _mark_superseded(self, db: AsyncSession, superseded_id: uuid.UUID, tenant_id: str | None) -> None:
        stmt = select(Memory).where(Memory.id == superseded_id)
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        result = await db.execute(stmt)
        previous = result.scalar_one_or_none()
        if previous and previous.status not in ("superseded", "deleted"):
            previous.status = "superseded"
            await db.flush()

    async def update_memory(self, db: AsyncSession, memory_id: uuid.UUID, dto: MemoryUpdate, tenant_id: str | None) -> Memory | None:
        memory = await self.get_memory(db, memory_id, tenant_id)
        if not memory:
            return None

        update_data = dto.model_dump(exclude_unset=True)

        if "content" in update_data and update_data["content"] is not None:
            update_data["content"] = sanitize_text(update_data["content"])
            content_for_embedding = update_data.get("content") or memory.content or ""
            if content_for_embedding.strip():
                with contextlib.suppress(LLMProviderError):
                    update_data["embedding"] = await llm_service.generate_embedding(
                        content_for_embedding,
                        user_id=str(memory.user_id) if memory.user_id else None,
                        workspace_id=str(memory.workspace_id) if memory.workspace_id else None,
                        db=db,
                    )
                update_data["content_hash"] = llm_service.compute_content_hash(content_for_embedding)
                update_data["size"] = len(content_for_embedding)

        if update_data.get("supersedes_id") and str(update_data["supersedes_id"]) != str(memory.id):
            await self._mark_superseded(db, update_data["supersedes_id"], tenant_id)

        for key, value in update_data.items():
            setattr(memory, key, value)

        await db.flush()
        await db.refresh(memory)
        return memory

    async def delete_memory(self, db: AsyncSession, memory_id: uuid.UUID, tenant_id: str | None) -> bool:
        memory = await self.get_memory(db, memory_id, tenant_id)
        if not memory:
            return False
        memory.status = "deleted"
        memory.deleted_at = datetime.now(UTC)
        await db.flush()
        return True

    async def search_memories(
        self, db: AsyncSession, dto: MemorySearch, tenant_id: str | None
    ) -> list[tuple[Memory, float]]:
        content_for_embedding = dto.query
        query_embedding = await llm_service.generate_embedding(content_for_embedding)

        stmt = select(Memory, func.cosine_distance(Memory.embedding, query_embedding).label("distance"))
        conditions = [Memory.status == "active", Memory.embedding.isnot(None)]
        if tenant_id:
            conditions.append(Memory.tenant_id == tenant_id)
        if dto.type:
            conditions.append(Memory.type == dto.type)
        if dto.domain:
            conditions.append(Memory.domain == dto.domain)
        if dto.tags:
            conditions.append(Memory.tags.overlap(dto.tags))

        stmt = stmt.where(*conditions)
        if dto.threshold is not None:
            stmt = stmt.where(func.cosine_distance(Memory.embedding, query_embedding) <= (1.0 - dto.threshold))
        stmt = stmt.order_by(func.cosine_distance(Memory.embedding, query_embedding)).limit(dto.top_k)

        result = await db.execute(stmt)
        rows = result.all()
        return [(row[0], float(1.0 - row[1])) for row in rows]


memory_service = MemoryService()
