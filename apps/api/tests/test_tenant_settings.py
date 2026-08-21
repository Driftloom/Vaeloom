import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from api.models.schema import Tenant
from api.services.tenant_settings import (
    BrandingSettings,
    PasswordPolicy,
    Policies,
    RetentionPolicy,
    SessionPolicy,
    TenantSettings,
    TenantSettingsError,
    TenantSettingsManager,
)

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def seeded_tenant(db_session):
    tenant = Tenant(name="Test Inc", slug="test-inc", domain="test.com")
    db_session.add(tenant)
    await db_session.flush()
    await db_session.refresh(tenant)
    return tenant


class TestGetSettings:
    async def test_returns_defaults(self, seeded_tenant, db_session):
        mgr = TenantSettingsManager()
        settings = await mgr.get_settings(str(seeded_tenant.id), db_session)
        assert settings.tenant_id == str(seeded_tenant.id)
        assert settings.branding.primary_color == "#6366f1"
        assert settings.policies.password_policy.min_length == 8
        assert settings.policies.session_timeout.session_timeout_minutes == 480
        assert settings.policies.mfa_required is False
        assert settings.retention.audit_retention_days == 730

    async def test_raises_on_missing_tenant(self, db_session):
        mgr = TenantSettingsManager()
        with pytest.raises(TenantSettingsError, match="not found"):
            await mgr.get_settings(str(uuid.uuid4()), db_session)


class TestUpdateSettings:
    async def test_updates_all_fields(self, seeded_tenant, db_session):
        mgr = TenantSettingsManager()
        new_settings = TenantSettings(
            tenant_id=str(seeded_tenant.id),
            branding=BrandingSettings(logo_url="https://example.com/logo.png", primary_color="#ff0000"),
            policies=Policies(
                password_policy=PasswordPolicy(min_length=12, require_special_chars=True),
                session_timeout=SessionPolicy(session_timeout_minutes=120, max_concurrent_sessions=3),
                mfa_required=True,
            ),
            retention=RetentionPolicy(data_retention_days=90, audit_retention_days=180),
        )
        result = await mgr.update_settings(str(seeded_tenant.id), new_settings, db_session)
        assert result.branding.logo_url == "https://example.com/logo.png"
        assert result.branding.primary_color == "#ff0000"
        assert result.policies.password_policy.min_length == 12
        assert result.policies.mfa_required is True
        assert result.retention.data_retention_days == 90

        # Verify persisted
        tenant = (await db_session.execute(select(Tenant).where(Tenant.id == seeded_tenant.id))).scalar_one()
        assert tenant.settings["branding"]["logo_url"] == "https://example.com/logo.png"
        assert tenant.settings["policies"]["mfa_required"] is True

    async def test_raises_on_missing_tenant(self, db_session):
        mgr = TenantSettingsManager()
        settings = TenantSettings(tenant_id=str(uuid.uuid4()))
        with pytest.raises(TenantSettingsError, match="not found"):
            await mgr.update_settings(str(uuid.uuid4()), settings, db_session)

    async def test_partial_update_merges(self, seeded_tenant, db_session):
        mgr = TenantSettingsManager()
        partial = TenantSettings(
            tenant_id=str(seeded_tenant.id),
            branding=BrandingSettings(primary_color="#00ff00"),
        )
        result = await mgr.update_settings(str(seeded_tenant.id), partial, db_session)
        assert result.branding.primary_color == "#00ff00"
        assert result.policies.password_policy.min_length == 8  # default preserved
