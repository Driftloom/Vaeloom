from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_tenant_id
from ..schemas.search import SearchRequest, SearchResponse
from ..services.search_service import search_service

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search_all(
    dto: SearchRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    result = await search_service.search_all(
        query=dto.query,
        tenant_id=tenant_id,
        sources=dto.sources,
        limit=dto.limit,
        offset=dto.offset,
        db=db,
        filters=dto.filters,
    )
    return SearchResponse(**result)
