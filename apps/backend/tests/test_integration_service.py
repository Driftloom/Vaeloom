import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class TestIntegrationService:
    @pytest.fixture
    def service(self):
        from backend.services.integration_service import IntegrationService
        return IntegrationService()

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        db.execute = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        return db

    async def test_create_success(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.name = "Test Integration"
        dto.provider = "gmail"
        dto.config = {"key": "val"}

        result = await service.create(dto, str(uuid.uuid4()), mock_db)
        assert result.name == "Test Integration"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_create_duplicate_raises_409(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.provider = "gmail"

        with pytest.raises(HTTPException) as exc:
            await service.create(dto, str(uuid.uuid4()), mock_db)
        assert exc.value.status_code == 409
        assert "already exists" in exc.value.detail

    async def test_list_for_user(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [MagicMock(), MagicMock()]
        mock_db.execute.return_value = mock_result

        result = await service.list_for_user(str(uuid.uuid4()), mock_db)
        assert len(result) == 2

    async def test_update_success(self, service, mock_db):
        integration = MagicMock()
        integration.name = "Old Name"
        integration.config = {}
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = integration
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.name = "New Name"
        dto.config = {"new": "config"}

        result = await service.update(str(uuid.uuid4()), dto, str(uuid.uuid4()), mock_db)
        assert result.name == "New Name"
        assert result.config == {"new": "config"}
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_update_not_found_raises_404(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.name = None
        dto.config = None

        with pytest.raises(HTTPException) as exc:
            await service.update(str(uuid.uuid4()), dto, str(uuid.uuid4()), mock_db)
        assert exc.value.status_code == 404

    async def test_delete_success(self, service, mock_db):
        integration = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = integration
        mock_db.execute.return_value = mock_result

        result = await service.delete(str(uuid.uuid4()), str(uuid.uuid4()), mock_db)
        assert result is True
        mock_db.delete.assert_called_once()
        mock_db.commit.assert_called_once()

    async def test_delete_not_found_raises_404(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await service.delete(str(uuid.uuid4()), str(uuid.uuid4()), mock_db)
        assert exc.value.status_code == 404

    async def test_sync_not_found_raises_404(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await service.sync(str(uuid.uuid4()), str(uuid.uuid4()), mock_db)
        assert exc.value.status_code == 404

    async def test_sync_updates_last_sync_at_and_status(self, service, mock_db):
        integration = MagicMock()
        integration.last_sync_at = None
        integration.status = "disconnected"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = integration
        mock_db.execute.return_value = mock_result

        result = await service.sync(str(uuid.uuid4()), str(uuid.uuid4()), mock_db)
        assert result == {"synced": True, "message": "Sync initiated"}
        assert integration.status == "syncing"
        assert integration.last_sync_at is not None
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()
