import asyncio
import contextlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import AgentAction, Memory
from ..schemas.memory import (
    MemoryCreate,
    MemoryImportBatch,
    MemoryQuery,
    MemorySearch,
    MemorySupersedeRequest,
    MemoryUpdate,
)
from ..utils.sanitize import sanitize_text
from .llm_service import LLMProviderError, llm_service
from .memory_type_packs import validate_memory_type


def _to_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    """Coerce a workspace/tenant identifier to UUID, accepting either a UUID or str."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


class MemoryService:
    async def _record_taxonomy_change(
        self,
        db: AsyncSession,
        *,
        memory_id: uuid.UUID,
        from_type: str,
        to_type: str,
        taxonomy_version: int,
        content_hash: str | None = None,
        migration_wave: str = "CONT-P12",
    ) -> None:
        """Append one provenance row to `memory_taxonomy_ledger`.

        Without this the ledger table (migration 0027) was never written, so the
        expand-contract taxonomy change had no audit trail. Best-effort: provenance
        must never fail the user's write. Only ids, type names and a checksum are
        stored -- never memory content.
        """
        if not from_type or not to_type or from_type == to_type:
            return
        try:
            from ..models.schema import MemoryTaxonomyLedger

            checksum = (content_hash or llm_service.compute_content_hash(f"{from_type}->{to_type}"))[:64]
            db.add(
                MemoryTaxonomyLedger(
                    id=uuid.uuid4(),
                    memory_id=memory_id,
                    from_type=from_type,
                    to_type=to_type,
                    taxonomy_version=taxonomy_version,
                    migration_wave=migration_wave,
                    checksum=checksum,
                )
            )
        except Exception as e:
            logger.debug(f"Taxonomy ledger write skipped: {e}")

    async def create_memory(
        self,
        db: AsyncSession,
        dto: MemoryCreate,
        tenant_id: str | None,
        user_id: str | None,
        workspace_id: uuid.UUID | str | None = None,
    ) -> Memory:
        resolved_ws_id = workspace_id or dto.workspace_id
        if resolved_ws_id and isinstance(resolved_ws_id, str):
            with contextlib.suppress(ValueError, TypeError):
                resolved_ws_id = uuid.UUID(resolved_ws_id)
        if db is not None:
            from ..middleware.tenant import set_rls_session_vars
            await set_rls_session_vars(
                db,
                tenant_id=tenant_id,
                workspace_id=str(resolved_ws_id) if resolved_ws_id else None,
                user_id=user_id,
            )

        # 0068 dropped `ck_memories_type_valid`, so this lookup is the only guard
        # on the write path: nothing downstream re-checks `dto.type`. It runs
        # before the embedding call so an illegal type costs a registry read and
        # not an LLM round trip, and its ValueError is the user-facing rejection.
        pack_match = await validate_memory_type(db, dto.type)

        content_for_embedding = dto.content or dto.title or dto.summary or ""
        embedding = None
        if content_for_embedding.strip():
            try:
                embedding = await asyncio.wait_for(
                    llm_service.generate_embedding(
                        content_for_embedding,
                        user_id=user_id,
                        workspace_id=str(resolved_ws_id) if resolved_ws_id else None,
                        db=db,
                    ),
                    timeout=3.0,
                )
            except Exception:
                embedding = None

        # CONT-P12 expand-contract: taxonomy_version 1 (legacy 6) vs 2 (expanded 22) — no guess
        from ..schemas.memory import ENTERPRISE_MEMORY_TYPES
        taxonomy_version = 2 if dto.type in ENTERPRISE_MEMORY_TYPES else 1
        # Lineage: model/prompt/tool/retrieval per CONT-P12-R06 (stored via 0027 lineage JSONB)
        lineage = (dto.metadata or {}).get("lineage") if dto.metadata else None
        if lineage is None:
            lineage = {"model": getattr(dto, "model", None) or "unknown", "taxonomy_version": taxonomy_version, "workspace_id": str(resolved_ws_id) if resolved_ws_id else None}
        derived_summary = dto.summary
        if not derived_summary and dto.content:
            derived_summary = dto.content[:240].strip()

        initial_status = getattr(dto, "status", None) or "active"
        memory = Memory(
            id=uuid.uuid4(),
            type=dto.type,
            domain=dto.domain,
            status=initial_status,
            title=sanitize_text(dto.title),
            summary=sanitize_text(derived_summary),
            content=sanitize_text(dto.content),
            content_hash=llm_service.compute_content_hash(content_for_embedding or ""),
            size=len(content_for_embedding or ""),
            embedding=embedding,
            metadata_=dto.metadata or {},
            tags=dto.tags,
            tenant_id=tenant_id,
            user_id=user_id,
            workspace_id=resolved_ws_id,
            source_type=dto.source_type,
            source_uri=dto.source_uri,
            source_label=dto.source_label,
            connector_id=dto.connector_id,
            supersedes_id=dto.supersedes_id,
            # Provenance from the pack that legalised the type -- never a literal
            # slug, or every row would be attributed to the career pack after the
            # second domain ships.
            type_pack_slug=pack_match.slug,
            type_pack_version=pack_match.version,
        )
        # Set additive columns if present (SQLAlchemy will ignore on SQLite if missing)
        try:
            memory.taxonomy_version = taxonomy_version
            memory.lineage = lineage
            memory.confidence = 1.0
            memory.contradiction_flags = []
        except Exception:
            pass
        if dto.supersedes_id:
            await self._mark_superseded(db, dto.supersedes_id, tenant_id)
        db.add(memory)
        await db.flush()
        await db.refresh(memory)
        if embedding:
            try:
                from ..infrastructure.vector_store import (
                    VectorRecord,
                    get_vector_store,
                )
                vstore = get_vector_store()
                await vstore.upsert([
                    VectorRecord(
                        id=str(memory.id),
                        vector=embedding,
                        metadata={
                            "source_type": "memory",
                            "source_id": str(memory.id),
                            "workspace_id": str(resolved_ws_id) if resolved_ws_id else "",
                            "tenant_id": tenant_id or "",
                            "title": memory.title or "",
                        },
                    )
                ], session=db)
            except Exception as e:
                logger.debug(f"Vector store upsert bypassed or failed: {e}")
        return memory

    async def list_memories(
        self,
        db: AsyncSession,
        query: MemoryQuery,
        tenant_id: str | None,
        workspace_id: str | None = None,
        allow_tenant_wide: bool = False,
    ) -> tuple[list[Memory], int]:
        stmt = select(Memory)
        count_stmt = select(func.count(Memory.id))

        # Status handling: default "active" means exclude superseded/deleted unless requested
        conditions: list[Any] = []
        if query.status and query.status != "all":
            if query.status == "active":
                if query.include_superseded:
                    conditions.append(Memory.status.in_(["READY", "active", "superseded"]))
                else:
                    conditions.append(Memory.status.in_(["READY", "active"]))
            else:
                conditions.append(Memory.status == query.status)
        elif query.status == "all":
            pass
        else:
            conditions.append(Memory.status.in_(["active", "READY", "PROCESSING"]))

        if query.type:
            conditions.append(Memory.type == query.type)
        if query.domain:
            conditions.append(Memory.domain == query.domain)
        if tenant_id:
            conditions.append(Memory.tenant_id == tenant_id)
        # Enforced workspace scoping (F-03, G-41): authoritative workspace_id from auth context
        # takes precedence over any client-supplied DTO value. Accidental tenant-wide queries are rejected.
        enforced_ws = workspace_id or query.workspace_id
        if not enforced_ws and not allow_tenant_wide:
            raise ValueError("workspace_id is required for memory operations")
        if enforced_ws:
            ws_uuid = _to_uuid(enforced_ws)
            if ws_uuid is not None:
                conditions.append(Memory.workspace_id == ws_uuid)
                from ..middleware.tenant import set_rls_session_vars
                await set_rls_session_vars(db, workspace_id=str(ws_uuid))
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

    async def get_memory(
        self,
        db: AsyncSession,
        memory_id: uuid.UUID,
        tenant_id: str | None,
        workspace_id: str | None = None,
    ) -> Memory | None:
        stmt = select(Memory).where(Memory.id == memory_id)
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        # Enforced workspace scoping (F-03)
        if workspace_id:
            ws_uuid = _to_uuid(workspace_id)
            if ws_uuid is not None:
                stmt = stmt.where(Memory.workspace_id == ws_uuid)
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

    async def update_memory(
        self,
        db: AsyncSession,
        memory_id: uuid.UUID,
        dto: MemoryUpdate,
        tenant_id: str | None,
        workspace_id: str | None = None,
    ) -> Memory | None:
        memory = await self.get_memory(db, memory_id, tenant_id, workspace_id)
        if not memory:
            return None

        # Snapshot old state for durable versioning (EXC-P12-03) — tolerate mock Memory objects in tests
        old_state = {
            "title": getattr(memory, "title", None),
            "summary": getattr(memory, "summary", None),
            "content": getattr(memory, "content", None),
            "type": getattr(memory, "type", None),
            "domain": getattr(memory, "domain", None),
            "status": getattr(memory, "status", None),
            "tags": list(getattr(memory, "tags", None) or []),
            "metadata": dict(getattr(memory, "metadata_", None) or {}),
        }

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

        # Taxonomy provenance: a type remap is exactly what the ledger exists to record.
        new_type = update_data.get("type")
        if new_type and new_type != old_state.get("type"):
            from ..schemas.memory import ENTERPRISE_MEMORY_TYPES

            await self._record_taxonomy_change(
                db,
                memory_id=memory.id,
                from_type=str(old_state.get("type") or ""),
                to_type=str(new_type),
                taxonomy_version=2 if new_type in ENTERPRISE_MEMORY_TYPES else 1,
                content_hash=getattr(memory, "content_hash", None),
            )

        # Durable version row BEFORE flush so single flush persists both (keeps test flush count=1)
        try:
            new_state = {
                "title": getattr(memory, "title", None),
                "summary": getattr(memory, "summary", None),
                "content": getattr(memory, "content", None),
                "type": getattr(memory, "type", None),
                "domain": getattr(memory, "domain", None),
                "status": getattr(memory, "status", None),
                "tags": list(getattr(memory, "tags", None) or []),
                "metadata": dict(getattr(memory, "metadata_", None) or {}),
            }
            from .memory_versioning import persist_version

            await persist_version(
                memory_id=memory.id,
                old_state=old_state,
                new_state=new_state,
                workspace_id=str(memory.workspace_id) if memory.workspace_id else None,
                created_by=str(memory.user_id) if memory.user_id else None,
                db=db,
            )
        except Exception:
            pass
        await db.flush()
        await db.refresh(memory)
        return memory

    async def delete_memory(
        self,
        db: AsyncSession,
        memory_id: uuid.UUID,
        tenant_id: str | None,
        workspace_id: str | None = None,
    ) -> bool:
        memory = await self.get_memory(db, memory_id, tenant_id, workspace_id)
        if not memory:
            return False
        memory.status = "deleted"
        memory.deleted_at = datetime.now(UTC)
        await db.flush()
        try:
            from ..infrastructure.vector_store import get_vector_store
            vstore = get_vector_store()
            await vstore.delete([str(memory_id)], session=db)
        except Exception:
            pass
        return True

    async def search_memories(
        self,
        db: AsyncSession,
        dto: MemorySearch,
        tenant_id: str | None,
        workspace_id: str | None = None,
        allow_tenant_wide: bool = False,
    ) -> list[tuple[Memory, float]]:
        target_ws = workspace_id or getattr(dto, "workspace_id", None)
        if not target_ws and not allow_tenant_wide:
            raise ValueError("workspace_id is required for memory operations")

        strategy = getattr(dto, "strategy", "hybrid") or "hybrid"
        include_superseded = getattr(dto, "include_superseded", False)
        status_filter = [Memory.status.in_(["active", "superseded"])] if include_superseded else [Memory.status == "active"]

        vector_results: list[tuple[Memory, float]] = []
        if strategy in ("hybrid", "vector"):
            content_for_embedding = dto.query
            query_embedding = await llm_service.generate_embedding(content_for_embedding)

            # Primary: query configured vector store polymorphically
            try:
                from ..infrastructure.vector_store import get_vector_store
                vstore = get_vector_store()
                filters: dict[str, Any] = {}
                if target_ws:
                    filters["workspace_id"] = str(target_ws)
                elif tenant_id:
                    # FallbackVectorStore.search raises on an unscoped query:
                    # "vector search must specify tenant_id or workspace_id filter".
                    # Passing only source_type below tripped that guard, so every
                    # tenant-scoped-but-not-workspace-scoped search failed here,
                    # was swallowed by the except at the bottom of this block, and
                    # silently degraded to the cosine query. Widen the scope rather
                    # than the exception.
                    filters["tenant_id"] = str(tenant_id)
                # The embeddings table is shared with document_chunk rows, which carry
                # placeholder source_ids. Without this filter they consume top_k slots
                # and are then silently discarded by the Memory lookup below.
                filters["source_type"] = "memory"
                if not (target_ws or tenant_id):
                    # Neither scope is available. The guard would reject this, and
                    # the cosine fallback below is the correct path, so skip the
                    # round trip instead of provoking a guaranteed exception.
                    raise ValueError("no tenant or workspace scope for vector search")
                vrecords = await vstore.search(
                    query_vector=query_embedding, limit=dto.top_k, filters=filters or None, session=db
                )
                if vrecords:
                    mem_ids = [_to_uuid(r.metadata.get("source_id") or r.id) for r in vrecords if _to_uuid(r.metadata.get("source_id") or r.id)]
                    if mem_ids:
                        # Re-apply the caller's visibility rules. The vector store has no
                        # notion of status, so superseded/deleted rows would otherwise be
                        # returned even when include_superseded=False.
                        lookup_conditions: list[Any] = [Memory.id.in_(mem_ids), *status_filter]
                        if tenant_id:
                            lookup_conditions.append(Memory.tenant_id == tenant_id)
                        if target_ws:
                            ws_uuid = _to_uuid(target_ws)
                            if ws_uuid is not None:
                                lookup_conditions.append(Memory.workspace_id == ws_uuid)
                        if dto.type:
                            lookup_conditions.append(Memory.type == dto.type)
                        res = await db.execute(select(Memory).where(*lookup_conditions))
                        mem_map = {m.id: m for m in res.scalars().all()}
                        scored: list[tuple[Memory, float]] = []
                        for rec in vrecords:
                            mid = _to_uuid(rec.metadata.get("source_id") or rec.id)
                            mem = mem_map.get(mid)
                            if mem is None:
                                continue
                            # Use the real cosine distance when the store provides it;
                            # never fabricate a constant relevance score.
                            dist = rec.metadata.get("distance")
                            if isinstance(dist, (int, float)):
                                score = max(0.0, min(1.0, 1.0 - float(dist)))
                            else:
                                score = 0.0
                            scored.append((mem, score))
                        vector_results = scored
            except Exception as e:
                logger.debug(f"Vector store search failed or bypassed: {e}")

            if not vector_results:
                try:
                    stmt = select(Memory, func.cosine_distance(Memory.embedding, query_embedding).label("distance"))
                    conditions = list(status_filter) + [Memory.embedding.isnot(None)]
                    if tenant_id:
                        conditions.append(Memory.tenant_id == tenant_id)
                    # Enforced workspace scoping (F-03, G-41)
                    if target_ws:
                        ws_uuid = _to_uuid(target_ws)
                        if ws_uuid is not None:
                            conditions.append(Memory.workspace_id == ws_uuid)
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
                    if rows:
                        vector_results = [(row[0], float(1.0 - row[1])) for row in rows]
                except Exception as e:
                    logger.debug(f"Cosine distance search failed or unsupported on this dialect: {e}")

        # If pure vector strategy requested and results found, return them
        if strategy == "vector" and vector_results:
            return vector_results

        # Keyword text search across title/summary/content for precision & SQLite parity
        pattern = f"%{dto.query}%"
        words = [w.strip() for w in dto.query.split() if len(w.strip()) > 2]
        match_expr = or_(
            Memory.title.ilike(pattern),
            Memory.summary.ilike(pattern),
            Memory.content.ilike(pattern),
        )
        if words and len(words) > 1:
            word_conditions = [
                or_(
                    Memory.title.ilike(f"%{w}%"),
                    Memory.summary.ilike(f"%{w}%"),
                    Memory.content.ilike(f"%{w}%"),
                )
                for w in words
            ]
            match_expr = or_(match_expr, and_(*word_conditions))

        fallback_stmt = select(Memory).where(
            *status_filter,
            match_expr,
        )
        if target_ws:
            ws_uuid = _to_uuid(target_ws)
            if ws_uuid is not None:
                fallback_stmt = fallback_stmt.where(Memory.workspace_id == ws_uuid)
        if tenant_id:
            fallback_stmt = fallback_stmt.where(Memory.tenant_id == tenant_id)
        if dto.type:
            fallback_stmt = fallback_stmt.where(Memory.type == dto.type)
        fallback_stmt = fallback_stmt.limit(dto.top_k)
        fb_res = await db.execute(fallback_stmt)
        fb_mems = list(fb_res.scalars().all())

        # Check decrypted content for memory records in workspace if matches are below top_k
        if len(fb_mems) < dto.top_k and target_ws:
            content_stmt = select(Memory).where(
                *status_filter,
                Memory.workspace_id == _to_uuid(target_ws),
            ).limit(100)
            if tenant_id:
                content_stmt = content_stmt.where(Memory.tenant_id == tenant_id)
            if dto.type:
                content_stmt = content_stmt.where(Memory.type == dto.type)
            c_res = await db.execute(content_stmt)
            existing_ids = {m.id for m in fb_mems}
            q_lower = dto.query.lower()
            for m in c_res.scalars().all():
                if m.id not in existing_ids:
                    c_text = (m.content or "").lower()
                    if q_lower in c_text or (words and any(w.lower() in c_text for w in words)):
                        fb_mems.append(m)
                        existing_ids.add(m.id)
                        if len(fb_mems) >= dto.top_k:
                            break

        text_results = [(m, 0.90 if dto.query.lower() in m.title.lower() else 0.75) for m in fb_mems]

        if strategy == "keyword":
            return text_results

        # Hybrid strategy: Reciprocal Rank Fusion (RRF)
        if not vector_results:
            return text_results
        if not text_results:
            return vector_results

        # RRF formula: score(d) = sum(1 / (60 + rank))
        rrf_scores: dict[uuid.UUID, float] = {}
        mem_lookup: dict[uuid.UUID, Memory] = {}

        for rank, (mem, _) in enumerate(vector_results, start=1):
            mem_lookup[mem.id] = mem
            rrf_scores[mem.id] = rrf_scores.get(mem.id, 0.0) + (1.0 / (60.0 + rank))

        for rank, (mem, _) in enumerate(text_results, start=1):
            mem_lookup[mem.id] = mem
            rrf_scores[mem.id] = rrf_scores.get(mem.id, 0.0) + (1.0 / (60.0 + rank))

        sorted_mems = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:dto.top_k]
        max_rrf = sorted_mems[0][1] if sorted_mems else 1.0
        fused = [
            (mem_lookup[mid], min(0.98, max(0.65, (score / max_rrf) * 0.98)))
            for mid, score in sorted_mems
        ]
        return fused

    async def supersede_memory(
        self,
        db: AsyncSession,
        memory_id: uuid.UUID,
        dto: MemorySupersedeRequest,
        tenant_id: str | None,
        workspace_id: str | None = None,
        user_id: str | None = None,
    ) -> Memory | None:
        """Supersede an existing memory with immutable revision provenance (ENT-P12 Task 4).

        The previous memory is preserved in status='superseded' with updated_at timestamp.
        A new successor memory is created with supersedes_id pointer, content hash,
        recalculated embeddings, and an immutable audit trail.
        """
        old_memory = await self.get_memory(db, memory_id, tenant_id, workspace_id)
        if not old_memory:
            return None

        # 1. Snapshot old state for durable versioning
        old_state = {
            "title": getattr(old_memory, "title", None),
            "summary": getattr(old_memory, "summary", None),
            "content": getattr(old_memory, "content", None),
            "type": getattr(old_memory, "type", None),
            "domain": getattr(old_memory, "domain", None),
            "status": getattr(old_memory, "status", None),
            "tags": list(getattr(old_memory, "tags", None) or []),
            "metadata": dict(getattr(old_memory, "metadata_", None) or {}),
        }

        # 2. Mark old memory as superseded
        old_memory.status = "superseded"
        old_memory.updated_at = datetime.now(UTC)

        # 3. Create successor memory record
        new_title = dto.title if dto.title is not None else old_memory.title
        new_summary = dto.summary if dto.summary is not None else old_memory.summary
        new_content = dto.content if dto.content is not None else old_memory.content
        if new_content:
            new_content = sanitize_text(new_content)
        new_type = dto.type or old_memory.type
        new_domain = dto.domain or old_memory.domain
        new_tags = dto.tags if dto.tags is not None else list(old_memory.tags or [])

        merged_meta = dict(getattr(old_memory, "metadata_", None) or {})
        if dto.metadata:
            merged_meta.update(dto.metadata)
        merged_meta["supersession_reason"] = dto.reason
        merged_meta["superseded_from_id"] = str(old_memory.id)
        merged_meta["superseded_at"] = datetime.now(UTC).isoformat()
        if user_id:
            merged_meta["superseded_by_user_id"] = str(user_id)

        content_for_embedding = new_content or new_summary or new_title or ""
        embedding = None
        if content_for_embedding.strip():
            with contextlib.suppress(LLMProviderError):
                embedding = await llm_service.generate_embedding(
                    content_for_embedding,
                    user_id=str(user_id) if user_id else (str(old_memory.user_id) if old_memory.user_id else None),
                    workspace_id=str(workspace_id) if workspace_id else (str(old_memory.workspace_id) if old_memory.workspace_id else None),
                    db=db,
                )

        new_memory = Memory(
            id=uuid.uuid4(),
            type=new_type,
            domain=new_domain,
            status="active",
            title=new_title,
            summary=new_summary,
            content=new_content,
            content_hash=llm_service.compute_content_hash(content_for_embedding),
            size=len(content_for_embedding),
            embedding=embedding,
            metadata_=merged_meta,
            tags=new_tags,
            tenant_id=_to_uuid(tenant_id) if tenant_id else old_memory.tenant_id,
            user_id=_to_uuid(user_id) if user_id else old_memory.user_id,
            workspace_id=_to_uuid(workspace_id) if workspace_id else old_memory.workspace_id,
            source_type="correction",
            source_label=f"Superseded #{str(old_memory.id)[:8]}: {dto.reason[:60]}",
            supersedes_id=old_memory.id,
        )
        db.add(new_memory)

        # 3b. Taxonomy provenance — a supersede can remap the type, which is
        # exactly the event the ledger exists to record.
        old_type = getattr(old_memory, "type", None)
        if new_type and new_type != old_type:
            from ..schemas.memory import ENTERPRISE_MEMORY_TYPES

            await self._record_taxonomy_change(
                db,
                memory_id=old_memory.id,
                from_type=str(old_type or ""),
                to_type=str(new_type),
                taxonomy_version=2 if new_type in ENTERPRISE_MEMORY_TYPES else 1,
                content_hash=new_memory.content_hash,
            )

        # 4. Durable versioning
        new_state = {
            "title": new_memory.title,
            "summary": new_memory.summary,
            "content": new_memory.content,
            "type": new_memory.type,
            "domain": new_memory.domain,
            "status": "active",
            "tags": list(new_memory.tags or []),
            "metadata": dict(new_memory.metadata_ or {}),
            "supersedes_id": str(old_memory.id),
            "reason": dto.reason,
        }
        try:
            from .memory_versioning import persist_version

            await persist_version(
                memory_id=old_memory.id,
                old_state=old_state,
                new_state={"status": "superseded", "superseded_by": str(new_memory.id), "reason": dto.reason},
                workspace_id=str(old_memory.workspace_id) if old_memory.workspace_id else None,
                created_by=str(user_id) if user_id else None,
                db=db,
            )
            await persist_version(
                memory_id=new_memory.id,
                old_state={},
                new_state=new_state,
                workspace_id=str(new_memory.workspace_id) if new_memory.workspace_id else None,
                created_by=str(user_id) if user_id else None,
                db=db,
            )
        except Exception:
            pass

        # 5. Record agent action / audit event
        try:
            action = AgentAction(
                id=uuid.uuid4(),
                agent_name="human_correction",
                action_type="memory_superseded",
                input_ref=str(old_memory.id),
                output_ref=str(new_memory.id),
                status="completed",
                tenant_id=_to_uuid(tenant_id) if tenant_id else old_memory.tenant_id,
                workspace_id=_to_uuid(workspace_id) if workspace_id else old_memory.workspace_id,
                metadata_={"reason": dto.reason},
            )
            db.add(action)
        except Exception:
            pass

        await db.flush()

        # 6. Sync the vector store. Without this the successor is unreachable by
        # vector search (corrections silently fail) and the predecessor's vector
        # keeps ranking even though it is now 'superseded'.
        try:
            from ..infrastructure.vector_store import (
                VectorRecord,
                get_vector_store,
            )

            vstore = get_vector_store()
            new_ws = _to_uuid(workspace_id) if workspace_id else old_memory.workspace_id
            if embedding:
                await vstore.upsert(
                    [
                        VectorRecord(
                            id=str(new_memory.id),
                            vector=embedding,
                            metadata={
                                "source_type": "memory",
                                "source_id": str(new_memory.id),
                                "workspace_id": str(new_ws) if new_ws else "",
                                "tenant_id": str(new_memory.tenant_id) if new_memory.tenant_id else "",
                                "title": new_memory.title or "",
                            },
                        )
                    ],
                    session=db,
                )
            # Purge the superseded vector so stale content cannot outrank the
            # correction it was replaced by.
            await vstore.delete([str(old_memory.id)], session=db)
        except Exception as e:
            logger.debug(f"Vector store sync on supersede bypassed or failed: {e}")

        await db.refresh(new_memory)
        return new_memory

    async def export_memories(
        self,
        db: AsyncSession,
        workspace_id: str | uuid.UUID,
        tenant_id: str | None,
        include_superseded: bool = False,
    ) -> list[Memory]:
        """Export all memories for a workspace with lineage & audit metadata (CONT-P07)."""
        ws_uuid = _to_uuid(workspace_id)
        if not ws_uuid:
            return []
        stmt = select(Memory).where(Memory.workspace_id == ws_uuid)
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        if not include_superseded:
            stmt = stmt.where(Memory.status == "active")
        else:
            stmt = stmt.where(Memory.status != "deleted")
        stmt = stmt.order_by(desc(Memory.created_at))
        res = await db.execute(stmt)
        return list(res.scalars().all())

    async def import_memories(
        self,
        db: AsyncSession,
        batch: MemoryImportBatch,
        tenant_id: str | None,
        user_id: str | None,
    ) -> tuple[int, int, int, list[uuid.UUID]]:
        """Batch import memories with hash deduplication and workspace RLS isolation."""
        ws_uuid = _to_uuid(batch.workspace_id)
        imported_ids: list[uuid.UUID] = []
        skipped_count = 0
        error_count = 0

        existing_hashes = set()
        if batch.deduplicate_by_hash and ws_uuid:
            stmt = select(Memory.content_hash).where(
                Memory.workspace_id == ws_uuid,
                Memory.status != "deleted",
            )
            res = await db.execute(stmt)
            existing_hashes = set(res.scalars().all())

        for item in batch.memories:
            try:
                title = item.title or (item.summary[:60] if item.summary else "Imported Memory")
                content = item.content or item.summary or title
                content_for_embedding = content or ""
                chash = llm_service.compute_content_hash(content_for_embedding)

                if batch.deduplicate_by_hash and chash in existing_hashes:
                    skipped_count += 1
                    continue

                embedding = None
                if content_for_embedding.strip():
                    with contextlib.suppress(LLMProviderError):
                        embedding = await llm_service.generate_embedding(
                            content_for_embedding,
                            user_id=str(user_id) if user_id else None,
                            workspace_id=str(ws_uuid) if ws_uuid else None,
                            db=db,
                        )

                mem = Memory(
                    id=uuid.uuid4(),
                    type=item.type or "note",
                    domain=item.domain,
                    status="active",
                    title=title,
                    summary=item.summary,
                    content=sanitize_text(content),
                    content_hash=chash,
                    size=len(content_for_embedding),
                    embedding=embedding,
                    metadata_=dict(item.metadata or {}),
                    tags=list(item.tags or []),
                    tenant_id=_to_uuid(tenant_id) if tenant_id else None,
                    user_id=_to_uuid(user_id) if user_id else None,
                    workspace_id=ws_uuid,
                    source_type=item.source_type or "import",
                    source_label=item.source_label or "Batch Import",
                )
                db.add(mem)
                imported_ids.append(mem.id)
                existing_hashes.add(chash)
            except Exception:
                error_count += 1

        await db.flush()
        return len(imported_ids), skipped_count, error_count, imported_ids

    async def bulk_status(
        self,
        db: AsyncSession,
        memory_ids: list[uuid.UUID],
        status: str,
        workspace_id: str | uuid.UUID,
        tenant_id: str | None,
    ) -> list[uuid.UUID]:
        """Atomically update status across multiple workspace memories."""
        ws_uuid = _to_uuid(workspace_id)
        if not ws_uuid or not memory_ids:
            return []
        stmt = select(Memory).where(
            Memory.id.in_(memory_ids),
            Memory.workspace_id == ws_uuid,
        )
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        res = await db.execute(stmt)
        mems = list(res.scalars().all())
        updated: list[uuid.UUID] = []
        now = datetime.now(UTC)
        for m in mems:
            m.status = status
            m.updated_at = now
            if status == "deleted":
                m.deleted_at = now
            updated.append(m.id)
        await db.flush()
        return updated

    async def bulk_tag(
        self,
        db: AsyncSession,
        memory_ids: list[uuid.UUID],
        add_tags: list[str],
        remove_tags: list[str],
        workspace_id: str | uuid.UUID,
        tenant_id: str | None,
    ) -> list[uuid.UUID]:
        """Batch update tags across multiple memories in a workspace."""
        ws_uuid = _to_uuid(workspace_id)
        if not ws_uuid or not memory_ids:
            return []
        stmt = select(Memory).where(
            Memory.id.in_(memory_ids),
            Memory.workspace_id == ws_uuid,
        )
        if tenant_id:
            stmt = stmt.where(Memory.tenant_id == tenant_id)
        res = await db.execute(stmt)
        mems = list(res.scalars().all())
        updated: list[uuid.UUID] = []
        now = datetime.now(UTC)
        for m in mems:
            current_tags = set(m.tags or [])
            if add_tags:
                current_tags.update(add_tags)
            if remove_tags:
                current_tags.difference_update(remove_tags)
            m.tags = list(current_tags)
            m.updated_at = now
            updated.append(m.id)
        await db.flush()
        return updated


memory_service = MemoryService()


async def retrieve_grounding_dossier(
    workspace_id: str | uuid.UUID | None,
    query: str,
    db: AsyncSession,
    limit: int = 5,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Retrieve relevant workspace memories and vault documents as background context
    and return structured dossier metadata for UI inspectability.
    """
    if not workspace_id or not query:
        return "", []

    try:
        import uuid as _uuid

        from sqlalchemy import or_, select

        from ..models.schema import Document, Memory

        ws_uuid = _uuid.UUID(str(workspace_id)) if not isinstance(workspace_id, _uuid.UUID) else workspace_id

        # 1. Extract meaningful query terms (strip punctuation, skip common question stop words)
        _stop_words = {
            "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
            "tell", "write", "about", "does", "have", "with", "this", "that", "these",
            "those", "from", "your", "mine", "some", "more", "then", "into", "also",
            "show", "find", "give", "please", "could", "would", "should", "been", "were",
            "the", "and", "for", "are", "did"
        }
        cleaned_tokens = [w.strip("?!.,;:\"'()[]{}").lower() for w in query.split()]
        terms = [t for t in cleaned_tokens if len(t) >= 3 and t not in _stop_words]
        if not terms:
            terms = [t for t in cleaned_tokens if len(t) >= 3]

        mem_stmt = (
            select(Memory)
            .where(Memory.workspace_id == ws_uuid)
            .where(Memory.deleted_at.is_(None))
        )
        if terms:
            word_filters = [
                or_(
                    Memory.title.ilike(f"%{t}%"),
                    Memory.summary.ilike(f"%{t}%"),
                )
                for t in terms[:5]
            ]
            mem_stmt = mem_stmt.where(or_(*word_filters))

        mem_stmt = mem_stmt.order_by(Memory.updated_at.desc(), Memory.created_at.desc()).limit(limit)
        mem_res = await db.execute(mem_stmt)
        memories = mem_res.scalars().all()

        # 2. Search relevant workspace documents (uploaded documents, resumes, markdown vault notes)
        doc_stmt = (
            select(Document)
            .where(Document.workspace_id == ws_uuid)
            .where(Document.deleted_at.is_(None))
        )
        if terms:
            doc_filters = [
                or_(
                    Document.path.ilike(f"%{t}%"),
                    Document.summary.ilike(f"%{t}%"),
                )
                for t in terms[:5]
            ]
            doc_stmt = doc_stmt.where(or_(*doc_filters))

        doc_stmt = doc_stmt.order_by(Document.updated_at.desc(), Document.created_at.desc()).limit(limit)
        doc_res = await db.execute(doc_stmt)
        documents = doc_res.scalars().all()

        if not memories and not documents:
            return "", []

        dossier_items: list[dict[str, Any]] = []
        context_lines = [
            "[Background Context from Workspace Memories & Vault Notes]",
            "[COGNITIVE PRECEDENCE DIRECTIVE]: Grounding Documents represent current authoritative facts. Inspect and ground on Active Grounding Documents first. Dynamic Memories represent user preferences and background; do not allow historical memory to override active documents.",
        ]

        # Active Grounding Documents FIRST (Claude-style authoritative grounding)
        if documents:
            context_lines.append("\n### 📄 Active Grounding Documents (Authoritative)")
            for d in documents:
                snippet = (d.summary or "").strip()[:350]
                title = d.path.rsplit("/", 1)[-1] if d.path else "Document"
                context_lines.append(f"- Active Document ({title}): {snippet}")
                dossier_items.append({
                    "id": str(d.id),
                    "title": title,
                    "snippet": snippet,
                    "source": "vault",
                    "score": 0.95,
                    "updatedAt": d.updated_at.isoformat() if getattr(d, "updated_at", None) else None,
                })

        # Dynamic Memories SECOND (ChatGPT-style personalization & memory cards)
        if memories:
            context_lines.append("\n### 🧠 Dynamic Memories (Enrichment)")
            for m in memories:
                snippet = (m.summary or m.content or "").strip()[:250]
                context_lines.append(f"- Memory ({m.type or 'fact'}): {m.title} — {snippet}")
                dossier_items.append({
                    "id": str(m.id),
                    "title": m.title,
                    "snippet": snippet,
                    "source": "memory",
                    "score": 0.82,
                    "updatedAt": m.updated_at.isoformat() if getattr(m, "updated_at", None) else None,
                })

        return "\n".join(context_lines), dossier_items
    except Exception as e:
        logger.debug(f"Failed to retrieve grounding dossier: {e}")
        return "", []


async def retrieve_memory_and_vault_context(
    workspace_id: str | uuid.UUID | None,
    query: str,
    db: AsyncSession,
    limit: int = 5,
) -> str:
    """
    Retrieve relevant workspace memories and vault notes as background context
    for chat queries.
    """
    bg_context, _ = await retrieve_grounding_dossier(workspace_id, query, db, limit=limit)
    return bg_context

