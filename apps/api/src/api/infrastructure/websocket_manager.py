"""WebSocket Connection Manager and Multi-Channel Real-Time Pub/Sub Hub.

Supports:
1. Workspace-scoped broadcasts (all active members in a workspace).
2. User-targeted events (direct approvals, private notifications).
3. Agent session streams (real-time thought stream and tool execution).
4. Dual-mode scaling: In-memory asyncio broadcaster + optional Redis Pub/Sub for multi-replica clusters.
5. Presence tracking and message sequencing.
"""

import asyncio
from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Dict, List, Optional, Set
import uuid

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketConnection:
    def __init__(
        self,
        websocket: WebSocket,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ):
        self.websocket = websocket
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.workspace_id = workspace_id
        self.subscriptions: Set[str] = {
            f"workspace:{workspace_id}",
            f"user:{user_id}",
            "broadcast",
        }
        self.connected_at = datetime.now(timezone.utc)
        self.last_ping = datetime.now(timezone.utc)

    async def send_json(self, data: Dict[str, Any]) -> None:
        try:
            await self.websocket.send_text(json.dumps(data, default=str))
        except Exception as exc:
            logger.debug("Failed to send WebSocket frame to user %s: %s", self.user_id, exc)
            raise


class WebSocketConnectionManager:
    def __init__(self):
        self._connections: Dict[uuid.UUID, List[WebSocketConnection]] = {}  # user_id -> [connections]
        self._channel_map: Dict[str, Set[WebSocketConnection]] = {}  # channel -> set(connections)
        self._presence: Dict[uuid.UUID, Dict[str, Any]] = {}  # user_id -> {status, last_active}
        self._lock = asyncio.Lock()
        self._redis_client = None
        self._redis_pubsub = None
        self._redis_task: Optional[asyncio.Task] = None

    async def init_redis(self, redis_url: Optional[str] = None) -> bool:
        """Initialize Redis Pub/Sub for multi-replica horizontal scaling."""
        url = redis_url or os.environ.get("REDIS__URL") or os.environ.get("REDIS_URL")
        if not url:
            logger.debug("Redis URL not provided; running WebSocket manager in local in-memory mode")
            return False

        try:
            import redis.asyncio as aioredis

            self._redis_client = aioredis.from_url(url, decode_responses=True)
            self._redis_pubsub = self._redis_client.pubsub()
            await self._redis_pubsub.psubscribe("vaeloom:channel:*")
            self._redis_task = asyncio.create_task(self._redis_listener())
            logger.info("WebSocket Redis Pub/Sub initialized on %s", url.split("@")[-1])
            return True
        except Exception as exc:
            logger.warning("Failed to connect to Redis for WebSocket Pub/Sub: %s (falling back to in-memory)", exc)
            self._redis_client = None
            self._redis_pubsub = None
            return False

    async def _redis_listener(self) -> None:
        """Background task listening for cross-replica events from Redis."""
        try:
            async for message in self._redis_pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"].replace("vaeloom:channel:", "")
                    try:
                        data = json.loads(message["data"])
                        await self._deliver_local(channel, data)
                    except Exception as err:
                        logger.debug("Error processing Redis Pub/Sub frame: %s", err)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.warning("Redis Pub/Sub listener disconnected: %s", exc)

    async def connect(
        self,
        websocket: WebSocket,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> WebSocketConnection:
        await websocket.accept()
        conn = WebSocketConnection(websocket, user_id, tenant_id, workspace_id)

        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = []
            self._connections[user_id].append(conn)

            for channel in conn.subscriptions:
                if channel not in self._channel_map:
                    self._channel_map[channel] = set()
                self._channel_map[channel].add(conn)

            self._presence[user_id] = {
                "status": "online",
                "last_active": datetime.now(timezone.utc).isoformat(),
            }

        logger.info(
            "WebSocket connected: user=%s workspace=%s (active total: %d)",
            user_id,
            workspace_id,
            self.total_connections,
        )
        return conn

    async def disconnect(self, conn: WebSocketConnection) -> None:
        async with self._lock:
            if conn.user_id in self._connections:
                self._connections[conn.user_id] = [
                    c for c in self._connections[conn.user_id] if c != conn
                ]
                if not self._connections[conn.user_id]:
                    del self._connections[conn.user_id]
                    if conn.user_id in self._presence:
                        self._presence[conn.user_id]["status"] = "offline"

            for channel in conn.subscriptions:
                if channel in self._channel_map:
                    self._channel_map[channel].discard(conn)
                    if not self._channel_map[channel]:
                        del self._channel_map[channel]

        logger.info(
            "WebSocket disconnected: user=%s workspace=%s (active total: %d)",
            conn.user_id,
            conn.workspace_id,
            self.total_connections,
        )

    def subscribe(self, conn: WebSocketConnection, channel: str) -> None:
        conn.subscriptions.add(channel)
        if channel not in self._channel_map:
            self._channel_map[channel] = set()
        self._channel_map[channel].add(conn)

    def unsubscribe(self, conn: WebSocketConnection, channel: str) -> None:
        conn.subscriptions.discard(channel)
        if channel in self._channel_map:
            self._channel_map[channel].discard(conn)

    def update_presence(self, user_id: uuid.UUID, status: str) -> None:
        if user_id in self._presence:
            self._presence[user_id]["status"] = status
            self._presence[user_id]["last_active"] = datetime.now(timezone.utc).isoformat()

    def get_presence(self, user_id: uuid.UUID) -> Dict[str, Any]:
        return self._presence.get(
            user_id,
            {"status": "offline", "last_active": None},
        )

    async def _deliver_local(self, channel: str, message: Dict[str, Any]) -> int:
        """Deliver a message to all locally connected WebSockets for a channel."""
        recipients: List[WebSocketConnection] = []
        async with self._lock:
            if channel in self._channel_map:
                recipients = list(self._channel_map[channel])

        delivered = 0
        dead_conns = []
        for conn in recipients:
            try:
                await conn.send_json(message)
                delivered += 1
            except Exception:
                dead_conns.append(conn)

        for dead in dead_conns:
            await self.disconnect(dead)

        return delivered

    async def broadcast_to_channel(
        self,
        channel: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> int:
        """Broadcast a message to all subscribers across all replicas."""
        message = {
            "seq_id": str(uuid.uuid4()),
            "type": event_type,
            "event": event_type,
            "channel": channel,
            "data": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # If Redis is connected, publish to Redis so peer replicas broadcast
        if self._redis_client:
            try:
                await self._redis_client.publish(
                    f"vaeloom:channel:{channel}",
                    json.dumps(message, default=str),
                )
            except Exception as exc:
                logger.debug("Failed to publish to Redis pubsub: %s", exc)

        # Deliver to local subscribers
        return await self._deliver_local(channel, message)

    async def broadcast_to_workspace(
        self,
        workspace_id: uuid.UUID | str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> int:
        return await self.broadcast_to_channel(f"workspace:{workspace_id}", event_type, payload)

    async def send_to_user(
        self,
        user_id: uuid.UUID | str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> int:
        return await self.broadcast_to_channel(f"user:{user_id}", event_type, payload)

    async def close(self) -> None:
        """Gracefully close Redis connections on shutdown."""
        if self._redis_task:
            self._redis_task.cancel()
        if self._redis_pubsub:
            await self._redis_pubsub.close()
        if self._redis_client:
            await self._redis_client.close()

    @property
    def total_connections(self) -> int:
        return sum(len(conns) for conns in self._connections.values())

    @property
    def active_channels(self) -> List[str]:
        return list(self._channel_map.keys())


# Global singleton manager
ws_manager = WebSocketConnectionManager()
