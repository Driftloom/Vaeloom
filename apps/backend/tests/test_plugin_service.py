import json
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class _MockMapping:
    """Simulates a RowMapping returned by .mappings().first() / .mappings().all()."""

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
    """Simulates the return of db.execute(text(...))."""

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


class TestPluginService:
    @pytest.fixture
    def service(self):
        from backend.services.plugin_service import PluginService
        return PluginService()

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        return db

    # ── _fix_json_fields ──────────────────────────────────────────────────

    def test_fix_json_fields_none(self, service):
        assert service._fix_json_fields(None) is None

    def test_fix_json_fields_converts_strings_to_dicts(self, service):
        row = {
            "permissions": '{"read": true}',
            "config_schema": '{"type": "object"}',
            "tags": '["tag1", "tag2"]',
            "output": '{"result": "ok"}',
            "capabilities": '["cap1"]',
            "hooks": '["hook1"]',
            "name": "test",
        }
        result = service._fix_json_fields(row)
        assert result["permissions"] == {"read": True}
        assert result["config_schema"] == {"type": "object"}
        assert result["tags"] == ["tag1", "tag2"]
        assert result["output"] == {"result": "ok"}
        assert result["name"] == "test"

    def test_fix_json_fields_handles_decode_errors(self, service):
        row = {"permissions": "{invalid json}", "name": "test"}
        result = service._fix_json_fields(row)
        assert result["permissions"] == "{invalid json}"

    def test_fix_json_fields_handles_none_values(self, service):
        row = {"permissions": None, "name": "test"}
        result = service._fix_json_fields(row)
        assert result["permissions"] is None

    # ── register ──────────────────────────────────────────────────────────

    async def test_register_inserts_and_returns_row(self, service, mock_db):
        dto = MagicMock()
        dto.name = "MyPlugin"
        dto.version = "1.0.0"
        dto.author = "Test"
        dto.description = "A plugin"
        dto.license = "MIT"
        dto.min_app_version = "1.0.0"
        dto.permissions = MagicMock()
        dto.permissions.model_dump.return_value = {"read": True}
        dto.tags = ["tool", "utility"]
        dto.capabilities = ["calc"]
        dto.hooks = ["startup"]
        dto.entry_point = "main.py"
        dto.homepage = "https://example.com"
        dto.repository = "https://github.com/example"
        dto.icon = "icon.png"
        dto.config_schema = {"type": "object"}
        dto.code = "print('hello')"

        row = _MockMapping(
            id=str(uuid.uuid4()), name="MyPlugin", version="1.0.0",
            author="Test", description="A plugin", license="MIT",
            status="REGISTERED", permissions='{"read": true}',
            capabilities=["calc"], hooks=["startup"], tags=["tool", "utility"],
            entry_point="main.py", tenant_id="tenant-1",
            homepage="https://example.com", repository="https://github.com/example",
            icon="icon.png", config_schema='{"type": "object"}', code="print('hello')",
            min_app_version="1.0.0",
            created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        )

        def side_effect(stmt, params):
            result = MagicMock()
            result.mappings.return_value.first.return_value = row
            return result

        mock_db.execute = AsyncMock(side_effect=side_effect)

        result = await service.register(dto, "tenant-1", mock_db)
        assert result["name"] == "MyPlugin"
        assert result["status"] == "REGISTERED"
        assert result["permissions"] == {"read": True}

    # ── list_plugins ──────────────────────────────────────────────────────

    async def test_list_plugins_no_filters(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                           description="D", license="MIT", status="REGISTERED",
                           permissions="{}", capabilities=[], hooks=[], tags=[],
                           entry_point="main.py", tenant_id=None,
                           homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=1),
            _MockExecResult(all_rows=[row]),
        ])

        plugins, total = await service.list_plugins(1, 20, None, None, None, None, mock_db)
        assert total == 1
        assert len(plugins) == 1
        assert plugins[0]["name"] == "P1"

    async def test_list_plugins_with_status_filter(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=0),
            _MockExecResult(all_rows=[]),
        ])

        plugins, total = await service.list_plugins(1, 20, "REGISTERED", None, None, None, mock_db)
        assert total == 0
        assert plugins == []

    async def test_list_plugins_with_tags(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=0),
            _MockExecResult(all_rows=[]),
        ])

        plugins, total = await service.list_plugins(1, 20, None, ["tool"], None, None, mock_db)
        assert total == 0

    async def test_list_plugins_with_search(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=0),
            _MockExecResult(all_rows=[]),
        ])

        plugins, total = await service.list_plugins(1, 20, None, None, "test", None, mock_db)
        assert total == 0

    async def test_list_plugins_with_pagination(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=5),
            _MockExecResult(all_rows=[]),
        ])

        plugins, total = await service.list_plugins(2, 10, None, None, None, None, mock_db)
        assert total == 5

    # ── get_plugin ────────────────────────────────────────────────────────

    async def test_get_plugin_found(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                           description="D", license="MIT", status="REGISTERED",
                           permissions="{}", capabilities=[], hooks=[], tags=[],
                           entry_point="main.py", tenant_id=None,
                           homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_plugin(uuid.uuid4(), mock_db)
        assert result["name"] == "P1"

    async def test_get_plugin_not_found(self, service, mock_db):
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = None
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_plugin(uuid.uuid4(), mock_db)
        assert result is None

    # ── update_plugin ─────────────────────────────────────────────────────

    async def test_update_plugin_specific_fields(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="2.0.0", author="A",
                           description="Updated desc", license="MIT",
                           status="REGISTERED", permissions="{}", capabilities=[],
                           hooks=[], tags=[], entry_point="main.py",
                           tenant_id=None, homepage=None, repository=None,
                           icon=None, config_schema=None, code=None,
                           min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.version = "2.0.0"
        dto.description = "Updated desc"
        dto.entry_point = None
        dto.permissions = None
        dto.capabilities = None
        dto.hooks = None
        dto.tags = None
        dto.status = None

        result = await service.update_plugin(uuid.uuid4(), dto, mock_db)
        assert result["version"] == "2.0.0"
        assert result["description"] == "Updated desc"

    async def test_update_plugin_empty_update_returns_current(self, service, mock_db):
        row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                           description="D", license="MIT", status="REGISTERED",
                           permissions="{}", capabilities=[], hooks=[], tags=[],
                           entry_point="main.py", tenant_id=None,
                           homepage=None, repository=None, icon=None,
                           config_schema=None, code=None, min_app_version="1.0",
                           created_at=datetime.now(timezone.utc),
                           updated_at=datetime.now(timezone.utc))

        call_count = 0

        def side_effect(stmt, params):
            nonlocal call_count
            call_count += 1
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.version = None
        dto.description = None
        dto.entry_point = None
        dto.permissions = None
        dto.capabilities = None
        dto.hooks = None
        dto.tags = None
        dto.status = None

        result = await service.update_plugin(uuid.uuid4(), dto, mock_db)
        assert result["name"] == "P1"

    # ── delete_plugin ─────────────────────────────────────────────────────

    async def test_delete_plugin_returns_true(self, service, mock_db):
        mock_result = AsyncMock()
        mock_result.rowcount = 1
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.delete_plugin(uuid.uuid4(), mock_db)
        assert result is True

    async def test_delete_plugin_returns_false(self, service, mock_db):
        mock_result = AsyncMock()
        mock_result.rowcount = 0
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.delete_plugin(uuid.uuid4(), mock_db)
        assert result is False

    # ── get_permissions ───────────────────────────────────────────────────

    async def test_get_permissions_returns_parsed(self, service, mock_db):
        row = _MockMapping(permissions='{"read": true, "write": false}')

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.get_permissions(uuid.uuid4(), mock_db)
        assert result == {"read": True, "write": False}

    # ── execute ───────────────────────────────────────────────────────────

    async def test_execute_success_with_code_result_variable(self, service, mock_db):
        plugin_row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                                   description="D", license="MIT", status="REGISTERED",
                                   permissions='{}', capabilities=[], hooks=[], tags=[],
                                   entry_point="main.py", tenant_id="t1",
                                   homepage=None, repository=None, icon=None,
                                   config_schema=None, code=None, min_app_version="1.0",
                                   created_at=datetime.now(timezone.utc),
                                   updated_at=datetime.now(timezone.utc))

        exec_row = _MockMapping(id=str(uuid.uuid4()), plugin_id="p1", status="completed",
                                 duration_ms=1, output='{"result": 42}',
                                 error_message=None, created_at=datetime.now(timezone.utc))

        call_index = 0

        def side_effect(stmt, params):
            nonlocal call_index
            call_index += 1
            r = MagicMock()
            if call_index == 1:
                r.mappings.return_value.first.return_value = plugin_row
            else:
                r.mappings.return_value.first.return_value = exec_row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.code = "result = 42"
        dto.input = {"x": 1}
        dto.timeout_ms = 5000

        result = await service.execute(uuid.uuid4(), dto, mock_db)
        assert result["status"] == "completed"

    async def test_execute_success_with_run_function(self, service, mock_db):
        plugin_row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                                   description="D", license="MIT", status="REGISTERED",
                                   permissions='{}', capabilities=[], hooks=[], tags=[],
                                   entry_point="main.py", tenant_id="t1",
                                   homepage=None, repository=None, icon=None,
                                   config_schema=None, code=None, min_app_version="1.0",
                                   created_at=datetime.now(timezone.utc),
                                   updated_at=datetime.now(timezone.utc))

        exec_row = _MockMapping(id=str(uuid.uuid4()), plugin_id="p1", status="completed",
                                 duration_ms=1, output='{"result": "run_ok"}',
                                 error_message=None, created_at=datetime.now(timezone.utc))

        call_index = 0

        def side_effect(stmt, params):
            nonlocal call_index
            call_index += 1
            r = MagicMock()
            if call_index == 1:
                r.mappings.return_value.first.return_value = plugin_row
            else:
                r.mappings.return_value.first.return_value = exec_row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.code = "def run():\n    return 'run_ok'"
        dto.input = {}
        dto.timeout_ms = 5000

        result = await service.execute(uuid.uuid4(), dto, mock_db)
        assert result["status"] == "completed"

    async def test_execute_no_code_raises_400(self, service, mock_db):
        plugin_row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                                   description="D", license="MIT", status="REGISTERED",
                                   permissions='{}', capabilities=[], hooks=[], tags=[],
                                   entry_point="main.py", tenant_id="t1",
                                   homepage=None, repository=None, icon=None,
                                   config_schema=None, code=None, min_app_version="1.0",
                                   created_at=datetime.now(timezone.utc),
                                   updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = plugin_row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.code = None
        dto.input = {}

        with pytest.raises(HTTPException) as exc:
            await service.execute(uuid.uuid4(), dto, mock_db)
        assert exc.value.status_code == 400

    async def test_execute_disabled_plugin_raises_403(self, service, mock_db):
        plugin_row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                                   description="D", license="MIT", status="DISABLED",
                                   permissions='{}', capabilities=[], hooks=[], tags=[],
                                   entry_point="main.py", tenant_id="t1",
                                   homepage=None, repository=None, icon=None,
                                   config_schema=None, code=None, min_app_version="1.0",
                                   created_at=datetime.now(timezone.utc),
                                   updated_at=datetime.now(timezone.utc))

        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = plugin_row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await service.execute(uuid.uuid4(), dto, mock_db)
        assert exc.value.status_code == 403

    async def test_execute_plugin_not_found_raises_404(self, service, mock_db):
        def side_effect(stmt, params):
            r = MagicMock()
            r.mappings.return_value.first.return_value = None
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()

        with pytest.raises(HTTPException) as exc:
            await service.execute(uuid.uuid4(), dto, mock_db)
        assert exc.value.status_code == 404

    async def test_execute_code_raises_exception(self, service, mock_db):
        plugin_row = _MockMapping(id="p1", name="P1", version="1.0", author="A",
                                   description="D", license="MIT", status="REGISTERED",
                                   permissions='{}', capabilities=[], hooks=[], tags=[],
                                   entry_point="main.py", tenant_id="t1",
                                   homepage=None, repository=None, icon=None,
                                   config_schema=None, code=None, min_app_version="1.0",
                                   created_at=datetime.now(timezone.utc),
                                   updated_at=datetime.now(timezone.utc))

        exec_row = _MockMapping(id=str(uuid.uuid4()), plugin_id="p1", status="failed",
                                 duration_ms=1, output=None,
                                 error_message="ValueError: intentional error",
                                 created_at=datetime.now(timezone.utc))

        call_index = 0

        def side_effect(stmt, params):
            nonlocal call_index
            call_index += 1
            r = MagicMock()
            if call_index == 1:
                r.mappings.return_value.first.return_value = plugin_row
            else:
                r.mappings.return_value.first.return_value = exec_row
            return r

        mock_db.execute = AsyncMock(side_effect=side_effect)

        dto = MagicMock()
        dto.code = "raise ValueError('intentional error')"
        dto.input = {}
        dto.timeout_ms = 5000

        result = await service.execute(uuid.uuid4(), dto, mock_db)
        assert result["status"] == "failed"

    # ── list_executions ───────────────────────────────────────────────────

    async def test_list_executions_paginated(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockExecResult(scalar=3),
            _MockExecResult(all_rows=[
                _MockMapping(id="e1", plugin_id="p1", status="completed",
                             duration_ms=10, output="{}", error_message=None,
                             created_at=datetime.now(timezone.utc)),
            ]),
        ])

        rows, total = await service.list_executions(uuid.uuid4(), 1, 10, mock_db)
        assert total == 3
        assert len(rows) == 1
