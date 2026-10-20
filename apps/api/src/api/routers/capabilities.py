import asyncio
import contextlib
import json
import logging
import re
import time
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id, get_workspace_id
from ..middleware.rate_limit import rate_limit
from ..models.schema import Plugin, Workspace, WorkspaceCapability, WorkspaceUser
from ..schemas.capability_draft import (
    CapabilityDraftRequest,
    CapabilityDraftValidationResponse,
    DraftSource,
    DraftViolation,
    Severity,
)
from ..services.audit import AuditLogger
from ..services.capability_usage_service import record_usage
from ..services.github_skills_sync import GitHubSkillSyncResult
from ..services.skill_catalog_service import (
    AUTONOMY_VALUES,
    TRUST_CLASSES,
    catalog_to_wire,
    get_catalog_entry,
    is_bundled_skill,
    list_catalog,
    tool_scope_vocabulary,
)
from ..services.skill_injection import WORKSPACE_AUTHORED_TRUST
from ..tools.definitions import ALL_TOOLS, ToolDefinition
from ..tools.executor import (
    WORKSPACE_DYNAMIC_TOOL_DEFS,
    approval_gated_tools,
    execute_tool,
    invalidate_tool_enable_cache,
    register_dynamic_tool,
    unregister_dynamic_tools,
)

logger = logging.getLogger(__name__)

router = APIRouter()

NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\. ]{1,255}$")
VALID_CATEGORIES = frozenset({"skill", "connector", "mcp", "plugin", "tool", "agent"})

AutonomyLiteral = Literal["suggest", "autonomous", "approval_required"]

MCP_PROBE_TIMEOUT_S = 5.0

# A skill document is prompt payload, not a standalone file: the directive
# budget is ``skill_injection.SKILL_DIRECTIVE_TOKEN_BUDGET`` (4000 tokens,
# roughly 16KB of text), and a row past this cap cannot be rendered within any
# realistic prompt envelope. Refused at write time so the failure is a 400 the
# author sees, not a silently dropped layer at injection time.
MARKDOWN_DOC_MAX_CHARS = 256 * 1024

# Workspace rows returned by ``list_capabilities`` in one response. Nothing
# enforced a bound before; a pathological workspace returned its entire row set
# on every poll. Past the cap the response is truncated and says so via
# ``X-Capabilities-Truncated`` / ``X-Capabilities-Limit`` headers -- a listing
# endpoint must stay usable at the cap, so truncation is signalled, not an error.
CAPABILITY_LIST_LIMIT = 500

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


class CatalogSkillItem(BaseModel):
    """One browsable catalog entry, exactly as :func:`catalog_to_wire` emits it.

    Typed so the route's contract is machine-checkable in the OpenAPI schema
    rather than ``dict[str, Any]``, which told a generated client nothing.
    """

    slug: str
    name: str
    description: str
    tags: list[str]
    version: str
    author: str
    required_scope: str
    autonomy: str
    trust_class: str
    triggers: list[str]
    markdown_doc: str
    bundled: bool
    self_check: str


class TestCapabilityRequest(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


class TestCapabilityResponse(BaseModel):
    status: str
    latency_ms: float
    output: Any = None
    error: str | None = None
    executed: bool = False
    recorded_usage: bool = True


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
        # Fail closed.
        #
        # This used to silently substitute the caller's first workspace by
        # `created_at`. A client that dropped the `X-Workspace-Id` header then
        # operated on a workspace it never selected and received a 200 to prove
        # it worked. A cross-tenant write looks identical from the caller's side
        # when they own more than one workspace.
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


async def _require_workspace_owner(
    db: AsyncSession, user_id: str | None, workspace_id: str | uuid.UUID | None
) -> uuid.UUID:
    """Resolve the workspace and require that the caller owns it.

    Ownership, not a role, is the privilege boundary available today.
    ``services.auth_service._create_jwt`` does not put a ``roles`` claim in the
    token, so ``dependencies.require_role`` would reject every real user with
    403 -- the routes it guards today (``admin_console``, ``iam``, ``gdpr``)
    are enterprise-only and mostly dormant. ``workspaces.user_id`` is real,
    enforced data, so privileged capability operations gate on it.

    Members keep read access and workspace-scoped configuration writes; the
    owner alone can destroy a capability or dispatch its code.
    """
    wid = await _verify_workspace_access(db, user_id, workspace_id)
    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identity",
        )

    res = await db.execute(
        select(Workspace.id).where(Workspace.id == wid, Workspace.user_id == uid)
    )
    if res.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner may perform this operation",
        )
    return wid


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _as_tags(raw: Any) -> list[str]:
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str) and raw.strip():
        return [part.strip() for part in raw.split(",") if part.strip()]
    return []


_SECRET_CONFIG_KEYS = frozenset(
    {
        "auth_token",
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "client_secret",
        "secret",
        "password",
        "private_key",
        "token",
        "authorization",
    }
)
_REDACTED = "[redacted]"


def _redact_config(config: dict[str, Any]) -> dict[str, Any]:
    """Strip credential-bearing keys from a config blob before it leaves the API.

    ``config`` is an unvalidated JSONB column returned verbatim by
    ``_serialize_cap`` on GET, GET-by-id, POST and PATCH. The draft validator
    itself reasons about ``config["headers"]`` and ``config["env"]``, so those
    are expected shapes -- and in practice they carry bearer tokens. Writes
    still accept the real values; only the read path is redacted, so a
    round-trip returns a marker rather than a secret.
    """
    if not isinstance(config, dict):
        return config

    out: dict[str, Any] = {}
    for key, value in config.items():
        if isinstance(key, str) and key.lower() in _SECRET_CONFIG_KEYS:
            out[key] = _REDACTED
        elif isinstance(value, dict):
            out[key] = _redact_config(value)
        elif isinstance(value, list):
            out[key] = [
                _redact_config(item) if isinstance(item, dict) else item for item in value
            ]
        else:
            out[key] = value
    return out


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
        config=_redact_config(dict(c.config or {})),
        created_at=_iso(c.created_at),
        updated_at=_iso(c.updated_at),
        usage_count=int(c.usage_count or 0),
        last_used_at=_iso(c.last_used_at),
        installed_at=_iso(c.installed_at),
    )


def _config_autonomy(config: dict[str, Any]) -> str | None:
    value = config.get("autonomy")
    return value if value in AUTONOMY_VALUES else None


def _effective_trust_class(config: dict[str, Any], catalog) -> str | None:
    """The trust class the runtime will actually apply to this row.

    ``services/skill_injection.py`` downgrades to ``community`` whenever the
    workspace supplied ``config["markdown_doc"]``, even when the row name still
    matches a bundled catalog slug. Reporting ``core_trusted`` here instead made
    the API's trust badge a statement about a document the runtime quarantines.
    """
    declared = config.get("trust_class")
    if isinstance(declared, str) and declared.strip():
        return declared
    workspace_authored = isinstance(config.get("markdown_doc"), str) and bool(
        config["markdown_doc"].strip()
    )
    if catalog and not workspace_authored:
        return catalog.trust_class
    return WORKSPACE_AUTHORED_TRUST


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
        trust_class=_effective_trust_class(config, catalog),
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


