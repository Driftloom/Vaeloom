import secrets
from datetime import datetime, timezone, timedelta
from uuid import UUID

import bcrypt
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import ApiKey


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    permissions: list
    tenant_id: str | None = None
    user_id: str
    expires_at: datetime | None = None
    last_used: datetime | None = None
    enabled: bool
    version: int
    rotated_at: datetime | None = None
    created_at: datetime


class APIKeyManager:
    KEY_PREFIX = "vael_"

    def generate_key(self) -> tuple[str, str]:
        raw = self.KEY_PREFIX + secrets.token_urlsafe(32)
        if len(raw) < 40:
            raise ValueError("Generated key does not meet entropy requirements")
        key_hash = bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()
        return raw, key_hash

    def hash_key(self, key: str) -> str:
        return bcrypt.hashpw(key.encode(), bcrypt.gensalt()).decode()

    def validate_key(self, key: str, key_hash: str) -> bool:
        return bcrypt.checkpw(key.encode(), key_hash.encode())

    async def create_key(
        self,
        name: str,
        user_id: str,
        permissions: list | None = None,
        tenant_id: str | None = None,
        expires_at: datetime | None = None,
        db: AsyncSession | None = None,
    ) -> tuple[str, ApiKey]:
        raw, key_hash = self.generate_key()
        key_prefix = raw[:10]

        api_key = ApiKey(
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash,
            permissions=permissions or [],
            tenant_id=UUID(tenant_id) if tenant_id else None,
            user_id=UUID(user_id),
            expires_at=expires_at,
        )
        db.add(api_key)
        await db.flush()
        await db.refresh(api_key)
        return raw, api_key

    async def get_key(self, key_id: str, db: AsyncSession) -> ApiKey | None:
        result = await db.execute(select(ApiKey).where(ApiKey.id == UUID(key_id)))
        return result.scalar_one_or_none()

    async def rotate_key(self, key_id: str, db: AsyncSession) -> tuple[str, ApiKey]:
        key = await self.get_key(key_id, db)
        if not key:
            raise ValueError("API key not found")

        raw, key_hash = self.generate_key()
        key_prefix = raw[:10]
        old_hash = key.key_hash

        key.key_hash = key_hash
        key.key_prefix = key_prefix
        key.version += 1
        key.rotated_at = datetime.now(timezone.utc)
        key.rotated_from = key.id
        key.last_used = None

        await db.flush()
        await db.refresh(key)
        return raw, key

    async def revoke_key(self, key_id: str, db: AsyncSession) -> None:
        key = await self.get_key(key_id, db)
        if not key:
            raise ValueError("API key not found")
        key.enabled = False
        await db.flush()

    async def enforce_rotation(self, key_id: str, db: AsyncSession, max_age_days: int = 90) -> bool:
        key = await self.get_key(key_id, db)
        if not key:
            raise ValueError("API key not found")
        if not key.enabled:
            return False
        reference = key.rotated_at or key.created_at
        if reference.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) - timedelta(days=max_age_days):
            return True
        return False

    async def list_keys(self, user_id: str, db: AsyncSession) -> list[ApiKey]:
        result = await db.execute(
            select(ApiKey).where(ApiKey.user_id == UUID(user_id)).order_by(ApiKey.created_at.desc())
        )
        return list(result.scalars().all())


api_key_manager = APIKeyManager()
