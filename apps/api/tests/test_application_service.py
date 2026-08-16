import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

pytestmark = pytest.mark.asyncio


class _MockScalarResult:
    def __init__(self, scalar=None, scalars_data=None):
        self._scalar = scalar
        self._scalars_data = scalars_data or []

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar or 0

    def scalars(self):
        return self

    def all(self):
        return self._scalars_data


def _make_application(**overrides):
    a = MagicMock()
    a.id = overrides.get("id", uuid.uuid4())
    a.workspace_id = overrides.get("workspace_id", uuid.uuid4())
    a.job_external_id = overrides.get("job_external_id", "ext-1")
    a.platform = overrides.get("platform", "linkedin")
    a.status = overrides.get("status", "DRAFT")
    a.metadata_ = overrides.get("metadata_", {})
    a.outcome_at = overrides.get("outcome_at", None)
    return a


class TestApplicationService:
    @pytest.fixture
    def service(self):
        from api.services.application_service import ApplicationService
        return ApplicationService()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def create_dto(self):
        dto = MagicMock()
        dto.job_external_id = "ext-42"
        dto.platform = "indeed"
        dto.status = "DRAFT"
        dto.metadata = {"source": "test"}
        return dto

    # ── find_all ────────────────────────────────────────────────────

    async def test_find_all_with_data(self, service, mock_db):
        apps = [_make_application(), _make_application()]
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalars_data=apps),
            _MockScalarResult(scalar=2),
        ])
        result, total = await service.find_all(str(uuid.uuid4()), db=mock_db)
        assert len(result) == 2
        assert total == 2

    async def test_find_all_empty(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalars_data=[]),
            _MockScalarResult(scalar=0),
        ])
        result, total = await service.find_all(str(uuid.uuid4()), db=mock_db)
        assert result == []
        assert total == 0

    async def test_find_all_page_2(self, service, mock_db):
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalars_data=[]),
            _MockScalarResult(scalar=1),
        ])
        result, total = await service.find_all(str(uuid.uuid4()), db=mock_db, page=2, page_size=10)
        assert total == 1

    # ── find_one ─────────────────────────────────────────────────────

    async def test_find_one_found(self, service, mock_db):
        app = _make_application()
        mock_db.execute.return_value = _MockScalarResult(scalar=app)
        result = await service.find_one(str(app.workspace_id), str(app.id), db=mock_db)
        assert result is app

    async def test_find_one_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.find_one(str(uuid.uuid4()), str(uuid.uuid4()), db=mock_db)
        assert result is None

    # ── create ───────────────────────────────────────────────────────

    async def test_create_success(self, service, mock_db, create_dto):
        result = await service.create(str(uuid.uuid4()), create_dto, db=mock_db)
        assert result.job_external_id == "ext-42"
        assert result.platform == "indeed"
        assert result.status == "DRAFT"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited()
        mock_db.refresh.assert_awaited()

    # ── update_outcome ───────────────────────────────────────────────

    async def test_update_outcome_found(self, service, mock_db):
        app = _make_application(status="DRAFT")
        mock_db.execute.return_value = _MockScalarResult(scalar=app)
        result = await service.update_outcome(str(app.workspace_id), str(app.id), "ACCEPTED", db=mock_db)
        assert result is app
        assert app.status == "ACCEPTED"
        assert app.outcome_at is not None
        mock_db.flush.assert_awaited()
        mock_db.refresh.assert_awaited()

    async def test_update_outcome_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.update_outcome(str(uuid.uuid4()), str(uuid.uuid4()), "REJECTED", db=mock_db)
        assert result is None
