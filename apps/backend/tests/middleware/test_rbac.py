import pytest
from fastapi import FastAPI, Depends, HTTPException
from httpx import AsyncClient, ASGITransport

from backend.middleware.rbac import (
    require_role,
    require_permission,
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS,
)


class TestRBACConfig:
    def test_role_hierarchy_order(self):
        assert ROLE_HIERARCHY["viewer"] < ROLE_HIERARCHY["editor"]
        assert ROLE_HIERARCHY["editor"] < ROLE_HIERARCHY["admin"]

    def test_viewer_permissions(self):
        perms = ROLE_PERMISSIONS["viewer"]
        assert "workspace:read" in perms
        assert "workspace:write" not in perms

    def test_editor_permissions(self):
        perms = ROLE_PERMISSIONS["editor"]
        assert "workspace:read" in perms
        assert "workspace:write" in perms
        assert "workspace:delete" not in perms

    def test_admin_permissions(self):
        perms = ROLE_PERMISSIONS["admin"]
        assert "workspace:read" in perms
        assert "workspace:write" in perms
        assert "workspace:delete" in perms
        assert "workspace:manage_members" in perms
        assert "workspace:manage_billing" in perms


@pytest.mark.asyncio
class TestRequireRole:
    def _build_app(self, user_roles: list[str] | None = None):
        from backend.dependencies import get_current_user

        app = FastAPI()

        async def fake_current_user():
            if user_roles is None:
                return None
            return {"sub": "user-1", "email": "test@test.com", "roles": user_roles}

        app.dependency_overrides[get_current_user] = fake_current_user

        @app.get("/admin")
        async def admin_endpoint(_=Depends(require_role("admin"))):
            return {"ok": True}

        @app.get("/editor")
        async def editor_endpoint(_=Depends(require_role("editor"))):
            return {"ok": True}

        @app.get("/viewer")
        async def viewer_endpoint(_=Depends(require_role("viewer"))):
            return {"ok": True}

        return app

    async def test_admin_can_access_admin_route(self):
        app = self._build_app(user_roles=["admin"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin")
            assert res.status_code == 200

    async def test_admin_can_access_editor_route(self):
        app = self._build_app(user_roles=["admin"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/editor")
            assert res.status_code == 200

    async def test_editor_cannot_access_admin_route(self):
        app = self._build_app(user_roles=["editor"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin")
            assert res.status_code == 403
            assert "Requires role: admin" in res.json()["detail"]

    async def test_viewer_cannot_access_editor_route(self):
        app = self._build_app(user_roles=["viewer"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/editor")
            assert res.status_code == 403
            assert "Requires role: editor" in res.json()["detail"]

    async def test_unauthenticated_returns_401(self):
        app = self._build_app(user_roles=None)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/viewer")
            assert res.status_code == 401
            assert "Not authenticated" in res.json()["detail"]

    async def test_realm_access_roles(self):
        from backend.dependencies import get_current_user

        app = FastAPI()

        async def fake_current_user():
            return {
                "sub": "user-1",
                "email": "test@test.com",
                "realm_access": {"roles": ["admin"]},
            }

        app.dependency_overrides[get_current_user] = fake_current_user

        @app.get("/admin")
        async def admin_endpoint(_=Depends(require_role("admin"))):
            return {"ok": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/admin")
            assert res.status_code == 200


@pytest.mark.asyncio
class TestRequirePermission:
    def _build_app(self, user_roles: list[str] | None = None):
        from backend.dependencies import get_current_user

        app = FastAPI()

        async def fake_current_user():
            if user_roles is None:
                return None
            return {"sub": "user-1", "email": "test@test.com", "roles": user_roles}

        app.dependency_overrides[get_current_user] = fake_current_user

        @app.get("/read")
        async def read_endpoint(_=Depends(require_permission("workspace:read"))):
            return {"ok": True}

        @app.get("/delete")
        async def delete_endpoint(_=Depends(require_permission("workspace:delete"))):
            return {"ok": True}

        @app.get("/billing")
        async def billing_endpoint(_=Depends(require_permission("workspace:manage_billing"))):
            return {"ok": True}

        return app

    async def test_admin_has_all_permissions(self):
        app = self._build_app(user_roles=["admin"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.get("/read")).status_code == 200
            assert (await ac.get("/delete")).status_code == 200
            assert (await ac.get("/billing")).status_code == 200

    async def test_viewer_only_read_permission(self):
        app = self._build_app(user_roles=["viewer"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.get("/read")).status_code == 200
            assert (await ac.get("/delete")).status_code == 403
            assert (await ac.get("/billing")).status_code == 403

    async def test_editor_read_write_no_delete(self):
        app = self._build_app(user_roles=["editor"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            assert (await ac.get("/read")).status_code == 200
            assert (await ac.get("/delete")).status_code == 403
            assert (await ac.get("/billing")).status_code == 403

    async def test_unauthenticated_returns_401(self):
        app = self._build_app(user_roles=None)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/read")
            assert res.status_code == 401

    async def test_no_matching_permission(self):
        app = self._build_app(user_roles=["editor"])

        @app.get("/unknown")
        async def unknown_endpoint(_=Depends(require_permission("workspace:nonexistent"))):
            return {"ok": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/unknown")
            assert res.status_code == 403
            assert "Requires permission" in res.json()["detail"]

    async def test_unknown_role_has_no_permissions(self):
        app = self._build_app(user_roles=["superuser"])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            res = await ac.get("/read")
            assert res.status_code == 403
