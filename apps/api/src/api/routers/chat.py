from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..dependencies import get_current_user
from ..services.llm_service import llm_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=10000, description="User message (max 10000 chars)")
    agent_name: str | None = None


@router.post("/workspaces/{workspace_id}/chat")
async def send_chat_message(
    workspace_id: str,
    dto: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await llm_service.generate_completion([
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": dto.message},
    ])
    return {"reply": result.get("content", "")}
