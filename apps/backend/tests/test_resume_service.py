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

    def scalars(self):
        return self

    def all(self):
        return self._scalars_data


class TestResumeService:
    @pytest.fixture
    def service(self):
        from backend.services.resume_service import ResumeService
        return ResumeService()

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    def _make_resume(self, **overrides):
        r = MagicMock()
        r.id = overrides.get("id", uuid.uuid4())
        r.workspace_id = overrides.get("workspace_id", uuid.uuid4())
        r.variant_type = overrides.get("variant_type", "master")
        r.content = overrides.get("content", {"key": "val"})
        r.version = overrides.get("version", 1)
        r.generated_from_snapshot = overrides.get("generated_from_snapshot", None)
        return r

    # ── list_for_workspace ───────────────────────────────────────────

    async def test_list_for_workspace_returns_list(self, service, mock_db):
        resumes = [self._make_resume(), self._make_resume()]
        mock_db.execute.return_value = _MockScalarResult(scalars_data=resumes)
        result = await service.list_for_workspace(str(uuid.uuid4()), db=mock_db)
        assert len(result) == 2

    async def test_list_for_workspace_empty(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalars_data=[])
        result = await service.list_for_workspace(str(uuid.uuid4()), db=mock_db)
        assert result == []

    # ── get_master ───────────────────────────────────────────────────

    async def test_get_master_found(self, service, mock_db):
        resume = self._make_resume(variant_type="master")
        mock_db.execute.return_value = _MockScalarResult(scalar=resume)
        result = await service.get_master(str(uuid.uuid4()), db=mock_db)
        assert result is resume

    async def test_get_master_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.get_master(str(uuid.uuid4()), db=mock_db)
        assert result is None

    # ── generate_variant ─────────────────────────────────────────────

    async def test_generate_variant_success(self, service, mock_db):
        base = self._make_resume(version=2)
        mock_db.execute.return_value = _MockScalarResult(scalar=base)
        dto = MagicMock()
        dto.variant_type = "ats"
        result = await service.generate_variant(str(base.id), dto, str(uuid.uuid4()), db=mock_db)
        assert result.workspace_id == base.workspace_id
        assert result.variant_type == "ats"
        assert result.content == base.content
        assert result.version == 3
        assert result.generated_from_snapshot == str(base.id)
        mock_db.add.assert_called_once()
        mock_db.flush.assert_awaited()
        mock_db.refresh.assert_awaited()

    async def test_generate_variant_base_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        dto = MagicMock()
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.generate_variant(str(uuid.uuid4()), dto, str(uuid.uuid4()), db=mock_db)
        assert exc.value.status_code == 404