# ── Draft validation (unsaved capabilities) ────────────────────────────────
#
# Every category-specific check below delegates to the validator that already
# owns the rules, or reports that no validator exists. Nothing here executes the
# capability and nothing here writes a row.

_UNSUBSTITUTED_VAR_RE = re.compile(r"\$\{[^}]*\}")

#: Connector types ``ConnectorExtService._validate_config`` actually has a clause
#: for. Anything else has no validator and must be reported as such.
_REAL_CONNECTOR_TYPES = frozenset({"rest", "graphql", "database", "file", "mcp"})


class _RuleLedger:
    """Counts the rules that actually ran and collects what they rejected.

    ``rules_checked`` is the number of :meth:`check` calls, so it varies with the
    category and with what the draft declared instead of being a constant. A rule
    that was skipped is not counted, which is why short-circuit paths return
    early rather than padding the count.
    """

    def __init__(self) -> None:
        self.checked = 0
        self.violations: list[DraftViolation] = []

    def check(
        self,
        rule: str,
        *,
        passed: bool,
        message: str = "",
        line: int | None = None,
        severity: Severity = "hard",
    ) -> bool:
        self.checked += 1
        if not passed:
            self.violations.append(
                DraftViolation(rule=rule, message=message, line=line, severity=severity)
            )
        return passed

    def adopt(self, rule_count: int) -> None:
        """Take over the rule count a delegated validator reported for itself."""
        self.checked += max(0, int(rule_count))


def _parse_draft_json(raw: str) -> tuple[Any, list[str], str | None]:
    """Parse JSON text while keeping duplicate keys visible.

    Returns ``(value, duplicate_keys, error)``. Duplicate keys only survive in the
    text form — a parsed object has already discarded them — so this is the only
    way a duplicate property name can be reported instead of silently collapsed.
    """
    duplicates: list[str] = []

    def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        keys = [key for key, _ in pairs]
        duplicates.extend(sorted({k for k in keys if keys.count(k) > 1}))
        return dict(pairs)

    try:
        return json.loads(raw, object_pairs_hook=_pairs), duplicates, None
    except json.JSONDecodeError as exc:
        return None, duplicates, (
            f"not valid JSON: {exc.msg} (line {exc.lineno}, column {exc.colno})"
        )


def _unsubstituted_vars(config: dict[str, Any]) -> list[str]:
    """Every ``${VAR}`` left unsubstituted in an MCP header or env value."""
    hits: list[str] = []
    for section in ("headers", "env"):
        values = config.get(section)
        if not isinstance(values, dict):
            continue
        for key, value in values.items():
            if isinstance(value, str):
                for match in _UNSUBSTITUTED_VAR_RE.findall(value):
                    hits.append(f"{section}.{key}={match}")
    return sorted(set(hits))


def _validation_errors_text(exc: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in err['loc']) or '<root>'}: {err['msg']}"
        for err in exc.errors()
    )


def _validate_skill_draft(
    ledger: _RuleLedger, name: str, config: dict[str, Any], trust_class: str | None
) -> tuple[DraftSource, str | None]:
    """Hand the document to the real skill validator instead of restating its rules.

    When the draft carries no markdown but its name matches a bundled entry, the
    catalog document is what the author is editing a copy of, so that document is
    validated and the source is reported as ``catalog``. The catalog self-check
    runs either way: a copy of a bundled skill is still held to its own contract.
    """
    from ..services.skill_catalog_service import TRUST_CLASSES, validate_skill_document

    catalog = get_catalog_entry(name)
    markdown = str(config.get("markdown_doc") or config.get("doc") or "")
    tags = _as_tags(config.get("tags"))
    required_scope = str(config.get("required_scope") or "")
    triggers = _as_tags(config.get("triggers"))
    source: DraftSource = "draft"
    slug: str | None = None
    if not markdown.strip() and catalog is not None:
        # Same precedence the skill test endpoint uses: the draft's own values
        # win, and the catalog supplies whatever the draft has not declared yet.
        markdown = catalog.markdown_doc
        tags = tags or list(catalog.tags)
        required_scope = required_scope or catalog.required_scope
        triggers = triggers or list(catalog.triggers)
        source = "catalog"
        slug = catalog.slug

    result = validate_skill_document(
        markdown_doc=markdown,
        required_scope=required_scope,
        tags=tags,
        entry=catalog,
        triggers=triggers,
    )
    ledger.adopt(result.rules_checked)
    ledger.violations.extend(DraftViolation(**v.model_dump()) for v in result.violations)

    ledger.check(
        "SKILL-TRUST-CLASS",
        passed=trust_class is None or trust_class in TRUST_CLASSES,
        message=(
            f"trust_class '{trust_class}' is not one of {sorted(TRUST_CLASSES)}; "
            "the skill catalog can only emit those values"
        ),
        severity="soft",
    )
    return source, slug


