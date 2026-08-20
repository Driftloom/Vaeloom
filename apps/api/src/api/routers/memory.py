import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..schemas.memory import MemoryCreate, MemoryUpdate, MemoryResponse, MemoryQuery, MemorySearch, MemorySearchResult
from ..services.memory_service import memory_service
from ..models.schema import Memory, AgentAction

router = APIRouter()


@router.get("", response_model=dict)
async def list_memories(
    query: MemoryQuery = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    memories, total = await memory_service.list_memories(db, query, tenant_id)
    return {
        "memories": [MemoryResponse.model_validate(m) for m in memories],
        "total": total,
        "page": query.page,
        "page_size": query.page_size,
    }


@router.get("/feed", response_model=dict)
async def get_agentic_feed(
    workspace_id: str | None = Query(None, description="Workspace to scope feed"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    """Agentic memory activity feed: merges memory mutations with agent action timeline.

    Shows agent-created, superseded, and human-corrected memories plus recent AgentAction entries.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Fetch memories for workspace
    mem_query = MemoryQuery(workspace_id=workspace_id, status="all", page=page, page_size=page_size)
    memories, total = await memory_service.list_memories(db, mem_query, tenant_id)

    # Fetch recent agent actions for workspace if available
    actions: list[AgentAction] = []
    if workspace_id:
        try:
            ws_uuid = uuid.UUID(workspace_id)
            stmt = select(AgentAction).where(AgentAction.workspace_id == ws_uuid).order_by(desc(AgentAction.created_at)).limit(50)
            result = await db.execute(stmt)
            actions = list(result.scalars().all())
        except Exception:
            actions = []

    # Build enriched feed items from memories
    feed: list[dict] = []
    for m in memories:
        # Determine provenance kind
        kind = "memory_created"
        if m.status == "superseded":
            kind = "memory_superseded"
        elif m.supersedes_id is not None:
            kind = "memory_corrected"
        elif m.source_type in ("agent", "memory_agent", "organization"):
            kind = "agent_created"
        elif m.source_type:
            kind = f"memory_{m.source_type}"

        # Try to find linked agent action
        linked_action = None
        for a in actions:
            if str(m.id) in (a.input_ref or "") or str(m.id) in (a.output_ref or ""):
                linked_action = a
                break

        feed.append({
            "kind": kind,
            "memory": MemoryResponse.model_validate(m).model_dump(mode="json"),
            "agent_name": linked_action.agent_name if linked_action else (m.source_type if m.source_type else None),
            "action": {
                "id": str(linked_action.id),
                "action_type": linked_action.action_type,
                "status": linked_action.status,
                "created_at": linked_action.created_at.isoformat() if linked_action.created_at else None,
            } if linked_action else None,
            "timestamp": (m.updated_at or m.created_at).isoformat() if (m.updated_at or m.created_at) else None,
        })

    # Also inject standalone agent actions not linked to a memory (e.g., organize, draft)
    memory_ids = {str(m.id) for m in memories}
    for a in actions:
        in_feed = any(str(a.id) == (item.get("action") or {}).get("id") for item in feed)
        if in_feed:
            continue
        # Check if action references a memory outside page
        refs_memory = False
        if a.output_ref:
            for mid in memory_ids:
                if mid in a.output_ref:
                    refs_memory = True
                    break
        if refs_memory:
            continue
        # Standalone AI activity
        feed.append({
            "kind": f"agent_{a.action_type}",
            "memory": None,
            "agent_name": a.agent_name,
            "action": {
                "id": str(a.id),
                "action_type": a.action_type,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "input_ref": a.input_ref,
                "output_ref": a.output_ref,
            },
            "timestamp": a.created_at.isoformat() if a.created_at else None,
        })

    # Sort combined feed by timestamp desc
    feed.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    # Page slice already applied to memories; truncate feed to page_size for consistency
    feed = feed[:page_size]

    # Stats for header
    total_memories = total
    superseded_count = sum(1 for m in memories if m.status == "superseded")
    agent_created = sum(1 for m in memories if (m.source_type or "").startswith("agent") or m.source_type in ("memory_agent", "organization"))
    return {
        "feed": feed,
        "total": total_memories,
        "page": page,
        "page_size": page_size,
        "stats": {
            "total_memories": total_memories,
            "superseded": superseded_count,
            "agent_created": agent_created,
            "recent_actions": len(actions),
        },
    }


@router.get("/{memory_id}/lineage", response_model=dict)
async def get_memory_lineage(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    """Return full lineage for a memory: supersession chain + provenance + linked agent actions."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    memory = await memory_service.get_memory(db, memory_id, tenant_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Walk supersession chain backwards (resolve supersedes_id chain)
    chain_backward: list[dict] = []
    current = memory
    visited: set[str] = set()
    while current and str(current.id) not in visited:
        visited.add(str(current.id))
        chain_backward.append(MemoryResponse.model_validate(current).model_dump(mode="json"))
        if current.supersedes_id:
            nxt = await memory_service.get_memory(db, current.supersedes_id, tenant_id)
            current = nxt
        else:
            break

    # Walk forward: find memories that supersede this one
    chain_forward: list[dict] = []
    try:
        stmt = select(Memory).where(Memory.supersedes_id == memory_id).order_by(desc(Memory.created_at))
        result = await db.execute(stmt)
        forwards = list(result.scalars().all())
        for f in forwards:
            chain_forward.append(MemoryResponse.model_validate(f).model_dump(mode="json"))
            # Recursively walk forward successors
            # Depth 2 only for simplicity
            stmt2 = select(Memory).where(Memory.supersedes_id == f.id)
            r2 = await db.execute(stmt2)
            for ff in r2.scalars().all():
                chain_forward.append(MemoryResponse.model_validate(ff).model_dump(mode="json"))
    except Exception:
        pass

    # Provenance nodes via service
    provenance_nodes: list[dict] = []
    try:
        from ..services.provenance_service import ProvenanceService
        svc = ProvenanceService()
        chain = await svc.trace_memory_lineage(db, memory_id)
        provenance_nodes = [{"table": n.table, "id": n.id, "type": n.type, "detail": n.detail} for n in chain.nodes]
    except Exception:
        provenance_nodes = []

    # Linked agent actions
    actions: list[dict] = []
    try:
        stmt = select(AgentAction).where(
            (AgentAction.input_ref.contains(str(memory_id))) | (AgentAction.output_ref.contains(str(memory_id)))
        ).order_by(desc(AgentAction.created_at)).limit(20)
        result = await db.execute(stmt)
        for a in result.scalars().all():
            actions.append({
                "id": str(a.id),
                "agent_name": a.agent_name,
                "action_type": a.action_type,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "input_ref": a.input_ref,
                "output_ref": a.output_ref,
            })
    except Exception:
        actions = []

    return {
        "memory": MemoryResponse.model_validate(memory).model_dump(mode="json"),
        "chain_backwards": chain_backward,  # current + ancestors (superseded lineage)
        "chain_forwards": chain_forward,  # children that supersede this
        "provenance": provenance_nodes,
        "agent_actions": actions,
    }


@router.post("", response_model=MemoryResponse, status_code=201)
async def create_memory(
    dto: MemoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    memory = await memory_service.create_memory(db, dto, tenant_id, user_id)
    return MemoryResponse.model_validate(memory)


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    memory = await memory_service.get_memory(db, memory_id, tenant_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return MemoryResponse.model_validate(memory)


@router.put("/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: uuid.UUID,
    dto: MemoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    memory = await memory_service.update_memory(db, memory_id, dto, tenant_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return MemoryResponse.model_validate(memory)


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await memory_service.delete_memory(db, memory_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory not found")


@router.post("/search", response_model=list[MemorySearchResult])
async def search_memories(
    dto: MemorySearch,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    results = await memory_service.search_memories(db, dto, tenant_id)
    return [
        MemorySearchResult(memory=MemoryResponse.model_validate(mem), score=score)
        for mem, score in results
    ]
