from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Entity, Memory, MemoryRecord


class SearchService:
    async def search_all(
        self,
        query: str,
        tenant_id: str | None = None,
        sources: list[str] | None = None,
        limit: int = 20,
        offset: int = 0,
        db: AsyncSession = None,
    ):
        pattern = f"%{query}%"
        results = []

        if not sources or "memory" in sources:
            memory_stmt = select(Memory).where(
                or_(
                    Memory.title.ilike(pattern),
                    Memory.summary.ilike(pattern),
                    Memory.content.ilike(pattern),
                )
            )
            if tenant_id:
                memory_stmt = memory_stmt.where(Memory.tenant_id == tenant_id)
            memory_result = await db.execute(memory_stmt)
            for mem in memory_result.scalars().all():
                score = 2.0 if query.lower() in mem.title.lower() else 1.0
                results.append({
                    "id": str(mem.id),
                    "text": mem.title,
                    "score": score,
                    "source": "memory",
                    "metadata": {"type": mem.type, "summary": mem.summary or ""},
                })

        if not sources or "memory_record" in sources:
            record_stmt = select(MemoryRecord).where(
                cast(MemoryRecord.content, String).ilike(pattern)
            )
            record_result = await db.execute(record_stmt)
            for rec in record_result.scalars().all():
                results.append({
                    "id": str(rec.id),
                    "text": str(rec.content.get("text", rec.content)),
                    "score": 1.0,
                    "source": "memory_record",
                    "metadata": {"type": rec.type, "confidence": rec.confidence},
                })

        if not sources or "entity" in sources:
            entity_stmt = select(Entity).where(
                or_(
                    Entity.canonical_name.ilike(pattern),
                    cast(Entity.aliases, String).ilike(pattern),
                )
            )
            entity_result = await db.execute(entity_stmt)
            for ent in entity_result.scalars().all():
                score = 2.0 if query.lower() in ent.canonical_name.lower() else 1.5
                results.append({
                    "id": str(ent.id),
                    "text": ent.canonical_name,
                    "score": score,
                    "source": "entity",
                    "metadata": {"type": ent.type, "aliases": ent.aliases or []},
                })

        results.sort(key=lambda r: r["score"], reverse=True)
        total = len(results)
        paginated = results[offset : offset + limit]

        return {"results": paginated, "total": total}


search_service = SearchService()
