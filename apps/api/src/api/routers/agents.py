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
async def chat(dto: ChatMessage, request: Request):
    """
    High-level chat endpoint: auto-classifies intent, routes to the right agent,
    runs the agentic loop, and returns the result.
    """
    req = UserRequest(
        request_id=str(uuid.uuid4()),
        message=dto.message,
        workspace_id=dto.workspaceId,
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
