"""
PIOS Peer-to-Peer Agent Federation API Router.
Exposes endpoints for cryptographically-gated agent delegation across workspaces.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace, WorkspaceUser
from ..services.agent_federation_service import (
    FederationDispatchRequest,
    FederationDispatchResponse,
    agent_federation_service,
)

router = APIRouter()


async def _verify_workspace_access(
    db: AsyncSession,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
) -> bool:
    r1 = await db.execute(
        select(Workspace.id).where(Workspace.id == workspace_id, Workspace.user_id == user_id)
    )
    if r1.scalar_one_or_none() is not None:
        return True
    r2 = await db.execute(
        select(WorkspaceUser.id).where(
            WorkspaceUser.workspace_id == workspace_id,
            WorkspaceUser.user_id == user_id,
        )
    )
    return r2.scalar_one_or_none() is not None


@router.post("/dispatch", response_model=FederationDispatchResponse)
async def dispatch_federation(
    body: FederationDispatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> FederationDispatchResponse:
    """Dispatches a task to a federated peer agent guarded by W3C capability credentials."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.caller_workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to calling workspace")

    return await agent_federation_service.dispatch_federated_task(
        db=db,
        dispatch=body,
    )
