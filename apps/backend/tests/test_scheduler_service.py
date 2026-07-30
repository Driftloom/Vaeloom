import uuid
from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi import HTTPException

pytestmark = pytest.mark.asyncio


class TestSchedulerService:
    @pytest.fixture
    def service(self):
        from backend.services.scheduler_service import SchedulerService
        return SchedulerService()

    def _make_mapping(self, **kwargs):
        class MappingRow(dict):
            def __getitem__(self, k):
                return self.get(k)
            def get(self, k, d=None):
                return super().get(k, d)
        return MappingRow(kwargs)

    def _make_db(self, first_val=None, all_val=None):
        db = AsyncMock()
        mapping_result = MagicMock()
        mapping_result.first.return_value = first_val
        if all_val is not None:
            mapping_result.all.return_value = all_val
        exec_result = MagicMock()
        exec_result.mappings.return_value = mapping_result
        db.execute = AsyncMock(return_value=exec_result)
        db.commit = AsyncMock()
        return db

    async def test_fix_json_fields_none(self):
        from backend.services.scheduler_service import SchedulerService
        assert SchedulerService._fix_json_fields(None) is None

    async def test_create_job(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active", tenant_id="t1",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = self._make_db(first_val=result_map)

        dto = MagicMock()
        dto.name = "test"
        dto.type.value = "http"
        dto.cron = "* * * * *"
        dto.method = "GET"
        dto.url = "https://example.com"
        dto.event = None
        dto.payload = {}
        dto.headers = {}

        result = await service.create_job(dto, tenant_id="t1", db=db)
        assert result["name"] == "test"
        assert result["status"] == "active"

    async def test_list_jobs(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload='{"key":"val"}', headers='{}', status="active", tenant_id="t1",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = self._make_db(all_val=[result_map])

        result = await service.list_jobs(page=1, page_size=20, type_filter=None, status_filter=None, name_search=None, tenant_id="t1", db=db)
        assert len(result) == 1
        assert result[0]["payload"] == {"key": "val"}

    async def test_list_jobs_with_filters(self, service):
        db = self._make_db(all_val=[])
        result = await service.list_jobs(page=1, page_size=20, type_filter="http", status_filter="active", name_search="test", tenant_id="t1", db=db)
        assert result == []

    async def test_get_job_found(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = self._make_db(first_val=result_map)
        result = await service.get_job(uuid.uuid4(), db=db)
        assert result["name"] == "test"

    async def test_get_job_not_found(self, service):
        db = self._make_db(first_val=None)
        with pytest.raises(HTTPException) as exc:
            await service.get_job(uuid.uuid4(), db=db)
        assert exc.value.status_code == 404

    async def test_update_job(self, service):
        jid = str(uuid.uuid4())
        result_map = self._make_mapping(
            id=jid, name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        updated_map = self._make_mapping(
            id=jid, name="updated", type="http", cron="0 * * * *",
            method="POST", url="https://example2.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        first_call = MagicMock()
        first_call.first.return_value = result_map
        second_call = MagicMock()
        second_call.first.return_value = updated_map
        db.execute = AsyncMock(side_effect=[
            MagicMock(mappings=MagicMock(return_value=first_call)),
            MagicMock(),
            MagicMock(mappings=MagicMock(return_value=second_call)),
        ])
        db.commit = AsyncMock()
        dto = MagicMock()
        dto.name = "updated"
        dto.cron = "0 * * * *"
        dto.method = "POST"
        dto.url = "https://example2.com"
        dto.event = None
        dto.payload = {}
        dto.headers = {}
        result = await service.update_job(uuid.uuid4(), dto, db=db)
        assert result["name"] == "updated"

    async def test_update_job_no_fields_raises_400(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        my_map = MagicMock()
        my_map.first.return_value = result_map
        db.execute = AsyncMock(return_value=MagicMock(mappings=MagicMock(return_value=my_map)))
        dto = MagicMock()
        dto.name = None
        dto.cron = None
        dto.method = None
        dto.url = None
        dto.event = None
        dto.payload = None
        dto.headers = None
        with pytest.raises(HTTPException) as exc:
            await service.update_job(uuid.uuid4(), dto, db=db)
        assert exc.value.status_code == 400

    async def test_pause_job(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="paused",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        my_map = MagicMock()
        my_map.first.return_value = result_map
        db.execute = AsyncMock(return_value=MagicMock(mappings=MagicMock(return_value=my_map)))
        db.commit = AsyncMock()
        result = await service.pause_job(uuid.uuid4(), db=db)
        assert result["status"] == "paused"

    async def test_resume_job(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        my_map = MagicMock()
        my_map.first.return_value = result_map
        db.execute = AsyncMock(return_value=MagicMock(mappings=MagicMock(return_value=my_map)))
        db.commit = AsyncMock()
        result = await service.resume_job(uuid.uuid4(), db=db)
        assert result["status"] == "active"

    async def test_trigger_job(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        my_map = MagicMock()
        my_map.first.return_value = result_map
        db.execute = AsyncMock(return_value=MagicMock(mappings=MagicMock(return_value=my_map)))
        db.commit = AsyncMock()
        jid = uuid.uuid4()
        result = await service.trigger_job(jid, db=db)
        assert result["triggered"] is True
        assert result["job_id"] == str(jid)

    async def test_delete_job(self, service):
        result_map = self._make_mapping(
            id=str(uuid.uuid4()), name="test", type="http", cron="* * * * *",
            method="GET", url="https://example.com", event=None,
            payload={}, headers={}, status="active",
            created_at=None, updated_at=None, last_run_at=None, next_run_at=None,
        )
        db = AsyncMock()
        my_map = MagicMock()
        my_map.first.return_value = result_map
        db.execute = AsyncMock(return_value=MagicMock(mappings=MagicMock(return_value=my_map)))
        db.commit = AsyncMock()
        result = await service.delete_job(uuid.uuid4(), db=db)
        assert result is True

    async def test_fix_json_fields_with_string_payload(self, service):
        from backend.services.scheduler_service import SchedulerService
        row = self._make_mapping(
            id="1", name="t", payload='{"key":"val"}', headers='bad{json',
            created_at=None,
        )
        result = SchedulerService._fix_json_fields(row)
        assert result["payload"] == {"key": "val"}
        assert result["headers"] == 'bad{json'

    async def test_list_executions(self, service):
        eid = str(uuid.uuid4())
        result_map = self._make_mapping(
            id=eid, job_id=str(uuid.uuid4()), status="completed",
            created_at=None,
        )
        first_call = MagicMock()
        first_call.first.return_value = result_map
        second_call = MagicMock()
        second_call.all.return_value = [result_map]
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[
            MagicMock(mappings=MagicMock(return_value=first_call)),
            MagicMock(mappings=MagicMock(return_value=second_call)),
        ])
        db.commit = AsyncMock()
        result = await service.list_executions(uuid.uuid4(), db=db)
        assert len(result) == 1
