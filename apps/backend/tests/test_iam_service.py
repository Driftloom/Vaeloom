import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from backend.schemas.iam import CreateUserRequest, UpdateUserRequest
from backend.services.iam_service import IamService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return IamService()


def make_user_row(user_id=None, email="u@test.com", display_name="User",
                  tenant_id="t-1", active=True, created_at=None,
                  updated_at=None):
    if user_id is None:
        user_id = str(uuid.uuid4())
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    if updated_at is None:
        updated_at = created_at
    return (user_id, email, display_name, tenant_id, active, created_at,
            updated_at)


class TestCreateUser:
    async def test_create_user_with_roles(self, svc):
        get_result = MagicMock()
        get_result.fetchone.return_value = make_user_row(
            email="new@test.com", display_name="New User", tenant_id="t-1",
        )
        roles_result = MagicMock()
        roles_result.fetchall.return_value = [("role-1", "admin"), ("role-2", "viewer")]
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_users WHERE id =" in t:
                return get_result
            if "iam_user_roles ur" in t:
                return roles_result
            return MagicMock()

        db.execute = execute
        dto = CreateUserRequest(
            email="new@test.com", display_name="New User",
            tenant_id="t-1", role_ids=["role-1", "role-2"],
        )
        result = await svc.create_user(dto, db=db)
        assert result["email"] == "new@test.com"
        assert len(result["roles"]) == 2

    async def test_create_user_without_roles(self, svc):
        get_result = MagicMock()
        get_result.fetchone.return_value = make_user_row(
            email="noroles@test.com", display_name="No Roles", tenant_id="t-1",
        )
        roles_result = MagicMock()
        roles_result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_users WHERE id =" in t:
                return get_result
            if "iam_user_roles ur" in t:
                return roles_result
            return MagicMock()

        db.execute = execute
        dto = CreateUserRequest(
            email="noroles@test.com", display_name="No Roles",
            tenant_id="t-1", role_ids=None,
        )
        result = await svc.create_user(dto, db=db)
        assert result["roles"] == []


class TestListUsers:
    async def test_list_users_with_data(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 2
        rows_result = MagicMock()
        rows_result.fetchall.return_value = [
            make_user_row("u1", email="a@test.com"),
            make_user_row("u2", email="b@test.com"),
        ]
        roles_result = MagicMock()
        roles_result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "COUNT(*)" in t:
                return count_result
            if "iam_user_roles ur" in t:
                return roles_result
            return rows_result

        db.execute = execute
        users, total = await svc.list_users(page=1, page_size=10, tenant_id="t-1", db=db)
        assert total == 2
        assert len(users) == 2
        assert users[0]["email"] == "a@test.com"

    async def test_list_users_empty(self, svc):
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        rows_result = MagicMock()
        rows_result.fetchall.return_value = []
        results = [count_result, rows_result]
        db = MagicMock()

        async def execute(sql, params=None):
            return results.pop(0)

        db.execute = execute
        users, total = await svc.list_users(page=1, page_size=10, tenant_id="t-1", db=db)
        assert total == 0
        assert users == []


class TestGetUser:
    async def test_get_user_found(self, svc):
        user_result = MagicMock()
        user_result.fetchone.return_value = make_user_row("u1", email="get@test.com")
        roles_result = MagicMock()
        roles_result.fetchall.return_value = [("r-1", "admin")]
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_user_roles ur" in t:
                return roles_result
            return user_result

        db.execute = execute
        result = await svc.get_user("u1", db=db)
        assert result is not None
        assert result["email"] == "get@test.com"
        assert result["roles"] == [{"id": "r-1", "name": "admin"}]

    async def test_get_user_not_found(self, svc):
        result = MagicMock()
        result.fetchone.return_value = None
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        user = await svc.get_user("nonexistent", db=db)
        assert user is None


class TestUpdateUser:
    async def test_update_all_fields(self, svc):
        calls = [0]
        roles_result = MagicMock()
        roles_result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_user_roles ur" in t:
                return roles_result
            calls[0] += 1
            get_result = MagicMock()
            if calls[0] <= 1:
                get_result.fetchone.return_value = make_user_row("u1", display_name="Old")
            else:
                get_result.fetchone.return_value = make_user_row("u1", display_name="Updated")
            return get_result

        db.execute = execute
        dto = UpdateUserRequest(display_name="Updated", email="new@test.com", active=False)
        result = await svc.update_user("u1", dto, db=db)
        assert result["display_name"] == "Updated"

    async def test_update_no_changes(self, svc):
        get_result = MagicMock()
        get_result.fetchone.return_value = make_user_row("u1")
        roles_result = MagicMock()
        roles_result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_user_roles ur" in t:
                return roles_result
            return get_result

        db.execute = execute
        dto = UpdateUserRequest()
        result = await svc.update_user("u1", dto, db=db)
        assert result is not None

    async def test_update_user_not_found(self, svc):
        result = MagicMock()
        result.fetchone.return_value = None
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        dto = UpdateUserRequest(display_name="X")
        with pytest.raises(HTTPException) as exc:
            await svc.update_user("nonexistent", dto, db=db)
        assert exc.value.status_code == 404


class TestDeactivateUser:
    async def test_deactivate_success(self, svc):
        result = MagicMock()
        result.rowcount = 1
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        await svc.deactivate_user("u1", db=db)

    async def test_deactivate_not_found(self, svc):
        result = MagicMock()
        result.rowcount = 0
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        with pytest.raises(HTTPException) as exc:
            await svc.deactivate_user("nonexistent", db=db)
        assert exc.value.status_code == 404


class TestAssignRoles:
    async def test_assign_roles_success(self, svc):
        get_result = MagicMock()
        get_result.fetchone.return_value = make_user_row("u1")
        roles_result = MagicMock()
        roles_result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            t = sql.text if hasattr(sql, "text") else str(sql)
            if "iam_user_roles ur" in t:
                return roles_result
            return get_result

        db.execute = execute
        await svc.assign_roles("u1", ["r-1", "r-2"], db=db)

    async def test_assign_roles_user_not_found(self, svc):
        result = MagicMock()
        result.fetchone.return_value = None
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        with pytest.raises(HTTPException) as exc:
            await svc.assign_roles("nonexistent", ["r-1"], db=db)
        assert exc.value.status_code == 404


class TestRemoveRole:
    async def test_remove_role_success(self, svc):
        result = MagicMock()
        result.rowcount = 1
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        await svc.remove_role("u1", "r-1", db=db)

    async def test_remove_role_not_found(self, svc):
        result = MagicMock()
        result.rowcount = 0
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        with pytest.raises(HTTPException) as exc:
            await svc.remove_role("u1", "r-1", db=db)
        assert exc.value.status_code == 404


class TestGetPermissions:
    async def test_get_permissions_with_results(self, svc):
        result = MagicMock()
        result.fetchall.return_value = [("read",), ("write",), ("delete",)]
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        perms = await svc.get_permissions("u1", db=db)
        assert perms == ["read", "write", "delete"]

    async def test_get_permissions_empty(self, svc):
        result = MagicMock()
        result.fetchall.return_value = []
        db = MagicMock()

        async def execute(sql, params=None):
            return result

        db.execute = execute
        perms = await svc.get_permissions("u1", db=db)
        assert perms == []