def _validate_tool_draft(
    ledger: _RuleLedger, name: str, description: str, config: dict[str, Any]
) -> None:
    """Check the JSON Schema the dynamic-tool registry actually needs.

    ``ToolDefinition.input_schema`` is typed ``dict[str, Any]``, so Pydantic
    accepts a malformed schema and the defect only surfaces later as a failure
    against a caller's arguments. These rules are the ones the create path skips.
    """
    raw_schema = config.get("parameters")
    if raw_schema is None:
        ledger.check(
            "TOOL-SCHEMA-PRESENT",
            passed=False,
            message=(
                "Tool draft declares no 'parameters' schema; the create path would "
                "register it with an empty object schema that rejects every argument"
            ),
        )
        return

    duplicate_keys: list[str] = []
    if isinstance(raw_schema, str):
        raw_schema, duplicate_keys, parse_error = _parse_draft_json(raw_schema)
        ledger.check(
            "TOOL-SCHEMA-JSON",
            passed=parse_error is None,
            message=f"config.parameters is {parse_error}",
        )

    if not isinstance(raw_schema, dict):
        ledger.check(
            "TOOL-SCHEMA-OBJECT",
            passed=False,
            message=(
                "config.parameters must be a JSON Schema object, got "
                f"{type(raw_schema).__name__}"
            ),
        )
        return

    ledger.check(
        "TOOL-SCHEMA-DUPLICATE-KEY",
        passed=not duplicate_keys,
        message=f"config.parameters declares duplicate JSON keys: {duplicate_keys}",
    )
    ledger.check(
        "TOOL-SCHEMA-OBJECT",
        passed=raw_schema.get("type") == "object",
        message=(
            "config.parameters must declare type 'object', got "
            f"{raw_schema.get('type')!r}"
        ),
    )

    properties = raw_schema.get("properties")
    if isinstance(properties, dict):
        ledger.check("TOOL-PROPERTIES-OBJECT", passed=True)
    else:
        ledger.check(
            "TOOL-PROPERTIES-OBJECT",
            passed=False,
            message=(
                "config.parameters.properties must be an object mapping property "
                "names to schemas"
            ),
        )
        properties = {}

    for prop_name, prop in properties.items():
        declared_type = prop.get("type") if isinstance(prop, dict) else None
        ledger.check(
            "TOOL-PROPERTY-TYPE",
            passed=isinstance(declared_type, str) and bool(declared_type.strip()),
            message=(
                f"Property '{prop_name}' declares no 'type'; an untyped property "
                "cannot be validated against caller arguments"
            ),
        )

    required = raw_schema.get("required") or []
    if isinstance(required, list):
        ledger.check("TOOL-REQUIRED-LIST", passed=True)
    else:
        ledger.check(
            "TOOL-REQUIRED-LIST",
            passed=False,
            message="config.parameters.required must be a list of property names",
        )
        required = []

    undeclared = [item for item in required if item not in properties]
    ledger.check(
        "TOOL-REQUIRED-RESOLVED",
        passed=not undeclared,
        message=(
            "config.parameters.required names properties that are not declared: "
            f"{undeclared}"
        ),
    )

    try:
        ToolDefinition(
            name=name,
            description=description or f"Custom workspace tool: {name}",
            category="custom",
            required_scope=f"tool.{name}",
            input_schema=raw_schema,
            output_schema=config.get("returns") or {"type": "object", "properties": {}},
        )
        ledger.check("TOOL-REGISTRABLE", passed=True)
    except ValidationError as exc:
        ledger.check(
            "TOOL-REGISTRABLE",
            passed=False,
            message=f"ToolDefinition would reject this draft — {_validation_errors_text(exc)}",
        )


def _validate_mcp_draft(ledger: _RuleLedger, config: dict[str, Any]) -> None:
    """Mirror ``validate_mcp_config`` clause-for-clause by calling it.

    The transport set, the command/args or url requirement and the URL scheme
    allow-list are that function's clauses; its message is surfaced verbatim so the
    author is told which clause failed. The other rules below are the two it does
    not implement.
    """
    from ..services.mcp_client_service import McpConfigError, validate_mcp_config

    ledger.check(
        "MCP-TRANSPORT-SET",
        passed=str(config.get("transport") or "") in ("stdio", "http"),
        message=(
            f"transport {config.get('transport')!r} is not in the real transport set "
            "('stdio' | 'http')"
        ),
    )

    command = str(config.get("command") or "").strip()
    url = str(config.get("url") or "").strip()
    ledger.check(
        "MCP-ENDPOINT-DECLARED",
        passed=bool(command) or bool(url),
        message=(
            "MCP draft declares neither 'command' nor 'url'; there is no endpoint to "
            "validate and none is invented"
        ),
    )

    unsubstituted = _unsubstituted_vars(config)
    ledger.check(
        "MCP-UNSUBSTITUTED-VAR",
        passed=not unsubstituted,
        message=(
            "Unsubstituted ${VAR} placeholders remain in header/env values: "
            f"{unsubstituted}"
        ),
    )

    try:
        validate_mcp_config(dict(config))
        ledger.check("MCP-CONFIG-VALIDATOR", passed=True)
    except McpConfigError as exc:
        ledger.check("MCP-CONFIG-VALIDATOR", passed=False, message=str(exc))


def _validate_agent_draft(
    ledger: _RuleLedger, name: str, description: str, config: dict[str, Any]
) -> None:
    """Check an agent draft against the live agent and tool registries.

    ``autonomy`` is not re-checked here: the shared ``AUTONOMY-ENUM`` rule already
    compares it against the real enum for every category.
    """
    from ..orchestrator.router import AGENT_REGISTRY

    mission = str(config.get("mission") or description or "").strip()
    ledger.check(
        "AGENT-FIELD-PRESENT",
        passed=bool(mission),
        message=(
            "Agent draft declares neither a 'mission' in config nor a description; "
            "there is nothing for the agent to be told"
        ),
    )

    declared_tools = _as_tags(config.get("tools")) or _as_tags(config.get("tool_ids"))
    agent_aliases = {key.lower().replace("-", "_") for key in AGENT_REGISTRY}
    unresolved = [
        tool
        for tool in declared_tools
        if tool not in ALL_TOOLS and tool.lower().replace("-", "_") not in agent_aliases
    ]
    ledger.check(
        "AGENT-TOOL-RESOLVABLE",
        passed=not unresolved,
        message=(
            "Agent draft references tool ids that resolve against neither the tool "
            f"registry ({len(ALL_TOOLS)} tools) nor the agent registry "
            f"({len(AGENT_REGISTRY)} agents): {unresolved}"
        ),
    )


def _validate_connector_draft(
    ledger: _RuleLedger, config: dict[str, Any]
) -> tuple[DraftSource, str | None]:
    """Delegate to the connector service's own config validator.

    ``ConnectorExtService._validate_config`` owns the per-type clauses (url policy
    for rest/graphql, connectionString, path) and ``validate_mcp_config`` owns the
    mcp ones, so both are called rather than restated. A connector whose declared
    type is outside the real set has no clause anywhere: that returns
    ``(None, None)`` so the endpoint answers ``not_validated`` instead of
    inventing a pass.
    """
    from ..services.connector_ext_service import connector_ext_service
    from ..services.mcp_client_service import McpConfigError, validate_mcp_config

    connector_type = str(config.get("type") or "").strip()
    ledger.check(
        "CONNECTOR-TYPE-PRESENT",
        passed=bool(connector_type),
        message="Connector draft has no 'type'; the connector runtime reads it first",
    )
    if not connector_type:
        return "none", None

    if connector_type.lower() == "mcp":
        try:
            validate_mcp_config(dict(config))
            ledger.check("CONNECTOR-MCP-CONFIG", passed=True)
        except McpConfigError as exc:
            ledger.check("CONNECTOR-MCP-CONFIG", passed=False, message=str(exc))
        return "delegated", None

    if connector_type.lower() not in _REAL_CONNECTOR_TYPES:
        return "none", None

    try:
        connector_ext_service._validate_config(connector_type.lower(), dict(config))
        ledger.check("CONNECTOR-CONFIG-VALIDATOR", passed=True)
    except HTTPException as exc:
        ledger.check(
            "CONNECTOR-CONFIG-VALIDATOR",
            passed=False,
            message=str(exc.detail),
        )
    return "delegated", None


