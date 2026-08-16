import json
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class _MockMapping:
    def __init__(self, **kwargs):
        self._mapping = kwargs
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __getitem__(self, key):
        return self._mapping[key]

    def get(self, key, default=None):
        return self._mapping.get(key, default)

    def __contains__(self, key):
        return key in self._mapping

    def items(self):
        return self._mapping.items()

    def keys(self):
        return self._mapping.keys()


class _MockExecResult:
    def __init__(self, first_row=None, all_rows=None, scalar=None, rowcount=0):
        self._first = first_row
        self._all = all_rows or []
        self._scalar = scalar
        self.rowcount = rowcount

    def mappings(self):
        return self

    def first(self):
        return self._first

    def all(self):
        return self._all

    def scalar_one(self):
        if self._scalar is not None:
            return self._scalar
        return len(self._all)

    def fetchone(self):
        return self._first

    def fetchall(self):
        return self._all


class TestPluginServiceExtended:
    @pytest.fixture
    def service(self):
        from api.services.plugin_service import PluginService
        return PluginService()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    # ── list_plugins with tenant_id (covers lines 68-69) ─────────────────

    async def test_list_plugins_with_tenant_id(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                           description="D", license="MIT", status="REGISTERED",
                           permissions="{}", capabilities=[], hooks=[], tags=[],
                           entry_point="main.py", tenant_id="tenant-1",
                           homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=1),
            _MockExecResult(all_rows=[row]),
        ])
        plugins, total = await service.list_plugins(1, 20, None, None, None, "tenant-1", mock_db)
        assert total == 1
        assert plugins[0]["tenant_id"] == "tenant-1"

    # ── update_plugin — all fields (covers lines 126-143) ────────────────

    async def test_update_plugin_all_fields(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="2.0.0", author="A",
                           description="Updated", license="MIT", status="ACTIVE",
                           permissions='{"read": true}', capabilities=["cap1"],
                           hooks=["hook1"], tags=["tag1"], entry_point="new_main.py",
                           tenant_id=None, homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.version = None
        dto.description = None
        dto.entry_point = "new_main.py"
        dto.permissions = MagicMock()
        dto.permissions.model_dump.return_value = {"read": True}
        dto.capabilities = ["cap1"]
        dto.hooks = ["hook1"]
        dto.tags = ["tag1"]
        dto.status = "ACTIVE"

        result = await service.update_plugin(uuid.uuid4(), dto, mock_db)
        assert result["status"] == "ACTIVE"
        assert result["entry_point"] == "new_main.py"
        assert result["permissions"] == {"read": True}

    async def test_update_plugin_permissions_dict(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                           description="D", license="MIT", status="REGISTERED",
                           permissions='{"write": false}', capabilities=[],
                           hooks=[], tags=[], entry_point="main.py",
                           tenant_id=None, homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.version = None
        dto.description = None
        dto.entry_point = None
        dto.permissions = {"write": False}  # plain dict, no model_dump
        dto.capabilities = None
        dto.hooks = None
        dto.tags = None
        dto.status = None

        result = await service.update_plugin(uuid.uuid4(), dto, mock_db)
        assert result["permissions"] == {"write": False}

    # ── get_permissions — edge cases (covers lines 178-180) ──────────────

    async def test_get_permissions_already_dict(self, service, mock_db):
        row = _MockMapping(permissions={"read": True})
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r
        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_permissions(uuid.uuid4(), mock_db)
        assert result == {"read": True}

    async def test_get_permissions_decode_error(self, service, mock_db):
        row = _MockMapping(permissions="{invalid}")
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r
        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_permissions(uuid.uuid4(), mock_db)
        assert result == "{invalid}"

    async def test_get_permissions_none(self, service, mock_db):
        row = _MockMapping(permissions=None)
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r
        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_permissions(uuid.uuid4(), mock_db)
        assert result is None

    async def test_get_permissions_row_none(self, service, mock_db):
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = None
            return r
        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_permissions(uuid.uuid4(), mock_db)
        assert result is None
