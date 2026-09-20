import pytest
from httpx import AsyncClient
from sqlalchemy import text, select
from api.models.schema import User


@pytest.mark.asyncio
async def test_signup_rejects_false_terms_accepted(client: AsyncClient):
    """Zero-Trust Gate: Signing up with terms_accepted=False must fail with 422."""
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "refuse_terms@example.com",
            "password": "Password123!Secure",
            "terms_accepted": False,
        },
    )
    assert res.status_code == 422
    errors = res.json()["detail"]
    assert any("Terms of Service and Privacy Policy" in str(err) for err in errors)


@pytest.mark.asyncio
async def test_signup_persists_affirmative_consent(client: AsyncClient, db_session):
    """Zero-Trust Gate: Signing up with terms_accepted=True records affirmative consent in user & consent_records."""
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": "affirmative_consent@example.com",
            "password": "Password123!Secure",
            "display_name": "Consent User",
            "terms_accepted": True,
        },
    )
    assert res.status_code == 201
    data = res.json()
    user_id = data["user"]["id"]

    # 1. Verify User model has consent_version and consent_granted_at
    user_res = await db_session.execute(select(User).where(User.email == "affirmative_consent@example.com"))
    user = user_res.scalar_one_or_none()
    assert user is not None
    assert user.consent_version == "2026-v1"
    assert user.consent_granted_at is not None

    # 2. Verify consent_records has audited row
    consent_query = await db_session.execute(
        text("SELECT scope, granted_at FROM consent_records WHERE user_id = :uid"),
        {"uid": str(user.id)},
    )
    row = consent_query.fetchone()
    assert row is not None
    assert row[0] == "terms_and_privacy"
    assert row[1] is not None
