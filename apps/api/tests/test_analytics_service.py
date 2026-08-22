import pytest
from unittest.mock import MagicMock, AsyncMock

pytestmark = pytest.mark.asyncio


class TestAnalyticsService:
    @pytest.fixture
    def service(self):
        from api.services.analytics_service import analytics_service
        return analytics_service

    def _mock_db(self, fetchall_return=None, scalar_one_return=None):
        db = AsyncMock()
        execute = AsyncMock()
        r = MagicMock()
        if fetchall_return is not None:
            r.fetchall.return_value = fetchall_return
        if scalar_one_return is not None:
            r.scalar_one.return_value = scalar_one_return
        execute.return_value = r
        db.execute = execute
        return db

    async def test_get_usage_empty(self, service):
        db = self._mock_db(fetchall_return=[])
        result = await service.get_usage(tenant_id="t1", date_from="2025-01-01", date_to="2025-01-03", interval="day", db=db)
        assert len(result) == 3
        assert result[0].memories_created == 0
        assert result[0].agents_run == 0
        assert result[0].tokens_used == 0

    async def test_get_usage_with_data(self, service):
        db = self._mock_db(fetchall_return=[("2025-01-01", 5, 3, 1000)])
        result = await service.get_usage(tenant_id="t1", date_from="2025-01-01", date_to="2025-01-01", interval="day", db=db)
        assert len(result) == 1
        assert result[0].memories_created == 5
        assert result[0].agents_run == 3
        assert result[0].tokens_used == 1000

    async def test_get_usage_default_dates(self, service):
        db = self._mock_db(fetchall_return=[])
        result = await service.get_usage(tenant_id="t1", date_from=None, date_to=None, interval="day", db=db)
        assert len(result) == 1

    async def test_get_metrics(self, service):
        db = self._mock_db(scalar_one_return=0)
        result = await service.get_metrics(tenant_id="t1", db=db)
        assert result.total_memories == 0
        assert result.total_agents == 0
        assert result.active_users == 0
        assert result.avg_response_time_ms == 0.0

    async def test_track_event(self, service):
        db = AsyncMock()
        db.execute = AsyncMock()
        event_id = await service.track_event(name="test_event", properties={"key": "val"}, tenant_id="t1", user_id="u1", db=db)
        assert event_id is not None
        db.execute.assert_called_once()

    async def test_track_event_no_properties(self, service):
        db = AsyncMock()
        db.execute = AsyncMock()
        event_id = await service.track_event(name="test", properties=None, tenant_id="t1", user_id="u1", db=db)
        assert event_id is not None

    async def test_aggregate_with_tenant(self, service):
        db = AsyncMock()
        exec_results = []
        r = MagicMock()
        r.scalar_one.return_value = 5
        exec_results.append(r)
        r2 = MagicMock()
        r2.scalar_one.return_value = 3
        exec_results.append(r2)
        r3 = MagicMock()
        r3.scalar_one.return_value = 1000
        exec_results.append(r3)
        for _ in range(3):
            r4 = MagicMock()
            exec_results.append(r4)
        db.execute = AsyncMock(side_effect=exec_results)
        await service.aggregate(date="2025-01-01", tenant_id="t1", db=db)
        assert db.execute.call_count == 6

    async def test_aggregate_without_tenant(self, service):
        db = AsyncMock()
        db.execute = AsyncMock()
        await service.aggregate(date="2025-01-01", tenant_id=None, db=db)
        db.execute.assert_called_once()
