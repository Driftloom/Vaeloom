import json
import uuid
from datetime import UTC, datetime, timedelta

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
        date_from = date_from or (datetime.now(UTC).isoformat()[:10])
        date_to = date_to or (datetime.now(UTC).isoformat()[:10])

        start = datetime.strptime(date_from[:10], "%Y-%m-%d")
        end = datetime.strptime(date_to[:10], "%Y-%m-%d")

        buckets = []
        current = start
        one_day = timedelta(days=1)
        while current <= end:
            buckets.append(current.strftime("%Y-%m-%d"))
            current += one_day

        result = await db.execute(
            text("""
                SELECT DATE(recorded_at) AS date,
                       COALESCE(SUM(memories_created), 0) AS memories_created,
                       COALESCE(SUM(agents_run), 0) AS agents_run,
                       COALESCE(SUM(tokens_used), 0) AS tokens_used
                FROM usage_records
                WHERE tenant_id = :tenant_id
                  AND DATE(recorded_at) >= :date_from
                  AND DATE(recorded_at) <= :date_to
                GROUP BY DATE(recorded_at)
                ORDER BY DATE(recorded_at)
            """),
            {"tenant_id": tenant_id, "date_from": date_from[:10], "date_to": date_to[:10]},
        )
        rows = result.fetchall()
        data_by_date = {str(r[0]): r for r in rows}

        return [
            UsageTimePoint(
                date=bucket,
                memories_created=data_by_date[bucket][1] if bucket in data_by_date else 0,
                agents_run=data_by_date[bucket][2] if bucket in data_by_date else 0,
                tokens_used=data_by_date[bucket][3] if bucket in data_by_date else 0,
            )
            for bucket in buckets
        ]

    async def get_metrics(self, tenant_id: str, db=None) -> KpiSummary:
        count_memories = await db.execute(
            text("SELECT COUNT(*) FROM memories WHERE tenant_id = :tenant_id"),  # nosec B608
            {"tenant_id": tenant_id},
        )
        count_agents = await db.execute(
            text("SELECT COUNT(*) FROM agents WHERE tenant_id = :tenant_id"),  # nosec B608
            {"tenant_id": tenant_id},
        )
        count_active_users = await db.execute(
            text("SELECT COUNT(DISTINCT user_id) FROM agent_executions WHERE tenant_id = :tenant_id"),  # nosec B608
            {"tenant_id": tenant_id},
        )
        avg_response_time = await db.execute(
            text("SELECT COALESCE(AVG(response_time_ms), 0) FROM agent_executions WHERE tenant_id = :tenant_id"),  # nosec B608
            {"tenant_id": tenant_id},
        )

        return KpiSummary(
            total_memories=count_memories.scalar_one() or 0,
            total_agents=count_agents.scalar_one() or 0,
            active_users=count_active_users.scalar_one() or 0,
            avg_response_time_ms=float(avg_response_time.scalar_one() or 0),
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
        now = datetime.now(UTC)
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
        target_date = date or datetime.now(UTC).strftime("%Y-%m-%d")
        if tenant_id:
            memories_r = await db.execute(
                text("SELECT COUNT(*) FROM memories WHERE tenant_id = :tenant_id AND DATE(created_at) = :date"),  # nosec B608
                {"tenant_id": tenant_id, "date": target_date},
            )
            agents_r = await db.execute(
                text("SELECT COUNT(*) FROM agents WHERE tenant_id = :tenant_id AND DATE(created_at) = :date"),  # nosec B608
                {"tenant_id": tenant_id, "date": target_date},
            )
            tokens_r = await db.execute(
                text("""
                    SELECT COALESCE(SUM(tokens_used), 0) FROM agent_executions
                    WHERE tenant_id = :tenant_id AND DATE(created_at) = :date
                """),
                {"tenant_id": tenant_id, "date": target_date},
            )
            memories = memories_r.scalar_one() or 0
            agents = agents_r.scalar_one() or 0
            tokens = tokens_r.scalar_one() or 0

            for metric, value in [("memories_created", memories), ("agents_run", agents), ("tokens_used", tokens)]:
                await db.execute(
                    text("""
                        INSERT INTO usage_records (id, tenant_id, metric, value)
                        VALUES (:id, :tenant_id, :metric, :value)
                    """),  # nosec B608
                    {
                        "id": str(uuid.uuid4()),
                        "tenant_id": tenant_id,
                        "metric": metric,
                        "value": value,
                    },
                )
        else:
            await db.execute(
                text("""
                    INSERT INTO usage_records (id, tenant_id, metric, value)
                    SELECT :id, tenant_id, 'memories_created', COUNT(*)
                    FROM memories GROUP BY tenant_id
                """),  # nosec B608
                {"id": str(uuid.uuid4()), "metric": target_date},
            )


analytics_service = AnalyticsService()