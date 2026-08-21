from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


class PaginatedResponse(BaseModel):
    data: list[Any]
    meta: PaginationMeta


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: dict | None = None
    meta: dict[str, Any] | None = None
