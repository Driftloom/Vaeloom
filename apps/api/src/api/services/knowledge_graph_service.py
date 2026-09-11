import contextlib
import json
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from sqlalchemy import text

from ..services.llm_service import LLMProviderError, llm_service


class KnowledgeGraphService:
    # APP-KG-01: service-layer scope is AUTHORITATIVE. Rules (fail-closed):
    # - writes (create/update/delete/edges) REQUIRE workspace_id (raise);
    #   tenant is enforced whenever provided (create falls back to "default"
    #   only for legacy tenant-less callers; the workspace binding holds).
    # - reads with NO scope at all return empty (None/[]); provided
    #   dimensions are always enforced. Fully unscoped reads never dump.
    # - caller DTO scope fields are NEVER trusted (see create_node).
    # - graph hops (traverse/path/edge expansion) constrain BOTH endpoints.
    @staticmethod
    def _require_write_scope(workspace_id: str | None) -> str:
        if not workspace_id:
            raise ValueError("workspace_id is required for KG writes (fail closed)")
        return str(workspace_id)

    @staticmethod
    def _read_scope(
        tenant_id: str | None, workspace_id: str | None
    ) -> tuple[str | None, str | None]:
        return (str(tenant_id) if tenant_id else None,
                str(workspace_id) if workspace_id else None)

    @staticmethod
    def _tenant_cond(alias: str, tenant_id: str | None, params: dict, suffix: str = "") -> str:
        if tenant_id:
            key = f"scope_tenant_id{suffix}"
            params[key] = tenant_id
            return f" AND {alias}.tenant_id = :{key}"
        return ""

    @staticmethod
    def _fix_row(row):
        """Convert raw DB row types for Pydantic (SQLite returns JSON strings)."""
        if row is None:
            return None
        d = dict(row._mapping)
        for col in ("properties", "embedding"):
            if col in d and isinstance(d[col], str):
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    d[col] = json.loads(d[col])
        if hasattr(row, "edge_count") and row.edge_count is not None:
            d["edge_count"] = int(row.edge_count)
        now = datetime.now(UTC)
        for col in ("created_at", "updated_at"):
            if col in d and d[col] is None:
                d[col] = now
        ns = SimpleNamespace(**d)
        ns._mapping = d
        return ns

    @staticmethod
    def _fix_rows(rows):
        return [KnowledgeGraphService._fix_row(r) for r in rows]
    async def _compute_embedding(self, text_content: str) -> list[float]:
        try:
            return await llm_service.generate_embedding(text_content)
        except (LLMProviderError, ValueError, KeyError, IndexError):
            pass
        return [0.0] * 1536

    async def _edge_rows_with_source_target(self, query_text, params, db):
        """Fetch edge rows and attach source/target dicts (PG/SQLite compatible)."""
        result = await db.execute(text(query_text), params)
        rows = result.fetchall()
        enriched = []
        for r in rows:
            d = dict(r._mapping)
            d["source"] = {"id": d.pop("src_id"), "label": d.pop("src_label"), "type": d.pop("src_type")}
            d["target"] = {"id": d.pop("tgt_id"), "label": d.pop("tgt_label"), "type": d.pop("tgt_type")}
            for col in ("properties",):
                if col in d and isinstance(d[col], str):
                    with contextlib.suppress(json.JSONDecodeError, TypeError):
                        d[col] = json.loads(d[col])
            ns = SimpleNamespace(**d)
            ns._mapping = d
            enriched.append(ns)
        return enriched

    async def create_node(self, dto, tenant_id: str | None, db, workspace_id: str | None = None):
        ws = self._require_write_scope(workspace_id)
        node_id = uuid.uuid4()
        label = dto.label
        node_type = dto.type.value
        description = dto.description
        importance = dto.importance if dto.importance is not None else 0.5
        properties = dto.properties or {}
        # APP-KG-01: caller DTO tenant NEVER overrides the authoritative
        # scope (tenant_id param from auth context / pipeline). dto.tenant_id
        # is ignored by design; "default" only for legacy tenant-less callers.
        effective_tenant = tenant_id or "default"

        content_for_embedding = f"{label} {description or ''}".strip()
        embedding = await self._compute_embedding(content_for_embedding)
        embedding_str = "[" + ",".join(f"{v}" for v in embedding) + "]"

        result = await db.execute(
            text("""
                INSERT INTO knowledge_nodes (id, label, type, description, importance, embedding, properties, tenant_id, workspace_id)
                VALUES (:id, :label, :type, :description, :importance, :embedding, :properties, :tenant_id, :workspace_id)
                RETURNING id, label, type, description, importance, properties, tenant_id, workspace_id, created_at, updated_at
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
                "workspace_id": ws,
            },
        )
        row = result.fetchone()
        return self._fix_row(row)

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
        workspace_id: str | None = None,
    ):
        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)
        if not tenant_id and not workspace_id:
            return [], 0
        conditions = []
        params: dict[str, Any] = {}

        if tenant_id:
            conditions.append("n.tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id

        if workspace_id:
            conditions.append("n.workspace_id = :workspace_id")
            params["workspace_id"] = workspace_id

        if type_filter:
            conditions.append("n.type = :type_filter")
            params["type_filter"] = type_filter

        if search:
            conditions.append("(n.label LIKE :search OR n.description LIKE :search)")
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
                       n.properties, n.tenant_id, n.workspace_id, n.created_at, n.updated_at
                FROM knowledge_nodes n
                WHERE {where_clause}
                ORDER BY n.{order_column} {order_dir}
                LIMIT :limit OFFSET :offset_val
            """),
            params,
        )
        rows = result.fetchall()
        return self._fix_rows(rows), total

    async def get_node(
        self, node_id: uuid.UUID, db,
        workspace_id: str | None = None, tenant_id: str | None = None,
    ):
        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)
        if not tenant_id and not workspace_id:
            return None
        params: dict[str, Any] = {"node_id": node_id, "workspace_id": workspace_id}
        tenant_cond = self._tenant_cond("n", tenant_id, params)
        s_cond = self._tenant_cond("_s", tenant_id, params, suffix="s")
        t_cond = self._tenant_cond("_t", tenant_id, params, suffix="t")
        result = await db.execute(
            text(f"""
                SELECT n.id, n.label, n.type, n.description, n.importance,
                        n.properties, n.tenant_id, n.workspace_id, n.created_at, n.updated_at,
                        (SELECT COUNT(*) FROM knowledge_edges e
                         JOIN knowledge_nodes _s ON _s.id = e.source_id
                         JOIN knowledge_nodes _t ON _t.id = e.target_id
                         WHERE (e.source_id = n.id OR e.target_id = n.id)
                           AND (_s.workspace_id = :workspace_id OR :workspace_id IS NULL)
                           AND (_t.workspace_id = :workspace_id OR :workspace_id IS NULL)
                           {s_cond} {t_cond}) AS edge_count
                FROM knowledge_nodes n
                WHERE n.id = :node_id
                  AND (n.workspace_id = :workspace_id OR :workspace_id IS NULL)
                  {tenant_cond}
            """),
            params,
        )
        return self._fix_row(result.fetchone())

    async def update_node(self, node_id: uuid.UUID, dto, db,
                          workspace_id: str | None = None, tenant_id: str | None = None):
        ws = self._require_write_scope(workspace_id)
        update_data = dto.model_dump(exclude_unset=True)
        if not update_data:
            return await self.get_node(node_id, db, ws, tenant_id)

        set_parts = []
        params: dict[str, Any] = {"node_id": node_id, "workspace_id": ws}
        params["scope_tenant_id"] = tenant_id  # None-safe: `... OR :x IS NULL`
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
            set_parts.append("embedding = :embedding")
            params["embedding"] = embedding_str

        set_clause = ", ".join(set_parts)
        # APP-KG-01: scope is part of the UPDATE predicate itself (single
        # statement — no verify-then-act TOCTOU). Zero rows = foreign/missing.
        result = await db.execute(
            text(f"""
                UPDATE knowledge_nodes
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = :node_id
                  AND workspace_id = :workspace_id
                  AND (tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)
                RETURNING id, label, type, description, importance, properties, tenant_id, created_at, updated_at
            """),
            params,
        )
        return self._fix_row(result.fetchone())

    async def delete_node(self, node_id: uuid.UUID, db,
                          workspace_id: str | None = None, tenant_id: str | None = None):
        ws = self._require_write_scope(workspace_id)
        scope = {"node_id": node_id, "workspace_id": ws, "scope_tenant_id": tenant_id}
        owned = await db.execute(
            text("SELECT id FROM knowledge_nodes n WHERE id = :node_id "
                 "AND workspace_id = :workspace_id "
                 "AND (n.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)"),
            scope,
        )
        if not owned.fetchone():
            return None
        # Scoped cascade: only same-scope edges (FK CASCADE covers the rest on
        # PG; explicit cleanup keeps SQLite parity where FKs are unenforced).
        await db.execute(
            text("DELETE FROM knowledge_edges WHERE (source_id = :node_id OR target_id = :node_id) "
                 "AND workspace_id = :workspace_id"),
            {"node_id": node_id, "workspace_id": ws},
        )
        result = await db.execute(
            text("DELETE FROM knowledge_nodes WHERE id = :node_id "
                 "AND workspace_id = :workspace_id "
                 "AND (tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL) "
                 "RETURNING id"),
            scope,
        )
        return result.fetchone()

    async def create_edge(self, source_id: uuid.UUID, dto, db,
                          workspace_id: str | None = None, tenant_id: str | None = None):
        ws = self._require_write_scope(workspace_id)
        # APP-KG-01: BOTH endpoints must be owned under the same scope —
        # cross-workspace links are refused (no NULL-scope backdoor).
        source = await self.get_node(source_id, db, ws, tenant_id)
        if not source:
            return None

        target_uuid = uuid.UUID(dto.target_id) if isinstance(dto.target_id, str) else dto.target_id
        target = await self.get_node(target_uuid, db, ws, tenant_id)
        if not target:
            return None

        dup = await db.execute(
            text("""
                SELECT id FROM knowledge_edges
                WHERE source_id = :source_id AND target_id = :target_id AND relationship = :rel
                  AND workspace_id = :workspace_id
            """),
            {"source_id": source_id, "target_id": target_uuid, "rel": dto.relationship,
             "workspace_id": ws},
        )
        if dup.fetchone():
            return None

        edge_id = uuid.uuid4()
        weight = dto.weight if dto.weight is not None else 0.5
        properties = dto.properties or {}

        result = await db.execute(
            text("""
                INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, properties, workspace_id)
                VALUES (:id, :source_id, :target_id, :relationship, :weight, :properties, :workspace_id)
                RETURNING id, source_id, target_id, relationship, weight, properties, workspace_id, created_at
            """),
            {
                "id": edge_id,
                "source_id": source_id,
                "target_id": target_uuid,
                "relationship": dto.relationship,
                "weight": weight,
                "properties": properties,
                "workspace_id": ws,
            },
        )
        return self._fix_row(result.fetchone())

    async def list_edges(self, node_id: uuid.UUID, page: int, page_size: int, db,
                         workspace_id: str | None = None, tenant_id: str | None = None):
        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)
        # Anchor must be owned; neighbors constrained on BOTH sides.
        anchor = await self.get_node(node_id, db, workspace_id, tenant_id)
        if not anchor:
            return [], 0
        offset = (page - 1) * page_size
        params: dict[str, Any] = {
            "node_id": node_id, "workspace_id": workspace_id,
            "scope_tenant_id": tenant_id, "limit": page_size, "offset_val": offset,
        }
        scope_filter = """
            AND e.workspace_id = :workspace_id
            AND src.workspace_id = :workspace_id
            AND tgt.workspace_id = :workspace_id
            AND (src.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)
            AND (tgt.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)
        """
        count_result = await db.execute(
            text(f"""
                SELECT COUNT(*) FROM knowledge_edges e
                JOIN knowledge_nodes src ON src.id = e.source_id
                JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                WHERE (e.source_id = :node_id OR e.target_id = :node_id)
                {scope_filter}
            """),
            params,
        )
        total = count_result.scalar()

        enriched = await self._edge_rows_with_source_target(f"""
                SELECT e.id, e.source_id, e.target_id, e.relationship, e.weight,
                       e.properties, e.created_at,
                       src.id AS src_id, src.label AS src_label, src.type AS src_type,
                       tgt.id AS tgt_id, tgt.label AS tgt_label, tgt.type AS tgt_type
                FROM knowledge_edges e
                JOIN knowledge_nodes src ON src.id = e.source_id
                JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                WHERE (e.source_id = :node_id OR e.target_id = :node_id)
                {scope_filter}
                ORDER BY e.created_at DESC
                LIMIT :limit OFFSET :offset_val
            """,
            params,
            db,
        )
        return enriched, total

    async def list_all_edges(self, page: int, page_size: int, relationship: str | None, db, tenant_id: str | None = None, workspace_id: str | None = None):
        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)
        offset = (page - 1) * page_size
        params: dict[str, Any] = {
            "limit": page_size, "offset_val": offset,
            "scope_tenant_id": tenant_id, "workspace_id": workspace_id,
        }

        # APP-KG-01: BOTH endpoints constrained (source-only filtering leaked
        # edges pointing into foreign workspaces).
        conditions = [
            "e.workspace_id = :workspace_id",
            "src.workspace_id = :workspace_id",
            "tgt.workspace_id = :workspace_id",
            "(src.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)",
            "(tgt.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)",
        ]
        if relationship:
            conditions.append("e.relationship = :rel")
            params["rel"] = relationship

        where_clause = "WHERE " + " AND ".join(conditions)

        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM knowledge_edges e "
                 f"JOIN knowledge_nodes src ON src.id = e.source_id "
                 f"JOIN knowledge_nodes tgt ON tgt.id = e.target_id {where_clause}"),
            params,
        )
        total = count_result.scalar()

        enriched = await self._edge_rows_with_source_target(f"""
                SELECT e.id, e.source_id, e.target_id, e.relationship, e.weight,
                       e.properties, e.created_at,
                       src.id AS src_id, src.label AS src_label, src.type AS src_type,
                       tgt.id AS tgt_id, tgt.label AS tgt_label, tgt.type AS tgt_type
                FROM knowledge_edges e
                JOIN knowledge_nodes src ON src.id = e.source_id
                JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                {where_clause}
                ORDER BY e.created_at DESC
                LIMIT :limit OFFSET :offset_val
            """,
            params,
            db,
        )
        return enriched, total

    async def delete_edge(self, edge_id: uuid.UUID, db,
                          workspace_id: str | None = None, tenant_id: str | None = None):
        ws = self._require_write_scope(workspace_id)
        # APP-KG-01: scope-predicated single statement; tenant flows through
        # the source node (edges carry no tenant column).
        result = await db.execute(
            text("""
                DELETE FROM knowledge_edges
                WHERE id = :edge_id
                  AND workspace_id = :workspace_id
                  AND EXISTS (SELECT 1 FROM knowledge_nodes src
                              WHERE src.id = source_id
                                AND (src.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL))
                RETURNING id
            """),
            {"edge_id": edge_id, "workspace_id": ws, "scope_tenant_id": tenant_id},
        )
        return result.fetchone()

    async def traverse(self, start_id: uuid.UUID, depth: int, mode: str, db,
                       workspace_id: str | None = None, tenant_id: str | None = None):
        from collections import deque

        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)
        visited = {start_id}
        queue = deque([(start_id, 0)]) if mode == "bfs" else [(start_id, 0)]

        result = []

        while queue:
            if mode == "bfs":
                current_id, lvl = queue.popleft()
            else:
                current_id, lvl = queue.pop()

            row = await self.get_node(current_id, db, workspace_id, tenant_id)
            if row:
                result.append(row)

            if lvl < depth:
                # APP-KG-01: hops expand only into in-scope targets (the old
                # unscoped expansion walked into foreign workspaces).
                edge_result = await db.execute(
                    text("""
                        SELECT e.target_id FROM knowledge_edges e
                        JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                        WHERE e.source_id = :id
                          AND e.workspace_id = :workspace_id
                          AND tgt.workspace_id = :workspace_id
                          AND (tgt.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)
                    """),
                    {"id": current_id, "workspace_id": workspace_id,
                     "scope_tenant_id": tenant_id},
                )
                for edge_row in edge_result.fetchall():
                    neighbor_id = uuid.UUID(edge_row[0]) if isinstance(edge_row[0], str) else edge_row[0]
                    if neighbor_id not in visited:
                        visited.add(neighbor_id)
                        if mode == "bfs":
                            queue.append((neighbor_id, lvl + 1))
                        else:
                            queue.append((neighbor_id, lvl + 1))

        return result

    async def find_shortest_path(self, from_id: uuid.UUID, to_id: uuid.UUID, max_depth: int, db,
                                 workspace_id: str | None = None, tenant_id: str | None = None):
        from collections import deque

        tenant_id, workspace_id = self._read_scope(tenant_id, workspace_id)

        if from_id == to_id:
            node = await self.get_node(from_id, db, workspace_id, tenant_id)
            return [node] if node else [], 0

        # Both endpoints must be owned before searching (no foreign-target
        # discovery, no truncated phantom paths).
        if not await self.get_node(from_id, db, workspace_id, tenant_id):
            return None, None
        if not await self.get_node(to_id, db, workspace_id, tenant_id):
            return None, None

        visited = {from_id}
        parent = {from_id: None}
        queue = deque([(from_id, 0)])
        found_depth = None

        while queue:
            current_id, lvl = queue.popleft()

            if current_id == to_id:
                found_depth = lvl
                break

            if lvl < max_depth:
                edge_result = await db.execute(
                    text("""
                        SELECT e.target_id FROM knowledge_edges e
                        JOIN knowledge_nodes tgt ON tgt.id = e.target_id
                        WHERE e.source_id = :id
                          AND e.workspace_id = :workspace_id
                          AND tgt.workspace_id = :workspace_id
                          AND (tgt.tenant_id = :scope_tenant_id OR :scope_tenant_id IS NULL)
                    """),
                    {"id": current_id, "workspace_id": workspace_id,
                     "scope_tenant_id": tenant_id},
                )
                for edge_row in edge_result.fetchall():
                    neighbor_id = uuid.UUID(edge_row[0]) if isinstance(edge_row[0], str) else edge_row[0]
                    if neighbor_id not in visited:
                        visited.add(neighbor_id)
                        parent[neighbor_id] = current_id
                        queue.append((neighbor_id, lvl + 1))

        if found_depth is None:
            return None, None

        path_ids = []
        current = to_id
        while current is not None:
            path_ids.append(current)
            current = parent[current]
        path_ids.reverse()

        nodes = []
        for pid in path_ids:
            node = await self.get_node(pid, db, workspace_id, tenant_id)
            if node:
                nodes.append(node)

        return nodes, found_depth


kg_service = KnowledgeGraphService()