def _validate_plugin_draft(
    ledger: _RuleLedger, name: str, description: str, config: dict[str, Any]
) -> None:
    """Validate the plugin manifest against the contract the plugin router accepts.

    ``RegisterPluginRequest`` is the real registration schema, so it — not a
    hand-copied field list — decides which manifest fields are required.
    """
    from ..schemas.plugin import RegisterPluginRequest

    fields = dict(config)
    manifest = config.get("manifest")
    if isinstance(manifest, str):
        parsed, _duplicates, parse_error = _parse_draft_json(manifest)
        ledger.check(
            "PLUGIN-MANIFEST-JSON",
            passed=parse_error is None,
            message=f"config.manifest is {parse_error}",
        )
        if isinstance(parsed, dict):
            fields = {**parsed, **config}
    elif isinstance(manifest, dict):
        fields = {**manifest, **config}
    elif manifest is not None:
        ledger.check(
            "PLUGIN-MANIFEST-JSON",
            passed=False,
            message=(
                "config.manifest must be a JSON object or a JSON object string, got "
                f"{type(manifest).__name__}"
            ),
        )

    entry_point = fields.get("entry_point")
    ledger.check(
        "PLUGIN-ENTRYPOINT-PRESENT",
        passed=isinstance(entry_point, str) and bool(entry_point.strip()),
        message="Plugin manifest declares no non-empty 'entry_point'; nothing would load",
    )

    try:
        RegisterPluginRequest(
            name=str(fields.get("name") or name),
            version=fields.get("version"),
            author=fields.get("author"),
            description=str(
                description if fields.get("description") is None else fields["description"]
            ),
            license=fields.get("license"),
            min_app_version=fields.get("min_app_version"),
            tags=_as_tags(fields.get("tags")),
            permissions=fields.get("permissions"),
            entry_point=entry_point,
        )
        ledger.check("PLUGIN-MANIFEST-CONTRACT", passed=True)
    except ValidationError as exc:
        ledger.check(
            "PLUGIN-MANIFEST-CONTRACT",
            passed=False,
            message=(
                "RegisterPluginRequest would reject this manifest — "
                f"{_validation_errors_text(exc)}"
            ),
        )


@router.get("/catalog", response_model=list[CatalogSkillItem])
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


