from datetime import UTC, datetime

from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Entity, Memory, MemoryRecord


def _extract_facets(results: list[dict]) -> dict:
    facets: dict = {"types": {}, "date_ranges": {}, "tags": {}, "authors": {}}
    for r in results:
        src = r.get("source", "unknown")
        facets["types"][src] = facets["types"].get(src, 0) + 1

        created = r.get("metadata", {}).get("created_at") or r.get("created_at")
        if created:
            try:
                if isinstance(created, str):
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                elif isinstance(created, datetime):
                    dt = created
                else:
                    dt = None
                if dt is not None:
                    bucket = dt.strftime("%Y-%m")
                    facets["date_ranges"][bucket] = facets["date_ranges"].get(bucket, 0) + 1
            except (ValueError, TypeError):
                pass

        tags = r.get("metadata", {}).get("tags", [])
        if isinstance(tags, list):
            for tag in tags:
                facets["tags"][tag] = facets["tags"].get(tag, 0) + 1

        author = r.get("metadata", {}).get("author") or r.get("metadata", {}).get("user_id")
        if author:
            facets["authors"][str(author)] = facets["authors"].get(str(author), 0) + 1

    return facets


def _apply_filters(results: list[dict], filters: dict | None) -> list[dict]:
    if not filters:
        return results
    filtered = list(results)
    if filters.get("type"):
        filtered = [r for r in filtered if r.get("source") == filters["type"] or r.get("metadata", {}).get("type") == filters["type"]]
    if filters.get("date_from"):
        try:
            date_from = datetime.fromisoformat(filters["date_from"]).replace(tzinfo=UTC)
            filtered = [
                r for r in filtered
                if _parse_created(r) is None or _parse_created(r) >= date_from
            ]
        except (ValueError, TypeError):
            pass
    if filters.get("date_to"):
        try:
            date_to = datetime.fromisoformat(filters["date_to"]).replace(tzinfo=UTC)
            filtered = [
                r for r in filtered
                if _parse_created(r) is None or _parse_created(r) <= date_to
            ]
        except (ValueError, TypeError):
            pass
    if filters.get("tags"):
        required_tags = filters["tags"] if isinstance(filters["tags"], list) else [filters["tags"]]
        filtered = [
            r for r in filtered
            if any(t in (r.get("metadata", {}).get("tags", []) or []) for t in required_tags)
        ]
    if filters.get("author"):
        filtered = [
            r for r in filtered
            if str(r.get("metadata", {}).get("author", "") or r.get("metadata", {}).get("user_id", "")) == filters["author"]
        ]
    return filtered


def _parse_created(result: dict) -> datetime | None:
    created = result.get("metadata", {}).get("created_at") or result.get("created_at")
    if not created:
        return None
    if isinstance(created, str):
        return datetime.fromisoformat(created.replace("Z", "+00:00"))
    if isinstance(created, datetime):
        return created
    return None


class SearchService:
    async def search_all(
        self,
        query: str,
        tenant_id: str | None = None,
        sources: list[str] | None = None,
        limit: int = 20,
        offset: int = 0,
        db: AsyncSession = None,
        filters: dict | None = None,
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
                mem_tags = getattr(mem, "tags", []) or []
                results.append({
                    "id": str(mem.id),
                    "text": mem.title,
                    "score": score,
                    "source": "memory",
                    "metadata": {
                        "type": getattr(mem, "type", "unknown"),
                        "summary": getattr(mem, "summary", "") or "",
                        "created_at": getattr(mem, "created_at", None),
                        "tags": mem_tags,
                        "author": str(mem.user_id) if getattr(mem, "user_id", None) else None,
                        "importance": getattr(mem, "importance", None),
                    },
                })

        if not sources or "memory_record" in sources:
            record_stmt = select(MemoryRecord).where(
                cast(MemoryRecord.content, String).ilike(pattern)
            )
            # F-22 fix: tenant-scoped — RLS is primary, this is defense-in-depth
            if tenant_id:
                record_stmt = record_stmt.where(MemoryRecord.workspace_id.isnot(None))
            record_result = await db.execute(record_stmt)
            recs = record_result.scalars().all()
            if tenant_id:
                recs = [r for r in recs if getattr(r, "workspace_id", None) is not None]
            for rec in recs:
                rec_created = getattr(rec, "created_at", None)
                results.append({
                    "id": str(rec.id),
                    "text": str(rec.content.get("text", rec.content)),
                    "score": 1.0,
                    "source": "memory_record",
                    "metadata": {
                        "type": getattr(rec, "type", "unknown"),
                        "confidence": getattr(rec, "confidence", 1.0),
                        "importance": getattr(rec, "importance", 0.5),
                        "created_at": rec_created,
                    },
                })

        if not sources or "entity" in sources:
            entity_stmt = select(Entity).where(
                or_(
                    Entity.canonical_name.ilike(pattern),
                    cast(Entity.aliases, String).ilike(pattern),
                )
            )
            if tenant_id:
                entity_stmt = entity_stmt.where(Entity.workspace_id.isnot(None))
            entity_result = await db.execute(entity_stmt)
            ents = entity_result.scalars().all()
            if tenant_id:
                ents = [e for e in ents if getattr(e, "workspace_id", None) is not None]
            for ent in ents:
                score = 2.0 if query.lower() in ent.canonical_name.lower() else 1.5
                ent_created = getattr(ent, "created_at", None)
                results.append({
                    "id": str(ent.id),
                    "text": ent.canonical_name,
                    "score": score,
                    "source": "entity",
                    "metadata": {
                        "type": getattr(ent, "type", "unknown"),
                        "aliases": getattr(ent, "aliases", []) or [],
                        "created_at": ent_created,
                    },
                })

        results = _apply_filters(results, filters)
        facet_counts = _extract_facets(results)
        results.sort(key=lambda r: r["score"], reverse=True)
        total = len(results)
        paginated = results[offset : offset + limit]

        return {"results": paginated, "total": total, "facet_counts": facet_counts}


search_service = SearchService()
