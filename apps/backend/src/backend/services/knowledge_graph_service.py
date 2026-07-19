import uuid
from typing import Any

from sqlalchemy import text

from ..services.llm_service import llm_service, LLMProviderError


class KnowledgeGraphService:
    async def _compute_embedding(self, text_content: str) -> list[float]:
        try:
            return await llm_service.generate_embedding(text_content)
        except (LLMProviderError, ValueError, KeyError, IndexError):
            pass
        return [0.0] * 1536

    async def create_node(self, dto, tenant_id: str | None, db):
        node_id = uuid.uuid4()
        label = dto.label
        node_type = dto.type.value
        description = dto.description
        importance = dto.importance if dto.importance is not None else 0.5
        properties = dto.properties or {}
        effective_tenant = dto.tenant_id or tenant_id or "default"

        content_for_embedding = f"{label} {description or ''}".strip()
        embedding = await self._compute_embedding(content_for_embedding)
        embedding_str = "[" + ",".join(f"{v}" for v in embedding) + "]"

        result = await db.execute(
            text("""
                INSERT INTO knowledge_nodes (id, label, type, description, importance, embedding, properties, tenant_id)
                VALUES (:id, :label, :type, :description, :importance, :embedding::vector, :properties, :tenant_id)
                RETURNING id, label, type, description, importance, properties, tenant_id, created_at, updated_at
            """),
            {
                "id": node_id,
                "label": label,
                "type": node_type,
                "description": description,
                "importance": importance,
                "embedding": embedding_str,
                "properties": properties,
                "tenant_id": effective_tenant,
            },
        )
        row = result.fetchone()
        return row

    async def list_nodes(
        self,
        page: int,
        page_size: int,
        type_filter: str | None,
        search: str | None,
        min_importance: float | None,
        max_importance: float | None,
        sort_by: str | None,
        sort_order: str | None,
        tenant_id: str | None,
        db,
    ):
        conditions = []
        params: dict[str, Any] = {}

        if tenant_id:
            conditions.append("n.tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id

        if type_filter:
            conditions.append("n.type = :type_filter")
            params["type_filter"] = type_filter

        if search:
            conditions.append("(n.label ILIKE :search OR n.description ILIKE :search)")
            params["search"] = f"%{search}%"

        if min_importance is not None:
            conditions.append("n.importance >= :min_imp")
            params["min_imp"] = min_importance

        if max_importance is not None:
            conditions.append("n.importance <= :max_imp")
            params["max_imp"] = max_importance

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        allowed_sort_columns = {"label", "type", "importance", "created_at", "updated_at"}
        order_column = sort_by if sort_by in allowed_sort_columns else "created_at"
        order_dir = "ASC" if sort_order and sort_order.upper() == "ASC" else "DESC"

        offset = (page - 1) * page_size

        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM knowledge_nodes n WHERE {where_clause}"),
            params,
        )
        total = count_result.scalar()

        params["limit"] = page_size
        params["offset_val"] = offset

        result = await db.execute(
            text(f"""
                SELECT n.id, n.label, n.type, n.description, n.importance,
                       n.properties, n.tenant_id, n.created_at, n.updated_at
                FROM knowledge_nodes n
                WHERE {where_clause}
                ORDER BY n.{order_column} {order_dir}
                LIMIT :limit OFFSET :offset_val
            """),
            params,
        )
        rows = result.fetchall()
        return rows, total

    async def get_node(self, node_id: uuid.UUID, db):
        result = await db.execute(
            text("""
                SELECT n.id, n.label, n.type, n.description, n.importance,
                       n.properties, n.tenant_id, n.created_at, n.updated_at,
                       (SELECT COUNT(*)::int FROM knowledge_edges
                        WHERE source_id = n.id OR target_id = n.id) AS edge_count
                FROM knowledge_nodes n
                WHERE n.id = :node_id
            """),
            {"node_id": node_id},
        )
        return result.fetchone()

    async def update_node(self, node_id: uuid.UUID, dto, db):
        update_data = dto.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_node(node_id, db)

        set_parts = []
        params: dict[str, Any] = {"node_id": node_id}
        needs_reembed = False

        if "label" in update_data:
            set_parts.append("label = :label")
            params["label"] = update_data["label"]
            needs_reembed = True
        if "type" in update_data:
            set_parts.append("type = :type")
            params["type"] = update_data["type"].value
        if "description" in update_data:
            set_parts.append("description = :description")
            params["description"] = update_data["description"]
            needs_reembed = True
        if "importance" in update_data:
            set_parts.append("importance = :importance")
            params["importance"] = update_data["importance"]
        if "properties" in update_data:
            set_parts.append("properties = :properties")
            params["properties"] = update_data["properties"]

        if needs_reembed:
            label = update_data.get("label") or dto.label
            description = update_data.get("description") or dto.description
            content_for_embedding = f"{label} {description or ''}".strip()
            embedding = await self._compute_embedding(content_for_embedding)
            embedding_str = "[" + ",".join(f"{v}" for v in embedding) + "]"
            set_parts.append("embedding = :embedding::vector")
            params["embedding"] = embedding_str

        set_clause = ", ".join(set_parts)
        result = await db.execute(
            text(f"""
                UPDATE knowledge_nodes
                SET {set_clause}, updated_at = NOW()
                WHERE id = :node_id
                RETURNING id, label, type, description, importance, properties, tenant_id, created_at, updated_at
            """),
            params,
        )
        return result.fetchone()

    async def delete_node(self, node_id: uuid.UUID, db):
        await db.execute(
            text("DELETE FROM knowledge_edges WHERE source_id = :node_id OR target_id = :node_id"),
            {"node_id": node_id},
        )
        result = await db.execute(
            text("DELETE FROM knowledge_nodes WHERE id = :node_id RETURNING id"),
            {"node_id": node_id},
        )
        return result.fetchone()

    async def create_edge(self, source_id: uuid.UUID, dto, db):
        source = await self.get_node(source_id, db)
        if not source:
            return None

        target_uuid = uuid.UUID(dto.target_id) if isinstance(dto.target_id, str) else dto.target_id
        target = await self.get_node(target_uuid, db)
        if not target:
            return None

        dup = await db.execute(
            text("""
                SELECT id FROM knowledge_edges
                WHERE source_id = :source_id AND target_id = :target_id AND relationship = :rel
            """),
            {"source_id": source_id, "target_id": target_uuid, "rel": dto.relationship},
        )
        if dup.fetchone():
            return None

        edge_id = uuid.uuid4()
        weight = dto.weight if dto.weight is not None else 0.5
        properties = dto.properties or {}

        result = await db.execute(
            text("""
                INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, properties)
                VALUES (:id, :source_id, :target_id, :relationship, :weight, :properties)
                RETURNING id, source_id, target_id, relationship, weight, properties, created_at
            """),
            {
                "id": edge_id,
                "source_id": source_id,
                "target_id": target_uuid,
                "relationship": dto.relationship,
                "weight": weight,
                "properties": properties,
            },
        )
        return result.fetchone()

    async def list_edges(self, node_id: uuid.UUID, page: int, page_size: int, db):
        offset = (page - 1) * page_size

        count_result = await db.execute(
            text("""
                SELECT COUNT(*) FROM knowledge_edges
                WHERE source_id = :node_id OR target_id = :node_id
            """),
            {"node_id": node_id},
        )
        total = count_result.scalar()

        result = await db.execute(
            text("""
                SELECT e.id, e.source_id, e.target_id, e.relationship, e.weight,
                       e.properties, e.created_at,
                       jsonb_build_object('id', src.id, 'label', src.label, 'type', src.type) AS source,
                       jsonb_build_object('id', tgt.id, 'label', tgt.label, 'type', tgt.type) AS target
                FROM knowledge_edges e
                JOIN knowledge_nodes src ON src.id = e.source_id
                JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                WHERE e.source_id = :node_id OR e.target_id = :node_id
                ORDER BY e.created_at DESC
                LIMIT :limit OFFSET :offset_val
            """),
            {"node_id": node_id, "limit": page_size, "offset_val": offset},
        )
        return result.fetchall(), total

    async def list_all_edges(self, page: int, page_size: int, relationship: str | None, db):
        offset = (page - 1) * page_size
        params: dict[str, Any] = {"limit": page_size, "offset_val": offset}

        where_clause = ""
        if relationship:
            where_clause = "WHERE e.relationship = :rel"
            params["rel"] = relationship

        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM knowledge_edges e {where_clause}"),
            params if relationship else {},
        )
        total = count_result.scalar()

        result = await db.execute(
            text(f"""
                SELECT e.id, e.source_id, e.target_id, e.relationship, e.weight,
                       e.properties, e.created_at,
                       jsonb_build_object('id', src.id, 'label', src.label, 'type', src.type) AS source,
                       jsonb_build_object('id', tgt.id, 'label', tgt.label, 'type', tgt.type) AS target
                FROM knowledge_edges e
                JOIN knowledge_nodes src ON src.id = e.source_id
                JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                {where_clause}
                ORDER BY e.created_at DESC
                LIMIT :limit OFFSET :offset_val
            """),
            params,
        )
        return result.fetchall(), total

    async def delete_edge(self, edge_id: uuid.UUID, db):
        result = await db.execute(
            text("DELETE FROM knowledge_edges WHERE id = :edge_id RETURNING id"),
            {"edge_id": edge_id},
        )
        return result.fetchone()

    async def traverse(self, start_id: uuid.UUID, depth: int, mode: str, db):
        order_dir = "ASC" if mode == "bfs" else "DESC"
        result = await db.execute(
            text(f"""
                WITH RECURSIVE path_cte AS (
                    SELECT n.id, n.label, n.type, n.description, n.importance,
                           n.properties, n.tenant_id, n.created_at, n.updated_at,
                           ARRAY[n.id]::uuid[] AS path_ids, 0 AS lvl
                    FROM knowledge_nodes n
                    WHERE n.id = :start_id

                    UNION

                    SELECT DISTINCT ON (t.id)
                           t.id, t.label, t.type, t.description, t.importance,
                           t.properties, t.tenant_id, t.created_at, t.updated_at,
                           array_append(pc.path_ids, t.id) AS path_ids,
                           pc.lvl + 1 AS lvl
                    FROM path_cte pc
                    JOIN knowledge_edges e ON e.source_id = pc.id
                    JOIN knowledge_nodes t ON t.id = e.target_id
                    WHERE pc.lvl < :depth AND NOT t.id = ANY(pc.path_ids)
                )
                SELECT id, label, type, description, importance,
                       properties, tenant_id, created_at, updated_at,
                       lvl, path_ids
                FROM path_cte
                ORDER BY lvl {order_dir}
            """),
            {"start_id": start_id, "depth": depth},
        )
        return result.fetchall()

    async def find_shortest_path(self, from_id: uuid.UUID, to_id: uuid.UUID, max_depth: int, db):
        result = await db.execute(
            text("""
                WITH RECURSIVE search_path AS (
                    SELECT n.id, ARRAY[n.id]::uuid[] AS path_ids, 0 AS depth
                    FROM knowledge_nodes n
                    WHERE n.id = :from_id

                    UNION ALL

                    SELECT t.id, array_append(sp.path_ids, t.id), sp.depth + 1
                    FROM search_path sp
                    JOIN knowledge_edges e ON e.source_id = sp.id
                    JOIN knowledge_nodes t ON t.id = e.target_id
                    WHERE sp.depth < :max_depth AND NOT t.id = ANY(sp.path_ids)
                ),
                found AS (
                    SELECT path_ids, depth FROM search_path WHERE id = :to_id
                )
                SELECT path_ids, depth FROM found ORDER BY depth LIMIT 1
            """),
            {"from_id": from_id, "to_id": to_id, "max_depth": max_depth},
        )
        found = result.fetchone()
        if not found:
            return None, None

        path_ids = found[0]
        depth = found[1]

        nodes_result = await db.execute(
            text("""
                SELECT id, label, type, description, importance,
                       properties, tenant_id, created_at, updated_at
                FROM knowledge_nodes
                WHERE id = ANY(:path_ids)
                ORDER BY array_position(:path_ids, id)
            """),
            {"path_ids": path_ids},
        )
        return nodes_result.fetchall(), depth


kg_service = KnowledgeGraphService()
