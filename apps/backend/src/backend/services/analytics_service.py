import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from ..schemas.analytics import KpiSummary, UsageTimePoint


class AnalyticsService:
    async def get_usage(
        self,
        tenant_id: str,
        date_from: str | None,
        date_to: str | None,
        interval: str,
        db=None,
    ) -> list[UsageTimePoint]:
        params: dict = {}
        date_from = date_from or (datetime.now(timezone.utc).isoformat()[:10])
        date_to = date_to or (datetime.now(timezone.utc).isoformat()[:10])

        sql = """
            WITH date_series AS (
                SELECT generate_series(
                    :date_from::date,
                    :date_to::date,
                    :interval::interval
                ) AS bucket
            )
            SELECT
                to_char(ds.bucket, 'YYYY-MM-DD') AS date,
                COALESCE(SUM(ur.memories_created), 0) AS memories_created,
                COALESCE(SUM(ur.agents_run), 0) AS agents_run,
                COALESCE(SUM(ur.tokens_used), 0) AS tokens_used
            FROM date_series ds
            LEFT JOIN usage_records ur
                ON DATE_TRUNC(:trunc, ur.recorded_at) = ds.bucket
                AND ur.tenant_id = :tenant_id
            GROUP BY ds.bucket
            ORDER BY ds.bucket
        """

        trunc_map = {"day": "day", "hour": "hour", "week": "week", "month": "month"}
        trunc = trunc_map.get(interval, "day")

        params["date_from"] = date_from
        params["date_to"] = date_to
        params["interval"] = f"1 {interval}" if interval in ("day", "month") else "1 day"
        params["trunc"] = trunc
        params["tenant_id"] = tenant_id

        result = await db.execute(text(sql), params)
        rows = result.fetchall()

        return [UsageTimePoint(date=str(r[0]), memories_created=r[1], agents_run=r[2], tokens_used=r[3]) for r in rows]

    async def get_metrics(self, tenant_id: str, db=None) -> KpiSummary:
        import asyncio

        async def count_memories():
            r = await db.execute(
                text("SELECT COUNT(*) FROM memories WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id},
            )
            return r.scalar_one() or 0

        async def count_agents():
            r = await db.execute(
                text("SELECT COUNT(*) FROM agents WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id},
            )
            return r.scalar_one() or 0

        async def count_active_users():
            r = await db.execute(
                text("SELECT COUNT(DISTINCT user_id) FROM agent_executions WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id},
            )
            return r.scalar_one() or 0

        async def avg_response_time():
            r = await db.execute(
                text("SELECT COALESCE(AVG(response_time_ms), 0) FROM agent_executions WHERE tenant_id = :tenant_id"),
                {"tenant_id": tenant_id},
            )
            return float(r.scalar_one() or 0)

        total_memories, total_agents, active_users, avg_response_time_ms = await asyncio.gather(
            count_memories(), count_agents(), count_active_users(), avg_response_time(),
        )

        return KpiSummary(
            total_memories=total_memories,
            total_agents=total_agents,
            active_users=active_users,
            avg_response_time_ms=avg_response_time_ms,
        )

    async def track_event(
        self,
        name: str,
        properties: dict | None,
        tenant_id: str | None,
        user_id: str | None,
        db=None,
    ):
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO analytics_events (id, name, properties, tenant_id, user_id, created_at)
                VALUES (:id, :name, :properties, :tenant_id, :user_id, :created_at)
            """),
            {
                "id": event_id,
                "name": name,
                "properties": json.dumps(properties) if properties else None,
                "tenant_id": tenant_id,
                "user_id": user_id,
                "created_at": now,
            },
        )
        return event_id

    async def aggregate(self, date: str | None, tenant_id: str | None, db=None):
        target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if tenant_id:
            memories_r = await db.execute(
                text("SELECT COUNT(*) FROM memories WHERE tenant_id = :tenant_id AND DATE(created_at) = :date"),
                {"tenant_id": tenant_id, "date": target_date},
            )
            agents_r = await db.execute(
                text("SELECT COUNT(*) FROM agents WHERE tenant_id = :tenant_id AND DATE(created_at) = :date"),
                {"tenant_id": tenant_id, "date": target_date},
            )
            tokens_r = await db.execute(
                text("""
                    SELECT COALESCE(SUM(total_tokens), 0) FROM agent_executions
                    WHERE tenant_id = :tenant_id AND DATE(created_at) = :date
                """),
                {"tenant_id": tenant_id, "date": target_date},
            )
            memories = memories_r.scalar_one() or 0
            agents = agents_r.scalar_one() or 0
            tokens = tokens_r.scalar_one() or 0

            await db.execute(
                text("""
                    INSERT INTO usage_records (id, tenant_id, recorded_at, memories_created, agents_run, tokens_used)
                    VALUES (:id, :tenant_id, :recorded_at, :memories, :agents, :tokens)
                    ON CONFLICT (tenant_id, recorded_at) DO UPDATE SET
                        memories_created = EXCLUDED.memories_created,
                        agents_run = EXCLUDED.agents_run,
                        tokens_used = EXCLUDED.tokens_used
                """),
                {
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "recorded_at": target_date,
                    "memories": memories,
                    "agents": agents,
                    "tokens": tokens,
                },
            )
        else:
            await db.execute(
                text("""
                    INSERT INTO usage_records (id, tenant_id, recorded_at, memories_created, agents_run, tokens_used)
                    SELECT :id, tenant_id, :recorded_at,
                           COUNT(*) FILTER (WHERE DATE(created_at) = :recorded_at),
                           0, 0
                    FROM memories GROUP BY tenant_id
                """),
                {"id": str(uuid.uuid4()), "recorded_at": target_date},
            )


analytics_service = AnalyticsService()
