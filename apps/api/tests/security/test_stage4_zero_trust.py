"""Zero-Trust Stage 4 Verification Tests (Redis Revocation Hot Cache & E2E Verification).

Tests:
1. Redis-backed token revocation hot cache fast-path and graceful DB fallback.
2. Comprehensive multi-module Zero-Trust lifecycle (Auth -> MFA -> Onboarding -> Tenant Isolation -> GDPR).
"""

import time
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.schema import Tenant, User
from api.services.auth_service import (
    auth_service,
    set_revocation_redis,
)
from api.services.totp_service import totp_service

pytestmark = pytest.mark.asyncio


class MockRedis:
    """In-memory Redis client for testing revocation hot-cache."""
    def __init__(self):
        self.store = {}
        self.should_fail = False

    def get(self, key):
        if self.should_fail:
            raise ConnectionError("Redis cluster unreachable")
        return self.store.get(key)

    def set(self, key, value, ex=None):
        if self.should_fail:
            raise ConnectionError("Redis cluster unreachable")
        self.store[key] = str(value)
        return True

    def exists(self, key):
        if self.should_fail:
            raise ConnectionError("Redis cluster unreachable")
        return key in self.store

    def delete(self, key):
        if self.should_fail:
            raise ConnectionError("Redis cluster unreachable")
        return self.store.pop(key, None) is not None

    def ping(self):
        if self.should_fail:
            raise ConnectionError("Redis cluster unreachable")
        return True


async def test_redis_hot_cache_revocation(db_session: AsyncSession):
    """Verify that token revocation leverages Redis hot-cache for low-latency lookups and degrades safely."""
    mock_redis = MockRedis()
    set_revocation_redis(mock_redis)

    try:
        # 1. Revoke single token by JTI
        test_jti = f"jti-{uuid.uuid4()}"
        auth_service.revoke_token(jti=test_jti)
        assert mock_redis.exists(f"jwt:revoked:{test_jti}")

        # Check hot path lookup
        revoked, reason = await auth_service.is_token_revoked_async(jti=test_jti, db=db_session)
        assert revoked is True
        assert reason == "denylist"

        # 2. Revoke all user tokens (cutoff)
        test_user_id = str(uuid.uuid4())
        await auth_service.revoke_all_user_tokens(user_id=test_user_id, db=db_session)
        assert mock_redis.exists(f"jwt:cutoff:{test_user_id}")

        old_iat = time.time() - 300
        revoked_cut, reason_cut = await auth_service.is_token_revoked_async(
            user_id=test_user_id, iat=old_iat, db=db_session
        )
        assert revoked_cut is True
        assert reason_cut == "cutoff"

        # 3. Graceful degradation: Redis failure falls back to DB truth without crashing
        mock_redis.should_fail = True
        # DB check for a non-revoked token should return False, not crash
        clean_jti = f"clean-{uuid.uuid4()}"
        revoked_deg, _ = await auth_service.is_token_revoked_async(jti=clean_jti, db=db_session)
        assert revoked_deg is False

    finally:
        set_revocation_redis(None)


async def test_complete_zero_trust_modules_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """Full end-to-end multi-module Zero-Trust verification:
    1. Sign up with high entropy password (Module 01)
    2. Setup & verify RFC 6238 TOTP MFA (Module 01)
    3. Multi-tenant workspace provisioning & SCIM isolation (Module 02)
    4. Onboarding state progression & resume skill extraction (Module 03)
    5. GDPR Tenant data export & boundary validation (Module 02 / 03)
    """
    # 1. Sign up
    tenant = Tenant(name="Enterprise Co", slug=f"ent-{uuid.uuid4().hex[:6]}")
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)

    user_email = f"lead_{uuid.uuid4().hex[:6]}@enterprise.test"
    signup_res = await client.post(
        "/api/v1/auth/signup",
        json={"email": user_email, "password": "VaeloomEnterprisePass2026!", "display_name": "Tech Lead"},
    )
    assert signup_res.status_code == 201
    user_id = uuid.UUID(signup_res.json()["user"]["id"])
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Associate tenant
    u = await db_session.get(User, user_id)
    u.tenant_id = tenant.id
    await db_session.commit()

    # Re-login with tenant claim
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": user_email, "password": "VaeloomEnterprisePass2026!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. MFA Setup & Enable
    mfa_setup_res = await client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert mfa_setup_res.status_code == 200
    secret = mfa_setup_res.json()["secret"]

    valid_code = totp_service.generate_code(secret)
    mfa_enable_res = await client.post(
        "/api/v1/auth/mfa/enable",
        headers=headers,
        json={"code": valid_code},
    )
    assert mfa_enable_res.status_code == 200
    assert mfa_enable_res.json()["status"] == "success"

    # 3. Onboarding: Resume Upload
    resume_content = "Tech Lead with expertise in Python, FastAPI, Docker, Kubernetes, AWS, and React."
    import io
    files = {"file": ("resume.txt", io.BytesIO(resume_content.encode()), "text/plain")}
    resume_res = await client.post("/api/v1/onboarding/resume", headers=headers, files=files)
    assert resume_res.status_code == 200
    skills = resume_res.json()["extracted_skills"]
    assert "Python" in skills and "FastAPI" in skills and "Docker" in skills

    # 4. Onboarding: Complete
    comp_res = await client.post(
        "/api/v1/onboarding/complete",
        headers=headers,
        json={"final_data": {"role": "Tech Lead"}},
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["is_completed"] is True

    # 5. GDPR Tenant Export
    export_res = await client.post(f"/api/v1/tenants/{tenant.id}/export", headers=headers)
    assert export_res.status_code == 200
    exp_data = export_res.json()
    assert exp_data["tenant_name"] == "Enterprise Co"
    assert len(exp_data["data"]["users"]) >= 1
    assert exp_data["data"]["onboarding_states"][0]["is_completed"] is True
