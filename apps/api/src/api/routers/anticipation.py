"""
PIOS Proactive Anticipation API Router.
Exposes endpoints for:
- Discovering proactive anticipation proposals (calendar prep, follow-up drafts, commitment reminders)
- Triggering proactive background trajectory evaluation
- Accepting or dismissing proposals with anti-nagging feedback
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models.schema import Workspace, WorkspaceUser
from ..services.anticipation_daemon import ProposalOutput, anticipation_daemon

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


class ScanProposalsRequest(BaseModel):
    workspace_id: uuid.UUID


class DismissProposalRequest(BaseModel):
    workspace_id: uuid.UUID
    reason: str | None = Field(default=None, description="Anti-nagging dismissal reason")


class AcceptProposalRequest(BaseModel):
    workspace_id: uuid.UUID


@router.get("/proposals", response_model=dict[str, Any])
async def list_proposals(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    status: str | None = Query(None, description="PENDING, ACCEPTED, DISMISSED"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Lists proactive anticipation proposals in the user's workspace."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    proposals = await anticipation_daemon.list_proposals(
        db=db,
        user_id=user_id,
        workspace_id=workspace_id,
        status=status,
    )
    return {
        "proposals": [ProposalOutput.model_validate(p) for p in proposals],
        "total": len(proposals),
    }


@router.post("/scan", response_model=dict[str, Any])
async def scan_and_generate(
    body: ScanProposalsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Triggers proactive anticipation analysis across calendar, applications, and goals."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    proposals = await anticipation_daemon.scan_and_generate_proposals(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
    )
    return {
        "proposals": [ProposalOutput.model_validate(p) for p in proposals],
        "total": len(proposals),
    }


@router.post("/proposals/{proposal_id}/accept", response_model=ProposalOutput)
async def accept_proposal(
    proposal_id: uuid.UUID,
    body: AcceptProposalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ProposalOutput:
    """Accepts a proposal and promotes it to an active task."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    prop = await anticipation_daemon.accept_proposal(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        proposal_id=proposal_id,
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proactive proposal not found")
    return ProposalOutput.model_validate(prop)


@router.post("/proposals/{proposal_id}/dismiss", response_model=ProposalOutput)
async def dismiss_proposal(
    proposal_id: uuid.UUID,
    body: DismissProposalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ProposalOutput:
    """Dismisses a proposal with anti-nagging feedback."""
    user_id = uuid.UUID(current_user["sub"])
    has_access = await _verify_workspace_access(db, user_id, body.workspace_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Forbidden: User lacks access to specified workspace")

    prop = await anticipation_daemon.dismiss_proposal(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        proposal_id=proposal_id,
        reason=body.reason,
    )
    if not prop:
        raise HTTPException(status_code=404, detail="Proactive proposal not found")
    return ProposalOutput.model_validate(prop)
