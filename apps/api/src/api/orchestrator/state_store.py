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
    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
        """Load state dictionary by request_id, or None if not found.

        workspace_id is advisory scope for RLS-bound backends (ignored by
        file/memory/redis); DatabaseStateStore scopes its session with it.
        """
        raise NotImplementedError

    @abstractmethod
    async def save(
        self,
        request_id: str,
        state_dict: dict[str, Any],
        workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        """Persist state dictionary for request_id.

        Returns the new state_version. When expected_version is given, the
        store must raise ConcurrentUpdateError instead of overwriting a newer
        checkpoint (optimistic concurrency, Phase B §3).
        """
        raise NotImplementedError

    @abstractmethod
    async def delete(self, request_id: str) -> None:
        """Remove state for request_id."""
        raise NotImplementedError


class ConcurrentUpdateError(Exception):
    """Optimistic-concurrency conflict on checkpoint save."""


class FileStateStore(StateStore):
    """File-backed state store writing formatted JSON to disk."""

    def __init__(self, state_dir: Path | None = None):
        self._state_dir = state_dir
        self._lock: asyncio.Lock | None = None

    def _get_lock(self) -> asyncio.Lock:
        # In-loop interlock for the read-check-write CAS window. This
        # serializes coroutines sharing the loop; cross-PROCESS file races
        # remain best-effort (file backend is dev/offline grade — production
        # deployments use db/redis). Created lazily (loop-bound).
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    @property
    def state_dir(self) -> Path:
        if self._state_dir is not None:
            return self._state_dir
        from .state import STATE_DIR
        return Path(os.environ.get("VAELOOM_STATE_DIR", str(STATE_DIR)))

    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
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

    async def save(
        self,
        request_id: str,
        state_dict: dict[str, Any],
        workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        dir_path = self.state_dir
        dir_path.mkdir(parents=True, exist_ok=True)
        file_path = dir_path / f"{request_id}.json"
        payload_dict = dict(state_dict)
        async with self._get_lock():
            if expected_version is not None and file_path.exists():
                try:
                    raw = await asyncio.to_thread(file_path.read_text)
                    stored = json.loads(raw)
                    stored_version = int(stored.get("state_version", 1))
                    if stored_version != expected_version:
                        raise ConcurrentUpdateError(
                            f"checkpoint {request_id}: expected v{expected_version}, stored v{stored_version}"
                        )
                except ConcurrentUpdateError:
                    raise
                except (json.JSONDecodeError, OSError, ValueError, TypeError):
                    pass
            new_version = int(payload_dict.get("state_version", 1)) + 1
            payload_dict["state_version"] = new_version
            payload = json.dumps(payload_dict, indent=2, default=str)
            await asyncio.to_thread(file_path.write_text, payload)
        logger.debug(f"FileStateStore saved checkpoint for {request_id} v{new_version}")
        return new_version

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

    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
        factory = self._get_factory()
        # OP-RLS-01: default path uses an RLS-scoped session (tenant resolved
        # from workspace) so checkpoint I/O works under a least-privilege
        # role. Explicit custom factories (tests) are used as-is.
        if self._session_factory is None:
            try:
                from ..database import scoped_session

                cm = scoped_session(workspace_id=workspace_id, require=False)
            except Exception:
                cm = None
        else:
            cm = None
        try:
            from sqlalchemy import select
            from ..models.schema import LoopCheckpoint

            if cm is not None:
                async with cm as session:
                    return await self._load_via(session, request_id)
            async with factory() as session:
                return await self._load_via(session, request_id)
        except Exception as exc:
            logger.warning(f"DatabaseStateStore load failed for {request_id}: {exc}")
        return None

    @staticmethod
    async def _load_via(session, request_id: str) -> dict[str, Any] | None:
        from sqlalchemy import select
        from ..models.schema import LoopCheckpoint

        stmt = select(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
        res = await session.execute(stmt)
        row = res.scalar_one_or_none()
        if row and row.state_json is not None:
            return row.state_json
        return None

    async def save(
        self,
        request_id: str,
        state_dict: dict[str, Any],
        workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        # CAS-DEAD-01: the version check is a single atomic UPDATE predicate,
        # not read-then-write. Row vanished mid-flight -> INSERT path;
        # legacy DBs without the version column -> documented non-atomic path.
        factory = self._get_factory()
        payload = dict(state_dict)
        wid = workspace_id or payload.get("workspace_id")
        tenant = payload.get("tenant_id")
        if self._session_factory is None:
            try:
                from ..database import scoped_session

                cm = scoped_session(workspace_id=wid, require=False)
            except Exception:
                cm = None
        else:
            cm = None
        try:
            from sqlalchemy import select, update
            from ..models.schema import LoopCheckpoint

            if cm is not None:
                async with cm as session:
                    return await self._save_via(
                        session, request_id, payload, wid, tenant, expected_version
                    )
            async with factory() as session:
                return await self._save_via(
                    session, request_id, payload, wid, tenant, expected_version
                )
        except ConcurrentUpdateError:
            raise
        except Exception as exc:
            logger.warning(f"DatabaseStateStore save failed for {request_id}: {exc}")
            raise

    @staticmethod
    async def _save_via(session, request_id, payload, wid, tenant, expected_version) -> int:
        import json as _json

        from sqlalchemy import select, update
        from ..models.schema import LoopCheckpoint

        # CAS-DEAD-01 hardening: JSON-sanitize once (datetimes/UUIDs in phase
        # payloads are not JSON-native; the DB JSON/JSONB bind would reject
        # them and divert every save to the file fallback). Parity with
        # MemoryStateStore. Sanitization is deterministic, so CAS comparisons
        # stay consistent across writers.
        try:
            payload = _json.loads(_json.dumps(payload, default=str))
        except Exception:
            pass

        if expected_version is not None:
            new_version = int(expected_version) + 1
            payload = dict(payload)
            payload["state_version"] = new_version
            try:
                res = await session.execute(
                    update(LoopCheckpoint)
                    .where(
                        LoopCheckpoint.request_id == request_id,
                        LoopCheckpoint.state_version == int(expected_version),
                    )
                    .values(
                        state_json=payload,
                        state_version=new_version,
                        workspace_id=str(wid) if wid else None,
                        tenant_id=str(tenant) if tenant else None,
                    )
                )
                await session.commit()
                if res.rowcount == 1:
                    logger.debug(
                        f"DatabaseStateStore CAS saved checkpoint for {request_id} v{new_version}"
                    )
                    return new_version
            except Exception as col_exc:
                # Pre-0029 DBs without the version/tenant columns: fall back
                # to the legacy non-atomic path (documented residual).
                await session.rollback()
                if "no such column" not in str(col_exc).lower() and "undefinedcolumn" not in type(col_exc).__name__.lower():
                    raise
                logger.warning(
                    f"DatabaseStateStore legacy schema for {request_id}; CAS degraded: {col_exc}"
                )
            # Lost the race (or row vanished): re-read for a truthful error.
            row = (
                await session.execute(
                    select(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
                )
            ).scalar_one_or_none()
            if row is None:
                # Vanished between check and write: fresh INSERT keeps the
                # version chain monotonic (expected+1).
                payload = dict(payload)
                payload["state_version"] = new_version
                session.add(
                    LoopCheckpoint(
                        request_id=request_id,
                        workspace_id=str(wid) if wid else None,
                        tenant_id=str(tenant) if tenant else None,
                        state_json=payload,
                        state_version=new_version,
                    )
                )
                try:
                    await session.commit()
                    return new_version
                except Exception:
                    await session.rollback()
                    raise ConcurrentUpdateError(
                        f"checkpoint {request_id}: lost insert race after conflict"
                    )
            try:
                stored = int((row.state_json or {}).get("state_version", 1))
            except (TypeError, ValueError):
                stored = 1
            raise ConcurrentUpdateError(
                f"checkpoint {request_id}: expected v{expected_version}, stored v{stored}"
            )
        # expected_version None: legacy LWW (explicit opt-out of CAS).
        stmt = select(LoopCheckpoint).where(LoopCheckpoint.request_id == request_id)
        res = await session.execute(stmt)
        row = res.scalar_one_or_none()
        payload = dict(payload)
        if row:
            stored_version = int((row.state_json or {}).get("state_version", 1))
            try:
                row_version_col = int(getattr(row, "state_version", stored_version) or stored_version)
            except (TypeError, ValueError):
                row_version_col = stored_version
            current = max(stored_version, row_version_col)
            new_version = current + 1
            payload["state_version"] = new_version
            row.state_json = payload
            try:
                row.state_version = new_version
            except Exception:
                pass
            try:
                if wid:
                    row.workspace_id = str(wid)
                if tenant:
                    row.tenant_id = str(tenant)
            except Exception:
                pass
        else:
            new_version = int(payload.get("state_version", 1)) + 1
            payload["state_version"] = new_version
            try:
                new_ckpt = LoopCheckpoint(
                    request_id=request_id,
                    workspace_id=str(wid) if wid else None,
                    tenant_id=str(tenant) if tenant else None,
                    state_json=payload,
                    state_version=new_version,
                )
            except TypeError:
                # Older DBs without the newer columns (pre-0029/0039).
                try:
                    new_ckpt = LoopCheckpoint(
                        request_id=request_id,
                        workspace_id=str(wid) if wid else None,
                        state_json=payload,
                        state_version=new_version,
                    )
                except TypeError:
                    new_ckpt = LoopCheckpoint(
                        request_id=request_id,
                        workspace_id=str(wid) if wid else None,
                        state_json=payload,
                    )
            session.add(new_ckpt)
        await session.commit()
        logger.debug(f"DatabaseStateStore saved checkpoint for {request_id} v{new_version}")
        return new_version

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

    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
        data = self._data.get(request_id)
        return json.loads(json.dumps(data, default=str)) if data else None

    async def save(
        self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        if expected_version is not None and request_id in self._data:
            stored_version = int(self._data[request_id].get("state_version", 1))
            if stored_version != expected_version:
                raise ConcurrentUpdateError(
                    f"checkpoint {request_id}: expected v{expected_version}, stored v{stored_version}"
                )
        self._data[request_id] = json.loads(json.dumps(state_dict, default=str))
        self._data[request_id]["state_version"] = int(state_dict.get("state_version", 1)) + 1
        return int(self._data[request_id]["state_version"])

    async def delete(self, request_id: str) -> None:
        self._data.pop(request_id, None)


class RedisStateStore(StateStore):
    """Redis-backed distributed state store for multi-replica workers.

    CAS contract: when expected_version is given, the write succeeds only if
    the stored state_version equals it (atomic Lua compare-and-set); otherwise
    ConcurrentUpdateError is raised and nothing is overwritten. A missing key
    with expected_version behaves like the other backends (write proceeds).
    Malformed stored JSON with expected_version raises instead of silently
    overwriting corrupt state.
    """

    # KEYS[1]=key ARGV[1]=expected_version ARGV[2]=payload ARGV[3]=ttl ARGV[4]=new_version
    _LUA_CAS = """
local cur = redis.call('GET', KEYS[1])
if cur then
  local ok, obj = pcall(cjson.decode, cur)
  if not ok or type(obj) ~= 'table' or obj.state_version == nil then
    return redis.error_reply('CAS_MALFORMED')
  end
  if tonumber(obj.state_version) ~= tonumber(ARGV[1]) then
    return redis.error_reply('CAS_CONFLICT:' .. tostring(obj.state_version))
  end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return ARGV[4]
"""

    def __init__(self, redis_client: Any = None, ttl_seconds: int = 604800):
        self.redis = redis_client
        self.ttl = ttl_seconds

    def _key(self, request_id: str) -> str:
        return f"state:loop:{request_id}"

    async def _get_client(self):
        if self.redis is not None:
            return self.redis
        # NOTE: api.services.redis does not exist; build from settings like
        # temporal/quota.py instead of importing a missing module (which made
        # this backend a silent no-op that persisted nothing).
        try:
            import os

            url = os.environ.get("REDIS_URL") or os.environ.get("REDIS__URL") or ""
            if not url:
                try:
                    from ..config import settings as _settings

                    url = getattr(_settings, "redis__url", "") or ""
                except Exception:
                    url = ""
            if not url:
                return None
            import redis.asyncio as _aioredis

            client = _aioredis.from_url(url, decode_responses=True, socket_connect_timeout=1, socket_timeout=2)
            await client.ping()
            self.redis = client
            return client
        except Exception as exc:
            logger.debug(f"Redis client discovery unavailable: {exc}")
            return None

    async def _maybe_await(self, value: Any) -> Any:
        import inspect as _inspect

        if _inspect.isawaitable(value):
            return await value
        return value

    def _cas_conflict_version(self, exc: Exception) -> str | None:
        msg = str(exc)
        if "CAS_CONFLICT:" in msg:
            return msg.split("CAS_CONFLICT:", 1)[1].strip().split()[0]
        return None

    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
        client = await self._get_client()
        if not client:
            return None
        try:
            raw = await self._maybe_await(client.get(self._key(request_id)))
            if raw:
                return json.loads(raw if isinstance(raw, str) else raw.decode("utf-8"))
        except Exception as exc:
            logger.warning(f"RedisStateStore failed to load {request_id}: {exc}")
        return None

    async def save(
        self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        client = await self._get_client()
        if not client:
            # CAS-DEAD-01: a configured-but-unreachable Redis backend must fail
            # loudly, never pretend the write succeeded (the old code returned
            # the input version unchanged — a durability lie).
            raise RuntimeError("RedisStateStore: no client (backend misconfigured or Redis down)")
        try:
            base_version = int(state_dict.get("state_version", 1))
            if expected_version is None:
                payload_dict = dict(state_dict)
                payload_dict["state_version"] = base_version + 1
                payload = json.dumps(payload_dict, default=str)
                await self._maybe_await(client.set(self._key(request_id), payload, ex=self.ttl))
                return int(payload_dict["state_version"])
            # CAS path: atomic Lua compare-and-set.
            new_version = int(expected_version) + 1
            payload_dict = dict(state_dict)
            payload_dict["state_version"] = new_version
            payload = json.dumps(payload_dict, default=str)
            try:
                await self._maybe_await(
                    client.eval(self._LUA_CAS, 1, self._key(request_id), int(expected_version), payload, self.ttl, new_version)
                )
                return new_version
            except Exception as lua_exc:
                stored = self._cas_conflict_version(lua_exc)
                if stored is not None:
                    raise ConcurrentUpdateError(
                        f"checkpoint {request_id}: expected v{expected_version}, stored v{stored}"
                    ) from lua_exc
                if "CAS_MALFORMED" in str(lua_exc):
                    raise ConcurrentUpdateError(
                        f"checkpoint {request_id}: stored state malformed; refusing overwrite"
                    ) from lua_exc
                if "CAS_MISSING" in str(lua_exc):
                    raise ConcurrentUpdateError(
                        f"checkpoint {request_id}: expected v{expected_version}, stored state missing"
                    ) from lua_exc
                raise
        except ConcurrentUpdateError:
            raise
        except Exception as exc:
            # CAS-DEAD-01: transport failures after a CAS attempt must surface
            # (save_checkpoint routes them to the CAS-enforcing file fallback;
            # returning the input version would claim a save that never happened).
            raise RuntimeError(f"RedisStateStore failed to save {request_id}: {exc}") from exc

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

    async def load(
        self, request_id: str, workspace_id: str | None = None
    ) -> dict[str, Any] | None:
        data = await self.primary.load(request_id, workspace_id)
        if data is not None:
            return data
        return await self.fallback.load(request_id, workspace_id)

    async def save(
        self, request_id: str, state_dict: dict[str, Any], workspace_id: str | None = None,
        expected_version: int | None = None,
    ) -> int:
        new_version = await self.primary.save(request_id, state_dict, workspace_id, expected_version)
        merged = dict(state_dict)
        merged["state_version"] = new_version
        # CAS-DEAD-01: attempt CAS on the mirror too, but never let a lagging
        # fallback break the write the primary already won (primary is the
        # authority; fallback divergence is logged loudly).
        try:
            await self.fallback.save(request_id, merged, workspace_id, expected_version)
        except ConcurrentUpdateError as exc:
            logger.warning(f"CompositeStateStore fallback diverged for {request_id}: {exc}")
        return new_version

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
