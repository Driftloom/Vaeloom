import time
import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.schema import ProviderKey
from ..services.encryption import decrypt_value, encrypt_value

SUPPORTED_PROVIDERS = {"openai", "anthropic", "google", "mistral", "cohere", "azure", "openrouter", "groq", "ollama", "custom"}


def _hint_for_key(raw: str) -> tuple[str, str]:
    """Return (key_hint, key_prefix). Never log raw."""
    raw = raw.strip()
    hint = f"...{raw[-4:]}" if len(raw) >= 4 else "...****"
    # prefix is first up to 7 chars before sensitive middle
    prefix = raw[:7] if len(raw) >= 7 else raw[:3]
    return hint, prefix


class ProviderKeyService:
    """BYOK manager - encrypted storage, resolution, validation."""

    async def upsert(
        self,
        db: AsyncSession,
        user_id: str,
        dto_provider: str,
        api_key: str,
        workspace_id: str | None = None,
    ) -> ProviderKey:
        provider = dto_provider.strip().lower()
        if provider not in SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider '{provider}'")

        # Validate basic key format per provider
        self._basic_format_check(provider, api_key)

        # Check existing
        uid = uuid.UUID(user_id)
        ws_uuid = uuid.UUID(workspace_id) if workspace_id else None

        # Need to handle NULL uniq: query manually
        stmt = select(ProviderKey).where(
            ProviderKey.user_id == uid,
            ProviderKey.provider == provider,
        )
        if ws_uuid is None:
            stmt = stmt.where(ProviderKey.workspace_id.is_(None))
        else:
            stmt = stmt.where(ProviderKey.workspace_id == ws_uuid)

        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        hint, prefix = _hint_for_key(api_key)
        encrypted = encrypt_value(api_key.strip())

        if existing:
            existing.encrypted_key = encrypted
            existing.key_hint = hint
            existing.key_prefix = prefix
            existing.is_active = True
            existing.is_valid = None  # reset validation on rotation
            existing.validation_error = None
            existing.updated_at = datetime.now(UTC)
            await db.flush()
            await db.refresh(existing)
            return existing

        row = ProviderKey(
            user_id=uid,
            workspace_id=ws_uuid,
            provider=provider,
            encrypted_key=encrypted,
            key_hint=hint,
            key_prefix=prefix,
            is_active=True,
            is_valid=None,
        )
        db.add(row)
        await db.flush()
        await db.refresh(row)
        return row

    def _basic_format_check(self, provider: str, key: str) -> None:
        k = key.strip()
        if len(k) < 8:
            raise ValueError("API key too short")

    async def list_for_user(
        self,
        db: AsyncSession,
        user_id: str,
        workspace_id: str | None = None,
    ) -> list[ProviderKey]:
        uid = uuid.UUID(user_id)
        stmt = select(ProviderKey).where(ProviderKey.user_id == uid).order_by(ProviderKey.provider)
        result = await db.execute(stmt)
        keys = list(result.scalars().all())
        # If workspace_id filter provided, return only matching ws + global, else all
        if workspace_id:
            ws_uuid = uuid.UUID(workspace_id)
            keys = [k for k in keys if k.workspace_id is None or k.workspace_id == ws_uuid]
        return keys

    async def get_by_id(self, db: AsyncSession, key_id: uuid.UUID, user_id: str) -> ProviderKey | None:
        uid = uuid.UUID(user_id)
        result = await db.execute(select(ProviderKey).where(ProviderKey.id == key_id, ProviderKey.user_id == uid))
        return result.scalar_one_or_none()

    async def delete(self, db: AsyncSession, key_id: uuid.UUID, user_id: str) -> bool:
        row = await self.get_by_id(db, key_id, user_id)
        if not row:
            return False
        await db.delete(row)
        await db.flush()
        return True

    async def set_active(self, db: AsyncSession, key_id: uuid.UUID, user_id: str, is_active: bool) -> ProviderKey | None:
        row = await self.get_by_id(db, key_id, user_id)
        if not row:
            return None
        row.is_active = is_active
        row.updated_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(row)
        return row

    def decrypt(self, row: ProviderKey) -> str:
        return decrypt_value(row.encrypted_key)

    async def resolve_effective(
        self,
        db: AsyncSession,
        user_id: str,
        provider: str,
        workspace_id: str | None = None,
    ) -> dict:
        """Resolve effective key for user/ws/provider. Returns dict with source, hint, decrypted if available."""
        provider = provider.strip().lower()
        uid = uuid.UUID(user_id)
        ws_uuid = uuid.UUID(workspace_id) if workspace_id else None

        # 1. workspace-scoped
        if ws_uuid:
            stmt = select(ProviderKey).where(
                ProviderKey.user_id == uid,
                ProviderKey.provider == provider,
                ProviderKey.workspace_id == ws_uuid,
                ProviderKey.is_active == True,  # noqa
            )
            result = await db.execute(stmt)
            ws_key = result.scalar_one_or_none()
            if ws_key:
                return {
                    "source": "workspace",
                    "row": ws_key,
                    "key": self.decrypt(ws_key),
                    "hint": ws_key.key_hint,
                    "is_valid": ws_key.is_valid,
                    "last_validated_at": ws_key.last_validated_at,
                }

        # 2. user-global
        stmt = select(ProviderKey).where(
            ProviderKey.user_id == uid,
            ProviderKey.provider == provider,
            ProviderKey.workspace_id.is_(None),
            ProviderKey.is_active == True,  # noqa
        )
        result = await db.execute(stmt)
        user_key = result.scalar_one_or_none()
        if user_key:
            return {
                "source": "user",
                "row": user_key,
                "key": self.decrypt(user_key),
                "hint": user_key.key_hint,
                "is_valid": user_key.is_valid,
                "last_validated_at": user_key.last_validated_at,
            }

        # 3. system fallback
        if settings.llm_api_key and provider == settings.llm_provider:
            return {
                "source": "system",
                "row": None,
                "key": settings.llm_api_key,
                "hint": f"...{settings.llm_api_key[-4:]}" if len(settings.llm_api_key) >= 4 else None,
                "is_valid": None,
                "last_validated_at": None,
            }
        # Generic fallback: if we have any system key for that provider via env mapping
        return {
            "source": "none",
            "row": None,
            "key": None,
            "hint": None,
            "is_valid": None,
            "last_validated_at": None,
        }

    async def mark_used(self, db: AsyncSession, row: ProviderKey) -> None:
        row.last_used_at = datetime.now(UTC)
        await db.flush()

    async def validate(
        self,
        db: AsyncSession,
        row: ProviderKey,
    ) -> tuple[bool, str, int]:
        """Hit provider to verify key is valid. Returns (is_valid, message, latency_ms). Does not leak key."""
        raw = self.decrypt(row)
        provider = row.provider
        start = time.monotonic()
        is_valid = False
        msg = "Unknown"
        latency_ms = 0
        try:
            if provider == "openai":
                url = "https://api.openai.com/v1/models"
                headers = {"Authorization": f"Bearer {raw}"}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, headers=headers)
                    is_valid = resp.status_code == 200
                    msg = "Valid OpenAI key" if is_valid else f"OpenAI validation failed: {resp.status_code}"
            elif provider == "anthropic":
                url = "https://api.anthropic.com/v1/messages"
                headers = {"x-api-key": raw, "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
                body = {"model": "claude-3-haiku-20240307", "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, headers=headers, json=body)
                    # 200 = valid, 401 = invalid key
                    is_valid = resp.status_code == 200
                    msg = "Valid Anthropic key" if is_valid else f"Anthropic validation failed: {resp.status_code}"
            elif provider == "google":
                # Google Gemini validate via list models; key sent as header (never in URL)
                url = "https://generativelanguage.googleapis.com/v1beta/models"
                headers = {"x-goog-api-key": raw}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(url, headers=headers)
                    is_valid = resp.status_code == 200
                    msg = "Valid Google key" if is_valid else f"Google validation failed: {resp.status_code}"
            elif provider == "openrouter":
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {raw}"})
                    is_valid = resp.status_code == 200
                    msg = "Valid OpenRouter key" if is_valid else f"OpenRouter validation failed: {resp.status_code}"
            elif provider == "groq":
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {raw}"})
                    is_valid = resp.status_code == 200
                    msg = "Valid Groq key" if is_valid else f"Groq validation failed: {resp.status_code}"
            else:
                # Generic: assume valid if key present (no remote check)
                is_valid = True
                msg = f"No remote validation for provider '{provider}' — stored as valid"
        except Exception as e:
            is_valid = False
            msg = f"Validation error: {str(e)[:200]}"
        latency_ms = int((time.monotonic() - start) * 1000)

        row.is_valid = is_valid
        row.last_validated_at = datetime.now(UTC)
        row.validation_error = None if is_valid else msg
        await db.flush()
        await db.refresh(row)
        return is_valid, msg, latency_ms


provider_key_service = ProviderKeyService()
