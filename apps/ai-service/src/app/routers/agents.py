import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas.agent import AgentResponse, AgentExecute, ExecutionResponse, ExecutionStatus
from ..services.agent_service import agent_service
from ..dependencies import get_current_user, get_tenant_id
from ..orchestrator.router import handle, UserRequest

router = APIRouter()


class ChatMessage(BaseModel):
    workspaceId: str
    message: str
    agentName: str | None = None


@router.post("/chat", status_code=200)
async def chat(dto: ChatMessage, request: Request):
    """
    High-level chat endpoint: auto-classifies intent, routes to the right agent,
    runs the agentic loop, and returns the result.
    Used by the NestJS API's InternalAiService.sendChatMessage().
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
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    agents, total = await agent_service.list_agents(db, page, page_size, tenant_id, category)
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


@router.post("/{agent_id}/execute", response_model=ExecutionResponse)
async def execute_agent(
    agent_id: uuid.UUID,
    dto: AgentExecute,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    user_id = current_user.get("sub") or current_user.get("user_id") if current_user else None
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
    db: AsyncSession = Depends(get_db),
    tenant_id: str | None = Depends(get_tenant_id),
):
    executions, total = await agent_service.list_executions(db, agent_id, page, page_size, tenant_id)
    return {
        "executions": [ExecutionResponse.model_validate(e) for e in executions],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
