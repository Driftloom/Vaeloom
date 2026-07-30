import types
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException
from backend.dependencies import get_settings, get_db, get_current_user, get_tenant_id, get_user_id, require_role


class TestGetSettings:
    @pytest.mark.asyncio
    async def test_returns_settings_dict(self):
        result = await get_settings()
        assert isinstance(result, dict)


class TestGetDb:
    @pytest.mark.asyncio
    async def test_yields_session(self):
        gen = get_db()
        session = await gen.__anext__()
        assert session is not None


class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_returns_user_when_set(self):
        request = MagicMock()
        request.state = types.SimpleNamespace(user={"sub": "user-1"})
        result = await get_current_user(request)
        assert result == {"sub": "user-1"}

    @pytest.mark.asyncio
    async def test_returns_none_when_missing(self):
        request = MagicMock()
        request.state = types.SimpleNamespace()
        result = await get_current_user(request)
        assert result is None


class TestGetTenantId:
    @pytest.mark.asyncio
    async def test_returns_tenant_id(self):
        request = MagicMock()
        request.state = types.SimpleNamespace(tenant_id="tenant-abc")
        result = await get_tenant_id(request)
        assert result == "tenant-abc"

    @pytest.mark.asyncio
    async def test_returns_none_when_missing(self):
        request = MagicMock()
        request.state = types.SimpleNamespace()
        result = await get_tenant_id(request)
        assert result is None


class TestGetUserId:
    @pytest.mark.asyncio
    async def test_returns_user_id(self):
        request = MagicMock()
        request.state = types.SimpleNamespace(user_id="user-123")
        result = await get_user_id(request)
        assert result == "user-123"

    @pytest.mark.asyncio
    async def test_returns_none_when_missing(self):
        request = MagicMock()
        request.state = types.SimpleNamespace()
        result = await get_user_id(request)
        assert result is None


class TestRequireRole:
    @pytest.mark.asyncio
    async def test_success_when_user_has_role(self):
        checker = require_role("admin")
        result = await checker(current_user={"roles": ["admin", "user"]})
        assert result == {"roles": ["admin", "user"]}

    @pytest.mark.asyncio
    async def test_success_when_role_in_realm_access(self):
        checker = require_role("admin")
        user = {"realm_access": {"roles": ["admin"]}}
        result = await checker(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_raises_401_when_not_authenticated(self):
        checker = require_role("admin")
        with pytest.raises(HTTPException) as exc:
            await checker(current_user=None)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_raises_403_when_role_missing(self):
        checker = require_role("admin")
        with pytest.raises(HTTPException) as exc:
            await checker(current_user={"roles": ["user"]})
        assert exc.value.status_code == 403
        assert "admin" in exc.value.detail
