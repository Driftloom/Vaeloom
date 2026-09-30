import asyncio
import logging
import re
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id, get_workspace_id
from ..models.schema import Workspace, WorkspaceCapability, WorkspaceUser
from ..services.capability_usage_service import record_usage
from ..services.skill_catalog_service import (
    AUTONOMY_VALUES,
    catalog_to_wire,
    get_catalog_entry,
    is_bundled_skill,
    list_catalog,
)
from ..tools.definitions import ALL_TOOLS, ToolDefinition
from ..tools.executor import (
    WORKSPACE_DYNAMIC_TOOL_DEFS,
    execute_tool,
    register_dynamic_tool,
    unregister_dynamic_tools,
)

logger = logging.getLogger(__name__)

router = APIRouter()

NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\. ]{1,255}$")
VALID_CATEGORIES = frozenset({"skill", "connector", "mcp", "plugin", "tool", "agent"})

AutonomyLiteral = Literal["suggest", "autonomous", "approval_required"]

MCP_PROBE_TIMEOUT_S = 5.0

NO_EXECUTABLE_RUNTIME = (
    "This category has no executable runtime; only its configuration was validated."
)


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
    autonomy: AutonomyLiteral | None = None
    required_scope: str | None = Field(default=None, max_length=255)
    # Accepted so the client's field stops being silently dropped, and used only
    # to prove the client agrees with the verified workspace. Authorization comes
    # from the request-scoped workspace id, never from a body field.
    workspace_id: str | None = Field(default=None, max_length=64)


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
    usage_count: int = 0
    last_used_at: str | None = None
    installed_at: str | None = None


class SkillListItem(CapabilityResponse):
    """A workspace capability row, or a catalog entry the workspace has not installed.

    Superset of :class:`CapabilityResponse`: every field a plain capability
    response carries is present here, so existing clients keep working.
    """

    id: str | None = None
    workspace_id: str | None = None
    installed: bool = False
    tags: list[str] = Field(default_factory=list)
    markdown_doc: str | None = None
    required_scope: str | None = None
    trust_class: str | None = None
    autonomy: str | None = None
    triggers: list[str] = Field(default_factory=list)
    bundled: bool = False
    slug: str | None = None


class TestCapabilityRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


class TestCapabilityResponse(BaseModel):
    status: str
    latency_ms: float
    output: Any = None
    error: str | None = None
    executed: bool = False


def _get_user_id(current_user: dict | None) -> str | None:
    if not current_user:
        return None
    return current_user.get("id") or current_user.get("sub") or None


async def _verify_workspace_access(
    db: AsyncSession, user_id: str | None, workspace_id: str | uuid.UUID | None
) -> uuid.UUID:
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

    if not workspace_id:
        # Fallback to user's first workspace
        res = await db.execute(
            select(Workspace.id).where(Workspace.user_id == uid).order_by(Workspace.created_at.asc()).limit(1)
        )
        first_wid = res.scalar_one_or_none()
        if first_wid is not None:
            return first_wid
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


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _as_tags(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str) and raw.strip():
        return [part.strip() for part in raw.split(",") if part.strip()]
    return []


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
        created_at=_iso(c.created_at),
        updated_at=_iso(c.updated_at),
        usage_count=int(c.usage_count or 0),
        last_used_at=_iso(c.last_used_at),
        installed_at=_iso(c.installed_at),
    )


def _config_autonomy(config: dict[str, Any]) -> str | None:
    value = config.get("autonomy")
    return value if value in AUTONOMY_VALUES else None


def _to_list_item(c: WorkspaceCapability) -> SkillListItem:
    base = _serialize_cap(c)
    config = dict(c.config or {})
    catalog = get_catalog_entry(c.name) if c.category == "skill" else None
    return SkillListItem(
        **base.model_dump(),
        installed=True,
        tags=_as_tags(config.get("tags")),
        markdown_doc=config.get("markdown_doc") or (catalog.markdown_doc if catalog else None),
        required_scope=config.get("required_scope") or (catalog.required_scope if catalog else None),
        trust_class=catalog.trust_class if catalog else config.get("trust_class"),
        autonomy=_config_autonomy(config),
        triggers=_as_tags(config.get("triggers")) or (list(catalog.triggers) if catalog else []),
        bundled=catalog.bundled if catalog else False,
        slug=catalog.slug if catalog else None,
    )


def _catalog_to_list_item(entry) -> SkillListItem:
    """A browsable catalog skill the workspace has not installed.

    ``enabled`` is false and ``id`` is absent: there is no row to act on yet.
    """
    return SkillListItem(
        id=None,
        workspace_id=None,
        name=entry.name,
        category="skill",
        description=entry.description,
        version=entry.version,
        status="NOT_INSTALLED",
        enabled=False,
        author=entry.author,
        type="bundled",
        runtime="markdown",
        config={},
        created_at=None,
        updated_at=None,
        usage_count=0,
        last_used_at=None,
        installed_at=None,
        installed=False,
        tags=list(entry.tags),
        markdown_doc=entry.markdown_doc,
        required_scope=entry.required_scope,
        trust_class=entry.trust_class,
        autonomy=entry.autonomy,
        triggers=list(entry.triggers),
        bundled=entry.bundled,
        slug=entry.slug,
    )