@router.get("/tools/definitions", response_model=list[dict[str, Any]])
async def list_tool_definitions(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Authoritative server-side tool definitions reflecting ALL_TOOLS.

    Declared before ``/{cap_id}`` so literal path segment ``tools`` is not
    matched as a capability id.
    """
    _ = (db, current_user)
    return [
        {
            "name": td.name,
            "description": td.description,
            "required_scope": td.required_scope,
            "category": td.category,
            "trust_class": td.trust_class,
            "input_schema": td.input_schema,
            "output_schema": td.output_schema,
        }
        for td in ALL_TOOLS.values()
    ]


def _derive_draft_status(ledger: _RuleLedger, category_validator: str | None) -> str:
    if any(v.severity == "hard" for v in ledger.violations):
        return "error"
    if ledger.violations:
        return "warning"
    if category_validator is None:
        return "not_validated"
    return "success"


def _draft_detail(
    status: str, ledger: _RuleLedger, category: str, category_validator: str | None
) -> str:
    hard = sum(1 for v in ledger.violations if v.severity == "hard")
    soft = len(ledger.violations) - hard
    tally = f"{ledger.checked} rule(s) evaluated; {hard} hard and {soft} soft violation(s)"
    if status == "not_validated":
        return (
            f"No validator exists for category '{category}': {tally}. The draft was "
            "not approved for anything, only measured."
        )
    if category_validator is None:
        return f"Invalid category '{category}': {tally}. Only the shared draft rules ran."
    return f"{tally}; checked with {category_validator}. Nothing was executed or persisted."


@router.post("/validate", response_model=CapabilityDraftValidationResponse)
async def validate_capability_draft(
    payload: CapabilityDraftRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
):
    """Validate an UNSAVED capability draft. Executes nothing and persists nothing.

    The counterpart to ``POST /api/v1/capabilities/{id}/test``, which needs a
    minted UUID an author does not have yet: this takes the same field set a
    create takes and answers before the row exists.

    Status is derived from real violations, never asserted: ``error`` when a hard
    rule failed, ``warning`` when only soft rules failed, ``success`` when
    everything that ran passed, and ``not_validated`` when this category has no
    validator — in which case ``detail`` says so instead of a pass being claimed.

    The response carries neither the workspace id nor the requested name, and the
    duplicate check is scoped to the verified workspace, so a caller cannot learn
    whether a capability of some name exists in a workspace they cannot see.
    """
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    name = payload.name.strip()
    category = payload.category.strip().lower()
    config = dict(payload.config or {})
    ledger = _RuleLedger()

    ledger.check(
        "CATEGORY-VALID",
        passed=category in VALID_CATEGORIES,
        message=(
            f"Invalid category '{payload.category}'. Must be one of: "
            f"{sorted(VALID_CATEGORIES)}"
        ),
    )

    if ledger.check(
        "NAME-PATTERN",
        passed=bool(NAME_PATTERN.match(name)),
        message=(
            "Capability name contains invalid characters. Use alphanumeric, "
            "dashes, dots, or underscores."
        ),
    ) and category in VALID_CATEGORIES:
        existing = await db.execute(
            select(WorkspaceCapability.id).where(
                WorkspaceCapability.workspace_id == wid,
                WorkspaceCapability.name == name,
                WorkspaceCapability.category == category,
            )
        )
        ledger.check(
            "NAME-COLLISION",
            passed=existing.scalar_one_or_none() is None,
            message=(
                f"A capability named '{name}' already exists in category "
                f"'{category}' for this workspace; the create path returns 409."
            ),
        )

    autonomy = payload.autonomy or config.get("autonomy")
    if autonomy is not None:
        ledger.check(
            "AUTONOMY-ENUM",
            passed=str(autonomy) in AUTONOMY_VALUES,
            message=(
                f"autonomy {autonomy!r} is not one of the real autonomy values "
                f"{sorted(AUTONOMY_VALUES)}"
            ),
        )

    source: DraftSource = "none"
    catalog_slug: str | None = None
    category_validator: str | None = None

    if category == "skill":
        source, catalog_slug = _validate_skill_draft(
            ledger, name, config, payload.trust_class or config.get("trust_class")
        )
        category_validator = "skill_catalog_service.validate_skill_document"
    elif category == "tool":
        _validate_tool_draft(ledger, name, payload.description, config)
        category_validator = "draft JSON Schema checks + ToolDefinition registration"
        source = "delegated"
    elif category == "mcp":
        _validate_mcp_draft(ledger, config)
        category_validator = "mcp_client_service.validate_mcp_config"
        source = "delegated"
    elif category == "agent":
        _validate_agent_draft(ledger, name, payload.description, config)
        category_validator = "orchestrator AGENT_REGISTRY + tools ALL_TOOLS"
        source = "delegated"
    elif category == "connector":
        source, _ = _validate_connector_draft(ledger, config)
        category_validator = (
            "connector_ext_service._validate_config" if source == "delegated" else None
        )
    elif category == "plugin":
        _validate_plugin_draft(ledger, name, payload.description, config)
        category_validator = "schemas.plugin.RegisterPluginRequest"
        source = "delegated"

    status = _derive_draft_status(ledger, category_validator)

    return CapabilityDraftValidationResponse(
        status=status,
        rules_checked=ledger.checked,
        violations=ledger.violations,
        executed=False,
        category=category,
        validated_source=source,
        catalog_slug=catalog_slug,
        detail=_draft_detail(status, ledger, category, category_validator),
    )


@router.get("", response_model=list[SkillListItem])
async def list_capabilities(
    response: Response,
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

    The workspace row set is capped at ``CAPABILITY_LIST_LIMIT`` rows; past the
    cap the response is truncated and the ``X-Capabilities-Truncated`` /
    ``X-Capabilities-Limit`` headers make that explicit. The catalog merge then
    sees the returned, possibly truncated rows.
    """
    user_id = _get_user_id(current_user)
    wid = await _verify_workspace_access(db, user_id, workspace_id)

    query = select(WorkspaceCapability).where(WorkspaceCapability.workspace_id == wid)
    cat_clean = (category or "").strip().lower()
    if cat_clean:
        query = query.where(WorkspaceCapability.category == cat_clean)

    query = (
        query.order_by(WorkspaceCapability.created_at.desc())
        .limit(CAPABILITY_LIST_LIMIT + 1)
    )
    res = await db.execute(query)
    items = list(res.scalars().all())
    if len(items) > CAPABILITY_LIST_LIMIT:
        logger.warning(
            "Capability list for workspace %s exceeded %d rows; truncating",
            wid,
            CAPABILITY_LIST_LIMIT,
        )
        items = items[:CAPABILITY_LIST_LIMIT]
        response.headers["X-Capabilities-Truncated"] = "true"
        response.headers["X-Capabilities-Limit"] = str(CAPABILITY_LIST_LIMIT)

    merged: list[SkillListItem] = [_to_list_item(c) for c in items]
    if not include_catalog or cat_clean not in ("skill", "skills"):
        return merged

    installed_names = {c.name for c in items}
    for entry in list_catalog(cat_clean):
        if entry.name not in installed_names:
            merged.append(_catalog_to_list_item(entry))
    return merged


def _validate_config_claims(category: str, config: dict[str, Any] | None) -> None:
    """Refuse a row whose `config` claims something the runtime cannot honour.

    Scope, autonomy and trust class are validated here because each one
    silently misbehaves rather than erroring: an unknown scope fails closed at
    execution time with a permission error the user cannot act on, an unknown
    autonomy is dropped by `_config_autonomy` so the row reads back as "never
    declared", and an unknown trust class is surfaced verbatim as a trust badge
    for a classification the injector never applied.

    The skill *document* is deliberately NOT validated here. Its rules are
    lint, not safety -- `skill_injection` quarantines and fences whatever text
    it receives, and `/capabilities/{id}/test` exists precisely to diagnose a
    document that fails those rules. Hard-blocking on create would make a
    malformed document undiagnosable, because it could never be created. Draft
    authors reach for `/validate` and `/test` for that. Size is the one property
    checked here: a document past `MARKDOWN_DOC_MAX_CHARS` is refused because
    every copy -- storage, validation, prompt assembly -- scales with it.
    """
    if not isinstance(config, dict) or not config:
        return

    markdown_doc = config.get("markdown_doc")
    if isinstance(markdown_doc, str) and len(markdown_doc) > MARKDOWN_DOC_MAX_CHARS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"markdown_doc is {len(markdown_doc)} characters; the maximum is "
                f"{MARKDOWN_DOC_MAX_CHARS}. Skill documents are injected into the "
                "prompt, so the cap bounds how much of a turn one row can own."
            ),
        )

    scope = config.get("required_scope")
    if isinstance(scope, str) and scope.strip():
        unknown = [
            part.strip()
            for part in scope.split(",")
            if part.strip() and part.strip() not in tool_scope_vocabulary()
        ]
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Unknown required_scope {', '.join(repr(item) for item in unknown)}. "
                    "A scope the backend does not emit fails closed at execution time with "
                    "a permission error the user cannot act on. Known scopes: "
                    f"{', '.join(sorted(tool_scope_vocabulary()))} "
                    "(canonical live list: GET /api/v1/capabilities/tools/definitions)."
                ),
            )

    autonomy = config.get("autonomy")
    if isinstance(autonomy, str) and autonomy.strip() and autonomy not in AUTONOMY_VALUES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown autonomy {autonomy!r}. Must be one of: {sorted(AUTONOMY_VALUES)}",
        )

    trust_class = config.get("trust_class")
    if isinstance(trust_class, str) and trust_class.strip() and trust_class not in TRUST_CLASSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown trust_class {trust_class!r}. Must be one of: {sorted(TRUST_CLASSES)}",
        )


