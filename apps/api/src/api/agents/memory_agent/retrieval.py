import logging
import math
from typing import List, Literal, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Context window defaults
DEFAULT_MAX_CONTEXT_TOKENS = 8000
SYSTEM_PROMPT_TOKENS = 500
RESPONSE_TOKENS = 1000


class RetrievedMemory(BaseModel):
    id: str
    content: str
    source_document_id: Optional[str] = None
    source_memory_id: Optional[str] = None
    relevance_score: float

def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

async def vector_search(query: str, workspace_id: str, limit: int) -> List[RetrievedMemory]:
    try:
        from api.database import async_session_factory
        from api.models.schema import Embedding, Entity, MemoryRecord
        from api.services.llm_service import llm_service
        from sqlalchemy import select, text
    except ImportError as e:
        logger.warning(f"Vector search imports unavailable: {e}")
        return []

    try:
        query_embedding = await llm_service.generate_embedding(query)
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return _in_memory_vector_search(query, workspace_id, limit)

    try:
        async with async_session_factory() as session:
            try:
                stmt = text(
                    "SELECT e.id, e.source_type, e.source_id, e.vector, "
                    "e.vector <=> :query_vec AS distance "
                    "FROM embeddings e "
                    "WHERE e.workspace_id = :ws "
                    "ORDER BY distance "
                    "LIMIT :lim"
                )
                result = await session.execute(stmt, {
                    "query_vec": query_embedding,
                    "ws": workspace_id,
                    "lim": limit,
                })
                rows = result.fetchall()
            except Exception:
                rows = await _fallback_vector_search(session, query_embedding, workspace_id, limit)

            memories = []
            for row in rows:
                source_type = row.source_type
                source_id = str(row.source_id)
                distance = getattr(row, 'distance', 0.5)
                score = round(1.0 - min(float(distance), 1.0), 4)

                content = ""
                doc_id = None
                if source_type == "entity":
                    entity_result = await session.execute(
                        select(Entity).where(Entity.id == source_id)
                    )
                    entity = entity_result.scalar_one_or_none()
                    if entity:
                        content = entity.canonical_name
                        doc_id = str(entity.id)
                elif source_type == "memory_record":
                    mr_result = await session.execute(
                        select(MemoryRecord).where(MemoryRecord.id == source_id)
                    )
                    mr = mr_result.scalar_one_or_none()
                    if mr:
                        content = str(mr.content)
                        doc_id = str(mr.source_document_id) if mr.source_document_id else None

                if content:
                    memories.append(RetrievedMemory(
                        id=str(row.id),
                        content=content,
                        source_document_id=doc_id,
                        relevance_score=score,
                    ))
            return memories
    except Exception as e:
        logger.warning(f"Vector search DB failed: {e}, using in-memory fallback")
        return _in_memory_vector_search(query, workspace_id, limit)

async def _fallback_vector_search(session, query_embedding: list[float], workspace_id: str, limit: int) -> list:
    from api.models.schema import Embedding
    from sqlalchemy import select

    stmt = select(Embedding).where(Embedding.workspace_id == workspace_id).limit(limit * 3)
    result = await session.execute(stmt)
    all_embeddings = result.scalars().all()

    scored = []
    for emb in all_embeddings:
        if emb.vector is None:
            continue
        vec = list(emb.vector) if hasattr(emb.vector, '__iter__') else emb.vector
        sim = _cosine_similarity(query_embedding, vec)
        scored.append((emb, sim))

    scored.sort(key=lambda x: x[1], reverse=True)
    results = []
    for emb, _ in scored[:limit]:
        results.append(emb)
    return results

def _in_memory_vector_search(query: str, workspace_id: str, limit: int) -> List[RetrievedMemory]:
    return [RetrievedMemory(
        id="vec_fallback",
        content=f"Vector search unavailable for: {query}",
        relevance_score=0.5,
    )]

async def keyword_search(query: str, workspace_id: str, limit: int) -> List[RetrievedMemory]:
    try:
        from api.database import async_session_factory
        from api.models.schema import Entity, MemoryRecord
        from sqlalchemy import select, or_
    except ImportError as e:
        logger.warning(f"Keyword search imports unavailable: {e}")
        return []

    try:
        async with async_session_factory() as session:
            memories = []
            pattern = f"%{query}%"

            entity_stmt = (
                select(Entity)
                .where(Entity.workspace_id == workspace_id)
                .where(
                    or_(
                        Entity.canonical_name.ilike(pattern),
                        Entity.type.ilike(pattern),
                    )
                )
                .limit(limit)
            )
            entity_result = await session.execute(entity_stmt)
            for entity in entity_result.scalars().all():
                memories.append(RetrievedMemory(
                    id=f"entity_{entity.id}",
                    content=f"{entity.canonical_name} ({entity.type})",
                    source_document_id=str(entity.id),
                    relevance_score=0.7,
                ))

            if len(memories) < limit:
                mr_stmt = (
                    select(MemoryRecord)
                    .where(MemoryRecord.workspace_id == workspace_id)
                    .where(MemoryRecord.content.cast("text").ilike(pattern))
                    .limit(limit - len(memories))
                )
                mr_result = await session.execute(mr_stmt)
                for mr in mr_result.scalars().all():
                    memories.append(RetrievedMemory(
                        id=f"mr_{mr.id}",
                        content=str(mr.content),
                        source_document_id=str(mr.source_document_id) if mr.source_document_id else None,
                        relevance_score=0.65,
                    ))

            return memories
    except Exception as e:
        logger.warning(f"Keyword search failed: {e}")
        return []

