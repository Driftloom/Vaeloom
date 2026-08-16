import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import async_session_factory

logger = logging.getLogger(__name__)


class RetentionPolicy(BaseModel):
    tenant_id: str | None = None
    max_age_days: int
    action: Literal["archive", "delete"]
    resource_type: str


def load_retention_policies() -> list[RetentionPolicy]:
    raw = getattr(settings, "retention_policies", None)
    if not raw:
        return []
    if isinstance(raw, str):
        raw = json.loads(raw)
    return [RetentionPolicy(**p) for p in raw]


async def apply_retention(policy: RetentionPolicy, db: AsyncSession) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=policy.max_age_days)
    params = {"cutoff": cutoff.isoformat()}
    tenant_clause = ""
    if policy.tenant_id:
        tenant_clause = " AND tenant_id = :tenant_id"
        params["tenant_id"] = policy.tenant_id

    resource_map = {
        "events": "events",
        "audit_events": "audit_events",
        "usage_records": "usage_records",
        "agent_executions": "agent_executions",
        "sessions": "auth_sessions",
    }

    table = resource_map.get(policy.resource_type)
    if not table:
        raise ValueError(f"Unknown resource_type: {policy.resource_type}")

    if policy.action == "delete":
        result = await db.execute(
            text(f"DELETE FROM {table} WHERE created_at < :cutoff{tenant_clause}"),
            params,
        )
        count = result.rowcount
        logger.info("Retention deleted %d records from %s (age > %dd)", count, table, policy.max_age_days)
        return {"action": "delete", "table": table, "records_affected": count}

    if policy.action == "archive":
        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE created_at < :cutoff{tenant_clause}"),
            params,
        )
        count = count_result.scalar_one() or 0

        await db.execute(
            text(f"""
                INSERT INTO {table}_archive
                SELECT * FROM {table}
                WHERE created_at < :cutoff{tenant_clause}
            """),
            params,
        )
        await db.execute(
            text(f"DELETE FROM {table} WHERE created_at < :cutoff{tenant_clause}"),
            params,
        )
        logger.info("Retention archived %d records from %s (age > %dd)", count, table, policy.max_age_days)
        return {"action": "archive", "table": table, "records_affected": count}

    return {"action": policy.action, "table": table, "records_affected": 0}


class RetentionScheduler:
    def __init__(self, interval_hours: int = 24):
        self.interval_hours = interval_hours
        self._task: asyncio.Task | None = None

    async def run_once(self) -> list[dict]:
        policies = load_retention_policies()
        if not policies:
            logger.info("No retention policies configured")
            return []

        results = []
        async with async_session_factory() as db:
            for policy in policies:
                try:
                    result = await apply_retention(policy, db)
                    results.append(result)
                except Exception as e:
                    logger.error("Retention policy failed for %s: %s", policy.resource_type, e)
                    results.append({"action": policy.action, "table": policy.resource_type, "error": str(e)})
            await db.commit()
        return results

    async def start(self):
        logger.info("RetentionScheduler started (interval=%dh)", self.interval_hours)

        async def _loop():
            while True:
                try:
                    await self.run_once()
                except Exception as e:
                    logger.error("RetentionScheduler run error: %s", e)
                await asyncio.sleep(self.interval_hours * 3600)

        self._task = asyncio.create_task(_loop())

    async def stop(self):
        if self._task:
            self._task.cancel()
            self._task = None
            logger.info("RetentionScheduler stopped")


retention_scheduler = RetentionScheduler()
