"""WebSocket Real-Time Router.

Endpoints:
- WS   /api/v1/realtime/ws: Full-duplex WebSocket connection for workspace events.
- POST /api/v1/realtime/broadcast: Broadcast events from internal workers or agent loops.
- GET  /api/v1/realtime/status: Connection metrics and active channels.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
import jwt
from pydantic import BaseModel, Field

from ..config import settings
from ..infrastructure.websocket_manager import WebSocketConnection, ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])


class BroadcastRequest(BaseModel):
    channel: str = Field(..., description="Target channel (e.g. workspace:{id}, user:{id}, broadcast)")
    event: str = Field(..., description="Event name (e.g. AGENT_STEP, NOTIFICATION)")
    data: Dict[str, Any] = Field(default_factory=dict, description="Event payload")


def _authenticate_token(token: str) -> Dict[str, Any]:
    """Validate JWT token and return payload."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        return payload
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {exc}",
        )


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
):
    """Full-duplex WebSocket connection for real-time workspace updates."""
    # 1. Handshake authentication
    payload = None
    if token:
        try:
            payload = _authenticate_token(token)
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # If not provided in query param, wait for initial AUTH message
    if not payload:
        await websocket.accept()
        try:
            init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
            data = json.loads(init_msg)
            if data.get("type") == "AUTH" and data.get("token"):
                payload = _authenticate_token(data["token"])
                if data.get("workspace_id"):
                    workspace_id = data.get("workspace_id")
            else:
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    else:
        # Accepted in ws_manager.connect below
        pass

    # 2. Extract identity
    user_id_str = payload.get("sub") or payload.get("user_id")
    tenant_id_str = payload.get("tenant_id") or str(uuid.uuid4())
    ws_id_str = workspace_id or payload.get("workspace_id") or str(uuid.uuid4())

    try:
        user_uuid = uuid.UUID(str(user_id_str))
        tenant_uuid = uuid.UUID(str(tenant_id_str))
        ws_uuid = uuid.UUID(str(ws_id_str))
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # If token was in query param, accept connection inside connect()
    if token:
        conn = await ws_manager.connect(websocket, user_uuid, tenant_uuid, ws_uuid)
    else:
        # Already accepted above, create connection directly
        conn = WebSocketConnection(websocket, user_uuid, tenant_uuid, ws_uuid)
        async with ws_manager._lock:
            if user_uuid not in ws_manager._connections:
                ws_manager._connections[user_uuid] = []
            ws_manager._connections[user_uuid].append(conn)
            for ch in conn.subscriptions:
                if ch not in ws_manager._channel_map:
                    ws_manager._channel_map[ch] = set()
                ws_manager._channel_map[ch].add(conn)

    # Send initial connection acknowledgment
    await conn.send_json({
        "event": "CONNECTED",
        "user_id": str(user_uuid),
        "workspace_id": str(ws_uuid),
        "subscriptions": list(conn.subscriptions),
    })

    # 3. Message loop
    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "").upper()

            if msg_type == "PING":
                await conn.send_json({"type": "PONG", "event": "PONG", "timestamp": msg.get("timestamp")})
            elif msg_type == "SUBSCRIBE":
                channel = msg.get("channel")
                if channel:
                    ws_manager.subscribe(conn, channel)
                    await conn.send_json({"type": "SUBSCRIBED", "event": "SUBSCRIBED", "channel": channel})
            elif msg_type == "UNSUBSCRIBE":
                channel = msg.get("channel")
                if channel:
                    ws_manager.unsubscribe(conn, channel)
                    await conn.send_json({"type": "UNSUBSCRIBED", "event": "UNSUBSCRIBED", "channel": channel})
            elif msg_type in ("TYPING", "PRESENCE"):
                # Echo to workspace channel
                await ws_manager.broadcast_to_workspace(
                    ws_uuid,
                    msg_type,
                    {
                        "user_id": str(user_uuid),
                        "is_typing": msg.get("is_typing"),
                        "status": msg.get("status"),
                        "data": msg.get("data", {}),
                    },
                )
    except WebSocketDisconnect:
        await ws_manager.disconnect(conn)
    except Exception as exc:
        logger.debug("WebSocket exception for user %s: %s", user_uuid, exc)
        await ws_manager.disconnect(conn)


@router.post("/broadcast")
async def broadcast_event(req: BroadcastRequest):
    """Internal endpoint to broadcast an event to a channel."""
    delivered = await ws_manager.broadcast_to_channel(req.channel, req.event, req.data)
    return {"status": "ok", "delivered": delivered, "channel": req.channel}


@router.get("/status")
async def realtime_status():
    """Returns active connection count and channels."""
    return {
        "status": "online",
        "total_connections": ws_manager.total_connections,
        "active_channels": ws_manager.active_channels,
    }
