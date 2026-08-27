import logging
import uuid
from datetime import UTC, datetime

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Connector, Workspace
from .encryption import decrypt_value, encrypt_value, is_encrypted

logger = logging.getLogger(__name__)

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
    async def create(self, dto, user_id: str | None, tenant_id: str | None, db: AsyncSession = None):
        self._validate_config(dto.type.value, dto.config)

        workspace_id = None
        if user_id:
            result = await db.execute(
                select(Workspace).where(Workspace.user_id == uuid.UUID(user_id)).limit(1)
            )
            ws = result.scalar_one_or_none()
            if ws:
                workspace_id = ws.id

        if not workspace_id:
            workspace_id = uuid.uuid4()

        token_ref = None
        if hasattr(dto, "token_ref") and dto.token_ref:
            token_ref = self._encrypt_credential(dto.token_ref)

        # Encrypt sensitive config fields
        config = dict(dto.config) if dto.config else {}
        self._encrypt_config(config, dto.type.value)

        connector = Connector(
            workspace_id=workspace_id,
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

    def _validate_config(self, conn_type: str, config: dict):
        if conn_type in ("rest", "graphql") and not config.get("url"):
            raise HTTPException(400, f"URL is required for {conn_type} connectors")
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

    async def list_all(self, page: int, page_size: int, type_filter: str | None, tenant_id: str | None, db: AsyncSession = None):
        stmt = select(Connector)
        if type_filter:
            stmt = stmt.where(Connector.type == type_filter)
        if tenant_id:
            stmt = stmt.where(Connector.tenant_id == uuid.UUID(tenant_id))
        stmt = stmt.order_by(Connector.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        stmt = select(Connector).where(Connector.id == connector_id)
        if tenant_id:
            stmt = stmt.where(Connector.tenant_id == uuid.UUID(tenant_id))
        result = await db.execute(stmt)
        connector = result.scalar_one_or_none()
        if not connector:
            raise HTTPException(404, "Connector not found")
        return connector

    async def get_decrypted(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None) -> dict:
        """Get connector with decrypted token_ref and config for internal use."""
        connector = await self.get(connector_id, tenant_id, db)
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

    async def update(self, connector_id: uuid.UUID, dto, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
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

    def _encrypt_config(self, config: dict, conn_type: str) -> None:
        """Encrypt sensitive fields in the config dict in-place."""
        sensitive_fields = _SENSITIVE_CONFIG_FIELDS.get(conn_type, [])
        for field in sensitive_fields:
            if field in config and config[field] and isinstance(config[field], str):
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
        sensitive_fields = _SENSITIVE_CONFIG_FIELDS.get(conn_type, [])
        for field in sensitive_fields:
            if field in config and config[field] and isinstance(config[field], str):
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

    async def remove(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
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

    async def trigger_sync(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        """Trigger sync for a connector — now performs real authenticated handling per type.

        - rest/graphql: authenticated GET url (+ token_ref), 5s timeout; 2xx → synced else error
        - mcp: delegates to mcp_client_service.test_connection (discovery)
        - database: validates connectionString format
        - file: validates path present
        Falls back to timestamp-only marking when no network needed.
        """
        connector = await self.get(connector_id, tenant_id, db)
        now = datetime.now(UTC)
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

                probe = await mcp_client_service.test_connection(connector_id, tenant_id, db)
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
                url = config.get("url") or ""
                headers = self._build_auth_headers(config, ctype, token_ref)
                try:
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(url, headers=headers, timeout=5.0, follow_redirects=True)
                        if 200 <= resp.status_code < 300:
                            connector.last_synced_at = now
                            connector.status = "synced"
                            logger.info("connector_sync_rest_ok", extra={"connector_id": str(connector_id), "connector_type": ctype, "code": resp.status_code})
                        else:
                            error = f"sync_failed_http_{resp.status_code}"
                            connector.status = "error"
                            logger.warning("connector_sync_rest_http_error", extra={"connector_id": str(connector_id), "code": resp.status_code})
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
                # Unknown type — preserve legacy timestamp marking
                connector.last_synced_at = now
                connector.status = "synced"
                logger.info("connector_sync_trigger", extra={"connector_id": str(connector_id), "connector_type": ctype})
        except HTTPException:
            raise
        except Exception as e:
            # Legacy test expects error == "sync_failed"; preserve that for generic failures
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

    async def get_sync_status(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
        return {
            "connector_id": str(connector.id),
            "status": connector.status,
            "error": None,
            "synced_at": connector.last_synced_at,
        }

    async def test_connection(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
        if connector.type == "mcp":
            from .mcp_client_service import mcp_client_service

            return await mcp_client_service.test_connection(connector_id, tenant_id, db)
        # Decrypt config + token_ref for authenticated test
        config = dict(connector.config) if connector.config else {}
        self._decrypt_config(config, connector.type)
        self._validate_config(connector.type, config)
        token_ref = None
        try:
            token_ref = self._decrypt_credential(connector.token_ref) if connector.token_ref else None
        except Exception:
            token_ref = None
        url = config.get("url", "")
        headers = self._build_auth_headers(config, connector.type, token_ref)
        try:
            async with httpx.AsyncClient() as client:
                if connector.type == "graphql":
                    # Lightweight GraphQL introspection probe
                    resp = await client.post(
                        url,
                        headers={**headers, "Content-Type": "application/json"},
                        json={"query": "{ __typename }"},
                        timeout=5.0,
                    )
                else:
                    resp = await client.get(url, headers=headers, timeout=5.0, follow_redirects=True)
                return {"status": "ok", "code": resp.status_code}
        except httpx.TimeoutException:
            raise HTTPException(504, "Connection timed out")
        except httpx.RequestError as e:
            raise HTTPException(502, f"Connection failed: {str(e)}")


connector_ext_service = ConnectorExtService()
