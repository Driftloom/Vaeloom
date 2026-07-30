import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class _MockRow:
    def __init__(self, **kwargs):
        self._mapping = kwargs


class TestNotificationService:
    @pytest.fixture
    def service(self):
        from backend.services.notification_service import NotificationService
        return NotificationService()

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        db.execute = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = AsyncMock()
        return db

    async def test_send_with_template_resolution_and_interpolation(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = _MockRow(subject="Hello {{name}}", body="Welcome {{name}}!")
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.template = "welcome"
        dto.channel.value = "email"
        dto.subject = None
        dto.body = None
        dto.data = {"name": "Alice"}
        dto.recipient = "alice@test.com"

        with patch.object(service, "notify_subscribers", AsyncMock()):
            result = await service.send(dto, mock_db)

        assert result.status == "sent"
        assert result.message == "Welcome Alice!"
        assert result.subject == "Hello Alice"

    async def test_send_without_template_direct_body(self, service, mock_db):
        dto = MagicMock()
        dto.template = None
        dto.channel.value = "slack"
        dto.subject = "Direct Subject"
        dto.body = "Direct body message"
        dto.data = None
        dto.recipient = "#general"

        with patch.object(service, "notify_subscribers", AsyncMock()):
            result = await service.send(dto, mock_db)

        assert result.status == "sent"
        assert result.message == "Direct body message"

    async def test_send_no_body_raises_400(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.template = "missing"
        dto.channel.value = "email"
        dto.subject = None
        dto.body = None
        dto.data = None

        with pytest.raises(HTTPException) as exc:
            await service.send(dto, mock_db)
        assert exc.value.status_code == 400

    async def test_send_exception_during_delivery_sets_failed(self, service, mock_db):
        dto = MagicMock()
        dto.template = None
        dto.channel.value = "push"
        dto.subject = "Test"
        dto.body = "Body"
        dto.data = None
        dto.recipient = "device-token"

        with patch.object(service, "notify_subscribers", AsyncMock()):
            result = await service.send(dto, mock_db)
        assert result.status == "sent"

    async def test_notify_subscribers_db_error_caught(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=RuntimeError("db error"))
        notification = MagicMock()
        await service.notify_subscribers(notification, mock_db)

    async def test_list_notifications_with_channel_filter(self, service, mock_db):
        mock_total = MagicMock()
        mock_total.all.return_value = [1, 2, 3]
        mock_rows = MagicMock()
        mock_rows.scalars.return_value.all.return_value = [MagicMock(), MagicMock()]
        mock_db.execute = AsyncMock(side_effect=[mock_total, mock_rows])

        rows, total = await service.list_notifications(1, 10, "email", mock_db)
        assert total == 3
        assert len(rows) == 2

    async def test_list_notifications_without_channel_filter(self, service, mock_db):
        mock_total = MagicMock()
        mock_total.all.return_value = [1]
        mock_rows = MagicMock()
        mock_rows.scalars.return_value.all.return_value = [MagicMock()]
        mock_db.execute = AsyncMock(side_effect=[mock_total, mock_rows])

        rows, total = await service.list_notifications(1, 10, None, mock_db)
        assert total == 1
        assert len(rows) == 1

    async def test_get_notification_by_uuid(self, service, mock_db):
        nid = uuid.uuid4()
        notification = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = notification
        mock_db.execute.return_value = mock_result

        result = await service.get_notification(nid, mock_db)
        assert result is notification

    async def test_get_notification_by_string(self, service, mock_db):
        nid = str(uuid.uuid4())
        notification = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = notification
        mock_db.execute.return_value = mock_result

        result = await service.get_notification(nid, mock_db)
        assert result is notification

    async def test_create_template(self, service, mock_db):
        dto = MagicMock()
        dto.name = "welcome"
        dto.subject = "Hello"
        dto.body = "Welcome {{name}}!"
        dto.channel.value = "email"

        result = await service.create_template(dto, mock_db)
        assert result["name"] == "welcome"
        assert result["body"] == "Welcome {{name}}!"
        mock_db.execute.assert_called_once()
        mock_db.flush.assert_called_once()

    async def test_list_templates(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            _MockRow(id="1", name="t1", subject="S1", body="B1", channel="email", created_at=datetime.now(timezone.utc)),
        ]
        mock_db.execute.return_value = mock_result

        result = await service.list_templates(mock_db)
        assert len(result) == 1
        assert result[0]["name"] == "t1"

    async def test_resolve_template_found(self, service, mock_db):
        row = _MockRow(id="1", name="welcome", subject="Hi", body="Welcome!", channel="email", created_at=datetime.now(timezone.utc))
        mock_result = MagicMock()
        mock_result.fetchone.return_value = row
        mock_db.execute.return_value = mock_result

        result = await service.resolve_template("welcome", "email", mock_db)
        assert result["name"] == "welcome"
        assert result["body"] == "Welcome!"

    async def test_resolve_template_not_found(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute.return_value = mock_result

        result = await service.resolve_template("nonexistent", "email", mock_db)
        assert result is None

    def test_interpolate_template_replaces_keys(self, service):
        result = service.interpolate_template("Hello {{name}}, your {{item}} is ready", {"name": "Alice", "item": "report"})
        assert result == "Hello Alice, your report is ready"

    def test_interpolate_template_keeps_unknown_keys(self, service):
        result = service.interpolate_template("Hello {{name}}", {"other": "val"})
        assert result == "Hello {{name}}"

    async def test_subscribe(self, service, mock_db):
        dto = MagicMock()
        dto.url = "https://example.com/hook"
        dto.tenant_id = "tenant-1"

        result = await service.subscribe(dto, mock_db)
        assert result["url"] == "https://example.com/hook"
        assert result["tenant_id"] == "tenant-1"
        mock_db.execute.assert_called_once()
        mock_db.flush.assert_called_once()

    async def test_notify_subscribers_posts_to_urls(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("https://hook1.com",), ("https://hook2.com",)]
        mock_db.execute.return_value = mock_result

        notification = MagicMock()
        notification.id = uuid.uuid4()
        notification.channel = "email"
        notification.recipient = "a@b.com"
        notification.subject = "Sub"
        notification.message = "Body"
        notification.status = "sent"

        with patch("backend.services.notification_service.httpx.AsyncClient") as mock_httpx:
            mock_client = MagicMock()
            mock_httpx.return_value = mock_client
            mock_client.__aenter__.return_value = mock_client
            mock_client.post = MagicMock()
            await service.notify_subscribers(notification, mock_db)

        assert mock_client.post.call_count == 2

    async def test_notify_subscribers_handles_errors(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("https://fail.com",)]
        mock_db.execute.return_value = mock_result

        notification = MagicMock()

        with patch("backend.services.notification_service.httpx.AsyncClient") as mock_httpx:
            mock_client = MagicMock()
            mock_httpx.return_value = mock_client
            mock_client.__aenter__.return_value = mock_client
            mock_client.post = MagicMock(side_effect=Exception("fail"))
            await service.notify_subscribers(notification, mock_db)

    async def test_webhook_receipt_updates_status(self, service, mock_db):
        notification = MagicMock()
        notification.status = "pending"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = notification
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.status = "delivered"

        result = await service.webhook_receipt(uuid.uuid4(), dto, mock_db)
        assert result.status == "delivered"
        mock_db.flush.assert_called_once()
        mock_db.refresh.assert_called_once()

    async def test_webhook_receipt_not_found_raises_404(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        dto = MagicMock()
        dto.status = "delivered"

        with pytest.raises(HTTPException) as exc:
            await service.webhook_receipt(uuid.uuid4(), dto, mock_db)
        assert exc.value.status_code == 404

    async def test_update_status_returns_true(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await service.update_status(str(uuid.uuid4()), "sent", mock_db)
        assert result is True
        mock_db.flush.assert_called_once()

    async def test_update_status_returns_false(self, service, mock_db):
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await service.update_status(str(uuid.uuid4()), "sent", mock_db)
        assert result is False
