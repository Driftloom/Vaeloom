"""Fixtures and helpers for Module 05 integration tests."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from api.config import settings
from api.models.schema import User, Workspace, WorkspaceUser


def make_jwt(user_id: str, email: str = "test@example.com", tenant_id: str | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "user_id": str(user_id),
        "email": email,
        "tenant_id": tenant_id or str(uuid.uuid4()),
        "exp": (now + timedelta(hours=2)).timestamp(),
        "iat": now.timestamp(),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@pytest_asyncio.fixture
async def authenticated_context(db_session):
    """Seed real user and workspace in SQLite, returning an authenticated AsyncClient and IDs."""
    from api.main import app

    user_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    tenant_id = uuid.uuid4()

    user = User(
        id=user_id,
        email=f"user_{user_id.hex[:8]}@vaeloom.test",
        display_name="Integration Test User",
        tenant_id=tenant_id,
        password_hash="mocked_hash_for_test",
        status="ACTIVE",
    )
    workspace = Workspace(
        id=workspace_id,
        user_id=user_id,
        name="Integration Test Workspace",
        description="For Module 05 verification",
    )
    membership = WorkspaceUser(
        id=uuid.uuid4(),
        workspace_id=workspace_id,
        user_id=user_id,
        role="OWNER",
    )

    db_session.add_all([user, workspace, membership])
    await db_session.commit()

    token = make_jwt(str(user_id), user.email, str(tenant_id))

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(tenant_id),
        "X-Workspace-ID": str(workspace_id),
    }

    from tests.conftest import _build_test_app
    test_app = _build_test_app(db_session)
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield {
            "client": client,
            "headers": headers,
            "user_id": str(user_id),
            "workspace_id": str(workspace_id),
            "tenant_id": str(tenant_id),
            "token": token,
            "db": db_session,
        }
