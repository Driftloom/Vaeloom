"""MFA must not be bypassable by a federated assertion.

`sso_token_login` and the SAML callback both called `issue_token` directly, while
only the password path honoured `mfa_required`. A user enrolled in TOTP could
therefore sign in with an SSO/SAML assertion and receive a full token pair
without ever seeing a code prompt.

Both handlers now route through `AuthService.issue_login_response`, which is the
single issuance path for every authentication method.
"""
import pytest
from httpx import AsyncClient

from api.models.schema import User
from api.services.auth_service import auth_service

pytestmark = pytest.mark.asyncio


class TestMfaCannotBeBypassed:
    async def _make_user(self, db, email: str, mfa_enabled: bool) -> User:
        user = User(
            email=email,
            display_name="MFA Probe",
            mfa_enabled=mfa_enabled,
            status="ACTIVE",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def test_enrolled_user_gets_a_challenge_not_tokens(self, db_session):
        user = await self._make_user(db_session, "mfa-sso-bypass@test.com", True)

        resp = await auth_service.issue_login_response(db_session, user)

        # No usable credential may exist before the code is verified.
        assert resp.mfa_required is True
        assert resp.access_token == ""
        assert resp.refresh_token == ""
        assert resp.mfa_token

    async def test_non_enrolled_user_receives_tokens(self, db_session):
        user = await self._make_user(db_session, "no-mfa-sso@test.com", False)

        resp = await auth_service.issue_login_response(db_session, user)

        assert resp.mfa_required is False
        assert resp.access_token
        assert resp.refresh_token

    async def test_tenant_policy_can_demand_mfa_for_non_enrolled_user(self, db_session):
        """A tenant-wide MFA policy must apply to federated logins too."""
        import uuid as _uuid

        from api.models.schema import Tenant

        tenant = Tenant(name="MFA Policy Tenant", slug=f"mfa-policy-{_uuid.uuid4().hex[:8]}")
        tenant.settings = {"policies": {"mfa_required": True}}
        db_session.add(tenant)
        await db_session.commit()
        await db_session.refresh(tenant)

        user = await self._make_user(db_session, "policy-sso@test.com", False)
        user.tenant_id = tenant.id
        await db_session.commit()

        resp = await auth_service.issue_login_response(db_session, user)

        assert resp.mfa_required is True
        assert resp.access_token == ""
        assert resp.refresh_token == ""
