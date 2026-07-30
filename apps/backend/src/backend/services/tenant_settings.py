import uuid

from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Tenant


class BrandingSettings(BaseModel):
    logo_url: str = ""
    primary_color: str = "#6366f1"


class PasswordPolicy(BaseModel):
    min_length: int = 8
    require_uppercase: bool = True
    require_numbers: bool = True
    require_special_chars: bool = False


class SessionPolicy(BaseModel):
    session_timeout_minutes: int = 480
    max_concurrent_sessions: int = 5


class Policies(BaseModel):
    password_policy: PasswordPolicy = PasswordPolicy()
    session_timeout: SessionPolicy = SessionPolicy()
    mfa_required: bool = False


class RetentionPolicy(BaseModel):
    data_retention_days: int = 365
    audit_retention_days: int = 730


class TenantSettings(BaseModel):
    tenant_id: str
    branding: BrandingSettings = BrandingSettings()
    policies: Policies = Policies()
    retention: RetentionPolicy = RetentionPolicy()


class TenantSettingsError(Exception):
    pass


class TenantSettingsManager:
    async def get_settings(self, tenant_id: str, db: AsyncSession) -> TenantSettings:
        result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise TenantSettingsError(f"Tenant '{tenant_id}' not found")
        raw = tenant.settings or {}
        return TenantSettings(
            tenant_id=tenant_id,
            branding=BrandingSettings(**raw.get("branding", {})),
            policies=Policies(
                password_policy=PasswordPolicy(**raw.get("policies", {}).get("password_policy", {})),
                session_timeout=SessionPolicy(**raw.get("policies", {}).get("session_timeout", {})),
                mfa_required=raw.get("policies", {}).get("mfa_required", False),
            ),
            retention=RetentionPolicy(**raw.get("retention", {})),
        )

    async def update_settings(self, tenant_id: str, new_settings: TenantSettings, db: AsyncSession) -> TenantSettings:
        result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise TenantSettingsError(f"Tenant '{tenant_id}' not found")

        merged = dict(tenant.settings or {})
        merged["branding"] = new_settings.branding.model_dump()
        merged["policies"] = {
            "password_policy": new_settings.policies.password_policy.model_dump(),
            "session_timeout": new_settings.policies.session_timeout.model_dump(),
            "mfa_required": new_settings.policies.mfa_required,
        }
        merged["retention"] = new_settings.retention.model_dump()

        await db.execute(
            update(Tenant).where(Tenant.id == uuid.UUID(tenant_id)).values(settings=merged)
        )
        return TenantSettings(tenant_id=tenant_id, **merged)


tenant_settings_manager = TenantSettingsManager()
