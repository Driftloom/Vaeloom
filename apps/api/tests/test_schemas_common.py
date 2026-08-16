import pytest
from api.schemas.common import PaginationMeta, PaginatedResponse, ApiResponse


class TestPaginationMeta:
    def test_creates_with_all_fields(self):
        meta = PaginationMeta(page=1, page_size=20, total=100, total_pages=5, has_next=True, has_previous=False)
        assert meta.page == 1
        assert meta.page_size == 20
        assert meta.total == 100
        assert meta.total_pages == 5
        assert meta.has_next is True
        assert meta.has_previous is False

    def test_has_next_and_previous_both_true(self):
        meta = PaginationMeta(page=2, page_size=10, total=50, total_pages=5, has_next=True, has_previous=True)
        assert meta.has_next is True
        assert meta.has_previous is True


class TestPaginatedResponse:
    def test_creates_with_data_and_meta(self):
        meta = PaginationMeta(page=1, page_size=10, total=3, total_pages=1, has_next=False, has_previous=False)
        resp = PaginatedResponse(data=[{"id": 1}, {"id": 2}, {"id": 3}], meta=meta)
        assert len(resp.data) == 3
        assert resp.meta.total == 3

    def test_empty_data(self):
        meta = PaginationMeta(page=1, page_size=10, total=0, total_pages=0, has_next=False, has_previous=False)
        resp = PaginatedResponse(data=[], meta=meta)
        assert resp.data == []
        assert resp.meta.total == 0


class TestApiResponse:
    def test_defaults(self):
        resp = ApiResponse()
        assert resp.success is True
        assert resp.data is None
        assert resp.error is None
        assert resp.meta is None

    def test_success_with_data(self):
        resp = ApiResponse(success=True, data={"key": "value"})
        assert resp.data["key"] == "value"

    def test_error_response(self):
        resp = ApiResponse(success=False, error={"code": 404, "message": "Not found"})
        assert resp.success is False
        assert resp.error["code"] == 404

    def test_with_meta(self):
        resp = ApiResponse(success=True, data=[], meta={"count": 0})
        assert resp.meta["count"] == 0
