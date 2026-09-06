"""StateStore interface and implementations for durable LoopState checkpointing.

Provides pluggable persistence backends:
- FileStateStore: Local disk JSON files (dev, offline CI, local test fallback)
- DatabaseStateStore: Relational persistence via SQLAlchemy async sessions
- RedisStateStore: In-memory distributed persistence with TTL for multi-replica deployments
- CompositeStateStore: Multi-tier persistence (primary + fallback)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_STATE_DIR = Path(os.environ.get("VAELOOM_STATE_DIR", str(Path.home() / ".vaeloom" / "state")))


class StateStore(ABC):
    """Abstract protocol for agent loop state persistence."""

    @abstractmethod
    async def load(self, request_id: str) -> dict[str, Any] | None:
        """Load state dictionary by request_id, or None if not found."""
        raise NotImplementedError

    @abstractmethod
    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        """Persist state dictionary for request_id."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, request_id: str) -> None:
        """Remove state for request_id."""
        raise NotImplementedError


class FileStateStore(StateStore):
    """File-backed state store writing formatted JSON to disk."""

    def __init__(self, state_dir: Path | None = None):
        self._state_dir = state_dir

    @property
    def state_dir(self) -> Path:
        if self._state_dir is not None:
            return self._state_dir
        from .state import STATE_DIR
        return Path(os.environ.get("VAELOOM_STATE_DIR", str(STATE_DIR)))

    async def load(self, request_id: str) -> dict[str, Any] | None:
        dir_path = self.state_dir
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{request_id}.json"
        if not file_path.exists():
            return None
        try:
            raw = await asyncio.to_thread(file_path.read_text)
            return json.loads(raw)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning(f"FileStateStore failed to read {request_id}: {exc}")
            return None

    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        dir_path = self.state_dir
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{request_id}.json"
        payload = json.dumps(state_dict, indent=2, default=str)
        await asyncio.to_thread(file_path.write_text, payload)
        logger.debug(f"FileStateStore saved checkpoint for {request_id}")

    async def delete(self, request_id: str) -> None:
        file_path = self.state_dir / f"{request_id}.json"
        if file_path.exists():
            try:
                await asyncio.to_thread(file_path.unlink)
            except OSError as exc:
                logger.warning(f"FileStateStore failed to delete {request_id}: {exc}")


