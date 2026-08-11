import csv
import io
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text


class AuditService:
    async def record_event(
        self,
        actor_id: str,
        action: str,
        resource: str,
        resource_id: str | None,
        tenant_id: str | None,
        metadata: dict | None,
        db=None,
    ):
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO audit_events (id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at)
                VALUES (:id, :actor_id, :action, :resource, :resource_id, :tenant_id, :metadata, :created_at)
            """),
            {
                "id": event_id,
                "actor_id": actor_id,
                "action": action,
                "resource": resource,
                "resource_id": resource_id,
                "tenant_id": tenant_id,
                "metadata": json.dumps(metadata) if metadata else None,
                "created_at": now,
            },
        )
        return event_id

    async def query_events(
        self,
        page: int,
        page_size: int,
        filters: dict,
        db=None,
    ) -> tuple[list[dict], int]:
        conditions = []
        params: dict = {}

        if filters.get("actor_id"):
            conditions.append("actor_id = :actor_id")
            params["actor_id"] = filters["actor_id"]
        if filters.get("action"):
            conditions.append("action = :action")
            params["action"] = filters["action"]
        if filters.get("resource"):
            conditions.append("resource = :resource")
            params["resource"] = filters["resource"]
        if filters.get("tenant_id"):
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = filters["tenant_id"]
        if filters.get("date_from"):
            conditions.append("created_at >= :date_from")
            params["date_from"] = filters["date_from"]
        if filters.get("date_to"):
            conditions.append("created_at <= :date_to")
            params["date_to"] = filters["date_to"]

        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        offset = (page - 1) * page_size

        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM audit_events WHERE {where_clause}"),
            params,
        )
        total = count_result.scalar_one() or 0

        rows_result = await db.execute(
            text(f"""
                SELECT id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at
                FROM audit_events
                WHERE {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": page_size, "offset": offset},
        )
        rows = rows_result.fetchall()

        result = []
        for r in rows:
            meta_raw = r[6]
            if isinstance(meta_raw, str):
                try:
                    meta_raw = json.loads(meta_raw)
                except (json.JSONDecodeError, TypeError):
                    meta_raw = {}
            result.append({
                "id": r[0],
                "actor_id": r[1],
                "action": r[2],
                "resource": r[3],
                "resource_id": r[4],
                "tenant_id": r[5],
                "metadata": meta_raw or {},
                "created_at": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
            })

        return result, total

    async def get_event(self, event_id: str, db=None) -> dict | None:
        result = await db.execute(
            text("""
                SELECT id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at
                FROM audit_events WHERE id = :id
            """),
            {"id": event_id},
        )
        r = result.fetchone()
        if not r:
            return None

        meta_raw = r[6]
        if isinstance(meta_raw, str):
            try:
                meta_raw = json.loads(meta_raw)
            except (json.JSONDecodeError, TypeError):
                meta_raw = {}
        return {
            "id": r[0],
            "actor_id": r[1],
            "action": r[2],
            "resource": r[3],
            "resource_id": r[4],
            "tenant_id": r[5],
            "metadata": meta_raw or {},
            "created_at": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
        }

    async def export_events(
        self,
        date_from: str | None,
        date_to: str | None,
        format: str,
        tenant_id: str | None,
        db=None,
    ) -> str:
        params: dict = {}
        conditions = []
        if tenant_id:
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id
        if date_from:
            conditions.append("created_at >= :date_from")
            params["date_from"] = date_from
        if date_to:
            conditions.append("created_at <= :date_to")
            params["date_to"] = date_to

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        result = await db.execute(
            text(f"""
                SELECT id, actor_id, action, resource, resource_id, tenant_id, metadata, created_at
                FROM audit_events
                WHERE {where_clause}
                ORDER BY created_at DESC
            """),
            params,
        )
        rows = result.fetchall()

        data = []
        for r in rows:
            meta_raw = r[6]
            if isinstance(meta_raw, str):
                try:
                    meta_raw = json.loads(meta_raw)
                except (json.JSONDecodeError, TypeError):
                    meta_raw = {}
            data.append({
                "id": r[0],
                "actor_id": r[1],
                "action": r[2],
                "resource": r[3],
                "resource_id": r[4],
                "tenant_id": r[5],
                "metadata": meta_raw or {},
                "created_at": r[7].isoformat() if hasattr(r[7], "isoformat") else str(r[7]),
            })

        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            if data:
                writer.writerow(data[0].keys())
                for row in data:
                    writer.writerow(str(v) for v in row.values())
            return output.getvalue()

        return json.dumps(data, default=str)

    async def compliance_report(
        self,
        tenant_id: str | None,
        date_from: str | None,
        date_to: str | None,
        db=None,
    ) -> dict:
        params: dict = {}
        conditions = []
        if tenant_id:
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id
        if date_from:
            conditions.append("created_at >= :date_from")
            params["date_from"] = date_from
        if date_to:
            conditions.append("created_at <= :date_to")
            params["date_to"] = date_to

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        action_result = await db.execute(
            text(f"""
                SELECT action, COUNT(*) AS cnt
                FROM audit_events
                WHERE {where_clause}
                GROUP BY action
                ORDER BY cnt DESC
            """),
            params,
        )
        action_counts = [{"action": row[0], "count": row[1]} for row in action_result.fetchall()]

        resource_result = await db.execute(
            text(f"""
                SELECT resource, COUNT(*) AS cnt
                FROM audit_events
                WHERE {where_clause}
                GROUP BY resource
                ORDER BY cnt DESC
            """),
            params,
        )
        resource_counts = [{"resource": row[0], "count": row[1]} for row in resource_result.fetchall()]

        total_result = await db.execute(
            text(f"SELECT COUNT(*) FROM audit_events WHERE {where_clause}"),
            params,
        )
        total = total_result.scalar_one() or 0

        return {
            "by_action": action_counts,
            "by_resource": resource_counts,
            "total": total,
            "generated_at": datetime.now(timezone.utc),
        }


audit_service = AuditService()
