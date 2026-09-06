from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id, get_workspace_id
from ..schemas.search import SearchRequest, SearchResponse
from ..services.search_service import search_service

router = APIRouter()


@router.post("", response_model=SearchResponse)
async def search_all(
    dto: SearchRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
    workspace_id: str | None = Depends(get_workspace_id),
):
    header_ws = request.headers.get("X-Workspace-ID") or request.headers.get("X-WORKSPACE-ID")
    effective_workspace_id = workspace_id or header_ws
    if dto.filters and dto.filters.get("workspace_id"):
        filter_ws = str(dto.filters["workspace_id"])
        if workspace_id and filter_ws != str(workspace_id):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Workspace filter does not match authenticated workspace",
            )
        effective_workspace_id = filter_ws

    user_id = current_user.get("sub") or current_user.get("user_id") or current_user.get("id")
    if effective_workspace_id and user_id:
        from .memory import check_user_workspace_access
        has_access = await check_user_workspace_access(db, user_id, effective_workspace_id)
        if not has_access:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: User does not have access to specified workspace",
            )

    if not effective_workspace_id and not tenant_id:
        return SearchResponse(results=[], total=0, facet_counts={})

    result = await search_service.search_all(
        query=dto.query,
        tenant_id=tenant_id,
        sources=dto.sources,
        limit=dto.limit,
        offset=dto.offset,
        db=db,
        filters=dto.filters,
        workspace_id=effective_workspace_id,
    )
    return SearchResponse(**result)