async def graph_traversal(query: str, workspace_id: str, limit: int) -> List[RetrievedMemory]:
    try:
        from api.database import async_session_factory
        from api.models.schema import Entity, Relationship
        from sqlalchemy import select, or_
        import uuid
    except ImportError as e:
        logger.warning(f"Graph traversal imports unavailable: {e}")
        return []

    try:
        async with async_session_factory() as session:
            entity_stmt = (
                select(Entity)
                .where(Entity.workspace_id == workspace_id)
                .where(Entity.canonical_name.ilike(f"%{query}%"))
                .limit(limit)
            )
            entity_result = await session.execute(entity_stmt)
            matched_entities = entity_result.scalars().all()

            memories = []
            for entity in matched_entities:
                rel_stmt = select(Relationship).where(
                    or_(
                        Relationship.from_entity_id == entity.id,
                        Relationship.to_entity_id == entity.id,
                    )
                ).limit(5)
                rel_result = await session.execute(rel_stmt)
                relationships = rel_result.scalars().all()

                related_names = []
                for rel in relationships:
                    other_id = rel.to_entity_id if rel.from_entity_id == entity.id else rel.from_entity_id
                    try:
                        other = await session.get(Entity, other_id)
                        if other:
                            related_names.append(f"{other.canonical_name} ({rel.relation_type})")
                    except Exception:
                        continue

                content = entity.canonical_name
                if related_names:
                    content += " → " + ", ".join(related_names)

                memories.append(RetrievedMemory(
                    id=f"graph_{entity.id}",
                    content=content,
                    source_document_id=str(entity.id),
                    relevance_score=0.75,
                ))

            return memories
    except Exception as e:
        logger.warning(f"Graph traversal failed: {e}")
        return []

async def rerank(results: List[RetrievedMemory], query: str, limit: int) -> List[RetrievedMemory]:
    seen = set()
    deduped = []
    for r in results:
        key = r.id
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    sorted_results = sorted(deduped, key=lambda x: x.relevance_score, reverse=True)
    return sorted_results[:limit]


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (4 chars per token for English)."""
    return len(text) // 4


def fit_to_context_window(
    results: List[RetrievedMemory],
    max_context_tokens: int = DEFAULT_MAX_CONTEXT_TOKENS,
) -> List[RetrievedMemory]:
    """Filter results to fit within LLM context window.

    Keeps highest-relevance items first, then re-sorts by original order
    for coherence.
    """
    available = max_context_tokens - SYSTEM_PROMPT_TOKENS - RESPONSE_TOKENS
    if available <= 0:
        return []

    selected = []
    used_tokens = 0
    for r in results:
        chunk_tokens = _estimate_tokens(r.content)
        if used_tokens + chunk_tokens <= available:
            selected.append(r)
            used_tokens += chunk_tokens
    return selected


async def retrieve(
    query: str,
    workspace_id: str,
    strategy: Literal["vector", "keyword", "graph", "hybrid"] = "hybrid",
    limit: int = 10,
    max_context_tokens: int = DEFAULT_MAX_CONTEXT_TOKENS,
) -> List[RetrievedMemory]:
    logger.info(f"Retrieving memories for '{query}' using '{strategy}' strategy")

    if strategy == "vector":
        results = await vector_search(query, workspace_id, limit)
    elif strategy == "keyword":
        results = await keyword_search(query, workspace_id, limit)
    elif strategy == "graph":
        results = await graph_traversal(query, workspace_id, limit)
    elif strategy == "hybrid":
        vector_results = await vector_search(query, workspace_id, limit)
        keyword_results = await keyword_search(query, workspace_id, limit)
        graph_results = await graph_traversal(query, workspace_id, limit)

        seen = set()
        combined = []
        for r in vector_results + keyword_results + graph_results:
            if r.id not in seen:
                seen.add(r.id)
                combined.append(r)
        results = await rerank(combined, query, limit=limit)
    else:
        results = []

    # Fit results to context window
    return fit_to_context_window(results, max_context_tokens)
