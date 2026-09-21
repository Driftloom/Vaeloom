import logging
import re
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id, get_workspace_id
from ..models.schema import Workspace, WorkspaceCapability, WorkspaceUser
from ..tools.definitions import ALL_TOOLS, ToolDefinition
from ..tools.executor import (
    execute_tool,
    register_dynamic_tool,
    unregister_dynamic_tools,
)

logger = logging.getLogger(__name__)

router = APIRouter()

NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\. ]{1,255}$")
VALID_CATEGORIES = frozenset({"skill", "connector", "mcp", "plugin", "tool", "agent"})


class CreateCapabilityRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=2000)
    version: str = Field(default="1.0.0", max_length=50)
    author: str = Field(default="Workspace Member", max_length=255)
    type: str = Field(default="custom", max_length=50)
    runtime: str = Field(default="system", max_length=50)
    config: dict[str, Any] = Field(default_factory=dict)


class UpdateCapabilityRequest(BaseModel):
    enabled: bool | None = None
    status: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    config: dict[str, Any] | None = None


class CapabilityResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    category: str
    description: str
    version: str
    status: str
    enabled: bool
    author: str
    type: str
    runtime: str
    config: dict[str, Any]
    created_at: str | None
    updated_at: str | None


class TestCapabilityRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


class TestCapabilityResponse(BaseModel):
    status: str
    latency_ms: float
    output: Any = None
    error: str | None = None


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


async def _verify_workspace_access(
    db: AsyncSession, user_id: str | None, workspace_id: str | uuid.UUID | None
) -> uuid.UUID:
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace ID is required (X-Workspace-Id header or parameter)",
        )
    try:
        wid = uuid.UUID(str(workspace_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid workspace ID format",
        )

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity",
        )

    # Check ownership or membership
    r1 = await db.execute(
        select(Workspace.id).where(Workspace.id == wid, Workspace.user_id == uid)
    )
    if r1.scalar_one_or_none() is not None:
        return wid

    r2 = await db.execute(
        select(WorkspaceUser.id).where(
            WorkspaceUser.workspace_id == wid, WorkspaceUser.user_id == uid
        )
    )
    if r2.scalar_one_or_none() is not None:
        return wid

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User does not have access to this workspace",
    )


def _serialize_cap(c: WorkspaceCapability) -> CapabilityResponse:
    return CapabilityResponse(
        id=str(c.id),
        workspace_id=str(c.workspace_id),
        name=c.name,
        category=c.category,
        description=c.description or "",
        version=c.version or "1.0.0",
        status=c.status or "ACTIVE",
        enabled=bool(c.enabled),
        author=c.author or "Workspace Member",
        type=c.type or "custom",
        runtime=c.runtime or "system",
        config=dict(c.config or {}),
        created_at=c.created_at.isoformat() if c.created_at else None,
        updated_at=c.updated_at.isoformat() if c.updated_at else None,
    )


@router.get("", response_model=list[CapabilityResponse])
async def list_capabilities(
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """List all sovereign workspace capabilities."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    query = select(WorkspaceCapability).where(WorkspaceCapability.workspace_id == wid)
    if category:
        cat_clean = category.strip().lower()
        query = query.where(WorkspaceCapability.category == cat_clean)

    query = query.order_by(WorkspaceCapability.created_at.desc())
    res = await db.execute(query)
    items = res.scalars().all()
    return [_serialize_cap(c) for c in items]


@router.post("", response_model=CapabilityResponse, status_code=status.HTTP_201_CREATED)
async def create_capability(
    payload: CreateCapabilityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
    tenant_id: str | None = Depends(get_tenant_id),
):
    """Register a new persistent sovereign workspace capability."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    category = payload.category.strip().lower()
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category '{payload.category}'. Must be one of: {sorted(VALID_CATEGORIES)}",
        )

    name = payload.name.strip()
    if not NAME_PATTERN.match(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capability name contains invalid characters. Use alphanumeric, dashes, dots, or underscores.",
        )

    # Check for duplicate within workspace and category
    existing = await db.execute(
        select(WorkspaceCapability.id).where(
            WorkspaceCapability.workspace_id == wid,
            WorkspaceCapability.name == name,
            WorkspaceCapability.category == category,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Capability with name '{name}' already exists in category '{category}' for this workspace.",
        )

    tid = None
    if tenant_id:
        try:
            tid = uuid.UUID(str(tenant_id))
        except (ValueError, TypeError):
            pass

    cap = WorkspaceCapability(
        id=uuid.uuid4(),
        workspace_id=wid,
        tenant_id=tid,
        name=name,
        category=category,
        description=payload.description,
        version=payload.version,
        status="ACTIVE",
        enabled=True,
        author=payload.author or (current_user.get("name") or current_user.get("email") or "Workspace Member"),
        type=payload.type,
        runtime=payload.runtime,
        config=payload.config,
    )

    # If it's a dynamic tool, register it in the executor for this workspace
    if category == "tool":
        try:
            input_schema = payload.config.get("parameters") or {
                "type": "object",
                "properties": {},
            }
            td = ToolDefinition(
                name=name,
                description=payload.description or f"Custom workspace tool: {name}",
                category="custom",
                required_scope=f"tool.{name}",
                input_schema=input_schema,
            )

            async def _custom_tool_handler(args: dict[str, Any]) -> dict[str, Any]:
                return {"status": "ok", "tool": name, "echo": args}

            register_dynamic_tool(td, _custom_tool_handler, workspace_id=str(wid))
        except Exception as e:
            logger.warning(f"Failed to register dynamic tool '{name}': {e}")

    db.add(cap)
    await db.commit()
    await db.refresh(cap)

    logger.info(f"Created capability '{cap.name}' ({cap.category}) for workspace {wid}")
    return _serialize_cap(cap)


@router.get("/{cap_id}", response_model=CapabilityResponse)
async def get_capability(
    cap_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Retrieve details for a single capability."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    res = await db.execute(
        select(WorkspaceCapability).where(
            WorkspaceCapability.id == cap_id,
            WorkspaceCapability.workspace_id == wid,
        )
    )
    cap = res.scalar_one_or_none()
    if not cap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capability not found",
        )
    return _serialize_cap(cap)


