import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.agent import (
    AgentCreate, AgentResponse, AgentUpdate, AgentExecute,
    ExecutionResponse, ScheduleRequest, ScheduleResponse,
)
from ..services.agent_service import agent_service
from ..dependencies import get_current_user, get_tenant_id
from ..orchestrator.router import handle, UserRequest

router = APIRouter()


# ── Canonical catalog + skills/tools mapping ───────────────────────
@router.get("/catalog", response_model=dict)
async def get_agent_catalog(
    current_user: dict = Depends(get_current_user),
):
    """Return enriched canonical agent catalog: agents + skills + tools used.

    Data is derived from orchestrator registry and tool definitions - not just DB rows.
    Works even when no agents have been persisted yet.
    """
    from ..orchestrator.router import AGENT_REGISTRY, MVP_CANONICAL_AGENTS
    from ..tools.definitions import ALL_TOOLS

    catalog = []
    for name, cls in AGENT_REGISTRY.items():
        inst = None
        try:
            inst = cls()
        except Exception:
            inst = None

        # Extract mission, tools, memory scopes, autonomy
        mission = getattr(inst or cls, "mission", "") or getattr(cls, "__doc__", "") or ""
        tools_declared = getattr(inst or cls, "tools", []) or []
        # tools may be Tool pydantic or plain; normalize to names
        tool_names: list[str] = []
        for t in tools_declared:
            if isinstance(t, dict):
                tool_names.append(t.get("name", str(t)))
            elif hasattr(t, "name"):
                tool_names.append(getattr(t, "name"))
            else:
                tool_names.append(str(t))

        # Resolve full tool definitions
        tool_defs = []
        for tn in tool_names:
            td = ALL_TOOLS.get(tn)
            if td:
                tool_defs.append({
                    "name": td.name,
                    "description": td.description,
                    "required_scope": td.required_scope,
                    "category": td.category,
                    "input_schema": td.input_schema,
                })
            else:
                tool_defs.append({"name": tn, "description": "", "required_scope": "unknown", "category": "unknown"})

        memory_scopes = getattr(inst or cls, "memory_scopes", None)
        if memory_scopes is not None and hasattr(memory_scopes, "model_dump"):
            memory_scopes_dict = memory_scopes.model_dump()
        elif memory_scopes is not None:
            memory_scopes_dict = {"read_types": getattr(memory_scopes, "read_types", []), "write_types": getattr(memory_scopes, "write_types", [])}
        else:
            memory_scopes_dict = {"read_types": [], "write_types": []}

        default_autonomy = getattr(inst or cls, "default_autonomy", "suggest")
        is_canonical = name in MVP_CANONICAL_AGENTS

        # Derive skills from category + tools (human readable)
        # Skills are capability labels shown in UI
        skills = []
        # Core skill from mission / name
        if name == "organization":
            skills = ["Document Organization", "Deduplication", "Folder Routing"]
        elif name == "memory":
            skills = ["Entity Extraction", "Knowledge Graph", "Memory Consolidation"]
        elif name == "resume":
            skills = ["Resume Generation", "Template Filling", "Variant Tailoring"]
        elif name == "ats":
            skills = ["ATS Scoring", "Keyword Gap", "Resume Audit"]
        elif name == "job_search":
            skills = ["Job Discovery", "Ranking", "Opportunity Match"]
        elif name == "application":
            skills = ["Application Draft", "Cover Letter", "Submission (Approval-Gated)"]
        elif name == "gmail":
            skills = ["Inbox Watch", "Deadline Extraction", "Draft-Only Email"]
        elif name == "scheduler":
            skills = ["Calendar Merge", "Conflict Check", "Reminder Dispatch"]
        else:
            # Enterprise extras: derive from tools
            skills = [td["name"].replace("_", " ").title() for td in tool_defs[:3]] or [name.title()]

        catalog.append({
            "name": name,
            "mission": mission.strip() if isinstance(mission, str) else str(mission),
            "tools": tool_defs,
            "tool_names": tool_names,
            "memory_scopes": memory_scopes_dict,
            "default_autonomy": default_autonomy,
            "is_canonical": is_canonical,
            "skills": skills,
            "category": "canonical" if is_canonical else "enterprise",
        })

    # Sort canonical first
    catalog.sort(key=lambda x: (0 if x["is_canonical"] else 1, x["name"]))

    return {
        "agents": catalog,
        "total": len(catalog),
        "canonical_count": sum(1 for c in catalog if c["is_canonical"]),
        "tool_definitions": {k: {"description": v.description, "category": v.category, "required_scope": v.required_scope} for k, v in ALL_TOOLS.items()},
    }


@router.post("", response_model=AgentResponse, status_code=201)
async def create_agent(
    dto: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
    agent = await agent_service.register_agent(dto=dto, tenant_id=tenant_id, user_id=user_id, db=db)
    return AgentResponse.model_validate(agent)


class ChatMessage(BaseModel):
    workspaceId: str
    message: str
    agentName: str | None = None


@router.post("/chat", status_code=200)
async def chat(
    dto: ChatMessage,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    High-level chat endpoint: auto-classifies intent, routes to the right agent,
    runs the agentic loop, and returns the result. If dto.agentName is provided
    (enterprise explicit routing), honors it with high confidence.
    """
    req = UserRequest(
        request_id=str(uuid.uuid4()),
        message=dto.message,
        workspace_id=dto.workspaceId,
        preferred_agent=dto.agentName.strip().lower() if dto.agentName else None,
    )
    result = await handle(req)
    return result


@router.get("", response_model=dict)
async def list_agents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    agents, total = await agent_service.list_agents(
        db=db, page=page, page_size=page_size, tenant_id=tenant_id,
        category=category, search=search,
    )
    return {
        "agents": [AgentResponse.model_validate(a) for a in agents],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    agent = await agent_service.get_agent(db, agent_id, tenant_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: uuid.UUID,
    dto: AgentExecute,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None

    if dto.stream:
        async def event_stream():
            try:
                yield "event: start\ndata: {}\n\n"
                async for chunk in agent_service.execute_agent_stream(db, agent_id, dto, tenant_id, user_id):
                    yield f"data: {json.dumps(chunk)}\n\n"
                yield "event: done\ndata: {}\n\n"
            except ValueError as e:
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    try:
        execution = await agent_service.execute_agent(db, agent_id, dto, tenant_id, user_id)
        return ExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{agent_id}/executions", response_model=dict)
async def list_executions(
    agent_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    executions, total = await agent_service.list_executions(
        db=db, agent_id=agent_id, page=page, page_size=page_size,
        tenant_id=tenant_id, status=status,
    )
    return {
        "executions": [ExecutionResponse.model_validate(e) for e in executions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: uuid.UUID,
    dto: AgentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    agent = await agent_service.update_agent(agent_id, dto, db)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return AgentResponse.model_validate(agent)


@router.delete("/{agent_id}", status_code=204)
async def deactivate_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    deleted = await agent_service.deactivate_agent(agent_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.post("/{agent_id}/run", response_model=ExecutionResponse)
async def run_agent(
    agent_id: uuid.UUID,
    dto: AgentExecute,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
    try:
        execution = await agent_service.execute_agent(db, agent_id, dto, tenant_id, user_id)
        return ExecutionResponse.model_validate(execution)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{agent_id}/schedule", response_model=ScheduleResponse, status_code=201)
async def schedule_agent(
    agent_id: uuid.UUID,
    dto: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    schedule = await agent_service.schedule_agent(
        agent_id=agent_id, cron=dto.cron, input=dto.input, enabled=dto.enabled, db=db,
    )
    return ScheduleResponse.model_validate(schedule)
