"""
Agent Council API Router.
Exposes the PIOS 5-Agent Adjudication Quality Gate and Deliberation Protocol.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_workspace_id
from ..services.agent_council import agent_council, CouncilVerdict

router = APIRouter()


class CouncilReviewRequest(BaseModel):
    artifact: str = Field(..., min_length=1, description="Text or code artifact to evaluate")
    artifact_type: str = Field(default="text", description="text, code, resume, cover_letter, proposal")
    context: dict[str, Any] = Field(default_factory=dict, description="Additional metadata or user context")
    mode: str = Field(default="collaborative", description="collaborative or adversarial")


class CouncilTriageRequest(BaseModel):
    artifact: str


@router.post("/review", response_model=CouncilVerdict)
async def review_artifact(
    body: CouncilReviewRequest,
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
) -> CouncilVerdict:
    """
    Submits an artifact to the 5-Agent Council (Skeptic, Voice, Evidence, Strategy, Adjudicator)
    for a 2-round deliberation and returns a binding SHIP, REVISE, or HOLD verdict.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    verdict = await agent_council.deliberate(
        artifact=body.artifact,
        artifact_type=body.artifact_type,
        context={**body.context, "workspace_id": workspace_id, "user_id": current_user.get("sub")},
        mode=body.mode,
    )
    return verdict


@router.post("/triage")
async def triage_artifact(
    body: CouncilTriageRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Phase 1 Triage check: determines if artifact requires full council review."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    requires_council = agent_council.triage(body.artifact)
    return {
        "requires_council": requires_council,
        "length": len(body.artifact.strip()),
        "reason": "Meets non-triviality threshold" if requires_council else "Bypassed: trivial or short command",
    }


class CouncilCertifyRequest(BaseModel):
    workspace_id: uuid.UUID
    agent_name: str
    execution_id: str
    artifact: str = Field(..., min_length=1)
    artifact_type: str = "text"
    tools_invoked: list[str] = Field(default_factory=list)
    mode: str = "collaborative"


@router.post("/evaluate-and-certify")
async def evaluate_and_certify(
    body: CouncilCertifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Evaluates artifact through Council and automatically generates W3C AgentAuditCredential on consensus."""
    user_id = uuid.UUID(current_user["sub"])
    return await agent_council.evaluate_and_certify(
        db=db,
        user_id=user_id,
        workspace_id=body.workspace_id,
        agent_name=body.agent_name,
        execution_id=body.execution_id,
        artifact=body.artifact,
        artifact_type=body.artifact_type,
        tools_invoked=body.tools_invoked,
        mode=body.mode,
    )