class DatabaseStateStore(StateStore):
    """PostgreSQL/relational database-backed state store for durable checkpoints."""

    def __init__(self, session_factory: Any = None):
        self._session_factory = session_factory

    def _get_factory(self):
        if self._session_factory is not None:
            return self._session_factory
        from ..database import async_session_factory
        return async_session_factory

    async def load(self, request_id: str) -> dict[str, Any] | None:
        factory = self._get_factory()
        try:
            from sqlalchemy import select
            from ..models.schema import LoopCheckpoint

            async with factory() as session:
                stmt = select(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
                res = await session.execute(stmt)
                row = res.scalar_one_or_none()
                if row and row.state_json is not None:
                    return row.state_json
        except Exception as exc:
            logger.warning(f"DatabaseStateStore load failed for {request_id}: {exc}")
        return None

    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        factory = self._get_factory()
        try:
            from sqlalchemy import select
            from ..models.schema import LoopCheckpoint

            async with factory() as session:
                stmt = select(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
                res = await session.execute(stmt)
                row = res.scalar_one_or_none()
                if row:
                    row.state_json = state_dict
                    if workspace_id:
                        row.workspace_id = str(workspace_id)
                else:
                    new_ckpt = LoopCheckpoint(
                        request_id=request_id,
                        workspace_id=str(workspace_id) if workspace_id else None,
                        state_json=state_dict,
                    )
                    session.add(new_ckpt)
                await session.commit()
                logger.debug(f"DatabaseStateStore saved checkpoint for {request_id}")
        except Exception as exc:
            logger.warning(f"DatabaseStateStore save failed for {request_id}: {exc}")
            raise

    async def delete(self, request_id: str) -> None:
        factory = self._get_factory()
        try:
            from sqlalchemy import delete
            from ..models.schema import LoopCheckpoint

            async with factory() as session:
                stmt = delete(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
                await session.execute(stmt)
                await session.commit()
                logger.debug(f"DatabaseStateStore deleted checkpoint for {request_id}")
        except Exception as exc:
            logger.warning(f"DatabaseStateStore delete failed for {request_id}: {exc}")
            raise


class MemoryStateStore(StateStore):
    """In-memory state store for isolated fast unit tests."""

    def __init__(self):
        self._data: dict[str, dict[str, Any]] = {}

    async def load(self, request_id: str) -> dict[str, Any] | None:
        data = self._data.get(request_id)
        return json.loads(json.dumps(data, default=str)) if data else None

    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        self._data[request_id] = json.loads(json.dumps(state_dict, default=str))

    async def delete(self, request_id: str) -> None:
        self._data.pop(request_id, None)


class RedisStateStore(StateStore):
    """Redis-backed distributed state store for multi-replica workers."""

    def __init__(self, redis_client: Any = None, ttl_seconds: int = 604800):
        self.redis = redis_client
        self.ttl = ttl_seconds

    def _key(self, request_id: str) -> str:
        return f"state:loop:{request_id}"

    async def _get_client(self):
        if self.redis is not None:
            return self.redis
        try:
            from api.services.redis import get_redis_client
            self.redis = await get_redis_client()
            return self.redis
        except Exception as exc:
            logger.debug(f"Redis client discovery unavailable: {exc}")
            return None

    async def load(self, request_id: str) -> dict[str, Any] | None:
        client = await self._get_client()
        if not client:
            return None
        try:
            raw = await client.get(self._key(request_id))
            if raw:
                return json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
        except Exception as exc:
            logger.warning(f"RedisStateStore failed to load {request_id}: {exc}")
        return None

    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        client = await self._get_client()
        if not client:
            return
        try:
            payload = json.dumps(state_dict, default=str)
            await client.set(self._key(request_id), payload, ex=self.ttl)
        except Exception as exc:
            logger.warning(f"RedisStateStore failed to save {request_id}: {exc}")

    async def delete(self, request_id: str) -> None:
        client = await self._get_client()
        if not client:
            return
        try:
            await client.delete(self._key(request_id))
        except Exception as exc:
            logger.warning(f"RedisStateStore failed to delete {request_id}: {exc}")


class CompositeStateStore(StateStore):
    """Tiered state store: writes to both primary and fallback; loads from primary then fallback."""

    def __init__(self, primary: StateStore, fallback: StateStore):
        self.primary = primary
        self.fallback = fallback

    async def load(self, request_id: str) -> dict[str, Any] | None:
        data = await self.primary.load(request_id)
        if data is not None:
            return data
        return await self.fallback.load(request_id)

    async def save(self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None) -> None:
        await self.primary.save(request_id, state_dict, workspace_id)
        await self.fallback.save(request_id, state_dict, workspace_id)

    async def delete(self, request_id: str) -> None:
        await self.primary.delete(request_id)
        await self.fallback.delete(request_id)


_default_store: StateStore | None = None


def get_state_store() -> StateStore:
    """Resolve active state store singleton."""
    global _default_store
    if _default_store is not None:
        return _default_store

    backend = os.environ.get("VAELOOM_STATE_BACKEND", "file").lower()
    if backend == "memory":
        _default_store = MemoryStateStore()
    elif backend in ("db", "database", "postgres", "postgresql"):
        _default_store = CompositeStateStore(primary=DatabaseStateStore(), fallback=FileStateStore())
    elif backend == "redis":
        _default_store = CompositeStateStore(primary=RedisStateStore(), fallback=FileStateStore())
    else:
        _default_store = FileStateStore()
    return _default_store


def set_state_store(store: StateStore | None) -> None:
    """Override active state store (used in tests or DI)."""
    global _default_store
    _default_store = store
