"""
Legacy chat endpoint — SEC-001 fixed 2026-08-31.
Previously bypassed orchestrator (direct LLM call without classification,
kill-switch, adversarial detection, RLS-scoped RAG, QA gate, audit).
Now wraps the governed orchestrator path so both chat surfaces share
the same security boundary.
Kept for backward compat; new clients should use POST /api/v1/agents/chat.
"""
import contextlib
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..orchestrator.router import UserRequest
from ..orchestrator.router import handle as orchestrator_handle
from ..services.memory_service import retrieve_memory_and_vault_context

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
    try:
        await _verify_workspace_access(workspace_id, current_user, db)
        bg_context = await retrieve_memory_and_vault_context(workspace_id, dto.message, db)
    finally:
        # Crucial P0 Fix: Release DB connection immediately before awaiting long-running orchestrator loop
        with contextlib.suppress(Exception):
            await db.commit()
        with contextlib.suppress(Exception):
            await db.close()
    user_id = current_user.get("sub") or current_user.get("id") or current_user.get("user_id")
    tenant_id = current_user.get("tenant_id")
    from .agents import SLASH_COMMAND_AGENT_MAP

    preferred = dto.agent_name.strip().lower() if dto.agent_name else None
    if not preferred and dto.message.strip().startswith("/"):
        first_token = dto.message.strip().split()[0].lower()
        preferred = SLASH_COMMAND_AGENT_MAP.get(first_token)
    full_message = f"{dto.message}\n\n{bg_context}" if bg_context else dto.message

    req = UserRequest(
        request_id=str(uuid.uuid4()),
        message=full_message,
        workspace_id=workspace_id,
        preferred_agent=preferred,
        user_id=str(user_id) if user_id else None,
        tenant_id=str(tenant_id) if tenant_id else None,
    )
    result = await orchestrator_handle(req)
    # Preserve legacy shape: {"reply": str} while returning full orchestrator result for callers that need it
    summary = ""
    if isinstance(result, dict):
        summary = result.get("result", {}).get("summary", "") if isinstance(result.get("result"), dict) else str(result.get("result", ""))
    return {"reply": summary or str(result), "_governed": True, "result": result}
