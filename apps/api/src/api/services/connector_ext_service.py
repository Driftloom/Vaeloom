import asyncio
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Connector, Workspace, WorkspaceUser
from ..utils.url_guard import DnsResolutionError, UrlBlockedError, assert_public_http_url
from .encryption import decrypt_value, encrypt_value, is_encrypted

logger = logging.getLogger(__name__)

_SENSITIVE_KEY_RE = re.compile(
    r"(?i)(auth_?token|api_?key|connection_?string|secret|password|private_?key|access_?token|refresh_?token|client_?secret|credential)"
)

# Config fields that may contain embedded credentials per connector type
_SENSITIVE_CONFIG_FIELDS: dict[str, list[str]] = {
    "database": ["connectionString"],
    "rest": ["authToken", "apiKey"],
    "graphql": ["authToken", "apiKey"],
    "file": [],
    # MCP: secrets live inside config.env and config.headers (per-key encryption, see below)
    "mcp": [],
}

# GraphQL stored-query safety bounds (CON-GQL-01: fail closed on abusive shapes)
_GRAPHQL_MAX_CHARS = 32_768
_GRAPHQL_MAX_DEPTH = 8
_GRAPHQL_MAX_FIELDS = 200
_GRAPHQL_INTROSPECTION_RE = re.compile(r"__schema|__type")


def _strip_graphql_ignored(query: str) -> str:
    """Remove GraphQL string literals, block strings and comments for shape analysis."""
    out: list[str] = []
    i, n = 0, len(query)
    while i < n:
        ch = query[i]
        if ch == "#":
            while i < n and query[i] != "\n":
                i += 1
            continue
        if query.startswith('"""', i):
            end = query.find('"""', i + 3)
            i = n if end == -1 else end + 3
            out.append(" ")
            continue
        if ch == '"':
            i += 1
            while i < n:
                if query[i] == "\\":
                    i += 2
                    continue
                if query[i] == '"':
                    i += 1
                    break
                i += 1
            out.append(" ")
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def validate_graphql_query(query: str) -> None:
    """Validate a stored GraphQL query template. Raises HTTPException(400) when abusive.

    Enforces size, nesting depth, field count and introspection bans so a stored
    template cannot become a deep-recursion or introspection-exfiltration vector
    if ever executed by sync, test or agent tooling.
    """
    if not isinstance(query, str) or not query.strip():
        raise HTTPException(400, "GraphQL query must be a non-empty string")
    if len(query) > _GRAPHQL_MAX_CHARS:
        raise HTTPException(400, f"GraphQL query exceeds {_GRAPHQL_MAX_CHARS} characters")
    if _GRAPHQL_INTROSPECTION_RE.search(query):
        raise HTTPException(400, "GraphQL introspection (__schema/__type) is not permitted in connector queries")
    body = _strip_graphql_ignored(query)
    depth = max_depth = 0
    for ch in body:
        if ch == "{":
            depth += 1
            max_depth = max(max_depth, depth)
        elif ch == "}":
            depth -= 1
            if depth < 0:
                raise HTTPException(400, "GraphQL query has unbalanced braces")
    if depth != 0:
        raise HTTPException(400, "GraphQL query has unbalanced braces")
    if max_depth > _GRAPHQL_MAX_DEPTH:
        raise HTTPException(400, f"GraphQL query nesting depth {max_depth} exceeds limit {_GRAPHQL_MAX_DEPTH}")
    fields = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", re.sub(r"\b(query|mutation|subscription|fragment|on|true|false|null)\b", " ", body))
    if len(fields) > _GRAPHQL_MAX_FIELDS:
        raise HTTPException(400, f"GraphQL query field count {len(fields)} exceeds limit {_GRAPHQL_MAX_FIELDS}")


