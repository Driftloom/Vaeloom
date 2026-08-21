import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.workspace import CreateWorkspaceRequest, UpdateWorkspaceRequest, WorkspaceResponse
from ..services.workspace_service import workspace_service

router = APIRouter()


@router.post("", response_model=WorkspaceResponse, status_code=201)
async def create_workspace(dto: CreateWorkspaceRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    return await workspace_service.create(user_id=user_id, name=dto.name, db=db)


@router.get("", response_model=list[WorkspaceResponse])
async def list_workspaces(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    return await workspace_service.list_for_user(user_id=user_id, db=db)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    workspace = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(workspace_id: str, dto: UpdateWorkspaceRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    workspace = await workspace_service.update(
        workspace_id=workspace_id,
        user_id=user_id,
        data=dto.model_dump(exclude_unset=True),
        db=db,
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(workspace_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    deleted = await workspace_service.delete(workspace_id=workspace_id, user_id=user_id, db=db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workspace not found")


@router.get("/{workspace_id}/agents")
async def list_workspace_agents(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    from ..models.schema import Agent
    from ..schemas.agent import AgentResponse
    result = await db.execute(
        select(Agent).where(Agent.workspace_id == uuid.UUID(workspace_id))
    )
    agents = result.scalars().all()
    return [AgentResponse.model_validate(a) for a in agents]


@router.get("/{workspace_id}/memories")
async def list_workspace_memories(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    from ..models.schema import Memory
    from ..schemas.memory import MemoryResponse
    result = await db.execute(
        select(Memory).where(Memory.workspace_id == uuid.UUID(workspace_id))
    )
    memories = result.scalars().all()
    return [MemoryResponse.model_validate(m) for m in memories]


@router.get("/{workspace_id}/connectors")
async def list_workspace_connectors(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    from ..models.schema import Connector
    from ..schemas.connector import ConnectorResponse
    result = await db.execute(
        select(Connector).where(Connector.workspace_id == uuid.UUID(workspace_id))
    )
    connectors = result.scalars().all()
    return [ConnectorResponse.model_validate(c) for c in connectors]


@router.get("/{workspace_id}/document-actions")
async def list_workspace_document_actions(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    from ..models.schema import DocumentAction
    from ..schemas.document import DocumentActionResponse, DocumentActionListResponse
    result = await db.execute(
        select(DocumentAction)
        .where(DocumentAction.workspace_id == uuid.UUID(workspace_id))
        .order_by(DocumentAction.created_at.desc())
        .limit(100)
    )
    actions = result.scalars().all()
    return DocumentActionListResponse(
        actions=[DocumentActionResponse.model_validate(a) for a in actions],
        total=len(actions),
    )


@router.get("/{workspace_id}/agent-actions")
async def list_workspace_agent_actions(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")
    from ..models.schema import AgentAction
    from sqlalchemy import desc
    result = await db.execute(
        select(AgentAction)
        .where(AgentAction.workspace_id == uuid.UUID(workspace_id))
        .order_by(desc(AgentAction.created_at))
        .limit(100)
    )
    actions = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "workspaceId": str(a.workspace_id),
            "agentName": a.agent_name,
            "actionType": a.action_type,
            "inputRef": a.input_ref,
            "outputRef": a.output_ref,
            "status": a.status,
            "error": a.error,
            "durationMs": a.duration_ms,
            "approvalRequestId": str(a.approval_request_id) if a.approval_request_id else None,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
        }
        for a in actions
    ]
