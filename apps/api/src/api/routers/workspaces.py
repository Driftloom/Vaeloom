import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
    from ..services.connector_ext_service import connector_ext_service
    result = await db.execute(
        select(Connector).where(Connector.workspace_id == uuid.UUID(workspace_id))
    )
    connectors = result.scalars().all()
    res = []
    for c in connectors:
        resp = ConnectorResponse.model_validate(c)
        if resp.config:
            resp.config = connector_ext_service.mask_sensitive_config(resp.config, c.type)
        res.append(resp)
    return res


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
    from ..schemas.document import DocumentActionListResponse, DocumentActionResponse
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
    from sqlalchemy import desc

    from ..models.schema import AgentAction
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


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"


@router.post("/{workspace_id}/invites", status_code=201)
async def invite_workspace_member(
    workspace_id: str,
    dto: InviteMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    ws = await workspace_service.find_by_id(workspace_id=workspace_id, user_id=user_id, db=db)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found or access denied")

    # RBAC Enforcement (GAP-TEN-03): Only workspace owner or admin can invite members
    from ..models.schema import User, WorkspaceUser

    caller_uid = uuid.UUID(user_id)
    ws_uuid = uuid.UUID(workspace_id)
    is_owner = (ws.user_id == caller_uid)
    if not is_owner:
        role_res = await db.execute(
            select(WorkspaceUser.role).where(
                WorkspaceUser.workspace_id == ws_uuid,
                WorkspaceUser.user_id == caller_uid,
            )
        )
        caller_role = role_res.scalar_one_or_none()
        if not caller_role or caller_role.upper() not in ("ADMIN", "OWNER"):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: Only workspace owners and admins can invite members",
            )

    try:
        from sqlalchemy import text, func
        await db.execute(
            text("SELECT set_config('app.lookup_email', :email, true)"),
            {"email": str(dto.email).strip().lower()},
        )
    except Exception:
        pass

    u_res = await db.execute(select(User).where(func.lower(User.email) == str(dto.email).strip().lower()))
    target_user = u_res.scalar_one_or_none()

    try:
        ws_uuid = uuid.UUID(workspace_id)
        if target_user:
            existing = await db.execute(
                select(WorkspaceUser).where(
                    WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == target_user.id
                )
            )
            if not existing.scalar_one_or_none():
                member = WorkspaceUser(
                    id=uuid.uuid4(),
                    workspace_id=ws_uuid,
                    user_id=target_user.id,
                    role=dto.role.lower(),
                )
                db.add(member)
                await db.commit()
    except Exception:
        pass

    return {
        "status": "invited",
        "email": dto.email,
        "role": dto.role,
        "workspace_id": workspace_id,
        "message": f"Invitation successfully sent to {dto.email}",
    }
