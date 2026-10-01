from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..middleware.rate_limit import rate_limit
from ..schemas.conversation import (
    ConversationCreate,
    ConversationListItem,
    ConversationResponse,
    ConversationUpdate,
    ConversationWithMessages,
    MessageCreate,
    MessageResponse,
)

# Mounted at `/api/v1/workspaces/{workspace_id}/conversations`, NOT at the bare
# `/api/v1/workspaces` prefix the workspaces router uses. workspaces.router
# already owns `""` and `/{workspace_id}` for GET/POST/PATCH/DELETE, so a second
# router on that prefix would collide head-on — FastAPI matches in registration
# order, so every conversation route would resolve to the workspace route instead.
# Anchoring workspace_id in the include-time prefix keeps the public paths exactly
# as contracted while leaving no template collision: the same shape
# applications.router already uses for /applications.
router = APIRouter()


async def _verify_workspace_access(workspace_id: str, current_user: dict, db: AsyncSession) -> None:
    """Verify caller owns or is member of workspace — fail-closed (IDOR guard).

    Returns 404 (not 403) to avoid workspace existence enumeration.
    Matches temporal.py _verify_workflow_workspace_access pattern.
    """
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


def _uuid_pair(workspace_id: str, conversation_id: str) -> tuple:
    """Parse both path UUIDs; a malformed one is a 400, matching the guard above."""
    import uuid as _uuid

    try:
        return _uuid.UUID(str(workspace_id)), _uuid.UUID(str(conversation_id))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid ID format")


@router.get("", response_model=dict)
async def list_conversations(
    workspace_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    limit: int | None = Query(default=None, ge=1, le=100, description="Standard pagination page size (wins over page/page_size)"),
    offset: int | None = Query(default=None, ge=0, description="Standard pagination rows to skip"),
    search: str | None = Query(default=None, description="Case-insensitive substring match on title"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service
    from ..utils.pagination import resolve_page_params

    page, page_size = resolve_page_params(page, page_size, limit, offset)
    rows, total = await conversation_service.list_conversations(
        db=db,
        workspace_id=workspace_id,
        page=page,
        page_size=page_size,
        search=search,
    )
    return {
        "conversations": [ConversationListItem.model_validate(c).model_copy(update={"message_count": count}) for c, count in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", response_model=ConversationResponse, status_code=201)
async def create_conversation(
    workspace_id: str,
    dto: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    conversation = await conversation_service.create_conversation(
        db=db, workspace_id=workspace_id, dto=dto, tenant_id=tenant_id,
    )
    return ConversationResponse.model_validate(conversation).model_copy(update={"message_count": 0})


@router.get("/{conversation_id}", response_model=ConversationWithMessages)
async def get_conversation(
    workspace_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    ws_uuid, conv_uuid = _uuid_pair(workspace_id, conversation_id)
    conversation = await conversation_service.get_conversation(db, ws_uuid, conv_uuid)
    messages = await conversation_service.list_messages(db, conv_uuid)
    # Built from an explicit dict rather than model_validate(conversation): the
    # `messages` relationship is lazy, and from_attributes would trigger a sync
    # IO read outside greenlet context.
    return ConversationWithMessages(
        id=conversation.id,
        workspace_id=conversation.workspace_id,
        title=conversation.title,
        agent_name=conversation.agent_name,
        message_count=len(messages),
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    workspace_id: str,
    conversation_id: str,
    dto: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    ws_uuid, conv_uuid = _uuid_pair(workspace_id, conversation_id)
    conversation = await conversation_service.update_conversation(
        db=db, workspace_id=ws_uuid, conversation_id=conv_uuid, dto=dto,
    )
    messages = await conversation_service.list_messages(db, conv_uuid)
    return ConversationResponse.model_validate(conversation).model_copy(update={"message_count": len(messages)})


@router.delete("/{conversation_id}", status_code=204)
async def delete_conversation(
    workspace_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    ws_uuid, conv_uuid = _uuid_pair(workspace_id, conversation_id)
    await conversation_service.delete_conversation(db=db, workspace_id=ws_uuid, conversation_id=conv_uuid)
    return Response(status_code=204)


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=201,
    responses={200: {"model": MessageResponse, "description": "Duplicate client_id — the stored row is returned unchanged"}},
)
@rate_limit(max_requests=120, window_seconds=60)
async def create_message(
    workspace_id: str,
    conversation_id: str,
    dto: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
):
    """Persist one turn.

    A repeated `client_id` returns the stored row with **200** rather than 201:
    the frontend retries writes and accepts either, but 201 would claim a new row
    was created when nothing was written.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    ws_uuid, conv_uuid = _uuid_pair(workspace_id, conversation_id)
    message, created = await conversation_service.create_message(
        db=db, workspace_id=ws_uuid, conversation_id=conv_uuid, dto=dto, tenant_id=tenant_id,
    )
    if not created:
        return JSONResponse(
            status_code=200,
            content=MessageResponse.model_validate(message).model_dump(mode="json"),
        )
    return message


@router.delete("/{conversation_id}/messages", status_code=204)
async def clear_messages(
    workspace_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await _verify_workspace_access(workspace_id, current_user, db)

    from ..services.conversation_service import conversation_service

    ws_uuid, conv_uuid = _uuid_pair(workspace_id, conversation_id)
    await conversation_service.clear_messages(db=db, workspace_id=ws_uuid, conversation_id=conv_uuid)
    return Response(status_code=204)
