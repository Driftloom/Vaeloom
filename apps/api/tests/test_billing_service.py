import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class TestBillingService:
    @pytest.fixture
    def service(self):
        from api.services.billing_service import billing_service
        return billing_service

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        db.execute = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        return db

    def _make_scalar_result(self, value):
        m = MagicMock()
        m.scalar_one_or_none.return_value = value
        return m

    def _make_scalars_result(self, values):
        m = MagicMock()
        m.scalars.return_value.all.return_value = values
        return m

    async def test_get_usage_no_filters(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalars_result([])
        result = await service.get_usage(user_id=str(uid), db=mock_db)
        assert result == []

    async def test_get_usage_with_metric(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalars_result([])
        result = await service.get_usage(user_id=str(uid), metric="api_calls", db=mock_db)
        assert result == []

    async def test_get_usage_with_dates(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalars_result([])
        result = await service.get_usage(user_id=str(uid), from_date="2025-01-01", to_date="2025-01-31", db=mock_db)
        assert result == []

    async def test_get_subscription_found(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalar_result(MagicMock())
        result = await service.get_subscription(user_id=str(uid), db=mock_db)
        assert result is not None

    async def test_get_subscription_not_found(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalar_result(None)
        result = await service.get_subscription(user_id=str(uid), db=mock_db)
        assert result is None

    async def test_create_subscription_success(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalar_result(None)
        sub = await service.create_subscription(user_id=str(uid), plan="pro", db=mock_db)
        assert sub.plan == "pro"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_create_subscription_duplicate_raises(self, service, mock_db):
        uid = uuid.uuid4()
        mock_db.execute.return_value = self._make_scalar_result(MagicMock())
        with pytest.raises(HTTPException) as exc:
            await service.create_subscription(user_id=str(uid), plan="pro", db=mock_db)
        assert exc.value.status_code == 409
