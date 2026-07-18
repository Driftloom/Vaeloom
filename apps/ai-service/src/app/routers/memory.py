import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse, MemoryQuery, MemorySearch, MemorySearchResult
from ..services.memory_service import memory_service
from ..dependencies import get_current_user, get_tenant_id

router = APIRouter()


@router.get("", response_model=dict)
async def list_memories(
    query: MemoryQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    memories, total = await memory_service.list_memories(db, query, tenant_id)
    return {
        "memories": [MemoryResponse.model_validate(m) for m in memories],
        "total": total,
        "page": query.page,
        "page_size": query.page_size,
    }


@router.post("", response_model=MemoryResponse, status_code=201)
async def create_memory(
    dto: MemoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
    memory = await memory_service.create_memory(db, dto, tenant_id, user_id)
    return MemoryResponse.model_validate(memory)


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    memory = await memory_service.get_memory(db, memory_id, tenant_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return MemoryResponse.model_validate(memory)


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: uuid.UUID,
    dto: MemoryUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    memory = await memory_service.update_memory(db, memory_id, dto, tenant_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return MemoryResponse.model_validate(memory)


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    deleted = await memory_service.delete_memory(db, memory_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")


@router.post("/search", response_model=list[MemorySearchResult])
async def search_memories(
    dto: MemorySearch,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    results = await memory_service.search_memories(db, dto, tenant_id)
    return [
        MemorySearchResult(memory=MemoryResponse.model_validate(mem), score=score)
        for mem, score in results
    ]
