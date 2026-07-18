import uuid
from typing import Any

from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.memory import Memory
from ..schemas.memory import MemoryCreate, MemoryUpdate, MemoryQuery, MemorySearch
from .llm_service import llm_service, LLMProviderError


class MemoryService:
    async def create_memory(
        self, db: AsyncSession, dto: MemoryCreate, tenant_id: str | None, user_id: str | None
    ) -> Memory:
        content_for_embedding = dto.content or dto.title or dto.summary or ""
        embedding = None
        if content_for_embedding.strip():
            try:
                embedding = await llm_service.generate_embedding(content_for_embedding)
            except LLMProviderError:
                embedding = None

        memory = Memory(
            id=uuid.uuid4(),
            type=dto.type,
            title=dto.title,
            summary=dto.summary,
            content=dto.content,
            content_hash=llm_service.compute_content_hash(content_for_embedding) if content_for_embedding else None,
            size=len(content_for_embedding) if content_for_embedding else 0,
            embedding=embedding,
            metadata=dto.metadata or {},
            tags=dto.tags,
            tenant_id=tenant_id,
            user_id=user_id,
            workspace_id=dto.workspace_id,
            source_type=dto.source_type,
            source_uri=dto.source_uri,
            source_label=dto.source_label,
            connector_id=dto.connector_id,
        )
        db.add(memory)
        await db.flush()
        return memory

    async def list_memories(self, db: AsyncSession, query: MemoryQuery, tenant_id: str | None) -> tuple[list[Memory], int]:
        stmt = select(Memory)
        count_stmt = select(func.count(Memory.id))

        conditions = [Memory.status == (query.status or "active")]
        if query.type:
            conditions.append(Memory.type == query.type)
        if tenant_id:
            conditions.append(Memory.tenant_id == tenant_id)
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

    async def update_memory(self, db: AsyncSession, memory_id: uuid.UUID, dto: MemoryUpdate, tenant_id: str | None) -> Memory | None:
        memory = await self.get_memory(db, memory_id, tenant_id)
        if not memory:
            return None

        update_data = dto.model_dump(exclude_unset=True)

        if "content" in update_data and update_data["content"] is not None:
            content_for_embedding = update_data.get("content") or memory.content or ""
            if content_for_embedding.strip():
                try:
                    update_data["embedding"] = await llm_service.generate_embedding(content_for_embedding)
                except LLMProviderError:
                    pass
                update_data["content_hash"] = llm_service.compute_content_hash(content_for_embedding)
                update_data["size"] = len(content_for_embedding)

        for key, value in update_data.items():
            setattr(memory, key, value)

        await db.flush()
        return memory

    async def delete_memory(self, db: AsyncSession, memory_id: uuid.UUID, tenant_id: str | None) -> bool:
        memory = await self.get_memory(db, memory_id, tenant_id)
        if not memory:
            return False
        memory.status = "deleted"
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