async def _audit(
    db: AsyncSession,
    *,
    action: str,
    capability_id: str,
    name: str,
    category: str,
    user_id: str | None,
    tenant_id: str | None,
    workspace_id: uuid.UUID,
    details: dict[str, Any] | None = None,
) -> None:
    """Record a capability mutation in ``audit_events``.

    This is the durable answer to "who enabled or deleted this, when, and from
    where". Nothing else in the capability path persists it: ``usage_count``
    tracks executions, not intent, and ``services.audit.AuditMiddleware`` is
    defined but never registered in ``main.py`` -- so before this, the answer
    did not exist anywhere.

    Scoped to capability mutations by choice. A capability is a thing an
    operator grants execution rights to, so who changed it is a compliance
    question. Registering ``AuditMiddleware`` globally would add a database
    write to every request in the product to answer the same question for
    reads.

    Takes primitives rather than the ORM row so it can be called after a
    DELETE, where the instance is detached and its attributes are gone.

    Never raises. An audit-table outage must not become a denial of service on
    the operation itself, which is the same trade ``capability_usage_service``
    makes. The failure is logged at ERROR rather than WARNING so it is
    alertable, and the caller still returns its real result.
    """
    try:
        await AuditLogger(db).log(
            action,
            resource_type="capability",
            resource_id=capability_id,
            details={"name": name, "category": category, **(details or {})},
            tenant_id=tenant_id,
            workspace_id=str(workspace_id),
            user_id=user_id,
        )
        await db.commit()
    except Exception:
        logger.exception(
            "Failed to record capability audit event %s for %s; the mutation "
            "itself succeeded and was NOT rolled back.",
            action,
            name,
        )
        await db.rollback()


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

    from ..services.skill_catalog_service import PROHIBITED_EXTERNAL_DOMAINS

    if name.lower() in PROHIBITED_EXTERNAL_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Capability '{name}' is excluded by platform policy. Vaeloom workspace domain is restricted to career intelligence and verified platform tools.",
        )

    # Plugin capabilities are a Registry-delivered executable payload, so they
    # are enterprise-only. The duplicate/name checks below never run for a gated
    # category: the gate is a read-and-write boundary, not a validation error.
    if category == "plugin" and not settings.enterprise_routes_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Plugin runtime is enterprise-gated",
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
        with contextlib.suppress(ValueError, TypeError):
            tid = uuid.UUID(str(tenant_id))

    _validate_config_claims(category, payload.config)

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

    # A row for a name that a built-in tool already owns is a POLICY row, not a
    # tool definition: the enable gate reads it and nothing else should. Since
    # ToolsView now creates exactly these rows to switch a built-in off, the old
    # behaviour registered an echo stub with an empty schema under the built-in's
    # name, which then showed up in the registry listing as a phantom custom tool
    # shadowing a real one. Execution is unaffected (`get_tool_definition` checks
    # ALL_TOOLS first) but the listing lied.
    if category == "tool":
        shadows_builtin = name in ALL_TOOLS
        try:
            if shadows_builtin:
                logger.info(
                    f"Capability row for built-in tool '{name}' recorded as policy only; "
                    "no dynamic ToolDefinition registered"
                )
            else:
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

    # The plugin registry binding rides the SAME transaction as the capability
    # row: a plugin capability IS the executable, unlike the tool branch above,
    # whose policy row survives a registration failure. Union semantics:
    # capability insert + registry bind commit together or the error propagates.
    if category == "plugin":
        entry_point = payload.config.get("entry_point")
        if not isinstance(entry_point, str) or not entry_point.strip():
            # plugins.entry_point is NOT NULL and there is no truthful default;
            # the server must never invent a filename the author never wrote.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plugin capabilities require config.entry_point; the server will not invent one.",
            )

        permissions = payload.config.get("permissions")
        permissions = dict(permissions) if isinstance(permissions, dict) and permissions else {}

        def list_field(key: str) -> list[Any]:
            value = payload.config.get(key)
            return value if isinstance(value, list) else []

        # Upsert-by-name. The registry's own name lookups are tenant-scoped
        # when a tenant is attached and name-only otherwise (mirrors the
        # readability query in the plugin router), so the re-bind target is
        # resolve-deterministically the row this workspace's tenant already owns.
        plugin_query = select(Plugin).where(Plugin.name == name)
        if tid is not None:
            plugin_query = plugin_query.where(Plugin.tenant_id == str(tid))
        existing_plugin = (await db.execute(plugin_query)).scalar_one_or_none()

        if existing_plugin is not None:
            existing_plugin.version = payload.version
            existing_plugin.author = cap.author
            existing_plugin.description = payload.description or ""
            existing_plugin.license = payload.config.get("license") if isinstance(payload.config.get("license"), str) else ""
            existing_plugin.status = "REGISTERED"
            existing_plugin.permissions = permissions
            existing_plugin.capabilities = list_field("capabilities")
            existing_plugin.hooks = list_field("hooks")
            existing_plugin.tags = list_field("tags")
            existing_plugin.entry_point = entry_point
            existing_plugin.config_schema = None
            existing_plugin.code = payload.config.get("code") if isinstance(payload.config.get("code"), str) else None
            existing_plugin.min_app_version = (
                payload.config.get("min_app_version")
                if isinstance(payload.config.get("min_app_version"), str)
                else None
            )
        else:
            db.add(
                Plugin(
                    name=name,
                    version=payload.version,
                    author=cap.author,
                    description=payload.description or "",
                    license=payload.config.get("license") if isinstance(payload.config.get("license"), str) else "",
                    status="REGISTERED",
                    permissions=permissions,
                    capabilities=list_field("capabilities"),
                    hooks=list_field("hooks"),
                    tags=list_field("tags"),
                    entry_point=entry_point,
                    tenant_id=str(tid) if tid is not None else None,
                    config_schema=None,
                    code=payload.config.get("code") if isinstance(payload.config.get("code"), str) else None,
                    min_app_version=(
                        payload.config.get("min_app_version")
                        if isinstance(payload.config.get("min_app_version"), str)
                        else None
                    ),
                )
            )

    db.add(cap)
    await db.commit()
    await db.refresh(cap)

    await _audit(
        db,
        action="capability.created",
        capability_id=str(cap.id),
        name=cap.name,
        category=cap.category,
        user_id=user_id,
        tenant_id=tenant_id,
        workspace_id=wid,
        details={"enabled": cap.enabled, "type": cap.type},
    )

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
            # Same policy-row distinction as create: a row for a built-in name
            # carries no schema, and registering an empty echo stub under it
            # would shadow the real tool in the registry listing.
            if cap.name in ALL_TOOLS:
                logger.info(
                    f"Re-enabling built-in tool '{cap.name}': policy row only, "
                    "no dynamic ToolDefinition registered"
                )
            else:
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

    # Same contract as create: a row must not be able to drift into a claim the
    # runtime cannot honour. Validated on the merged patch so a partial update
    # that omits the key keeps whatever is already stored -- and a stored value
    # that predates this check is surfaced rather than silently accepted.
    if config_patch:
        merged = {**(cap.config or {}), **config_patch}
        _validate_config_claims(cap.category, merged)

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
    # The executor's enable gate caches the disabled set per workspace. Without
    # this the toggle is invisible to execution until the TTL expires, so the
    # operator watches a disabled tool keep running and concludes the switch is
    # broken. Invalidate after the commit so no reader can observe a cleared
    # cache that would still answer with the pre-write set.
    if cap.category == "tool":
        invalidate_tool_enable_cache(str(wid))

    # Record what actually changed, not just that something changed. An
    # enable/disable is a privilege decision and `enabled_after` is the field an
    # operator needs when asking "who turned this off and when".
    if payload.enabled is not None or config_patch or payload.status is not None:
        await _audit(
            db,
            action="capability.updated",
            capability_id=str(cap.id),
            name=cap.name,
            category=cap.category,
            user_id=user_id,
            tenant_id=None,
            workspace_id=wid,
            details={
                "enabled_after": cap.enabled,
                "status_after": cap.status,
                "config_keys_changed": sorted(config_patch.keys()) if config_patch else [],
            },
        )
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
    wid = await _require_workspace_owner(db, user_id, workspace_id)

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

    # Captured before the row goes: after `db.delete()` + commit the instance
    # is detached and its attributes are gone, and the id is the thing the
    # audit trail is keyed on.
    deleted_id = str(cap.id)
    deleted_name = cap.name
    deleted_category = cap.category
    deleted_type = cap.type

    await db.delete(cap)
    await db.commit()

    await _audit(
        db,
        action="capability.deleted",
        capability_id=deleted_id,
        name=deleted_name,
        category=deleted_category,
        user_id=user_id,
        tenant_id=None,
        workspace_id=wid,
        details={"type": deleted_type, "usage_count_at_delete": int(cap.usage_count or 0)},
    )

    # Deleting a disabled tool row must un-block it, or the cached set keeps
    # denying a tool the workspace no longer holds a row for.
    if cap.category == "tool":
        invalidate_tool_enable_cache(str(wid))
    return None


