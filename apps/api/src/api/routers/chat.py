"""
Legacy chat endpoint — SEC-001 fixed 2026-08-31.
Previously bypassed orchestrator (direct LLM call without classification,
kill-switch, adversarial detection, RLS-scoped RAG, QA gate, audit).
Now wraps the governed orchestrator path so both chat surfaces share
the same security boundary.
Kept for backward compat; new clients should use POST /api/v1/agents/chat.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..orchestrator.router import UserRequest, handle as orchestrator_handle

router = APIRouter()


async def _verify_workspace_access(workspace_id: str, current_user: dict, db: AsyncSession) -> None:
    """Verify caller owns or is member of workspace — fail-closed (IDOR guard)."""
    from sqlalchemy import select as _sel

    from ..models.schema import Workspace, WorkspaceUser

    try:
        from uuid import UUID as _UUID

        ws_uuid = _UUID(str(workspace_id))
        uid = _UUID(str(current_user.get("sub") or current_user.get("user_id")))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    try:
        r1 = await db.execute(_sel(Workspace).where(Workspace.id == ws_uuid, Workspace.user_id == uid))
        if r1.scalar_one_or_none():
            return
        r2 = await db.execute(_sel(WorkspaceUser).where(WorkspaceUser.workspace_id == ws_uuid, WorkspaceUser.user_id == uid))
        if r2.scalar_one_or_none():
            return
        raise HTTPException(status_code=404, detail="Workspace not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Authorization check failed")


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10000, description="User message (max 10000 chars)")
    agent_name: str | None = None


@router.post("/workspaces/{workspace_id}/chat")
async def send_chat_message(
    workspace_id: str,
    dto: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)
    # Delegate to governed orchestrator (fixes SEC-001 — no direct LLM bypass)
    req = UserRequest(
        request_id=str(uuid.uuid4()),
        message=dto.message,
        workspace_id=workspace_id,
        preferred_agent=dto.agent_name.strip().lower() if dto.agent_name else None,
    )
    result = await orchestrator_handle(req)
    # Preserve legacy shape: {"reply": str} while returning full orchestrator result for callers that need it
    summary = ""
    if isinstance(result, dict):
        summary = result.get("result", {}).get("summary", "") if isinstance(result.get("result"), dict) else str(result.get("result", ""))
    return {"reply": summary or str(result), "_governed": True, "result": result}
