import uuid
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.schema import Connector, Workspace
from .encryption import encrypt_value, decrypt_value, is_encrypted


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

        connector = Connector(
            workspace_id=workspace_id,
            name=dto.name,
            type=dto.type.value,
            config=dto.config,
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
        """Get connector with decrypted token_ref for internal use."""
        connector = await self.get(connector_id, tenant_id, db)
        data = {
            "id": connector.id,
            "workspace_id": connector.workspace_id,
            "name": connector.name,
            "type": connector.type,
            "config": connector.config,
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
            connector.config = dto.config
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
        """Decrypt a stored credential value."""
        if not ciphertext:
            return ciphertext
        if not is_encrypted(ciphertext):
            return ciphertext
        try:
            return decrypt_value(ciphertext)
        except Exception:
            # If decryption fails, return as-is (may be legacy unencrypted)
            return ciphertext

    async def remove(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
        await db.delete(connector)
        await db.commit()
        return True

    async def trigger_sync(self, connector_id: uuid.UUID, tenant_id: str | None, db: AsyncSession = None):
        connector = await self.get(connector_id, tenant_id, db)
        now = datetime.now(timezone.utc)
        try:
            connector.last_synced_at = now
            connector.status = "synced"
        except Exception:
            connector.status = "error"
        await db.commit()
        await db.refresh(connector)
        return {
            "connector_id": str(connector.id),
            "status": connector.status,
            "error": None if connector.status == "synced" else "sync_failed",
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
        self._validate_config(connector.type, connector.config)
        url = connector.config.get("url", "")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, timeout=5.0)
                return {"status": "ok", "code": resp.status_code}
        except httpx.TimeoutError:
            raise HTTPException(504, "Connection timed out")
        except httpx.RequestError as e:
            raise HTTPException(502, f"Connection failed: {str(e)}")


connector_ext_service = ConnectorExtService()