def _workspace_dynamic_definitions(workspace_id: str) -> dict[str, ToolDefinition]:
    """Dynamic tool definitions registered *by this workspace only*.

    ``dynamic_tool_definitions(workspace_id)`` falls back to the process-global
    ``DYNAMIC_TOOL_DEFS`` map whenever no workspace partitions exist at all, and
    that map mixes every workspace's registrations — which is how workspace B
    ends up executing workspace A's dynamic tool. The capability surface reads
    the workspace's own partition directly and never takes that fallback, so the
    accessor is intentionally not used here.
    """
    return dict(WORKSPACE_DYNAMIC_TOOL_DEFS.get(str(workspace_id)) or {})


async def probe_mcp_endpoint(config: dict[str, Any], *, timeout_s: float = MCP_PROBE_TIMEOUT_S) -> dict[str, Any]:
    """Real, bounded MCP discovery. Never reports a connection it did not make.

    Returns one of ``skipped`` (nothing configured, nothing contacted),
    ``connected`` (a real ``tools/list`` round trip), ``timeout``, or ``error``.
    """
    cfg = dict(config or {})
    url = str(cfg.get("url") or "").strip()
    command = str(cfg.get("command") or "").strip()
    if not url and not command:
        return {
            "status": "skipped",
            "detail": "No MCP endpoint configured; nothing was contacted.",
        }

    if not cfg.get("transport"):
        cfg["transport"] = "stdio" if command else "http"

    from ..services.mcp_client_service import (
        McpConfigError,
        mcp_client_service,
        validate_mcp_config,
    )

    try:
        normalized = validate_mcp_config(cfg)
    except McpConfigError as exc:
        return {"status": "error", "detail": f"MCP config is invalid: {exc}"}

    async def _list_tools(session) -> list[str]:
        result = await session.list_tools()
        return [t.name for t in result.tools]

    try:
        async with asyncio.timeout(timeout_s):
            names = await mcp_client_service._run_with_session(normalized, _list_tools)
    except TimeoutError:
        return {
            "status": "timeout",
            "detail": f"No MCP response within {timeout_s:g}s; discovery was abandoned.",
        }
    except Exception as exc:
        return {
            "status": "error",
            "detail": f"MCP discovery failed: {type(exc).__name__}: {exc}",
        }

    return {
        "status": "connected",
        "detail": f"Real tools/list round trip returned {len(names)} tool(s).",
        "tools_count": len(names),
        "tools": names,
        "transport": normalized.get("transport"),
    }


