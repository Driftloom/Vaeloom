import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class SchedulerService:
    @staticmethod
    def _fix_json_fields(row):
        if row is None:
            return None
        row = dict(row)
        for key in ('payload', 'headers'):
            val = row.get(key)
            if isinstance(val, str):
                try:
                    row[key] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
        return row

    async def create_job(self, dto, tenant_id: str | None, db: AsyncSession = None):
        job_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO scheduled_jobs (id, name, type, cron, method, url, event, payload, headers, status, tenant_id, created_at, updated_at)
                VALUES (:id, :name, :type, :cron, :method, :url, :event, :payload, :headers, :status, :tenant_id, :created_at, :updated_at)
            """),
            {
                "id": job_id,
                "name": dto.name,
                "type": dto.type.value,
                "cron": dto.cron,
                "method": dto.method,
                "url": dto.url,
                "event": dto.event,
                "payload": dto.payload or {},
                "headers": dto.headers or {},
                "status": "active",
                "tenant_id": tenant_id,
                "created_at": now,
                "updated_at": now,
            },
        )
        await db.commit()
        result = await db.execute(
            text("SELECT * FROM scheduled_jobs WHERE id = :id"),
            {"id": job_id},
        )
        return SchedulerService._fix_json_fields(result.mappings().first())

    async def list_jobs(
        self,
        page: int,
        page_size: int,
        type_filter: str | None,
        status_filter: str | None,
        name_search: str | None,
        tenant_id: str | None,
        db: AsyncSession = None,
    ):
        conditions = []
        params: dict[str, Any] = {}
        if type_filter:
            conditions.append("type = :type")
            params["type"] = type_filter
        if status_filter:
            conditions.append("status = :status")
            params["status"] = status_filter
        if name_search:
            conditions.append("name ILIKE :name")
            params["name"] = f"%{name_search}%"
        if tenant_id:
            conditions.append("tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id

        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        offset = (page - 1) * page_size
        params["limit"] = page_size
        params["offset"] = offset

        result = await db.execute(
            text(f"SELECT * FROM scheduled_jobs WHERE {where_clause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),
            params,
        )
        return [SchedulerService._fix_json_fields(r) for r in result.mappings().all()]

    async def get_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        result = await db.execute(
            text("SELECT * FROM scheduled_jobs WHERE id = :id"),
            {"id": job_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(404, "Job not found")
        return SchedulerService._fix_json_fields(row)

    async def update_job(self, job_id: uuid.UUID, dto, db: AsyncSession = None):
        await self.get_job(job_id, db)
        sets = []
        params: dict[str, Any] = {"id": job_id}
        for field in ("name", "cron", "method", "url", "event"):
            val = getattr(dto, field, None)
            if val is not None:
                sets.append(f"{field} = :{field}")
                params[field] = val
        if dto.payload is not None:
            sets.append("payload = :payload")
            params["payload"] = dto.payload
        if dto.headers is not None:
            sets.append("headers = :headers")
            params["headers"] = dto.headers

        if not sets:
            raise HTTPException(400, "No fields to update")

        sets.append("updated_at = :updated_at")
        params["updated_at"] = datetime.now(timezone.utc)

        await db.execute(
            text(f"UPDATE scheduled_jobs SET {', '.join(sets)} WHERE id = :id"),
            params,
        )
        await db.commit()
        return await self.get_job(job_id, db)

    async def pause_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        now = datetime.now(timezone.utc)
        await db.execute(
            text("UPDATE scheduled_jobs SET status = :status, updated_at = :updated_at WHERE id = :id"),
            {"status": "paused", "updated_at": now, "id": job_id},
        )
        await db.commit()
        return await self.get_job(job_id, db)

    async def resume_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        now = datetime.now(timezone.utc)
        await db.execute(
            text("UPDATE scheduled_jobs SET status = :status, updated_at = :updated_at WHERE id = :id"),
            {"status": "active", "updated_at": now, "id": job_id},
        )
        await db.commit()
        return await self.get_job(job_id, db)

    async def trigger_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        now = datetime.now(timezone.utc)
        await db.execute(
            text("UPDATE scheduled_jobs SET last_run_at = :now, updated_at = :updated_at WHERE id = :id"),
            {"now": now, "updated_at": now, "id": job_id},
        )
        await db.commit()
        return {"triggered": True, "job_id": str(job_id), "triggered_at": now.isoformat()}

    async def delete_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        await db.execute(
            text("DELETE FROM scheduled_jobs WHERE id = :id"),
            {"id": job_id},
        )
        await db.commit()
        return True

    async def list_executions(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        result = await db.execute(
            text("SELECT * FROM job_executions WHERE job_id = :job_id ORDER BY created_at DESC LIMIT 50"),
            {"job_id": job_id},
        )
        return result.mappings().all()


scheduler_service = SchedulerService()
