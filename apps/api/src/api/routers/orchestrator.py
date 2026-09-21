"""
Orchestrator Gateway Router - Enterprise Agent Invocation Boundary.

Routes execution requests from Trigger.dev, frontend workers, and external SDKs
through zero-trust validation into the orchestrator pipeline.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..middleware.tenant import check_user_workspace_access
from ..orchestrator.router import UserRequest
from ..orchestrator.router import handle as orchestrator_handle

logger = logging.getLogger(__name__)

router = APIRouter()


class OrchestratorExecuteRequest(BaseModel):
    workspace_id: str = Field(..., description="Target workspace UUID")
    user_id: str = Field(..., description="Authenticated user UUID (mandatory, non-null)")
    agent_id: str = Field(..., description="Target agent name or identifier")
    message: str = Field(..., max_length=10000, description="Task instruction or prompt")
    session_id: Optional[str] = None


@router.post("/execute", status_code=200)
async def execute_orchestrator_turn(
    dto: OrchestratorExecuteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: Optional[str] = Depends(get_tenant_id),
) -> dict[str, Any]:
    """Execute an agent turn via the governed orchestrator boundary."""
    try:
        ws_uuid = uuid.UUID(dto.workspace_id)
        u_uuid = uuid.UUID(dto.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace_id or user_id UUID format")

    authenticated_user_id = str(current_user.get("sub", ""))
    if str(u_uuid) != authenticated_user_id:
        logger.warning(
            "Security violation: caller user_id %s does not match authenticated identity %s",
            dto.user_id,
            authenticated_user_id,
        )
        raise HTTPException(status_code=403, detail="User ID mismatch with authenticated identity")

    effective_tenant_id = tenant_id or current_user.get("tenant_id")
    has_access = await check_user_workspace_access(
        session=db,
        workspace_id=str(ws_uuid),
        user_id=authenticated_user_id,
        tenant_id=effective_tenant_id,
    )
    if not has_access:
        logger.warning("User %s denied access to workspace %s", authenticated_user_id, dto.workspace_id)
        raise HTTPException(status_code=403, detail="Access denied to workspace")

    logger.info(
        "Orchestrator invocation for agent %s in workspace %s by user %s",
        dto.agent_id,
        dto.workspace_id,
        dto.user_id,
    )

    request_id = str(uuid.uuid4())
    req = UserRequest(
        request_id=request_id,
        message=dto.message,
        workspace_id=str(ws_uuid),
        preferred_agent=dto.agent_id.strip().lower(),
        user_id=authenticated_user_id,
        tenant_id=effective_tenant_id or "default",
    )

    try:
        result = await orchestrator_handle(req)
        return {
            "status": "success",
            "request_id": request_id,
            "agent_id": dto.agent_id,
            "result": result,
        }
    except Exception as exc:
        logger.exception("Orchestrator turn execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Orchestration failure: {str(exc)}")