@router.get("/catalog", response_model=list[dict[str, Any]])
async def list_catalog_capabilities(
    category: str | None = Query(default="skill"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Server-side skills catalog.

    Declared before ``/{cap_id}`` so the literal path segment ``catalog`` is not
    matched as a capability id. The catalog is global, so no workspace row is
    read; authentication alone gates it.
    """
    _ = (db, current_user)
    return [catalog_to_wire(e) for e in list_catalog(category)]


@router.get("", response_model=list[SkillListItem])
async def list_capabilities(
    category: str | None = Query(default=None),
    include_catalog: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """List all sovereign workspace capabilities.

    With ``include_catalog=true`` and ``category=skill`` the response also carries
    every bundled catalog skill the workspace has not installed, marked
    ``installed: false`` / ``enabled: false`` with no ``id``.
    """
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    query = select(WorkspaceCapability).where(WorkspaceCapability.workspace_id == wid)
    cat_clean = (category or "").strip().lower()
    if cat_clean:
        query = query.where(WorkspaceCapability.category == cat_clean)

    query = query.order_by(WorkspaceCapability.created_at.desc())
    res = await db.execute(query)
    items = res.scalars().all()

    merged: list[SkillListItem] = [_to_list_item(c) for c in items]
    if not include_catalog or cat_clean not in ("skill", "skills"):
        return merged

    installed_names = {c.name for c in items}
    for entry in list_catalog(cat_clean):
        if entry.name not in installed_names:
            merged.append(_catalog_to_list_item(entry))
    return merged


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
            output_schema = payload.config.get("returns") or {
                "type": "object",
                "properties": {},
            }
            td = ToolDefinition(
                name=name,
                description=payload.description or f"Custom workspace tool: {name}",
                category="custom",
                required_scope=f"tool.{name}",
                input_schema=input_schema,
                output_schema=output_schema,
            )

            async def _custom_tool_handler(args: dict[str, Any], workspace_id: str | None = None) -> dict[str, Any]:
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
            output_schema = (cap.config or {}).get("returns") or {
                "type": "object",
                "properties": {},
            }
            td = ToolDefinition(
                name=cap.name,
                description=cap.description or f"Custom workspace tool: {cap.name}",
                category="custom",
                required_scope=f"tool.{cap.name}",
                input_schema=input_schema,
                output_schema=output_schema,
            )

            async def _custom_tool_handler(args: dict[str, Any], workspace_id: str | None = None) -> dict[str, Any]:
                return {"status": "ok", "tool": cap.name, "echo": args}

            register_dynamic_tool(td, _custom_tool_handler, workspace_id=str(wid))

    if payload.status is not None:
        cap.status = payload.status
    if payload.description is not None:
        cap.description = payload.description

    config_patch: dict[str, Any] = dict(payload.config or {})
    if payload.autonomy is not None:
        config_patch["autonomy"] = payload.autonomy
    if payload.required_scope is not None:
        required = payload.required_scope.strip()
        if not required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="required_scope cannot be blank.",
            )
        config_patch["required_scope"] = required

    if payload.workspace_id is not None:
        # Verification only. The row above was already fetched scoped to the
        # request-verified workspace, so this cannot widen access — it only
        # catches a client that is updating the wrong workspace.
        try:
            claimed = uuid.UUID(str(payload.workspace_id))
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid workspace ID format",
            )
        if claimed != wid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="workspace_id in the request body does not match the verified workspace.",
            )

    if config_patch:
        merged_cfg = dict(cap.config or {})
        merged_cfg.update(config_patch)
        cap.config = merged_cfg

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

    # A bundled catalog skill is a product artefact, not a workspace row the
    # user owns. Deleting it would drop the definition for every workspace, so
    # the only supported action is disabling it.
    if cap.category == "skill" and is_bundled_skill(cap.name):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"'{cap.name}' is a bundled Vaeloom skill and cannot be deleted. "
                "Disable it instead (PATCH enabled=false) or create your own copy "
                "under a different name."
            ),
        )
    if (cap.type or "custom") != "custom":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Capability type '{cap.type}' is not deletable; only capabilities "
                "of type 'custom' can be deleted. Disable it instead."
            ),
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
    """Execute a real diagnostic test against a capability (no fake synthetic mocks).

    ``TestCapabilityResponse.executed`` states plainly whether anything was run,
    so a validation-only result can never be rendered as a live one.
    """
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

    await record_usage(db, cap)
    await db.commit()

    start_time = time.monotonic()
    try:
        if cap.category == "tool":
            # Static tools are process-wide and safe. Dynamic tools are only
            # resolvable from this workspace's own registration; the global map
            # is never consulted, so another workspace's tool cannot be executed.
            td = ALL_TOOLS.get(cap.name) or _workspace_dynamic_definitions(str(wid)).get(cap.name)
            if td is None:
                return TestCapabilityResponse(
                    status="not_registered",
                    latency_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                    error=(
                        f"No tool named '{cap.name}' is registered for this workspace. "
                        "Dynamic tool registrations are process-local and are lost on "
                        "restart — re-create the capability (POST /api/v1/capabilities) "
                        "or enable it again (PATCH enabled=true) to re-register it."
                    ),
                    output={
                        "detail": "Nothing was executed.",
                        "static_tool_namespaces_checked": len(ALL_TOOLS),
                        "workspace_dynamic_tools": sorted(
                            _workspace_dynamic_definitions(str(wid))
                        ),
                    },
                    executed=False,
                )

            out = await execute_tool(
                tool=td,
                params=payload.input,
                agent_id="test_runner",
                agent_scopes=[td.required_scope, "*"],
                workspace_id=str(wid),
            )
            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            if isinstance(out, dict) and out.get("status") == "error":
                return TestCapabilityResponse(
                    status="error",
                    latency_ms=round(elapsed_ms, 2),
                    error=out.get("error") or str(out.get("result", "Execution failed")),
                    output=out,
                    executed=True,
                )
            return TestCapabilityResponse(
                status="success",
                latency_ms=round(elapsed_ms, 2),
                output=out,
                executed=True,
            )

        if cap.category == "mcp":
            probe = await probe_mcp_endpoint(cap.config or {})
            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            return TestCapabilityResponse(
                status=probe["status"],
                latency_ms=round(elapsed_ms, 2),
                output=probe,
                error=probe.get("detail") if probe["status"] in ("error", "timeout") else None,
                executed=probe["status"] == "connected",
            )

        elapsed_ms = (time.monotonic() - start_time) * 1000.0
        return TestCapabilityResponse(
            status="success",
            latency_ms=round(elapsed_ms, 2),
            output={
                "detail": NO_EXECUTABLE_RUNTIME,
                "category": cap.category,
                "status": cap.status,
                "enabled": bool(cap.enabled),
            },
            executed=False,
        )

    except Exception as exc:
        elapsed_ms = (time.monotonic() - start_time) * 1000.0
        return TestCapabilityResponse(
            status="error",
            latency_ms=round(elapsed_ms, 2),
            error=str(exc),
            executed=False,
        )
