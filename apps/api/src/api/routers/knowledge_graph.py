import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.knowledge_graph import (
    CreateEdgeRequest,
    CreateNodeRequest,
    EdgeResponse,
    NodeResponse,
    ShortestPathRequest,
    TraverseRequest,
    UpdateNodeRequest,
)
from ..services.knowledge_graph_service import kg_service

router = APIRouter()


@router.post("/nodes", response_model=NodeResponse, status_code=201)
async def create_node(
    dto: CreateNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    tenant_id = current_user.get("tenant_id")
    row = await kg_service.create_node(dto, tenant_id, db)
    return NodeResponse.model_validate(row._mapping)


@router.get("/nodes", response_model=dict)
async def list_nodes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None, alias="type"),
    search: str | None = Query(None),
    min_importance: float | None = Query(None, ge=0, le=1),
    max_importance: float | None = Query(None, ge=0, le=1),
    sort_by: str | None = Query(None, pattern="^(name|type|importance|created_at|updated_at)$"),
    sort_order: str | None = Query(None, pattern="^(asc|desc|ASC|DESC)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    tenant_id = current_user.get("tenant_id")
    rows, total = await kg_service.list_nodes(
        page=page,
        page_size=page_size,
        type_filter=type,
        search=search,
        min_importance=min_importance,
        max_importance=max_importance,
        sort_by=sort_by,
        sort_order=sort_order,
        tenant_id=tenant_id,
        db=db,
    )
    return {
        "items": [NodeResponse.model_validate(r._mapping) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/nodes/{node_id}", response_model=NodeResponse)
async def get_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await kg_service.get_node(node_id, db)
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")
    return NodeResponse.model_validate(row._mapping)


@router.put("/nodes/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: uuid.UUID,
    dto: UpdateNodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await kg_service.update_node(node_id, dto, db)
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")
    return NodeResponse.model_validate(row._mapping)


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(
    node_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await kg_service.delete_node(node_id, db)
    if not row:
        raise HTTPException(status_code=404, detail="Node not found")


@router.post("/nodes/{node_id}/edges", response_model=EdgeResponse, status_code=201)
async def create_edge(
    node_id: uuid.UUID,
    dto: CreateEdgeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await kg_service.create_edge(node_id, dto, db)
    if not row:
        raise HTTPException(status_code=409, detail="Edge already exists or source/target not found")
    return EdgeResponse.model_validate(row._mapping)


@router.get("/nodes/{node_id}/edges", response_model=dict)
async def list_node_edges(
    node_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    rows, total = await kg_service.list_edges(node_id, page, page_size, db)
    return {
        "items": [EdgeResponse.model_validate(r._mapping) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/edges", response_model=dict)
async def list_all_edges(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    relationship: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    rows, total = await kg_service.list_all_edges(page, page_size, relationship, db)
    return {
        "items": [EdgeResponse.model_validate(r._mapping) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.delete("/edges/{edge_id}", status_code=204)
async def delete_edge(
    edge_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    row = await kg_service.delete_edge(edge_id, db)
    if not row:
        raise HTTPException(status_code=404, detail="Edge not found")


@router.post("/traverse", response_model=list[NodeResponse])
async def traverse(
    dto: TraverseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    rows = await kg_service.traverse(
        uuid.UUID(dto.start_id) if isinstance(dto.start_id, str) else dto.start_id,
        dto.depth,
        dto.mode,
        db,
    )
    return [NodeResponse.model_validate(r._mapping) for r in rows]


@router.get("/path", response_model=dict)
async def find_shortest_path(
    from_id: str = Query(...),
    to_id: str = Query(...),
    max_depth: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401)
    nodes, depth = await kg_service.find_shortest_path(
        uuid.UUID(from_id),
        uuid.UUID(to_id),
        max_depth,
        db,
    )
    if not nodes:
        raise HTTPException(status_code=404, detail="No path found")
    return {
        "path": [NodeResponse.model_validate(r._mapping) for r in nodes],
        "depth": depth,
        "from_id": from_id,
        "to_id": to_id,
    }
