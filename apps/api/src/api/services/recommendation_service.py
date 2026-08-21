import uuid
from typing import Any

from sqlalchemy import text

from ..services.llm_service import llm_service


class RecommendationService:
    async def _compute_embedding(self, text_content: str) -> list[float]:
        try:
            return await llm_service.generate_embedding(text_content)
        except Exception:
            pass
        return [0.0] * 1536

    async def generate(self, dto, db):
        user_id = dto.user_id
        tenant_id = dto.tenant_id or "default"
        top_n = dto.top_n
        context_tags = dto.context_tags or []

        pref_vector_result = await db.execute(
            text("""
                SELECT preference_vector FROM user_preference_vectors
                WHERE user_id = :user_id AND tenant_id = :tenant_id
            """),
            {"user_id": user_id, "tenant_id": tenant_id},
        )
        pref_row = pref_vector_result.fetchone()

        embedding = [0.0] * 1536
        if pref_row and pref_row[0]:
            raw = pref_row[0]
            if isinstance(raw, str):
                raw = raw.strip("[]").split(",")
            embedding = [float(v) for v in raw]

        embedding_str = "[" + ",".join(f"{v}" for v in embedding) + "]"

        memories_result = await db.execute(
            text("""
                SELECT id::text, 'memory' AS type, title, summary, metadata,
                       COALESCE((metadata->>'importance')::float, 0.5) AS importance,
                       EXTRACT(EPOCH FROM NOW() - created_at) / 86400.0 AS recency,
                       COALESCE((metadata->>'usageCount')::int, 0) AS usage_count,
                       1 - (embedding <=> :embedding::vector) AS distance
                FROM memories
                WHERE tenant_id = :tenant_id AND status != 'deleted' AND embedding IS NOT NULL
                ORDER BY distance DESC
                LIMIT :top_n
            """),
            {"embedding": embedding_str, "tenant_id": tenant_id, "top_n": top_n * 3},
        )
        memory_rows = memories_result.fetchall() or []

        nodes_result = await db.execute(
            text("""
                SELECT id::text, type, label AS title, description AS summary, properties AS metadata,
                       importance,
                       EXTRACT(EPOCH FROM NOW() - created_at) / 86400.0 AS recency,
                       COALESCE((properties->>'usageCount')::int, 0) AS usage_count,
                       1 - (embedding <=> :embedding::vector) AS distance
                FROM knowledge_nodes
                WHERE tenant_id = :tenant_id AND embedding IS NOT NULL
                ORDER BY distance DESC
                LIMIT :top_n
            """),
            {"embedding": embedding_str, "tenant_id": tenant_id, "top_n": top_n * 3},
        )
        node_rows = nodes_result.fetchall() or []

        candidates = []
        for r in memory_rows:
            candidates.append(self._build_item(r, "memory"))

        for r in node_rows:
            candidates.append(self._build_item(r, "knowledge_node"))

        if context_tags:
            for c in candidates:
                meta = c.get("metadata") or {}
                tags = meta.get("tags") or []
                tag_overlap = len(set(tags) & set(context_tags))
                c["context_boost"] = min(tag_overlap * 0.1, 0.3)
            for c in candidates:
                c["score"] = (
                    c.get("distance", 0) * 0.5
                    + c.get("importance", 0.5) * 0.3
                    + c.get("recency_score", 0) * 0.1
                    + c.get("usage_score", 0) * 0.1
                    + c.get("context_boost", 0)
                )
        else:
            for c in candidates:
                c["score"] = (
                    c.get("distance", 0) * 0.5
                    + c.get("importance", 0.5) * 0.3
                    + c.get("recency_score", 0) * 0.1
                    + c.get("usage_score", 0) * 0.1
                )

        candidates.sort(key=lambda x: x["score"], reverse=True)

        top_items = candidates[:top_n]

        items_json = [
            {
                "id": c["id"],
                "type": c["type"],
                "title": c["title"],
                "summary": c.get("summary"),
                "score": round(c["score"], 6),
                "source": c.get("source", "vector"),
                "metadata": c.get("metadata"),
            }
            for c in top_items
        ]

        rec_id = uuid.uuid4()
        model_version = "v1"

        result = await db.execute(
            text("""
                INSERT INTO recommendations (id, user_id, tenant_id, items, model_version)
                VALUES (:id, :user_id, :tenant_id, :items::jsonb, :model_version)
                RETURNING id, user_id, tenant_id, items::text, model_version, created_at
            """),
            {
                "id": rec_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "items": items_json,
                "model_version": model_version,
            },
        )
        return result.fetchone()

    def _build_item(self, row, source: str) -> dict:
        distance = float(row.distance) if row.distance is not None else 0
        importance = float(row.importance) if row.importance is not None else 0.5
        recency_days = float(row.recency) if row.recency is not None else 365
        usage_count = int(row.usage_count) if row.usage_count is not None else 0

        recency_score = max(0, 1.0 - recency_days / 365.0)
        usage_score = min(usage_count / 100.0, 1.0)

        return {
            "id": str(row.id),
            "type": str(row.type),
            "title": str(row.title),
            "summary": str(row.summary) if row.summary else None,
            "metadata": dict(row.metadata) if row.metadata else {},
            "distance": distance,
            "importance": importance,
            "recency_score": recency_score,
            "usage_score": usage_score,
            "source": source,
        }

    async def get_by_user(self, user_id: str, db):
        result = await db.execute(
            text("""
                SELECT id, user_id, tenant_id, items::text, model_version, created_at
                FROM recommendations
                WHERE user_id = :user_id
                ORDER BY created_at DESC
            """),
            {"user_id": user_id},
        )
        return result.fetchall()

    async def record_feedback(self, dto, db):
        rec_result = await db.execute(
            text("SELECT id FROM recommendations WHERE id = :rid"),
            {"rid": uuid.UUID(dto.recommendation_id)},
        )
        if not rec_result.fetchone():
            return None

        feedback_id = uuid.uuid4()
        row_result = await db.execute(
            text("""
                INSERT INTO recommendation_feedback (id, recommendation_id, useful)
                VALUES (:id, :recommendation_id, :useful)
                RETURNING id, recommendation_id, useful, created_at
            """),
            {
                "id": feedback_id,
                "recommendation_id": uuid.UUID(dto.recommendation_id),
                "useful": dto.useful,
            },
        )
        return row_result.fetchone()

    async def get_trending(self, limit: int, tenant_id: str | None, db):
        params: dict[str, Any] = {"limit": limit}

        tenant_clause = ""
        if tenant_id:
            tenant_clause = "AND tenant_id = :tenant_id"
            params["tenant_id"] = tenant_id

        memories_result = await db.execute(
            text(f"""
                SELECT id::text AS item_id, 'memory' AS item_type, title,
                       summary, metadata, COALESCE((metadata->>'usageCount')::int, 0) AS usage_count
                FROM memories
                WHERE status != 'deleted' {tenant_clause}
                ORDER BY usage_count DESC
                LIMIT :limit
            """),
            params,
        )
        memory_rows = memories_result.fetchall() or []

        nodes_result = await db.execute(
            text(f"""
                SELECT id::text AS item_id, 'knowledge_node' AS item_type, label AS title,
                       description AS summary, properties AS metadata,
                       COALESCE((properties->>'usageCount')::int, 0) AS usage_count
                FROM knowledge_nodes
                WHERE 1=1 {tenant_clause}
                ORDER BY usage_count DESC
                LIMIT :limit
            """),
            params,
        )
        node_rows = nodes_result.fetchall() or []

        merged = []
        for r in memory_rows:
            merged.append({
                "id": str(r.item_id),
                "type": str(r.item_type),
                "title": str(r.title),
                "summary": str(r.summary) if r.summary else None,
                "metadata": dict(r.metadata) if r.metadata else {},
                "score": float(r.usage_count),
                "source": "memory",
            })
        for r in node_rows:
            merged.append({
                "id": str(r.item_id),
                "type": str(r.item_type),
                "title": str(r.title),
                "summary": str(r.summary) if r.summary else None,
                "metadata": dict(r.metadata) if r.metadata else {},
                "score": float(r.usage_count),
                "source": "knowledge_node",
            })

        merged.sort(key=lambda x: x["score"], reverse=True)
        return merged[:limit]

    async def reindex(self, user_id: str | None, tenant_id: str | None, db):
        params: dict[str, Any] = {}

        user_clause = ""
        if user_id:
            user_clause = "AND m.user_id = :user_id"
            params["user_id"] = user_id

        tenant_clause = ""
        if tenant_id:
            tenant_clause = "AND m.tenant_id = :tenant_id"
            params["tenant_id"] = tenant_id

        users_result = await db.execute(
            text(f"""
                SELECT DISTINCT m.user_id
                FROM memories m
                WHERE m.user_id IS NOT NULL AND m.embedding IS NOT NULL
                {user_clause} {tenant_clause}
            """),
            params,
        )
        user_rows = users_result.fetchall() or []

        results = []
        for row in user_rows:
            uid = row[0]
            avg_result = await db.execute(
                text("""
                    SELECT AVG(embedding)::text FROM memories
                    WHERE user_id = :uid AND tenant_id = :tid AND embedding IS NOT NULL
                """),
                {"uid": uid, "tid": tenant_id or "default"},
            )
            avg_row = avg_result.fetchone()
            if avg_row and avg_row[0]:
                await db.execute(
                    text("""
                        INSERT INTO user_preference_vectors (user_id, tenant_id, preference_vector)
                        VALUES (:uid, :tid, :vector::vector)
                        ON CONFLICT (user_id, tenant_id)
                        DO UPDATE SET preference_vector = :vector::vector, updated_at = NOW()
                    """),
                    {"uid": uid, "tid": tenant_id or "default", "vector": avg_row[0]},
                )
                results.append({"user_id": str(uid), "status": "reindexed"})

        return results


recommendation_service = RecommendationService()
