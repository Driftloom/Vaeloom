import uuid
from datetime import datetime, timezone, timedelta
import jwt
import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient
from api.config import settings
from api.infrastructure.websocket_manager import (
    WebSocketConnection,
    WebSocketConnectionManager,
    ws_manager,
)


class MockWebSocket:
    """Mock WebSocket for unit testing WebSocketConnectionManager."""

    def __init__(self):
        self.sent_messages = []
        self.closed = False
        self.close_code = None

    async def accept(self):
        pass

    async def send_text(self, text: str):
        import json
        self.sent_messages.append(json.loads(text))

    async def close(self, code=1000):
        self.closed = True
        self.close_code = code


@pytest.mark.asyncio
class TestRealtimeWebSocketManager:
    """Test the in-memory WebSocket manager pub/sub and lifecycle."""

    async def test_manager_connection_and_channels(self):
        manager = WebSocketConnectionManager()
        mock_ws_1 = MockWebSocket()
        mock_ws_2 = MockWebSocket()

        uid_1 = uuid.uuid4()
        uid_2 = uuid.uuid4()
        tid = uuid.uuid4()
        wid = uuid.uuid4()

        # Connect both
        conn_1 = await manager.connect(
            websocket=mock_ws_1,  # type: ignore[arg-type]
            user_id=uid_1,
            tenant_id=tid,
            workspace_id=wid,
        )
        conn_2 = await manager.connect(
            websocket=mock_ws_2,  # type: ignore[arg-type]
            user_id=uid_2,
            tenant_id=tid,
            workspace_id=wid,
        )
        assert manager.total_connections == 2

        # Subscribe conn_1 to channel 'project-alpha'
        manager.subscribe(conn_1, "project-alpha")
        assert "project-alpha" in conn_1.subscriptions

        # Broadcast to channel 'project-alpha'
        payload = {"text": "hello team"}
        delivered = await manager.broadcast_to_channel("project-alpha", "CHANNEL_MESSAGE", payload)
        assert delivered == 1

        # conn_1 received, conn_2 did not
        assert len(mock_ws_1.sent_messages) == 1
        assert mock_ws_1.sent_messages[0]["data"]["text"] == "hello team"
        assert len(mock_ws_2.sent_messages) == 0

        # Broadcast to workspace
        await manager.broadcast_to_workspace(wid, "WORKSPACE_ALERT", {"alert": "update"})
        assert len(mock_ws_1.sent_messages) == 2
        assert len(mock_ws_2.sent_messages) == 1

        # Send direct to usr-2
        await manager.send_to_user(uid_2, "PRIVATE_NOTE", {"note": "private"})
        assert len(mock_ws_2.sent_messages) == 2
        assert mock_ws_2.sent_messages[1]["data"]["note"] == "private"

        # Disconnect conn_1
        await manager.disconnect(conn_1)
        assert manager.total_connections == 1
        assert "project-alpha" not in manager._channel_map

        # Disconnect conn_2
        await manager.disconnect(conn_2)
        assert manager.total_connections == 0


@pytest.mark.asyncio
class TestRealtimeRouter:
    """Test REST and WebSocket endpoints of realtime router."""

    async def test_realtime_status_endpoint(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.get("/api/v1/realtime/status", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "total_connections" in data
        assert "active_channels" in data

    async def test_realtime_broadcast_endpoint(
        self, client: AsyncClient, auth_headers: dict
    ):
        res = await client.post(
            "/api/v1/realtime/broadcast",
            json={
                "event": "DOCUMENT_UPDATED",
                "channel": "docs",
                "data": {"doc_id": "d-123"},
            },
            headers=auth_headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert data["channel"] == "docs"


class TestRealtimeWebSocketLifecycle:
    """Test Starlette WebSocket lifecycle."""

    def test_websocket_connection_unauthenticated(self, db_session):
        from tests.conftest import _build_test_app

        test_app = _build_test_app(db_session)
        client = TestClient(test_app)

        with pytest.raises(Exception):
            with client.websocket_connect("/api/v1/realtime/ws?token=invalid-token") as ws:
                pass

    def test_websocket_lifecycle_with_token(self, db_session):
        from tests.conftest import _build_test_app

        test_app = _build_test_app(db_session)
        client = TestClient(test_app)

        now = datetime.now(timezone.utc)
        payload = {
            "jti": str(uuid.uuid4()),
            "sub": str(uuid.uuid4()),
            "email": "test-ws@vaeloom.test",
            "tenant_id": str(uuid.uuid4()),
            "iat": now,
            "exp": now + timedelta(hours=1),
        }
        token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

        with client.websocket_connect(f"/api/v1/realtime/ws?token={token}") as ws:
            # First message received is CONNECTED event
            welcome = ws.receive_json()
            assert welcome["event"] == "CONNECTED"

            # 1. PING -> PONG
            ws.send_json({"type": "PING"})
            resp = ws.receive_json()
            assert resp["type"] == "PONG"

            # 2. SUBSCRIBE
            ws.send_json({"type": "SUBSCRIBE", "channel": "chat-room-1"})
            resp = ws.receive_json()
            assert resp["type"] == "SUBSCRIBED"
            assert resp["channel"] == "chat-room-1"

            # 3. TYPING
            ws.send_json({"type": "TYPING", "channel": "chat-room-1", "is_typing": True})
            resp = ws.receive_json()
            assert resp["type"] == "TYPING"
            assert resp["data"]["is_typing"] is True

            # 4. PRESENCE
            ws.send_json({"type": "PRESENCE", "status": "busy"})
            resp = ws.receive_json()
            assert resp["type"] == "PRESENCE"
            assert resp["data"]["status"] == "busy"

            # 5. UNSUBSCRIBE
            ws.send_json({"type": "UNSUBSCRIBE", "channel": "chat-room-1"})
            resp = ws.receive_json()
            assert resp["type"] == "UNSUBSCRIBED"
            assert resp["channel"] == "chat-room-1"