@router.post("/{cap_id}/test", response_model=TestCapabilityResponse)
# Dispatches real tool code in the API process. The global default is 60/min,
# which is indistinguishable from a GET and far too generous for an endpoint
# that runs code.
@rate_limit(max_requests=10, window_seconds=60)
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

    Owner-only: this dispatches real tool code inside the API process, outside
    the orchestrator's approval gate. Read-only categories (skills, agents,
    plugins) validate and do not execute, so those never needed the boundary.
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

    # Owner-only for tool dispatch, checked BEFORE the try below.
    #
    # The handler's `except Exception` converts anything raised inside it into
    # a 200 with `status="error"`. An authorization failure raised there is
    # therefore reported to the caller as success, which is a fail-open. Keep
    # this check outside so the 403 propagates.
    #
    # Scoped to `category == "tool"` because that is the only branch that runs
    # code. Skills, agents and plugins take the validation-only branches below,
    # which execute nothing and stay open to ordinary members.
    if cap.category == "tool":
        await _require_workspace_owner(db, user_id, workspace_id)

    # Skill message-probes are dry runs and must not move `usage_count`: a probe
    # that counted would answer "what would happen on a real turn" with a lie.
    # The intent is read before the counter is. Scoped to the skill branch: a
    # tool's payload may legitimately carry `message`/`pin` keys, and those must
    # not change tool behaviour.
    probe_message = ""
    probe_pin: str | None = None
    if cap.category == "skill" and isinstance(payload.input, dict):
        from ..services.skill_injection import _PIN_SLUG_RE

        probe_message = str(payload.input.get("message") or payload.input.get("prompt") or "")
        raw_pin = payload.input.get("pin")
        if raw_pin is not None:
            if (
                not isinstance(raw_pin, str)
                or not _PIN_SLUG_RE.match(raw_pin)
                or ".." in raw_pin
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "input.pin must be a skill slug matching "
                        "^[a-z0-9][a-z0-9._-]{0,63}$ with no '..'"
                    ),
                )
            probe_pin = raw_pin

    if not (cap.category == "skill" and probe_message.strip()):
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

            # An approval-gated tool may not be dispatched from this route.
            #
            # `approval_gated_tools()` is enforced only in the orchestrator loop,
            # never inside `execute_tool`. Passing `agent_scopes=[..., "*"]` (as
            # this handler did) made every scope check pass unconditionally, so
            # any workspace member could invoke `draft_email`, `move_file`,
            # `execute_code_sandbox` and the rest with an arbitrary payload and
            # no approval record. A row naming a gated tool is trivially
            # creatable: `POST /capabilities {"name":"draft_email",
            # "category":"tool"}` returns 201 and deliberately allows shadowing.
            if cap.name in approval_gated_tools():
                return TestCapabilityResponse(
                    status="approval_required",
                    latency_ms=round((time.monotonic() - start_time) * 1000.0, 2),
                    error=(
                        f"'{cap.name}' is approval-gated and is not executed by this "
                        "endpoint. Run it through the orchestrator, which enforces the "
                        "approval gate before dispatch."
                    ),
                    output={
                        "detail": "Nothing was executed.",
                        "tool": cap.name,
                        "approval_gated": True,
                    },
                    executed=False,
                )

            out = await execute_tool(
                tool=td,
                params=payload.input,
                agent_id="test_runner",
                # Only the tool's own declared scope. The former "*" made every
                # scope assertion in `execute_tool` vacuous.
                agent_scopes=[td.required_scope],
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

        if cap.category == "skill":
            cfg = cap.config or {}
            catalog_entry = get_catalog_entry(cap.name)
            doc = cfg.get("markdown_doc") or (catalog_entry.markdown_doc if catalog_entry else "")
            scope = cfg.get("required_scope") or (catalog_entry.required_scope if catalog_entry else "")
            triggers = cfg.get("triggers") or (list(catalog_entry.triggers) if catalog_entry else [])
            tags = cfg.get("tags") or (list(catalog_entry.tags) if catalog_entry else [])

            from ..services.skill_catalog_service import validate_skill_document
            val_res = validate_skill_document(
                markdown_doc=doc,
                required_scope=scope,
                tags=tags,
                entry=catalog_entry,
            )

            sample_msg = probe_message

            if not sample_msg:
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

            from ..services.prompt_compiler import estimate_tokens, quarantine
            from ..services.skill_injection import (
                SKILL_DIRECTIVE_TOKEN_BUDGET,
                EnabledSkill,
                _normalize,
                _render_block,
                _resolve,
                _skill_rows,
                _trigger_hits,
                _trigger_state,
                evaluate_skill_gates,
            )

            temp_skill = EnabledSkill(
                name=cap.name,
                markdown_doc=doc,
                required_scope=scope,
                tags=tuple(tags),
                triggers=tuple(triggers),
                trust_class=str(
                    cfg.get("trust_class")
                    or (catalog_entry.trust_class if catalog_entry else "community")
                ),
                version=str(cap.version or "1.0.0"),
                source=str(cap.type or "custom"),
                capability_id=str(cap.id),
            )
            trigger_matched, trigger_detail = (
                _trigger_state(temp_skill, _normalize(sample_msg))
                if sample_msg
                else (True, "No test message provided; trigger check skipped")
            )

            # ── dry-run probe ──────────────────────────────────────────────
            # `evaluate_skill_gates` is the same pure function production
            # injection runs, so this verdict cannot disagree with what a real
            # turn would do -- one code path, not a reimplementation. Granted
            # scopes are the whole tool vocabulary: the probe answers "is this
            # row injectable in this workspace at all", not "for one agent this
            # route cannot resolve". Nothing is executed or recorded.
            haystack = _normalize(sample_msg)
            scope_vocab = set(tool_scope_vocabulary())
            workspace_rows = await _skill_rows(db, wid)
            probe_injected, probe_skipped = evaluate_skill_gates(
                workspace_rows,
                scope_vocab,
                haystack,
                pinned=probe_pin,
                budget=SKILL_DIRECTIVE_TOKEN_BUDGET,
            )
            probed_injected = next(
                (s for s in probe_injected if s.capability_id == str(cap.id)),
                None,
            )
            probed_skip = next((s for s in probe_skipped if s.name == cap.name), None)
            pin_unknown_skip = next(
                (s for s in probe_skipped if s.reason == "pinned_unknown"), None
            )
            probed_row = next(
                (r for r in workspace_rows if str(r.id) == str(cap.id)), None
            )
            probed_resolved = probed_injected or (
                _resolve(probed_row) if probed_row is not None else temp_skill
            )

            gate_order = [
                "enabled",
                "domain_policy",
                "required_scope",
                "scope_granted",
                "markdown_doc",
                "pin",
                "trigger",
                "budget",
            ]
            reason_to_gate = {
                "disabled": "enabled",
                "domain_policy_exclusion": "domain_policy",
                "no_required_scope": "required_scope",
                "scope_not_granted": "scope_granted",
                "no_markdown_doc": "markdown_doc",
                "trigger_not_matched": "trigger",
                "token_budget_exceeded": "budget",
            }
            # The row ladder: only a skip of this row's own advances the
            # failing index. An unknown pin is deliberately NOT folded in here
            # -- it never blocks rows (evaluate_skill_gates reports it and lets
            # every row proceed), so it cannot make later row gates
            # not_evaluated. It fails the pin gate on its own, below.
            failing_gate = (
                reason_to_gate.get(probed_skip.reason)
                if probed_skip is not None
                else None
            )
            failing_index = gate_order.index(failing_gate) if failing_gate else None
            probed_is_pinned = bool(probe_pin and cap.name.lower() == probe_pin)

            gates: list[dict[str, Any]] = []
            for index, gate in enumerate(gate_order):
                verdict = "passed"
                reason: str | None = None
                detail: str | None = None
                if failing_index is not None and index > failing_index:
                    verdict = "not_evaluated"
                elif gate == "pin" and probe_pin is None:
                    verdict = "not_supplied"
                    detail = "No pin was supplied; trigger matching decides eligibility."
                elif gate == "pin":
                    detail = (
                        f"Pin '{probe_pin}' matches this skill."
                        if probed_is_pinned
                        else f"Pin '{probe_pin}' matches a different workspace skill."
                    )
                elif gate == "trigger":
                    if not trigger_matched and probed_is_pinned:
                        detail = "Trigger gate bypassed by pin."
                    else:
                        detail = trigger_detail
                if failing_index == index and probed_skip is not None:
                    verdict = "failed"
                    reason = probed_skip.reason
                    detail = probed_skip.detail
                if gate == "pin" and pin_unknown_skip is not None:
                    verdict = "failed"
                    reason = pin_unknown_skip.reason
                    detail = pin_unknown_skip.detail
                gates.append(
                    {"gate": gate, "verdict": verdict, "reason": reason, "detail": detail}
                )

            matched_triggers = _trigger_hits(probed_resolved, haystack)

            safe_doc, flagged_markers = quarantine(doc, source=f"skill:{cap.name}")
            est_tokens = estimate_tokens(safe_doc)

            elapsed_ms = (time.monotonic() - start_time) * 1000.0
            return TestCapabilityResponse(
                status=val_res.status,
                latency_ms=round(elapsed_ms, 2),
                output={
                    "skill_name": cap.name,
                    "validation_status": val_res.status,
                    "syntax_valid": val_res.status == "success",
                    "rules_checked": val_res.rules_checked,
                    "violations": [v.model_dump() for v in val_res.violations],
                    "estimated_tokens": est_tokens,
                    "token_budget": SKILL_DIRECTIVE_TOKEN_BUDGET,
                    "within_budget": est_tokens <= SKILL_DIRECTIVE_TOKEN_BUDGET,
                    "trigger_matched": trigger_matched,
                    "trigger_detail": trigger_detail,
                    "flagged_markers": flagged_markers,
                    "preview": safe_doc[:300] + ("..." if len(safe_doc) > 300 else ""),
                    "probe": {
                        "scope_context": "tool_scope_vocabulary",
                        "granted_scope_count": len(scope_vocab),
                        "outcome": (
                            "injected" if probed_injected is not None else "skipped"
                        ),
                        "skip": (
                            {"reason": probed_skip.reason, "detail": probed_skip.detail}
                            if probed_skip is not None
                            else None
                        ),
                        "gates": gates,
                        "pin": probe_pin,
                        "pin_unknown": pin_unknown_skip is not None,
                        "matched_triggers": matched_triggers,
                        "match_hits": len(matched_triggers),
                        "would_inject": [s.name for s in probe_injected],
                        "rendered_block": _render_block(probed_resolved),
                    },
                },
                error=(
                    val_res.violations[0].message
                    if val_res.violations and val_res.status == "error"
                    else None
                ),
                executed=False,
                recorded_usage=False,
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


class SyncGitHubSkillsRequest(BaseModel):
    """Body for a remote SKILL.md validation sweep.

    Deliberately carries no credential. A GitHub token used to read a private
    repository arrives in the ``X-GitHub-Token`` header instead, because request
    bodies are routinely captured by access logs, APM traces, and error
    reporters -- a body-borne secret leaks into infrastructure it has no reason
    to be in.
    """

    repository: str = Field(
        default="Driftloom/vaeloom-skills",
        min_length=1,
        max_length=200,
        pattern=r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$",
        description="Bare 'owner/repo' slug. URLs are rejected at the edge.",
    )
    ref: str = Field(default="master", min_length=1, max_length=128)

    # Reject unknown fields rather than dropping them. Pydantic's default is to
    # ignore extras, which would make a caller-supplied `auth_token` silently do
    # nothing -- the worst outcome, because the caller believes they authenticated
    # a private-repo sweep that actually ran unauthenticated against a public
    # repo. A 422 is louder and therefore safer.
    model_config = ConfigDict(extra="forbid")


@router.post(
    "/sync-github",
    response_model=GitHubSkillSyncResult,
    status_code=status.HTTP_200_OK,
)
# Walks a remote repository tree and issues up to 200 outbound fetches. The
# cheapest denial-of-service on the whole capability surface, and it was
# previously indistinguishable from a GET in the limiter.
@rate_limit(max_requests=5, window_seconds=60)
async def sync_github_skills(
    payload: SyncGitHubSkillsRequest = SyncGitHubSkillsRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    workspace_id: str | None = Depends(get_workspace_id),
    github_token: str | None = Header(default=None, alias="X-GitHub-Token"),
):
    """Validate remote SKILL.md playbooks from a GitHub repository.

    Validation-only: nothing is persisted (see
    ``services.github_skills_sync``). The result's ``persisted`` field is always
    ``False``. To install a candidate skill, POST it to ``/capabilities``.

    Owner-only: this walks a remote repository tree and issues up to 200
    outbound fetches, so it is not a workspace-member operation.
    """
    user_id = _get_user_id(current_user)
    await _require_workspace_owner(db, user_id, workspace_id)

    from ..services.github_skills_sync import sync_skills_from_github

    return await sync_skills_from_github(
        repo=payload.repository,
        ref=payload.ref,
        auth_token=github_token,
    )

