"""Dual-spelling pagination (pagination-standard, Loop 2).

The documented standard is `limit`/`offset`. Legacy `page`/`page_size` is still
accepted everywhere (the web client sends it in ~48 call sites) and is derived
back from `limit`/`offset` when the standard spelling is used, so responses
keep their existing `{page, page_size}` shape in both cases.

Rule: when `limit` is provided it wins; otherwise `page`/`page_size` apply.
"""

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


def resolve_page_params(
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    limit: int | None = None,
    offset: int | None = None,
    max_size: int = MAX_PAGE_SIZE,
) -> tuple[int, int]:
    """Return (page, page_size) honoring `limit`/`offset` when given."""
    if limit is not None:
        size = min(max(int(limit), 1), max_size)
        start = max(int(offset or 0), 0)
        return start // size + 1, size
    return page, page_size


def limit_offset_description() -> str:
    return (
        "Standard pagination (see pagination-standard). "
        "When `limit` is given it wins and `page`/`page_size` are derived; "
        "otherwise legacy `page`/`page_size` apply."
    )
