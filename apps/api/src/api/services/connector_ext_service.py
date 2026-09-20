import logging
import re
import uuid
from datetime import UTC, datetime

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


class ConnectorExtService:
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