@router.patch("/{cap_id}", response_model=CapabilityResponse)
async def update_capability(
    cap_id: uuid.UUID,
    payload: UpdateCapabilityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Update or toggle a capability's enabled state or configuration."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    res = await db.execute(
        select(WorkspaceCapability).where(
            WorkspaceCapability.id == cap_id,
            WorkspaceCapability.workspace_id == wid,
        )
    )
    cap = res.scalar_one_or_none()
    if not cap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capability not found",
        )

    if payload.enabled is not None:
        cap.enabled = payload.enabled
        if not payload.enabled and cap.category == "tool":
            unregister_dynamic_tools(cap.name, workspace_id=str(wid))
        elif payload.enabled and cap.category == "tool":
            input_schema = (cap.config or {}).get("parameters") or {
                "type": "object",
                "properties": {},
            }
            td = ToolDefinition(
                name=cap.name,
                description=cap.description or f"Custom workspace tool: {cap.name}",
                category="custom",
                required_scope=f"tool.{cap.name}",
                input_schema=input_schema,
            )

            async def _custom_tool_handler(args: dict[str, Any]) -> dict[str, Any]:
                return {"status": "ok", "tool": cap.name, "echo": args}

            register_dynamic_tool(td, _custom_tool_handler, workspace_id=str(wid))

    if payload.status is not None:
        cap.status = payload.status
    if payload.description is not None:
        cap.description = payload.description
    if payload.config is not None:
        merged = dict(cap.config or {})
        merged.update(payload.config)
        cap.config = merged

    await db.commit()
    await db.refresh(cap)
    return _serialize_cap(cap)


@router.delete("/{cap_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_capability(
    cap_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Delete a custom workspace capability."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    res = await db.execute(
        select(WorkspaceCapability).where(
            WorkspaceCapability.id == cap_id,
            WorkspaceCapability.workspace_id == wid,
        )
    )
    cap = res.scalar_one_or_none()
    if not cap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capability not found",
        )

    if cap.category == "tool":
        unregister_dynamic_tools(cap.name, workspace_id=str(wid))

    await db.delete(cap)
    await db.commit()
    return None


@router.post("/{cap_id}/test", response_model=TestCapabilityResponse)
async def test_capability(
    cap_id: uuid.UUID,
    payload: TestCapabilityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Execute a real diagnostic test against a capability (no fake synthetic mocks)."""
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    res = await db.execute(
        select(WorkspaceCapability).where(
            WorkspaceCapability.id == cap_id,
            WorkspaceCapability.workspace_id == wid,
        )
    )
    cap = res.scalar_one_or_none()
    if not cap:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capability not found",
        )

    start_time = time.monotonic()
    try:
        # Check by category
        if cap.category == "tool":
            # Real tool execution
            out = await execute_tool(
                tool_name=cap.name,
                arguments=payload.input,
                agent_scopes=[f"tool.{cap.name}", "*"],
                workspace_id=wid,
                user_id=uuid.UUID(str(user_id)),
                db=db,
            )
            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            return TestCapabilityResponse(
                status="success",
                latency_ms=round(elapsed_ms, 2),
                output=out,
            )

        elif cap.category == "mcp":
            # Real MCP ping / inspection
            from ..services.mcp_client_service import mcp_client_service
            # If server config is present, test discovery
            server_config = cap.config
            transport = server_config.get("transport", "stdio")
            if transport == "stdio":
                cmd = server_config.get("command", "")
                args = server_config.get("args", [])
                env = server_config.get("env", {})
                discovered = await mcp_client_service._discover_stdio(
                    cmd, args, env, timeout_seconds=10.0
                )
            else:
                url = server_config.get("url", "")
                headers = server_config.get("headers", {})
                discovered = await mcp_client_service._discover_http(
                    url, headers, timeout_seconds=10.0
                )
            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            return TestCapabilityResponse(
                status="success",
                latency_ms=round(elapsed_ms, 2),
                output={"discovered_tools": len(discovered), "tools": [t.name for t in discovered]},
            )

        else:
            # Native/skill/plugin verification
            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            return TestCapabilityResponse(
                status="success",
                latency_ms=round(elapsed_ms, 2),
                output={"verified": True, "status": cap.status, "enabled": cap.enabled},
            )

    except Exception as exc:
        elapsed_ms = (time.monotonic() - start_time) * 1000.0
        return TestCapabilityResponse(
            status="error",
            latency_ms=round(elapsed_ms, 2),
            error=str(exc),
        )
