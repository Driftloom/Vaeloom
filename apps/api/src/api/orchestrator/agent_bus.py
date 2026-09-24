"""Enterprise Distributed Agent Event Bus.

Supports:
- Local in-memory asynchronous message distribution
- Distributed Redis Pub/Sub integration for horizontal multi-agent scaling
- Request-Response RPC pattern for synchronous agent-to-agent delegation
- Topic-based subscriptions (agent-specific, run-specific, and broadcast channels)
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Awaitable, Callable

from .contracts.agent_message import AgentMessage, AgentResponseEnvelope, TaskStatus

logger = logging.getLogger(__name__)


class AgentEventBus:
    """Enterprise asynchronous event bus for agent-to-agent communication."""

    def __init__(self):
        self._subscribers: dict[str, list[Callable[[AgentMessage], Awaitable[None]]]] = defaultdict(list)
        self._pending_responses: dict[str, asyncio.Future[AgentResponseEnvelope]] = {}
        self._redis_client: Any = None
        self._is_redis_active = False

    async def initialize_redis(self, redis_url: str | None = None) -> None:
        """Initialize Redis connection for cross-node multi-agent pub/sub."""
        if not redis_url:
            return
        try:
            import redis.asyncio as aioredis
            self._redis_client = aioredis.from_url(redis_url, decode_responses=True)
            await self._redis_client.ping()
            self._is_redis_active = True
            logger.info("AgentEventBus connected to Redis Pub/Sub at %s", redis_url)
        except Exception as exc:
            logger.warning("Redis Pub/Sub initialization skipped (in-memory mode active): %s", exc)
            self._is_redis_active = False

    def subscribe(
        self,
        topic: str,
        handler: Callable[[AgentMessage], Awaitable[None]],
    ) -> None:
        """Subscribe an asynchronous handler to a topic."""
        if handler not in self._subscribers[topic]:
            self._subscribers[topic].append(handler)
            logger.debug("Subscribed handler to topic %s", topic)

    def unsubscribe(
        self,
        topic: str,
        handler: Callable[[AgentMessage], Awaitable[None]],
    ) -> None:
        """Unsubscribe a handler from a topic."""
        if topic in self._subscribers and handler in self._subscribers[topic]:
            self._subscribers[topic].remove(handler)

    async def publish(self, message: AgentMessage) -> None:
        """Publish an AgentMessage to in-memory topics and distributed bus."""
        # Check if this message resolves a pending RPC request
        if message.correlation_id in self._pending_responses and not self._pending_responses[message.correlation_id].done():
            # If payload represents response envelope
            envelope = AgentResponseEnvelope(
                message_id=message.message_id,
                correlation_id=message.correlation_id,
                source_agent=message.sender_agent,
                recipient_agent=message.recipient_agent,
                parent_run_id=message.parent_run_id,
                status=TaskStatus.SUCCESS,
                data=message.payload,
            )
            self._pending_responses[message.correlation_id].set_result(envelope)

        # Notify in-memory topic subscribers
        topics = [
            f"agent:{message.recipient_agent}",
            "broadcast",
        ]
        if message.parent_run_id:
            topics.append(f"run:{message.parent_run_id}")

        for topic in topics:
            handlers = list(self._subscribers.get(topic, []))
            for handler in handlers:
                try:
                    asyncio.create_task(handler(message))
                except Exception as exc:
                    logger.error("Handler error on topic %s: %s", topic, exc)

        # Distributed Redis publish
        if self._is_redis_active and self._redis_client:
            try:
                raw_data = message.model_dump_json()
                for topic in topics:
                    await self._redis_client.publish(topic, raw_data)
            except Exception as exc:
                logger.warning("Redis publish failed: %s", exc)

    async def send_response(self, response: AgentResponseEnvelope) -> None:
        """Deliver response envelope directly to caller awaiting correlation_id."""
        cid = response.correlation_id
        if cid in self._pending_responses and not self._pending_responses[cid].done():
            self._pending_responses[cid].set_result(response)

    async def request_response(
        self,
        message: AgentMessage,
        timeout: float | None = None,
    ) -> AgentResponseEnvelope:
        """Send a message to an agent and await the response envelope asynchronously."""
        timeout_sec = timeout or message.timeout_seconds
        future: asyncio.Future[AgentResponseEnvelope] = asyncio.get_running_loop().create_future()
        self._pending_responses[message.correlation_id] = future

        try:
            await self.publish(message)
            return await asyncio.wait_for(future, timeout=timeout_sec)
        except asyncio.TimeoutError:
            logger.warning(
                "Request timeout after %.1fs for message %s (target agent: %s)",
                timeout_sec,
                message.message_id,
                message.recipient_agent,
            )
            return AgentResponseEnvelope(
                correlation_id=message.correlation_id,
                source_agent=message.recipient_agent,
                status=TaskStatus.TIMEOUT,
                error_message=f"Agent '{message.recipient_agent}' timed out after {timeout_sec}s",
            )
        finally:
            self._pending_responses.pop(message.correlation_id, None)


# Singleton
agent_bus = AgentEventBus()
