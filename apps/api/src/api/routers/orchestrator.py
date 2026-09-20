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
    tenant_id: Optional[str] = Depends(get_tenant_id),
) -> dict[str, Any]:
    """Execute an agent turn via the governed orchestrator boundary."""
    try:
        ws_uuid = uuid.UUID(dto.workspace_id)
        u_uuid = uuid.UUID(dto.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace_id or user_id UUID format")

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
        user_id=str(u_uuid),
        tenant_id=tenant_id or "default",
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
