import contextlib
import json
import uuid
from datetime import UTC, datetime
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
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    row[key] = json.loads(val)
        return row

    async def create_job(self, dto, tenant_id: str | None, db: AsyncSession = None):
        # T-008 + T-001: payload size and secret validation
        try:
            from ..temporal.validation import validate_no_secrets, validate_payload_size
            if dto.payload is not None:
                validate_no_secrets(dto.payload)
                validate_payload_size(dto.payload, label="schedule payload")
            if dto.headers is not None:
                validate_no_secrets(dto.headers)
                validate_payload_size(dto.headers, label="schedule headers")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        job_id = uuid.uuid4()
        now = datetime.now(UTC)
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
            text("SELECT * FROM scheduled_jobs WHERE id = :id"),  # nosec B608
            {"id": job_id},
        )
        row = SchedulerService._fix_json_fields(result.mappings().first())
        # Shadow Temporal schedule (fail-open — DB remains source of truth)
        try:
            from ..temporal.schedules import create_or_update_schedule

            import asyncio as _aio

            _aio.create_task(create_or_update_schedule(str(job_id), dto.cron, tenant_id, payload=dto.payload))
        except Exception:
            pass
        return row

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
            text(f"SELECT * FROM scheduled_jobs WHERE {where_clause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"),  # nosec B608
            params,
        )
        return [SchedulerService._fix_json_fields(r) for r in result.mappings().all()]

    async def get_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        result = await db.execute(
            text("SELECT * FROM scheduled_jobs WHERE id = :id"),  # nosec B608
            {"id": job_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(404, "Job not found")
        return SchedulerService._fix_json_fields(row)

    async def update_job(self, job_id: uuid.UUID, dto, db: AsyncSession = None):
        # T-008 + T-001: validate payload size and secrets
        try:
            from ..temporal.validation import validate_no_secrets, validate_payload_size

            if dto.payload is not None:
                validate_no_secrets(dto.payload)
                validate_payload_size(dto.payload, label="schedule payload")
            if dto.headers is not None:
                validate_no_secrets(dto.headers)
                validate_payload_size(dto.headers, label="schedule headers")
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
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
        params["updated_at"] = datetime.now(UTC)

        await db.execute(
            text(f"UPDATE scheduled_jobs SET {', '.join(sets)} WHERE id = :id"),  # nosec B608
            params,
        )
        await db.commit()
        row = await self.get_job(job_id, db)
        # Shadow update to Temporal if cron/payload changed
        try:
            if dto.cron is not None or dto.payload is not None:
                from ..temporal.schedules import create_or_update_schedule

                import asyncio as _aio

                cron = dto.cron or row.get("cron")  # type: ignore[assignment]
                _aio.create_task(create_or_update_schedule(str(job_id), cron, row.get("tenant_id"), payload=dto.payload if dto.payload is not None else row.get("payload")))
        except Exception:
            pass
        return row

    async def pause_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        row_before = await self.get_job(job_id, db)
        now = datetime.now(UTC)
        await db.execute(
            text("UPDATE scheduled_jobs SET status = :status, updated_at = :updated_at WHERE id = :id"),  # nosec B608
            {"status": "paused", "updated_at": now, "id": job_id},
        )
        await db.commit()
        try:
            from ..temporal.schedules import pause_schedule

            import asyncio as _aio

            _aio.create_task(pause_schedule(str(job_id), row_before.get("tenant_id")))
        except Exception:
            pass
        return await self.get_job(job_id, db)

    async def resume_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        row_before = await self.get_job(job_id, db)
        now = datetime.now(UTC)
        await db.execute(
            text("UPDATE scheduled_jobs SET status = :status, updated_at = :updated_at WHERE id = :id"),  # nosec B608
            {"status": "active", "updated_at": now, "id": job_id},
        )
        await db.commit()
        try:
            from ..temporal.schedules import resume_schedule

            import asyncio as _aio

            _aio.create_task(resume_schedule(str(job_id), row_before.get("tenant_id")))
        except Exception:
            pass
        return await self.get_job(job_id, db)

    async def trigger_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        now = datetime.now(UTC)
        await db.execute(
            text("UPDATE scheduled_jobs SET last_run_at = :now, updated_at = :updated_at WHERE id = :id"),  # nosec B608
            {"now": now, "updated_at": now, "id": job_id},
        )
        await db.commit()
        return {"triggered": True, "job_id": str(job_id), "triggered_at": now.isoformat()}

    async def delete_job(self, job_id: uuid.UUID, db: AsyncSession = None):
        row_before = await self.get_job(job_id, db)
        await db.execute(
            text("DELETE FROM scheduled_jobs WHERE id = :id"),  # nosec B608
            {"id": job_id},
        )
        await db.commit()
        try:
            from ..temporal.schedules import delete_schedule

            import asyncio as _aio

            _aio.create_task(delete_schedule(str(job_id), row_before.get("tenant_id")))
        except Exception:
            pass
        return True

    async def list_executions(self, job_id: uuid.UUID, db: AsyncSession = None):
        await self.get_job(job_id, db)
        result = await db.execute(
            text("SELECT * FROM job_executions WHERE job_id = :job_id ORDER BY created_at DESC LIMIT 50"),  # nosec B608
            {"job_id": job_id},
        )
        return result.mappings().all()


scheduler_service = SchedulerService()