class ConnectorExtService:
    def __init__(self) -> None:
        self._sync_locks: dict[str, asyncio.Lock] = {}

    async def _acquire_sync_lock(self, connector_id: str) -> tuple[bool, Any]:
        """Acquire distributed Redis sync lock or in-memory fallback mutex."""
        try:
            import redis.asyncio as aioredis
            from ..config import settings
            redis_url = getattr(settings, "redis__url", None) or getattr(settings, "redis_url", None)
            if redis_url:
                r = aioredis.from_url(redis_url, socket_connect_timeout=1, decode_responses=True)
                lock_key = f"lock:connector:sync:{connector_id}"
                ok = await r.set(lock_key, "1", nx=True, ex=60)
                if not ok:
                    await r.aclose()
                    return False, None
                return True, ("redis", r, lock_key)
        except Exception:
            pass

        if connector_id not in self._sync_locks:
            self._sync_locks[connector_id] = asyncio.Lock()
        lock = self._sync_locks[connector_id]
        if lock.locked():
            return False, None
        await lock.acquire()
        return True, ("memory", lock)

    async def _release_sync_lock(self, handle: Any) -> None:
        if not handle:
            return
        mode = handle[0]
        if mode == "redis":
            _, r, lock_key = handle
            try:
                await r.delete(lock_key)
                await r.aclose()
            except Exception:
                pass
        elif mode == "memory":
            _, lock = handle
            if lock.locked():
                lock.release()

    async def create(
        self,
        dto,
        user_id: str | None,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        self._validate_config(dto.type.value, dto.config)

        ws_id = None
        if workspace_id:
            try:
                ws_id = uuid.UUID(str(workspace_id))
            except (ValueError, TypeError):
                ws_id = None

        if not ws_id and user_id:
            result = await db.execute(
                select(Workspace).where(Workspace.user_id == uuid.UUID(user_id)).limit(1)
            )
            ws = result.scalar_one_or_none()
            if ws:
                ws_id = ws.id

        if not ws_id:
            # Create a fallback workspace for the user if none exists
            new_ws = Workspace(
                user_id=uuid.UUID(user_id) if user_id else None,
                name="Default Workspace",
            )
            db.add(new_ws)
            await db.flush()
            ws_id = new_ws.id

        token_ref = None
        if hasattr(dto, "token_ref") and dto.token_ref:
            token_ref = self._encrypt_credential(dto.token_ref)

        # Encrypt sensitive config fields
        config = dict(dto.config) if dto.config else {}
        self._encrypt_config(config, dto.type.value)

        connector = Connector(
            workspace_id=ws_id,
            name=dto.name,
            type=dto.type.value,
            config=config,
            status="disconnected",
            tenant_id=uuid.UUID(tenant_id) if tenant_id else None,
            token_ref=token_ref,
        )
        db.add(connector)
        await db.commit()
        await db.refresh(connector)
        return connector

    def _check_url_policy_sync(self, url: str) -> None:
        """Fast synchronous check on URL scheme, size, and loopback/private hostnames."""
        import ipaddress
        from urllib.parse import urlparse

        if not url or not isinstance(url, str):
            raise HTTPException(400, "URL is required")
        url = url.strip()
        if len(url) > 2048:
            raise HTTPException(400, "URL exceeds maximum length of 2048 characters")
        try:
            parsed = urlparse(url)
        except Exception as e:
            raise HTTPException(400, f"Malformed URL: {e}")
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(400, f"Unsupported URL scheme: '{parsed.scheme}'. Only http and https allowed.")
        host = (parsed.hostname or "").lower().strip(".")
        if not host:
            raise HTTPException(400, "Missing hostname in URL")
        if parsed.username or parsed.password or "@" in (parsed.netloc.rsplit("@", 1)[0] if "@" in parsed.netloc else ""):
            raise HTTPException(400, "Credentials in URL are not permitted")

        blocked_hosts = {
            "localhost", "localhost.localdomain", "127.0.0.1", "0.0.0.0",
            "::1", "[::1]", "metadata.google.internal", "169.254.169.254",
        }
        if host in blocked_hosts or host.endswith(".local") or host.endswith(".internal"):
            raise HTTPException(400, f"URL targets a blocked host or internal domain: {host}")

        try:
            ip = ipaddress.ip_address(host)
            if not ip.is_global or ip.is_loopback or ip.is_private or ip.is_link_local:
                raise HTTPException(400, f"URL targets private or non-routable IP: {host}")
        except ValueError:
            pass

    def _validate_config(self, conn_type: str, config: dict):
        if conn_type in ("rest", "graphql"):
            url = config.get("url")
            if not url:
                raise HTTPException(400, f"URL is required for {conn_type} connectors")
            self._check_url_policy_sync(url)
            if conn_type == "graphql" and config.get("query") not in (None, ""):
                validate_graphql_query(config["query"])
        if conn_type == "database" and not config.get("connectionString"):
            raise HTTPException(400, "connectionString is required for database connectors")
        if conn_type == "file" and not config.get("path"):
            raise HTTPException(400, "path is required for file connectors")
        if conn_type == "mcp":
            from .mcp_client_service import McpConfigError, validate_mcp_config

            try:
                validate_mcp_config(config)
            except McpConfigError as e:
                raise HTTPException(400, f"Invalid MCP config: {e}")

    async def list_all(
        self,
        page: int,
        page_size: int,
        type_filter: str | None,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
        user_id: str | None = None,
    ):
        stmt = select(Connector)
        if type_filter:
            stmt = stmt.where(Connector.type == type_filter)
        if tenant_id:
            stmt = stmt.where(Connector.tenant_id == uuid.UUID(tenant_id))
        if workspace_id:
            try:
                stmt = stmt.where(Connector.workspace_id == uuid.UUID(str(workspace_id)))
            except (ValueError, TypeError):
                pass
        elif user_id:
            try:
                uid = uuid.UUID(str(user_id))
                ws_subquery = select(Workspace.id).where(Workspace.user_id == uid)
                ws_member_subquery = select(WorkspaceUser.workspace_id).where(WorkspaceUser.user_id == uid)
                stmt = stmt.where((Connector.workspace_id.in_(ws_subquery)) | (Connector.workspace_id.in_(ws_member_subquery)))
            except (ValueError, TypeError):
                pass
        stmt = stmt.order_by(Connector.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        stmt = select(Connector).where(Connector.id == connector_id)
        if tenant_id:
            stmt = stmt.where(Connector.tenant_id == uuid.UUID(tenant_id))
        if workspace_id:
            try:
                stmt = stmt.where(Connector.workspace_id == uuid.UUID(str(workspace_id)))
            except (ValueError, TypeError):
                pass
        result = await db.execute(stmt)
        connector = result.scalar_one_or_none()
        if not connector:
            raise HTTPException(404, "Connector not found")
        return connector

    async def get_decrypted(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ) -> dict:
        """Get connector with decrypted token_ref and config for internal use."""
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        # Decrypt sensitive config fields
        config = dict(connector.config) if connector.config else {}
        self._decrypt_config(config, connector.type)
        data = {
            "id": connector.id,
            "workspace_id": connector.workspace_id,
            "name": connector.name,
            "type": connector.type,
            "config": config,
            "status": connector.status,
            "tenant_id": connector.tenant_id,
            "token_ref": self._decrypt_credential(connector.token_ref) if connector.token_ref else None,
            "last_synced_at": connector.last_synced_at,
            "created_at": connector.created_at,
            "updated_at": connector.updated_at,
        }
        return data

    _CONFIG_HISTORY_LIMIT = 20

    @staticmethod
    def _current_version(connector) -> int:
        try:
            return int(getattr(connector, "config_version", 1) or 1)
        except (TypeError, ValueError):
            return 1

    @classmethod
    def _snapshot_current_config(cls, connector) -> None:
        """Append the live (still-encrypted) config to version history.

        Snapshots store ciphertext exactly as persisted, so a rollback never
        writes a decrypted secret back to the database. History is capped.
        """
        history = list(getattr(connector, "config_history", None) or [])
        history.append(
            {
                "version": cls._current_version(connector),
                "config": dict(getattr(connector, "config", {}) or {}),
                "saved_at": datetime.now(UTC).isoformat(),
            }
        )
        connector.config_history = history[-cls._CONFIG_HISTORY_LIMIT :]
        connector.config_version = cls._current_version(connector) + 1

    async def rollback_config(
        self,
        connector_id: uuid.UUID,
        version: int,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        """Restore a previous config snapshot. The rollback itself is versioned."""
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        history = list(getattr(connector, "config_history", None) or [])
        target = next((h for h in history if isinstance(h, dict) and h.get("version") == version), None)
        if target is None:
            raise HTTPException(404, f"Config version {version} not found in history")
        self._validate_config(connector.type, dict(target.get("config") or {}))
        self._snapshot_current_config(connector)
        connector.config = dict(target.get("config") or {})
        await db.commit()
        await db.refresh(connector)
        return connector

    async def usage_summary(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ) -> dict:
        """Aggregate lifecycle activity for one connector from audit events.

        The connector row is loaded first (tenant/workspace scoped, 404 for
        outsiders), so filtering events by resource_id alone cannot leak
        cross-tenant activity: connector IDs are UUID-unique and the row gate
        runs before any event is read.
        """
        from sqlalchemy import text as _text

        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        rows = (
            await db.execute(
                _text(
                    "SELECT action, COUNT(*), MAX(created_at) FROM audit_events "
                    "WHERE resource = 'connector' AND resource_id = :rid GROUP BY action"
                ),
                {"rid": str(connector_id)},
            )
        ).fetchall()
        by_action = {r[0]: int(r[1]) for r in rows}
        last_activity = None
        for r in rows:
            ts = r[2]
            ts_str = ts.isoformat() if hasattr(ts, "isoformat") else (str(ts) if ts else None)
            if ts_str and (last_activity is None or ts_str > last_activity):
                last_activity = ts_str
        return {
            "connector_id": str(connector_id),
            "name": connector.name,
            "type": connector.type,
            "status": getattr(connector, "status", None),
            "config_version": self._current_version(connector),
            "last_synced_at": connector.last_synced_at.isoformat()
            if getattr(connector, "last_synced_at", None) and hasattr(connector.last_synced_at, "isoformat")
            else None,
            "events_by_action": by_action,
            "total_events": sum(by_action.values()),
            "last_activity_at": last_activity,
        }

    async def update(
        self,
        connector_id: uuid.UUID,
        dto,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        if dto.name is not None:
            connector.name = dto.name
        if dto.config is not None:
            self._validate_config(connector.type, dict(dto.config))
            self._snapshot_current_config(connector)
            config = dict(dto.config)
            self._encrypt_config(config, connector.type)
            connector.config = config
        if hasattr(dto, "token_ref") and dto.token_ref is not None:
            connector.token_ref = self._encrypt_credential(dto.token_ref)
        await db.commit()
        await db.refresh(connector)
        return connector

    @staticmethod
    def _encrypt_credential(plaintext: str) -> str:
        """Encrypt a credential value before storage."""
        if not plaintext:
            return plaintext
        if is_encrypted(plaintext):
            return plaintext
        return encrypt_value(plaintext)

    @staticmethod
    def _decrypt_credential(ciphertext: str) -> str:
        """Decrypt a stored credential value.

        Raises:
            ValueError: If decryption fails (corrupted/tampered data).
        """
        if not ciphertext:
            return ciphertext
        if not is_encrypted(ciphertext):
            return ciphertext
        return decrypt_value(ciphertext)

    def _is_sensitive_key(self, key: str, conn_type: str) -> bool:
        if key in _SENSITIVE_CONFIG_FIELDS.get(conn_type, []):
            return True
        return bool(_SENSITIVE_KEY_RE.search(key))

    def _encrypt_config(self, config: dict, conn_type: str) -> None:
        """Encrypt sensitive fields in the config dict in-place."""
        for field in list(config.keys()):
            if self._is_sensitive_key(field, conn_type) and config[field] and isinstance(config[field], str):
                config[field] = self._encrypt_credential(config[field])
        # Generic headers dict (rest/graphql/mcp) — per-key encryption
        headers = config.get("headers")
        if isinstance(headers, dict):
            for k, v in headers.items():
                if isinstance(v, str):
                    headers[k] = self._encrypt_credential(v)
        if conn_type == "mcp":
            env = config.get("env")
            if isinstance(env, dict):
                for k, v in env.items():
                    if isinstance(v, str):
                        env[k] = self._encrypt_credential(v)

    def _decrypt_config(self, config: dict, conn_type: str) -> None:
        """Decrypt sensitive fields in the config dict in-place."""
        for field in list(config.keys()):
            if self._is_sensitive_key(field, conn_type) and config[field] and isinstance(config[field], str):
                if is_encrypted(config[field]):
                    config[field] = self._decrypt_credential(config[field])
        headers = config.get("headers")
        if isinstance(headers, dict):
            for k, v in headers.items():
                if isinstance(v, str) and is_encrypted(v):
                    headers[k] = self._decrypt_credential(v)
        if conn_type == "mcp":
            env = config.get("env")
            if isinstance(env, dict):
                for k, v in env.items():
                    if isinstance(v, str) and is_encrypted(v):
                        env[k] = self._decrypt_credential(v)

    def mask_sensitive_config(self, config: dict, conn_type: str) -> dict:
        """Return a sanitized copy of config with all sensitive fields replaced by '******'."""
        if not config or not isinstance(config, dict):
            return {}
        masked = dict(config)
        for k, v in list(masked.items()):
            if self._is_sensitive_key(k, conn_type) and v:
                masked[k] = "******"
        if isinstance(masked.get("headers"), dict):
            masked_headers = dict(masked["headers"])
            for hk in masked_headers:
                masked_headers[hk] = "******"
            masked["headers"] = masked_headers
        if conn_type == "mcp" and isinstance(masked.get("env"), dict):
            masked_env = dict(masked["env"])
            for ek in masked_env:
                masked_env[ek] = "******"
            masked["env"] = masked_env
        return masked

    async def remove(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        await db.delete(connector)
        await db.commit()
        return True

    def _build_auth_headers(self, config: dict, connector_type: str, token_ref: str | None = None) -> dict[str, str]:
        """Build Authorization headers from connector config + token_ref."""
        headers: dict[str, str] = {}
        # Explicit headers dict wins
        if isinstance(config.get("headers"), dict):
            for k, v in config["headers"].items():
                if isinstance(v, str) and v:
                    headers[str(k)] = v
        # authToken / apiKey helpers (rest/graphql legacy fields)
        if config.get("authToken") and isinstance(config["authToken"], str):
            token = config["authToken"]
            if "Authorization" not in headers and "authorization" not in {k.lower() for k in headers}:
                headers["Authorization"] = token if token.lower().startswith("bearer ") else f"Bearer {token}"
        if config.get("apiKey") and isinstance(config["apiKey"], str):
            # Prefer X-API-Key unless Authorization already set
            if "Authorization" not in headers and "authorization" not in {k.lower() for k in headers}:
                # Some APIs expect Bearer apikey, we expose as X-API-Key
                headers["X-API-Key"] = config["apiKey"]
        if token_ref and isinstance(token_ref, str) and token_ref.strip():
            if "Authorization" not in headers and "authorization" not in {k.lower() for k in headers}:
                headers["Authorization"] = token_ref if token_ref.lower().startswith("bearer ") else f"Bearer {token_ref}"
        return headers

    async def trigger_sync(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        """Trigger sync for a connector — now performs real authenticated handling per type with concurrency lock.

        - rest/graphql: authenticated GET url (+ token_ref), 5s timeout, SSRF-guarded; 2xx → synced else error
        - mcp: delegates to mcp_client_service.test_connection (discovery)
        - database: validates connectionString format
        - file: validates path present
        """
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        if getattr(connector, "status", None) == "syncing":
            return {
                "connector_id": str(connector.id),
                "status": "syncing",
                "error": "Sync already in progress",
                "synced_at": connector.last_synced_at,
            }

        cid_str = str(connector_id)
        lock_acquired, lock_handle = await self._acquire_sync_lock(cid_str)
        if not lock_acquired:
            return {
                "connector_id": str(connector.id),
                "status": "syncing",
                "error": "Sync already in progress",
                "synced_at": connector.last_synced_at,
            }

        now = datetime.now(UTC)
        connector.status = "syncing"
        await db.commit()
        await db.refresh(connector)

        # Decrypt config + token_ref for auth (defensive for tests with mock connectors lacking attributes)
        ctype = getattr(connector, "type", "rest")
        c_config = getattr(connector, "config", None)
        config = dict(c_config) if isinstance(c_config, dict) else {}
        try:
            self._decrypt_config(config, ctype)
        except Exception:
            pass
        token_ref = None
        try:
            raw_ref = getattr(connector, "token_ref", None)
            token_ref = self._decrypt_credential(raw_ref) if raw_ref else None
        except Exception:
            token_ref = None

        error: str | None = None
        try:
            if ctype == "mcp":
                # Delegate to MCP health check (discovery)
                from .mcp_client_service import mcp_client_service

                probe = await mcp_client_service.test_connection(connector_id, tenant_id, db, workspace_id=workspace_id)
                if probe.get("status") == "ok":
                    connector.last_synced_at = now
                    connector.status = "synced"
                    logger.info("connector_sync_mcp_ok", extra={"connector_id": str(connector_id), "connector_type": connector.type, "tools": probe.get("tools")})
                else:
                    error = probe.get("error", "mcp_unreachable")
                    connector.status = "error"
                    logger.warning("connector_sync_mcp_failed", extra={"connector_id": str(connector_id), "error": error})
            elif ctype in ("rest", "graphql"):
                self._validate_config(ctype, config)
                raw_url = config.get("url") or ""
                headers = self._build_auth_headers(config, ctype, token_ref)
                try:
                    url = await assert_public_http_url(raw_url)
                except DnsResolutionError:
                    url = raw_url
                except UrlBlockedError as e:
                    error = f"ssrf_blocked: {e}"
                    connector.status = "error"
                    url = None

                if url:
                    async def _safe_redirect_hook(response: httpx.Response):
                        if response.is_redirect and "location" in response.headers:
                            from urllib.parse import urljoin
                            target = urljoin(str(response.url), response.headers["location"])
                            try:
                                await assert_public_http_url(target)
                            except DnsResolutionError:
                                pass

                    try:
                        async with httpx.AsyncClient(
                            timeout=5.0,
                            follow_redirects=True,
                            event_hooks={"response": [_safe_redirect_hook]},
                        ) as client:
                            resp = await client.get(url, headers=headers)
                            if 200 <= resp.status_code < 300:
                                connector.last_synced_at = now
                                connector.status = "synced"
                                logger.info("connector_sync_rest_ok", extra={"connector_id": str(connector_id), "connector_type": ctype, "code": resp.status_code})
                            else:
                                error = f"sync_failed_http_{resp.status_code}"
                                connector.status = "error"
                                logger.warning("connector_sync_rest_http_error", extra={"connector_id": str(connector_id), "code": resp.status_code})
                    except UrlBlockedError as e:
                        error = f"ssrf_redirect_blocked: {e}"
                        connector.status = "error"
                    except httpx.TimeoutException as e:
                        error = f"sync_timeout: {e}"
                        connector.status = "error"
                    except httpx.RequestError as e:
                        error = f"sync_request_error: {e}"
                        connector.status = "error"
            elif ctype == "database":
                self._validate_config(ctype, config)
                cs = config.get("connectionString", "")
                if "://" not in cs:
                    error = "invalid_connection_string"
                    connector.status = "error"
                else:
                    connector.last_synced_at = now
                    connector.status = "synced"
                    logger.info("connector_sync_database_ok", extra={"connector_id": str(connector_id)})
            elif ctype == "file":
                self._validate_config(ctype, config)
                connector.last_synced_at = now
                connector.status = "synced"
                logger.info("connector_sync_file_ok", extra={"connector_id": str(connector_id)})
            else:
                connector.last_synced_at = now
                connector.status = "synced"
                logger.info("connector_sync_trigger", extra={"connector_id": str(connector_id), "connector_type": ctype})
        except HTTPException:
            raise
        except Exception:
            error = "sync_failed"
            try:
                connector.status = "error"
            except Exception:
                pass
            logger.exception("connector_sync_trigger_failed", extra={"connector_id": str(connector_id)})
        finally:
            await self._release_sync_lock(lock_handle)
        await db.commit()
        await db.refresh(connector)
        return {
            "connector_id": str(connector.id),
            "status": connector.status,
            "error": error,
            "synced_at": connector.last_synced_at,
        }

    async def get_sync_status(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        return {
            "connector_id": str(connector.id),
            "status": connector.status,
            "error": None,
            "synced_at": connector.last_synced_at,
        }

    async def test_connection(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ):
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        if connector.type == "mcp":
            from .mcp_client_service import mcp_client_service

            return await mcp_client_service.test_connection(connector_id, tenant_id, db, workspace_id=workspace_id)
        # Decrypt config + token_ref for authenticated test
        config = dict(connector.config) if connector.config else {}
        self._decrypt_config(config, connector.type)
        self._validate_config(connector.type, config)
        token_ref = None
        try:
            token_ref = self._decrypt_credential(connector.token_ref) if connector.token_ref else None
        except Exception:
            token_ref = None
        raw_url = config.get("url", "")
        try:
            url = await assert_public_http_url(raw_url)
        except DnsResolutionError:
            url = raw_url
        except UrlBlockedError as e:
            raise HTTPException(400, f"SSRF policy blocked URL: {e}")

        async def _safe_redirect_hook(response: httpx.Response):
            if response.is_redirect and "location" in response.headers:
                from urllib.parse import urljoin
                target = urljoin(str(response.url), response.headers["location"])
                try:
                    await assert_public_http_url(target)
                except DnsResolutionError:
                    pass

        headers = self._build_auth_headers(config, connector.type, token_ref)
        try:
            async with httpx.AsyncClient(
                timeout=5.0,
                follow_redirects=True,
                event_hooks={"response": [_safe_redirect_hook]},
            ) as client:
                if connector.type == "graphql":
                    resp = await client.post(
                        url,
                        headers={**headers, "Content-Type": "application/json"},
                        json={"query": "{ __typename }"},
                    )
                else:
                    resp = await client.get(url, headers=headers)
                return {"status": "ok", "code": resp.status_code}
        except UrlBlockedError as e:
            raise HTTPException(400, f"SSRF redirect blocked: {e}")
        except httpx.TimeoutException:
            raise HTTPException(504, "Connection timed out")
        except httpx.RequestError as e:
            raise HTTPException(502, f"Connection failed: {str(e)}")

    async def get_health(
        self,
        connector_id: uuid.UUID,
        tenant_id: str | None,
        db: AsyncSession = None,
        workspace_id: str | None = None,
    ) -> dict:
        """Inspect connector health without leaking credentials."""
        connector = await self.get(connector_id, tenant_id, db, workspace_id=workspace_id)
        status_map = {
            "synced": "healthy",
            "syncing": "degraded",
            "disconnected": "unknown",
            "error": "error",
        }
        health_status = status_map.get(connector.status, "unknown")
        has_auth = bool(
            connector.token_ref
            or (isinstance(connector.config, dict) and (
                connector.config.get("headers")
                or connector.config.get("apiKey")
                or connector.config.get("authToken")
            ))
        )
        auth_state = "configured" if has_auth else "unconfigured"
        return {
            "connector_id": str(connector.id),
            "name": connector.name,
            "type": connector.type,
            "status": health_status,
            "last_synced_at": connector.last_synced_at,
            "auth_state": auth_state,
            "connectivity": "ok" if connector.status == "synced" else ("unknown" if connector.status == "disconnected" else "failed"),
            "details": f"Connector in status '{connector.status}'",
        }


connector_ext_service = ConnectorExtService()
