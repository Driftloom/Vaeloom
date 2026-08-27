import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio

# Save original method before conftest's autouse mock_connector_test patches it
from api.services.connector_ext_service import ConnectorExtService
_original_test_connection = ConnectorExtService.test_connection

# The source code references httpx.TimeoutError which doesn't exist in
# the installed httpx version; create an alias for test use.
import httpx
if not hasattr(httpx, 'TimeoutError'):
    httpx.TimeoutError = httpx.TimeoutException


class _MockScalarResult:
    def __init__(self, scalar=None, scalars_data=None):
        self._scalar = scalar
        self._scalars_data = scalars_data or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._scalars_data


def _make_connector(**overrides):
    c = MagicMock()
    c.id = overrides.get("id", uuid.uuid4())
    c.workspace_id = overrides.get("workspace_id", uuid.uuid4())
    c.name = overrides.get("name", "TestConnector")
    c.type = overrides.get("type", "rest")
    c.config = overrides.get("config", {"url": "https://api.example.com"})
    c.status = overrides.get("status", "disconnected")
    c.tenant_id = overrides.get("tenant_id")
    c.last_synced_at = overrides.get("last_synced_at")
    c.token_ref = overrides.get("token_ref")
    return c


class TestConnectorExtService:
    @pytest.fixture
    def service(self):
        from api.services.connector_ext_service import ConnectorExtService
        return ConnectorExtService()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def create_dto(self):
        dto = MagicMock()
        dto.name = "MyConnector"
        dto.type = MagicMock()
        dto.type.value = "rest"
        dto.config = {"url": "https://api.example.com"}
        dto.token_ref = None
        return dto

    # ── create ───────────────────────────────────────────────────────

    async def test_create_with_user_workspace_found(self, service, mock_db, create_dto):
        uid = uuid.uuid4()
        ws = MagicMock()
        ws.id = uuid.uuid4()
        mock_db.execute.return_value = _MockScalarResult(scalar=ws)
        result = await service.create(create_dto, str(uid), None, mock_db)
        assert result.name == "MyConnector"
        assert result.workspace_id == ws.id
        mock_db.commit.assert_awaited()
        mock_db.refresh.assert_awaited()

    async def test_create_with_user_workspace_not_found(self, service, mock_db, create_dto):
        uid = uuid.uuid4()
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.create(create_dto, str(uid), None, mock_db)
        assert result.name == "MyConnector"
        mock_db.commit.assert_awaited()

    async def test_create_without_user(self, service, mock_db, create_dto):
        result = await service.create(create_dto, None, None, mock_db)
        assert result.name == "MyConnector"
        mock_db.commit.assert_awaited()

    async def test_create_with_tenant(self, service, mock_db, create_dto):
        result = await service.create(create_dto, None, str(uuid.uuid4()), mock_db)
        assert result.name == "MyConnector"

    async def test_create_rest_without_url_raises(self, service, mock_db):
        dto = MagicMock()
        dto.name = "BadConnector"
        dto.type = MagicMock()
        dto.type.value = "rest"
        dto.config = {}
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.create(dto, None, None, mock_db)
        assert exc.value.status_code == 400

    # ── _validate_config ────────────────────────────────────────────

    def test_validate_config_rest_no_url(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service._validate_config("rest", {})
        assert exc.value.status_code == 400

    def test_validate_config_graphql_no_url(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service._validate_config("graphql", {})
        assert exc.value.status_code == 400

    def test_validate_config_database_no_connection_string(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service._validate_config("database", {})
        assert exc.value.status_code == 400

    def test_validate_config_file_no_path(self, service):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            service._validate_config("file", {})
        assert exc.value.status_code == 400

    def test_validate_config_rest_valid(self, service):
        service._validate_config("rest", {"url": "https://valid.com"})

    def test_validate_config_graphql_valid(self, service):
        service._validate_config("graphql", {"url": "https://graphql.com"})

    def test_validate_config_database_valid(self, service):
        service._validate_config("database", {"connectionString": "postgres://..."})

    def test_validate_config_file_valid(self, service):
        service._validate_config("file", {"path": "/tmp/file"})

    def test_validate_config_unknown_type(self, service):
        service._validate_config("custom", {})

    # ── list_all ─────────────────────────────────────────────────────

    async def test_list_all_no_filters(self, service, mock_db):
        connectors = [_make_connector(), _make_connector()]
        mock_db.execute.return_value = _MockScalarResult(scalars_data=connectors)
        result = await service.list_all(1, 20, None, None, mock_db)
        assert len(result) == 2

    async def test_list_all_with_type_filter(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalars_data=[])
        result = await service.list_all(1, 20, "rest", None, mock_db)
        assert result == []

    async def test_list_all_with_tenant(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalars_data=[])
        result = await service.list_all(1, 20, None, str(uuid.uuid4()), mock_db)
        assert result == []

    async def test_list_all_with_both_filters(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalars_data=[])
        result = await service.list_all(2, 10, "graphql", str(uuid.uuid4()), mock_db)
        assert result == []

    # ── get ──────────────────────────────────────────────────────────

    async def test_get_found_no_tenant(self, service, mock_db):
        conn = _make_connector()
        mock_db.execute.return_value = _MockScalarResult(scalar=conn)
        result = await service.get(conn.id, None, mock_db)
        assert result is conn

    async def test_get_found_with_tenant(self, service, mock_db):
        conn = _make_connector(tenant_id=uuid.uuid4())
        mock_db.execute.return_value = _MockScalarResult(scalar=conn)
        result = await service.get(conn.id, str(conn.tenant_id), mock_db)
        assert result is conn

    async def test_get_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.get(uuid.uuid4(), None, mock_db)
        assert exc.value.status_code == 404

    # ── update ───────────────────────────────────────────────────────

    async def test_update_name_and_config(self, service, mock_db):
        conn = _make_connector()
        dto = MagicMock()
        dto.name = "Updated"
        dto.config = {"url": "https://api.example.com/v2"}
        dto.token_ref = None
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.update(conn.id, dto, None, mock_db)
            assert result.name == "Updated"
            assert result.config == {"url": "https://api.example.com/v2"}
            mock_db.commit.assert_awaited()
            mock_db.refresh.assert_awaited()

    async def test_update_rejects_invalid_config(self, service, mock_db):
        """Update path revalidates configs (e.g. rest without url → 400)."""
        from fastapi import HTTPException

        conn = _make_connector()
        dto = MagicMock()
        dto.name = "Updated"
        dto.config = {"new": "config"}  # missing url for rest type
        dto.token_ref = None
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with pytest.raises(HTTPException) as exc:
                await service.update(conn.id, dto, None, mock_db)
            assert exc.value.status_code == 400

    async def test_update_name_only(self, service, mock_db):
        conn = _make_connector()
        dto = MagicMock()
        dto.name = "Renamed"
        dto.config = None
        dto.token_ref = None
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.update(conn.id, dto, None, mock_db)
            assert result.name == "Renamed"

    async def test_update_config_only(self, service, mock_db):
        conn = _make_connector()
        dto = MagicMock()
        dto.name = None
        dto.config = {"url": "https://new.url"}
        dto.token_ref = None
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.update(conn.id, dto, None, mock_db)
            assert result.config == {"url": "https://new.url"}

    async def test_update_no_changes(self, service, mock_db):
        conn = _make_connector()
        dto = MagicMock()
        dto.name = None
        dto.config = None
        dto.token_ref = None
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.update(conn.id, dto, None, mock_db)
            assert result is conn

    # ── remove ───────────────────────────────────────────────────────

    async def test_remove_success(self, service, mock_db):
        conn = _make_connector()
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.remove(conn.id, None, mock_db)
            assert result is True
            mock_db.delete.assert_awaited_once_with(conn)
            mock_db.commit.assert_awaited()

    # ── trigger_sync ─────────────────────────────────────────────────

    async def test_trigger_sync_success(self, service, mock_db):
        conn = _make_connector(status="disconnected")
        now = datetime.now(timezone.utc)
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with patch('api.services.connector_ext_service.datetime') as mock_dt:
                mock_dt.now.return_value = now
                # New sync does authenticated GET for rest connectors — mock it
                with patch('httpx.AsyncClient') as mock_client:
                    inst = AsyncMock()
                    inst.get = AsyncMock(return_value=MagicMock(status_code=200))
                    mock_client.return_value.__aenter__.return_value = inst
                    result = await service.trigger_sync(conn.id, None, mock_db)
                assert result["status"] == "synced"
                assert result["error"] is None
                assert result["synced_at"] == now
                assert conn.last_synced_at == now
                assert conn.status == "synced"
                mock_db.commit.assert_awaited()
                mock_db.refresh.assert_awaited()

    async def test_trigger_sync_exception(self, service, mock_db):
        class _FailConn:
            id = uuid.uuid4()
            status = "disconnected"
            type = "rest"
            config = {"url": "https://api.example.com"}
            token_ref = None
            last_synced_at = property(
                fget=lambda self: None,
                fset=lambda self, v: (_ for _ in ()).throw(Exception("sync fail")),
            )

        conn = _FailConn()
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            # mock httpx for rest sync path before the setter throws (validation passes, then GET then setter)
            with patch('httpx.AsyncClient') as mock_client:
                inst = AsyncMock()
                inst.get = AsyncMock(return_value=MagicMock(status_code=200))
                mock_client.return_value.__aenter__.return_value = inst
                result = await service.trigger_sync(conn.id, None, mock_db)
            assert result["error"] == "sync_failed"

    # ── get_sync_status ─────────────────────────────────────────────

    async def test_get_sync_status(self, service, mock_db):
        conn = _make_connector(status="synced", last_synced_at=datetime.now(timezone.utc))
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.get_sync_status(conn.id, None, mock_db)
            assert result["status"] == "synced"
            assert result["error"] is None
            assert result["connector_id"] == str(conn.id)

    async def test_get_sync_status_disconnected(self, service, mock_db):
        conn = _make_connector(status="disconnected", last_synced_at=None)
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            result = await service.get_sync_status(conn.id, None, mock_db)
            assert result["status"] == "disconnected"
            assert result["synced_at"] is None

    # ── test_connection ──────────────────────────────────────────────
    # The conftest autouse mock_connector_test fixture replaces this
    # method on the class. We saved the original at module load time
    # and use a bound-method wrapper to avoid descriptor issues.

    @staticmethod
    async def _run_real_tc(self, connector_id, tenant_id, db):
        return await _original_test_connection(self, connector_id, tenant_id, db)

    @staticmethod
    def _real_tc_bound(service):
        return TestConnectorExtService._run_real_tc.__get__(service, type(service))

    async def test_test_connection_success(self, service, mock_db):
        conn = _make_connector(config={"url": "https://api.example.com"})
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with patch.object(service, 'test_connection',
                              new=self._real_tc_bound(service)):
                with patch('httpx.AsyncClient') as mock_client:
                    inst = AsyncMock()
                    inst.get = AsyncMock(return_value=MagicMock(status_code=200))
                    mock_client.return_value.__aenter__.return_value = inst
                    result = await service.test_connection(conn.id, None, mock_db)
                    assert result == {"status": "ok", "code": 200}

    async def test_test_connection_timeout(self, service, mock_db):
        conn = _make_connector(config={"url": "https://api.example.com"})
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with patch.object(service, 'test_connection',
                              new=self._real_tc_bound(service)):
                with patch('httpx.AsyncClient') as mock_client:
                    inst = AsyncMock()
                    inst.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
                    mock_client.return_value.__aenter__.return_value = inst
                    from fastapi import HTTPException
                    with pytest.raises(HTTPException) as exc:
                        await service.test_connection(conn.id, None, mock_db)
                    assert exc.value.status_code == 504

    async def test_test_connection_request_error(self, service, mock_db):
        conn = _make_connector(config={"url": "https://api.example.com"})
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with patch.object(service, 'test_connection',
                              new=self._real_tc_bound(service)):
                with patch('httpx.AsyncClient') as mock_client:
                    inst = AsyncMock()
                    inst.get = AsyncMock(side_effect=httpx.RequestError("connection failed", request=MagicMock()))
                    mock_client.return_value.__aenter__.return_value = inst
                    from fastapi import HTTPException
                    with pytest.raises(HTTPException) as exc:
                        await service.test_connection(conn.id, None, mock_db)
                    assert exc.value.status_code == 502

    async def test_test_connection_validate_config_error(self, service, mock_db):
        conn = _make_connector(type="rest", config={})
        with patch.object(service, 'get', new=AsyncMock()) as mock_get:
            mock_get.return_value = conn
            with patch.object(service, 'test_connection',
                              new=self._real_tc_bound(service)):
                from fastapi import HTTPException
                with pytest.raises(HTTPException) as exc:
                    await service.test_connection(conn.id, None, mock_db)
                assert exc.value.status_code == 400
