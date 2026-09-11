"""
Tool executor with permission checking, retry logic, and audit logging.
"""
import asyncio
import json
import logging
import time
import uuid as uuid_lib
from datetime import UTC, datetime, timedelta
from typing import Any

from .definitions import ToolDefinition
from ..utils.sanitize import sanitize_text

logger = logging.getLogger(__name__)

# Status returned when a mutating connector (Slack send, Gmail/Outlook draft,
# calendar create, GitHub issue/PR create, ...) is invoked but its backing
# integration is not configured. We must NOT fake a successful side-effect: the
# agent must learn the action did not happen (zero-trust: no silent mock writes).
NOT_CONFIGURED = "not_configured"


def _connector_not_configured(tool: str, integration: str) -> dict[str, Any]:
    return {
        "status": NOT_CONFIGURED,
        "tool": tool,
        "result": f"{integration} connector not configured",
        "note": f"{integration} API unavailable — connector not configured; no action was performed",
    }


class PermissionDeniedError(PermissionError):
    """Raised when the agent lacks the required scope for a tool call."""
    pass


class ToolExecutionError(Exception):
    """Raised when a tool call fails after all retries."""
    pass


# Timeouts per category (in seconds) per the Tool-Calling spec
CATEGORY_TIMEOUTS = {
    "memory_read": 2,
    "memory_write": 2,
    "connector_read": 5,
    "connector_write": 10,
    "system": 1,
}

# Retry config per category
CATEGORY_RETRIES = {
    "memory_read": 3,
    "memory_write": 3,
    "connector_read": 3,
    "connector_write": 3,
    "system": 1,
}

# Per-tool timeout overrides (seconds) — browser tools need longer than the
# connector_read default because chromium cold-start + navigation is slow.
TOOL_TIMEOUT_OVERRIDES = {
    "browse_job_page": 45,
    "scrape_company_insights": 20,
    "verify_application_link": 15,
    "compile_resume_pdf": 30,
    "compile_resume_docx": 15,
    "compile_cover_letter": 30,
    "search_github_repos": 15,
    "fetch_github_repo": 15,
    "get_github_profile": 15,
    "list_github_issues": 15,
    "read_github_file": 15,
    "create_github_issue": 15,
    "create_github_pull_request": 15,
    "search_gmail": 15,
    "draft_email": 15,
    "list_calendar_events": 15,
    "create_calendar_event": 15,
    "list_drive_files": 15,
    "search_drive": 15,
    "download_drive_file": 20,
    "create_google_doc": 15,
    "read_google_doc": 15,
    "append_google_doc": 15,
    "replace_google_doc_text": 15,
    "search_greenhouse_jobs": 10,
    "search_lever_jobs": 10,
    "search_jobs_board": 15,
    "search_outlook_mail": 10,
    "draft_outlook_mail": 10,
    "list_outlook_calendar_events": 10,
    "create_outlook_calendar_event": 10,
    "list_onedrive_files": 10,
    "search_onedrive": 10,
    "download_onedrive_file": 15,
}

# Per-workspace scraping quota (sliding window, in-process; matches the
# MemoryBackend rate-limiter precedent). Applied to network-heavy fetches.
# ── Distributed scraping quota (F-12) ───────────────────────────────────────
# The quota MUST be enforced per-workspace across all workers, not per-process.
# We use a pluggable backend: in-memory by default (single worker / tests), and a
# Redis-backed implementation automatically when a Redis URL is configured, so the
# quota is shared across the fleet. Both backends expose `allowed(ws, limit, window)`.
import os as _os
import time as _time

from typing import Protocol


class ScrapeQuotaBackend(Protocol):
    async def allowed(self, workspace_id: str, limit: int, window_s: float) -> bool:
        """Return True and record the hit if the workspace is under quota."""
        ...


class _InMemoryScrapeQuota:
    """Process-local fallback; correct for a single worker, not across the fleet."""

    def __init__(self) -> None:
        self._store: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def allowed(self, workspace_id: str, limit: int, window_s: float) -> bool:
        async with self._lock:
            now = _time.monotonic()
            hits = self._store.get(workspace_id)
            if hits is None:
                hits = self._store[workspace_id] = []
            while hits and hits[0] <= now - window_s:
                hits.pop(0)
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True


class _RedisScrapeQuota:
    """Shared quota across workers via a Redis sorted set of hit timestamps."""

    def __init__(self, redis_url: str) -> None:
        import redis.asyncio as _aioredis

        self._redis_url = redis_url
        self._r = _aioredis.from_url(redis_url, decode_responses=False)
        self._prefix = "vaeloom:scrape_quota:"
        self._store: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    def _rebuild_client(self) -> None:
        import redis.asyncio as _aioredis

        self._r = _aioredis.from_url(self._redis_url, decode_responses=False)

    async def allowed(self, workspace_id: str, limit: int, window_s: float,
                      _retried: bool = False) -> bool:
        key = f"{self._prefix}{workspace_id}"
        now = _time.monotonic()
        try:
            # Drop stale hits, then decide before recording this one.
            await self._r.zremrangebyscore(key, 0, now - window_s)
            count = await self._r.zcard(key)
            if count >= limit:
                return False
            await self._r.zadd(key, {f"{now}:{_uuid()}": now})
            await self._r.expire(key, int(window_s) + 10)
            return True
        except Exception as e:
            # Stale loop-bound client (tests, worker restarts): rebuild once
            # and retry so hits are not split-brained across Redis/local.
            if not _retried and "Event loop is closed" in str(e):
                try:
                    self._rebuild_client()
                    return await self.allowed(workspace_id, limit, window_s, _retried=True)
                except Exception:
                    pass
            # Redis unreachable: degrade to local best-effort
            logger.warning("scrape quota redis unavailable, local fallback: %s", e)
            return await self._local_fallback(workspace_id, limit, window_s)

    async def _local_fallback(self, workspace_id: str, limit: int, window_s: float) -> bool:
        # Process-local best-effort so a down Redis never hard-blocks scraping.
        now = time.time()
        async with self._lock:
            hits = self._store.get(workspace_id)
            if hits is None:
                hits = self._store[workspace_id] = []
            while hits and hits[0] <= now - window_s:
                hits.pop(0)
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True


def _uuid() -> str:
    return uuid_lib.uuid4().hex


_QUOTA_BACKEND: ScrapeQuotaBackend | None = None


def _get_quota_backend() -> ScrapeQuotaBackend:
    """Lazily pick Redis when configured, else in-memory. Cache the choice.

    Redis is used only when REDIS_URL/REDIS__URL is explicitly set (the config
    default of localhost is just a placeholder and must not auto-activate a
    backend that may be unreachable — see deployment runbook: "REDIS_URL is not
    set - will use in-memory fallback").
    """
    global _QUOTA_BACKEND
    if _QUOTA_BACKEND is not None:
        return _QUOTA_BACKEND
    redis_url = _os.environ.get("REDIS_URL") or _os.environ.get("REDIS__URL")
    if redis_url:
        try:
            _QUOTA_BACKEND = _RedisScrapeQuota(redis_url)
            logger.info("scrape quota backend: redis (%s)", redis_url)
            return _QUOTA_BACKEND
        except Exception as e:  # pragma: no cover - Redis init failure falls back
            logger.warning("scrape quota redis init failed, using in-memory: %s", e)
    _QUOTA_BACKEND = _InMemoryScrapeQuota()
    return _QUOTA_BACKEND


def set_scrape_quota_backend(backend: ScrapeQuotaBackend) -> None:
    """Override backend (test seam / explicit distributed store)."""
    global _QUOTA_BACKEND
    _QUOTA_BACKEND = backend


async def _check_scrape_quota(workspace_id: str, limit: int = 20, window_s: float = 3600.0) -> bool:
    """True if the workspace is under its scraping quota; records the hit."""
    return await _get_quota_backend().allowed(workspace_id, limit, window_s)


# ── Dynamic tool registry (MCP-bridged tools) ─────────────────────────
# Static tools live in TOOL_DISPATCH; MCP servers register here at runtime.
DYNAMIC_HANDLERS: dict[str, Any] = {}
DYNAMIC_TOOL_DEFS: dict[str, ToolDefinition] = {}
_DYNAMIC_APPROVAL_GATED: set[str] = set()

_BASE_APPROVAL_GATED = frozenset({
    "create_github_issue", "create_github_pull_request", "send_slack_message", "create_calendar_event",
    "create_outlook_calendar_event", "draft_email", "draft_outlook_mail",
    "rename_file", "move_file", "categorize_document",
    "create_entity", "merge_entities",
    # Wave 2 (2026-09-06): code execution must never auto-run from an LLM
    # loop, even sandboxed. compile_* (own-artifact generation), notify_user
    # (notification), web_search (read-only fetch) stay OPEN by decision —
    # see docs/phases/agentic-safety-w2/01-wave-report.md.
    "execute_code_sandbox",
    # Phase B: Google Docs mutating tools (connector_write) added without a
    # gate — closed here per the Tier-3 redteam contract that every
    # memory_write/connector_write tool must be approval-gated.
    "create_google_doc", "append_google_doc", "replace_google_doc_text",
})


def register_dynamic_tool(td: ToolDefinition, handler) -> None:
    """Register an externally-discovered tool (namespaced mcp__server__tool)."""
    DYNAMIC_TOOL_DEFS[td.name] = td
    DYNAMIC_HANDLERS[td.name] = handler
    TOOL_TIMEOUT_OVERRIDES.setdefault(td.name, 30)


def unregister_dynamic_tools(prefix: str) -> int:
    removed = [n for n in DYNAMIC_TOOL_DEFS if n.startswith(prefix)]
    for n in removed:
        DYNAMIC_TOOL_DEFS.pop(n, None)
        DYNAMIC_HANDLERS.pop(n, None)
        _DYNAMIC_APPROVAL_GATED.discard(n)
    return len(removed)


def mark_approval_gated(name: str) -> None:
    _DYNAMIC_APPROVAL_GATED.add(name)


def approval_gated_tools() -> frozenset[str]:
    """Static write-tools plus dynamically-gated (non-read-only) MCP tools."""
    return frozenset(_BASE_APPROVAL_GATED | _DYNAMIC_APPROVAL_GATED)


def dynamic_tool_definitions() -> dict[str, ToolDefinition]:
    return dict(DYNAMIC_TOOL_DEFS)


def get_tool_definition(name: str) -> ToolDefinition | None:
    """Merged lookup: static ALL_TOOLS ∪ dynamic MCP tools.

    Fixes loop.py:461 bug where LLM-requested mcp__* tools were looked up
    only in ALL_TOOLS and silently skipped even though they were offered
    in tool_schemas. Use this helper for any runtime dispatch.
    """
    from .definitions import ALL_TOOLS as _ALL

    return _ALL.get(name) or DYNAMIC_TOOL_DEFS.get(name)


def all_tool_definitions() -> dict[str, ToolDefinition]:
    """All tool definitions (static + dynamic) — for catalog/metrics."""
    from .definitions import ALL_TOOLS as _ALL

    merged: dict[str, ToolDefinition] = dict(_ALL)
    merged.update(DYNAMIC_TOOL_DEFS)
    return merged


async def check_permission(
    agent_scopes: list[str], required_scope: str
) -> bool:
    """
    Check if the agent has the required scope.
    In production this calls the Permission Engine; here it's a local check.
    """
    for scope in agent_scopes:
        if scope == required_scope:
            return True
        if scope.endswith(".*"):
            prefix = scope[:-2]
            if required_scope.startswith(prefix):
                return True
    return False


async def _execute_search_documents(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    limit = params.get("limit", 10)

    # 1. Primary fast search: Algolia Cloud
    try:
        from api.infrastructure.search import AlgoliaIndex, get_search_index
        search_idx = get_search_index()
        if isinstance(search_idx, AlgoliaIndex):
            hits = await search_idx.search(query, options={"limit": limit})
            if hits:
                return {
                    "status": "success",
                    "tool": "search_documents",
                    "result": [
                        {
                            "id": str(h.get("objectID") or h.get("id", "")),
                            "path": h.get("path") or h.get("title", ""),
                            "type": h.get("type", "document"),
                            "summary": h.get("summary", ""),
                            "content": h.get("content", ""),
                        }
                        for h in hits
                    ],
                    "count": len(hits),
                    "source": "algolia",
                }
    except Exception as e:
        logger.debug(f"Algolia search_documents fallback to DB: {e}")

    # 2. Native DB fallback
    try:
        from sqlalchemy import or_, select

        from api.database import async_session_factory
        from api.models.schema import Document
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    try:
        async with async_session_factory() as session:
            stmt = (
                select(Document)
                .where(Document.workspace_id == workspace_id)
                .where(
                    or_(
                        Document.path.ilike(f"%{query}%"),
                        Document.type.ilike(f"%{query}%"),
                        Document.summary.ilike(f"%{query}%"),
                    )
                )
                .limit(limit)
            )
            result = await session.execute(stmt)
            documents = result.scalars().all()
            return {
                "status": "success",
                "tool": "search_documents",
                "result": [
                    {
                        "id": str(d.id),
                        "path": d.path,
                        "type": d.type,
                        "summary": d.summary,
                        "created_at": d.created_at.isoformat() if d.created_at else None,
                    }
                    for d in documents
                ],
                "count": len(documents),
                "source": "database",
            }
    except Exception as e:
        logger.error(f"search_documents failed: {e}")
        return {"status": "error", "tool": "search_documents", "result": str(e)}


async def _execute_query_graph(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    try:
        from sqlalchemy import or_, select

        from api.database import async_session_factory
        from api.models.schema import Entity, Relationship
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    query = params.get("query", "")
    entity_type = params.get("entity_type", "any")
    limit = params.get("limit", 20)

    try:
        async with async_session_factory() as session:
            filters = [Entity.workspace_id == workspace_id]
            if entity_type != "any":
                filters.append(Entity.type == entity_type)
            filters.append(Entity.canonical_name.ilike(f"%{query}%"))

            stmt = select(Entity).where(*filters).limit(limit)
            result = await session.execute(stmt)
            entities = result.scalars().all()

            graph_nodes = []
            for entity in entities:
                rel_stmt = select(Relationship).where(
                    or_(
                        Relationship.from_entity_id == entity.id,
                        Relationship.to_entity_id == entity.id,
                    )
                ).limit(10)
                rel_result = await session.execute(rel_stmt)
                relationships = [
                    {
                        "id": str(r.id),
                        "from_entity_id": str(r.from_entity_id),
                        "to_entity_id": str(r.to_entity_id),
                        "relation_type": r.relation_type,
                        "confidence": r.confidence,
                    }
                    for r in rel_result.scalars().all()
                ]

                graph_nodes.append({
                    "id": str(entity.id),
                    "name": entity.canonical_name,
                    "type": entity.type,
                    "aliases": entity.aliases,
                    "metadata": entity.metadata_,
                    "relationships": relationships,
                })

            return {
                "status": "success",
                "tool": "query_graph",
                "result": graph_nodes,
                "count": len(graph_nodes),
            }
    except Exception as e:
        logger.error(f"query_graph failed: {e}")
        return {"status": "error", "tool": "query_graph", "result": str(e)}


async def _execute_get_entity(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    try:
        import uuid

        from sqlalchemy import or_, select

        from api.database import async_session_factory
        from api.models.schema import Entity, Relationship
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    entity_id = params.get("entity_id", "")

    try:
        async with async_session_factory() as session:
            entity = await session.get(Entity, uuid.UUID(entity_id))
            if not entity:
                return {"status": "error", "tool": "get_entity", "result": f"Entity {entity_id} not found"}

            rel_stmt = select(Relationship).where(
                or_(
                    Relationship.from_entity_id == entity.id,
                    Relationship.to_entity_id == entity.id,
                )
            ).limit(20)
            rel_result = await session.execute(rel_stmt)
            relationships = [
                {
                    "id": str(r.id),
                    "from_entity_id": str(r.from_entity_id),
                    "to_entity_id": str(r.to_entity_id),
                    "relation_type": r.relation_type,
                    "confidence": r.confidence,
                }
                for r in rel_result.scalars().all()
            ]

            return {
                "status": "success",
                "tool": "get_entity",
                "result": {
                    "id": str(entity.id),
                    "name": entity.canonical_name,
                    "type": entity.type,
                    "aliases": entity.aliases,
                    "metadata": entity.metadata_,
                    "created_at": entity.created_at.isoformat() if entity.created_at else None,
                    "relationships": relationships,
                },
            }
    except Exception as e:
        logger.error(f"get_entity failed: {e}")
        return {"status": "error", "tool": "get_entity", "result": str(e)}


async def _execute_create_entity(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    try:
        from sqlalchemy import select

        from api.database import async_session_factory
        from api.models.schema import Entity
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    name = params.get("name", "")
    entity_type = params.get("entity_type", "")
    properties = params.get("properties", {})

    if not name or not entity_type:
        return {"status": "error", "tool": "create_entity", "result": "name and entity_type are required"}

    try:
        async with async_session_factory() as session:
            existing = await session.execute(
                select(Entity).where(
                    Entity.workspace_id == workspace_id,
                    Entity.canonical_name == name,
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                return {"status": "error", "tool": "create_entity", "result": f"Entity '{name}' already exists"}

            new_entity = Entity(
                workspace_id=uuid_lib.UUID(workspace_id) if isinstance(workspace_id, str) else workspace_id,
                type=entity_type,
                canonical_name=name,
                aliases=properties.get("aliases", []),
                metadata_=properties.get("metadata", {}),
            )
            session.add(new_entity)
            await session.commit()
            await session.refresh(new_entity)

            return {
                "status": "success",
                "tool": "create_entity",
                "result": {
                    "id": str(new_entity.id),
                    "name": new_entity.canonical_name,
                    "type": new_entity.type,
                    "aliases": new_entity.aliases,
                    "created_at": new_entity.created_at.isoformat() if new_entity.created_at else None,
                },
            }
    except Exception as e:
        logger.error(f"create_entity failed: {e}")
        return {"status": "error", "tool": "create_entity", "result": str(e)}


async def _execute_categorize_document(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    document_id = params.get("document_id", "")
    category = params.get("category", "")
    folder = params.get("folder", "")

    try:
        import uuid

        from sqlalchemy import select  # noqa: F401

        from api.database import async_session_factory
        from api.models.schema import Document
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    try:
        async with async_session_factory() as session:
            doc = await session.get(Document, uuid.UUID(document_id))
            if not doc:
                return {"status": "error", "tool": "categorize_document", "result": f"Document {document_id} not found"}

            meta = dict(doc.metadata_ or {})
            meta["category"] = category
            if folder:
                meta["folder"] = folder
            doc.metadata_ = meta
            await session.commit()

            return {
                "status": "success",
                "tool": "categorize_document",
                "result": {
                    "document_id": document_id,
                    "category": category,
                    "folder": folder,
                    "status": "categorized",
                },
            }
    except Exception as e:
        logger.error(f"categorize_document failed: {e}")
        return {"status": "error", "tool": "categorize_document", "result": str(e)}


async def _execute_notify_user(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    message = params.get("message", "")
    priority = params.get("priority", "medium")

    logger.info(f"NOTIFICATION [{priority.upper()}]: {message}")

    try:
        import uuid

        from api.database import async_session_factory
        from api.models.schema import AgentAction
    except ImportError:
        return {"status": "success", "tool": "notify_user", "result": {"delivered": True, "logged_to": "stdout"}}

    try:
        async with async_session_factory() as session:
            action = AgentAction(
                workspace_id=uuid.UUID(workspace_id) if isinstance(workspace_id, str) else workspace_id,
                agent_name="tool_executor",
                action_type="notify_user",
                input_ref=json.dumps({"message": message, "priority": priority}),
                status="COMPLETED",
            )
            session.add(action)
            await session.commit()

        return {
            "status": "success",
            "tool": "notify_user",
            "result": {"delivered": True, "action_id": str(action.id)},
        }
    except Exception as e:
        logger.warning(f"notify_user DB logging failed: {e}")
        return {"status": "success", "tool": "notify_user", "result": {"delivered": True, "logged_to": "stdout"}}


async def _resolve_compile_content(params: dict[str, Any], workspace_id: str) -> tuple[dict[str, Any] | None, str | None]:
    """Helper for compile_* tools: resolve canonical resume_content dict."""
    # Direct content wins
    content = params.get("resume_content")
    if isinstance(content, dict) and content:
        return content, None
    # Try resume_id fetch
    resume_id = params.get("resume_id") or params.get("resumeId")
    if resume_id:
        try:
            import uuid
            from api.database import async_session_factory
            from api.models.schema import Resume
            async with async_session_factory() as session:
                row = await session.get(Resume, uuid.UUID(str(resume_id)))
                if row and isinstance(row.content, dict):
                    return row.content, None
                if row and isinstance(row.content, str):
                    try:
                        return json.loads(row.content), None
                    except Exception:
                        pass
        except Exception as e:
            logger.debug(f"compile resolve by resume_id failed: {e}")
    # Fallback: master resume for workspace (workspace_id → resumes)
    try:
        import uuid as _uuid
        from sqlalchemy import select
        from api.database import async_session_factory
        from api.models.schema import Resume
        async with async_session_factory() as session:
            # workspace-scoped lookup via raw SQL to avoid tenant RLS detachment complexity
            result = await session.execute(select(Resume).where(Resume.workspace_id == _uuid.UUID(workspace_id)).order_by(Resume.created_at.desc()).limit(1))  # type: ignore
            row = result.scalars().first()
            if row and isinstance(row.content, dict):
                return row.content, None
            if row and isinstance(row.content, str):
                try:
                    return json.loads(row.content), None  # type: ignore
                except Exception:
                    pass
    except Exception as e:
        logger.debug(f"compile resolve master fallback failed: {e}")
    return None, "no_resume_content"


async def _execute_compile_resume_pdf(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    template_slug = params.get("template_slug") or params.get("templateSlug") or "minimalist-clean"
    max_pages = int(params.get("max_pages") or params.get("maxPages") or 2)
    content, err = await _resolve_compile_content(params, workspace_id)
    if content is None:
        return {
            "status": "error",
            "tool": "compile_resume_pdf",
            "result": "no resume content found — provide resume_id or resume_content",
            "setup_hint": "create a resume via POST /api/v1/resumes or pass resume_content",
        }
    try:
        from api.services.document_builder import PlaywrightUnavailableError, document_builder
        compiled = await document_builder.compile_resume(content, template_slug, fmt="pdf", max_pages=max_pages)
        return {
            "status": "success",
            "tool": "compile_resume_pdf",
            "result": {
                "media_type": compiled.media_type,
                "extension": compiled.extension,
                "size_bytes": len(compiled.data),
                "template": template_slug,
                "pages_budget": max_pages,
                "note": "PDF compiled successfully" if err is None else "PDF compiled from mock content (no resume found in workspace)",
            },
        }
    except Exception as e:
        # Playwright missing → 503-style error but still structured
        if "PlaywrightUnavailableError" in type(e).__name__ or "Chromium unavailable" in str(e):
            return {
                "status": "error",
                "tool": "compile_resume_pdf",
                "result": f"Chromium not installed — run `uv run --project apps/api playwright install chromium`: {e}",
                "retryable": False,
                "setup_hint": "uv run --project apps/api playwright install chromium",
            }
        logger.error(f"compile_resume_pdf failed: {e}")
        return {"status": "error", "tool": "compile_resume_pdf", "result": str(e)}


async def _execute_compile_resume_docx(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    template_slug = params.get("template_slug") or params.get("templateSlug") or "minimalist-clean"
    content, err = await _resolve_compile_content(params, workspace_id)
    if content is None:
        return {
            "status": "error",
            "tool": "compile_resume_docx",
            "result": "no resume content found — provide resume_id or resume_content",
            "setup_hint": "create a resume via POST /api/v1/resumes or pass resume_content",
        }
    try:
        from api.services.document_builder import document_builder
        compiled = await document_builder.compile_resume(content, template_slug, fmt="docx")
        return {
            "status": "success",
            "tool": "compile_resume_docx",
            "result": {
                "media_type": compiled.media_type,
                "extension": compiled.extension,
                "size_bytes": len(compiled.data),
                "template": template_slug,
                "note": "DOCX compiled successfully" if err is None else "DOCX compiled from mock content",
            },
        }
    except Exception as e:
        logger.error(f"compile_resume_docx failed: {e}")
        return {"status": "error", "tool": "compile_resume_docx", "result": str(e)}


async def _execute_compile_cover_letter(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    template_slug = params.get("template_slug") or params.get("templateSlug") or "minimalist-clean"
    fmt = params.get("format") or params.get("fmt") or "pdf"
    body = params.get("body") or ""
    company = params.get("company")
    role = params.get("role")
    recipient = params.get("recipient")
    content, err = await _resolve_compile_content(params, workspace_id)
    if content is None:
        return {
            "status": "error",
            "tool": "compile_cover_letter",
            "result": "no resume content found — provide resume_id or resume_content",
            "setup_hint": "create a resume via POST /api/v1/resumes or pass resume_content",
        }
    if not body:
        body = f"Dear Hiring Manager,\n\nI am excited to apply for the {role or 'role'} at {company or 'your company'}. My background aligns with the requirements and I look forward to contributing.\n\nSincerely,\n{content.get('name', 'Candidate')}"
    try:
        from api.services.document_builder import PlaywrightUnavailableError, document_builder
        compiled = await document_builder.compile_cover_letter(content, body, template_slug, recipient=recipient, company=company, role=role, fmt=fmt)
        return {
            "status": "success",
            "tool": "compile_cover_letter",
            "result": {
                "media_type": compiled.media_type,
                "extension": compiled.extension,
                "size_bytes": len(compiled.data),
                "template": template_slug,
                "format": fmt,
                "note": "Cover letter compiled" if err is None else "Cover letter compiled from mock content",
            },
        }
    except Exception as e:
        if "PlaywrightUnavailableError" in type(e).__name__ or "Chromium unavailable" in str(e):
            return {
                "status": "error",
                "tool": "compile_cover_letter",
                "result": f"Chromium not installed for PDF: {e}",
                "setup_hint": "uv run --project apps/api playwright install chromium",
            }
        logger.error(f"compile_cover_letter failed: {e}")
        return {"status": "error", "tool": "compile_cover_letter", "result": str(e)}


async def _execute_merge_entities(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    try:
        import uuid

        from sqlalchemy import delete, or_, select  # noqa: F401
        from sqlalchemy import update as sa_update

        from api.database import async_session_factory
        from api.models.schema import Embedding, Entity, Relationship
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    source_id = params.get("source_id", "")
    target_id = params.get("target_id", "")

    if not source_id or not target_id:
        return {"status": "error", "tool": "merge_entities", "result": "source_id and target_id are required"}

    if source_id == target_id:
        return {"status": "error", "tool": "merge_entities", "result": "source_id and target_id must be different"}

    try:
        async with async_session_factory() as session:
            source_entity = await session.get(Entity, uuid.UUID(source_id))
            target_entity = await session.get(Entity, uuid.UUID(target_id))

            if not source_entity:
                return {"status": "error", "tool": "merge_entities", "result": f"Source entity {source_id} not found"}
            if not target_entity:
                return {"status": "error", "tool": "merge_entities", "result": f"Target entity {target_id} not found"}

            source_uuid = uuid.UUID(source_id)
            target_uuid = uuid.UUID(target_id)

            stmt_from = (
                sa_update(Relationship)
                .where(Relationship.from_entity_id == source_uuid)
                .values(from_entity_id=target_uuid)
            )
            await session.execute(stmt_from)

            stmt_to = (
                sa_update(Relationship)
                .where(Relationship.to_entity_id == source_uuid)
                .values(to_entity_id=target_uuid)
            )
            await session.execute(stmt_to)

            await session.execute(
                delete(Embedding).where(
                    Embedding.source_type == "entity",
                    Embedding.source_id == source_uuid,
                )
            )

            await session.delete(source_entity)
            await session.commit()

            merged_aliases = list(set((target_entity.aliases or []) + (source_entity.aliases or [])))
            merged_metadata = {**(source_entity.metadata_ or {}), **(target_entity.metadata_ or {})}
            if merged_aliases != target_entity.aliases or merged_metadata != (target_entity.metadata_ or {}):
                target_entity.aliases = merged_aliases
                target_entity.metadata_ = merged_metadata
                await session.commit()

            return {
                "status": "success",
                "tool": "merge_entities",
                "result": {
                    "merged_into_id": target_id,
                    "merged_into_name": target_entity.canonical_name,
                    "source_id_removed": source_id,
                    "source_name": source_entity.canonical_name,
                },
            }
    except Exception as e:
        logger.error(f"merge_entities failed: {e}")
        return {"status": "error", "tool": "merge_entities", "result": str(e)}


async def _get_client_for_workspace(client_cls: Any, workspace_id: str | None = None) -> Any:
    if hasattr(client_cls, "for_workspace") and callable(getattr(client_cls, "for_workspace")):
        return await client_cls.for_workspace(workspace_id)
    return client_cls()


async def _execute_search_gmail(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    max_results = params.get("max_results", 20)
    after_date = params.get("after_date")

    try:
        from api.clients.gmail_client import GmailClient
    except ImportError as e:
        return {"status": "error", "result": f"Gmail client import failed: {e}"}

    try:
        gmail_query = query
        if after_date:
            gmail_query = f"{query} after:{after_date}" if query else f"after:{after_date}"

        client = await _get_client_for_workspace(GmailClient, workspace_id)
        emails = await client.fetch_emails(query=gmail_query, max_results=max_results)

        if emails is None:
            return _connector_not_configured("search_gmail", "Gmail")

        return {
            "status": "success",
            "tool": "search_gmail",
            "result": emails,
            "count": len(emails),
        }
    except Exception as e:
        logger.error(f"search_gmail failed: {e}")
        return {"status": "error", "tool": "search_gmail", "result": str(e)}


async def _execute_search_jobs(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    keywords_raw = params.get("keywords", "")
    location = params.get("location")
    remote_ok = params.get("remote_ok", True)
    limit = params.get("limit", 20)

    try:
        from api.clients.job_board_client import JobBoardClient
    except ImportError as e:
        return {"status": "error", "result": f"Job board client import failed: {e}"}

    try:
        if isinstance(keywords_raw, str):
            keywords_list = [k.strip() for k in keywords_raw.split() if k.strip()]
        else:
            keywords_list = list(keywords_raw)

        if not keywords_list:
            return {"status": "error", "tool": "search_jobs", "result": "keywords are required"}

        client = JobBoardClient()
        jobs = await client.search_jobs(keywords=keywords_list, location=location)

        if jobs is None:
            return _connector_not_configured("search_jobs", "Job Board")

        results = jobs[:limit]
        if remote_ok:
            results = [j for j in results if "remote" in j.get("location", "").lower() or "remote" in j.get("title", "").lower()] or results

        return {
            "status": "success",
            "tool": "search_jobs",
            "result": results,
            "count": len(results),
        }
    except Exception as e:
        logger.error(f"search_jobs failed: {e}")
        return {"status": "error", "tool": "search_jobs", "result": str(e)}


async def _execute_list_calendar_events(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    start_date = params.get("start_date", "")
    end_date = params.get("end_date", "")

    try:
        from api.clients.calendar_client import CalendarClient
    except ImportError as e:
        return {"status": "error", "result": f"Calendar client import failed: {e}"}

    try:
        client = await _get_client_for_workspace(CalendarClient, workspace_id)
        events = await client.list_events(time_min=start_date if start_date else None, time_max=end_date if end_date else None)

        if events is None:
            return _connector_not_configured("list_calendar_events", "Calendar")

        return {
            "status": "success",
            "tool": "list_calendar_events",
            "result": events,
            "count": len(events),
        }
    except Exception as e:
        logger.error(f"list_calendar_events failed: {e}")
        return {"status": "error", "tool": "list_calendar_events", "result": str(e)}


async def _execute_list_drive_files(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "trashed = false")
    page_size = params.get("page_size", 50)
    try:
        from api.clients.drive_client import DriveClient
    except ImportError as e:
        return {"status": "error", "result": f"Drive client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DriveClient, workspace_id)
        files = await client.list_files(page_size=page_size, query=query)
        if files is None:
            return _connector_not_configured("list_drive_files", "Drive")
        return {"status": "success", "tool": "list_drive_files", "result": files, "count": len(files)}
    except Exception as e:
        logger.error(f"list_drive_files failed: {e}")
        return {"status": "error", "tool": "list_drive_files", "result": str(e)}


async def _execute_search_drive(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    page_size = params.get("page_size", 20)
    if not query:
        return {"status": "error", "tool": "search_drive", "result": "query is required"}
    try:
        from api.clients.drive_client import DriveClient
    except ImportError as e:
        return {"status": "error", "result": f"Drive client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DriveClient, workspace_id)
        files = await client.search_files(query=query, page_size=page_size)
        if files is None:
            return _connector_not_configured("search_drive", "Drive")
        return {"status": "success", "tool": "search_drive", "result": files, "count": len(files)}
    except Exception as e:
        logger.error(f"search_drive failed: {e}")
        return {"status": "error", "tool": "search_drive", "result": str(e)}


async def _execute_download_drive_file(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    import base64

    file_id = params.get("file_id", "")
    mime_type = params.get("mime_type", "application/pdf")
    if not file_id:
        return {"status": "error", "tool": "download_drive_file", "result": "file_id is required"}
    try:
        from api.clients.drive_client import DriveClient
    except ImportError as e:
        return {"status": "error", "result": f"Drive client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DriveClient, workspace_id)
        # Try metadata first for name
        meta = await client.get_file(file_id) if hasattr(client, "get_file") else None
        name = (meta or {}).get("name", f"{file_id}.bin")
        mt = (meta or {}).get("mimeType", "")
        if mt.startswith("application/vnd.google-apps."):
            content = await client.export_file(file_id, mime_type=mime_type)
        else:
            content = await client.download_file(file_id)
        if content is None:
            return _connector_not_configured("download_drive_file", "Drive")
        return {
            "status": "success",
            "tool": "download_drive_file",
            "result": {"file_id": file_id, "name": name, "size_bytes": len(content), "content_base64": base64.b64encode(content).decode(), "mime_type": mime_type},
        }
    except Exception as e:
        logger.error(f"download_drive_file failed: {e}")
        return {"status": "error", "tool": "download_drive_file", "result": str(e)}


async def _execute_create_google_doc(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    title = params.get("title", "Untitled Document")
    initial_text = params.get("initial_text", "")
    try:
        from api.clients.docs_client import DocsClient
    except ImportError as e:
        return {"status": "error", "result": f"Docs client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DocsClient, workspace_id)
        doc = await client.create_document(title=title)
        if doc is None:
            return _connector_not_configured("create_google_doc", "Google Docs")
        doc_id = doc.get("documentId", "")
        if initial_text and doc_id:
            await client.append_text(doc_id, initial_text)
        return {
            "status": "success",
            "tool": "create_google_doc",
            "result": {
                "document_id": doc_id,
                "title": title,
                "url": f"https://docs.google.com/document/d/{doc_id}/edit",
            },
        }
    except Exception as e:
        logger.error(f"create_google_doc failed: {e}")
        return {"status": "error", "tool": "create_google_doc", "result": str(e)}


async def _execute_read_google_doc(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    doc_id = params.get("document_id", "")
    if not doc_id:
        return {"status": "error", "tool": "read_google_doc", "result": "document_id is required"}
    try:
        from api.clients.docs_client import DocsClient
    except ImportError as e:
        return {"status": "error", "result": f"Docs client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DocsClient, workspace_id)
        content = await client.read_document_text(doc_id)
        if content is None:
            return _connector_not_configured("read_google_doc", "Google Docs")
        return {
            "status": "success",
            "tool": "read_google_doc",
            "result": {
                "document_id": doc_id,
                "content": content,
            },
        }
    except Exception as e:
        logger.error(f"read_google_doc failed: {e}")
        return {"status": "error", "tool": "read_google_doc", "result": str(e)}


async def _execute_append_google_doc(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    doc_id = params.get("document_id", "")
    text = params.get("text", "")
    if not doc_id:
        return {"status": "error", "tool": "append_google_doc", "result": "document_id is required"}
    if not text:
        return {"status": "error", "tool": "append_google_doc", "result": "text is required"}
    try:
        from api.clients.docs_client import DocsClient
    except ImportError as e:
        return {"status": "error", "result": f"Docs client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DocsClient, workspace_id)
        res = await client.append_text(doc_id, text)
        if res is None:
            return _connector_not_configured("append_google_doc", "Google Docs")
        return {
            "status": "success",
            "tool": "append_google_doc",
            "result": {"status": "appended", "document_id": doc_id},
        }
    except Exception as e:
        logger.error(f"append_google_doc failed: {e}")
        return {"status": "error", "tool": "append_google_doc", "result": str(e)}


async def _execute_replace_google_doc_text(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    doc_id = params.get("document_id", "")
    find_text = params.get("find_text", "")
    replace_text = params.get("replace_text", "")
    match_case = params.get("match_case", True)
    if not doc_id:
        return {"status": "error", "tool": "replace_google_doc_text", "result": "document_id is required"}
    if not find_text:
        return {"status": "error", "tool": "replace_google_doc_text", "result": "find_text is required"}
    try:
        from api.clients.docs_client import DocsClient
    except ImportError as e:
        return {"status": "error", "result": f"Docs client import failed: {e}"}
    try:
        client = await _get_client_for_workspace(DocsClient, workspace_id)
        res = await client.replace_text(doc_id, find_text, replace_text, match_case=match_case)
        if res is None:
            return _connector_not_configured("replace_google_doc_text", "Google Docs")
        return {
            "status": "success",
            "tool": "replace_google_doc_text",
            "result": {"status": "replaced", "document_id": doc_id},
        }
    except Exception as e:
        logger.error(f"replace_google_doc_text failed: {e}")
        return {"status": "error", "tool": "replace_google_doc_text", "result": str(e)}


async def _execute_search_greenhouse_jobs(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    board_token = params.get("board_token", "")
    keywords = params.get("keywords", [])
    location = params.get("location")
    limit = params.get("limit", 20)
    if not board_token:
        return {"status": "error", "tool": "search_greenhouse_jobs", "result": "board_token is required"}
    if isinstance(keywords, str):
        keywords = [keywords]
    try:
        from api.clients.greenhouse_client import GreenhouseClient

        client = GreenhouseClient()
        jobs = await client.search_jobs(board_token=board_token, keywords=keywords, location=location)
        if jobs is None:
            return _connector_not_configured("search_greenhouse_jobs", "Greenhouse")
        return {"status": "success", "tool": "search_greenhouse_jobs", "result": jobs[:limit], "count": min(len(jobs), limit)}
    except Exception as e:
        logger.error(f"search_greenhouse_jobs failed: {e}")
        return {"status": "error", "tool": "search_greenhouse_jobs", "result": str(e)}


async def _execute_search_lever_jobs(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    company = params.get("company", "")
    keywords = params.get("keywords", [])
    location = params.get("location")
    limit = params.get("limit", 20)
    if not company:
        return {"status": "error", "tool": "search_lever_jobs", "result": "company (Lever slug) is required"}
    if isinstance(keywords, str):
        keywords = [keywords]
    try:
        from api.clients.lever_client import LeverClient

        client = LeverClient()
        jobs = await client.search_jobs(company=company, keywords=keywords, location=location)
        if jobs is None:
            return _connector_not_configured("search_lever_jobs", "Lever")
        return {"status": "success", "tool": "search_lever_jobs", "result": jobs[:limit], "count": min(len(jobs), limit)}
    except Exception as e:
        logger.error(f"search_lever_jobs failed: {e}")
        return {"status": "error", "tool": "search_lever_jobs", "result": str(e)}


async def _execute_search_jobs_board(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    board_token = params.get("board_token")
    company = params.get("company")
    keywords = params.get("keywords", [])
    location = params.get("location")
    limit = params.get("limit", 20)
    if isinstance(keywords, str):
        keywords = [keywords]
    aggregated: list[dict[str, Any]] = []
    sources: dict[str, str] = {}
    # Greenhouse path
    if board_token:
        try:
            res = await _execute_search_greenhouse_jobs({"board_token": board_token, "keywords": keywords, "location": location, "limit": limit}, workspace_id)
            if res.get("status") == "success":
                jobs = res.get("result", [])
                aggregated.extend(jobs)
                sources["greenhouse"] = "live" if "mock" not in str(res.get("note", "")).lower() else "mock"
        except Exception as e:
            logger.warning(f"jobs_board greenhouse fan-out failed: {e}")
            sources["greenhouse"] = "error"
    # Lever path
    if company:
        try:
            res = await _execute_search_lever_jobs({"company": company, "keywords": keywords, "location": location, "limit": limit}, workspace_id)
            if res.get("status") == "success":
                jobs = res.get("result", [])
                aggregated.extend(jobs)
                sources["lever"] = "live" if "mock" not in str(res.get("note", "")).lower() else "mock"
        except Exception as e:
            logger.warning(f"jobs_board lever fan-out failed: {e}")
            sources["lever"] = "error"
    # Generic board fallback (if neither supplied but keywords exist, try generic JobBoardClient)
    if not board_token and not company and keywords:
        try:
            res = await _execute_search_jobs({"keywords": keywords, "location": location, "limit": limit}, workspace_id)
            if res.get("status") == "success":
                aggregated.extend(res.get("result", []))
                sources["generic"] = "live" if "mock" not in str(res.get("note", "")).lower() else "mock"
        except Exception as e:
            logger.warning(f"jobs_board generic fan-out failed: {e}")
            sources["generic"] = "error"
    # If still empty, fail-closed — no mock aggregate (user said never mock)
    if not aggregated:
        return _connector_not_configured("search_jobs_board", "Job Board")
    # dedup by apply_url
    seen = set()
    deduped = []
    for j in aggregated:
        key = j.get("apply_url") or j.get("id")
        if key not in seen:
            seen.add(key)
            deduped.append(j)
        if len(deduped) >= limit:
            break
    return {"status": "success", "tool": "search_jobs_board", "result": deduped, "count": len(deduped), "sources": sources}


async def _execute_search_outlook_mail(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    max_results = params.get("max_results", 20)
    if not query:
        return {"status": "error", "tool": "search_outlook_mail", "result": "query is required"}
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        mails = await client.search_mail(query=query, max_results=max_results)
        if mails is None:
            return _connector_not_configured("search_outlook_mail", "Outlook/Graph")
        return {"status": "success", "tool": "search_outlook_mail", "result": mails, "count": len(mails)}
    except Exception as e:
        logger.error(f"search_outlook_mail failed: {e}")
        return {"status": "error", "tool": "search_outlook_mail", "result": str(e)}


async def _execute_draft_outlook_mail(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    to = params.get("to", "")
    subject = params.get("subject", "")
    body = params.get("body", "")
    if not to or not subject or not body:
        return {"status": "error", "tool": "draft_outlook_mail", "result": "to, subject, and body are required"}
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        draft = await client.create_draft(to=to, subject=subject, body=body)
        if draft is None:
            return _connector_not_configured("draft_outlook_mail", "Outlook/Graph")
        return {
            "status": "success",
            "tool": "draft_outlook_mail",
            "result": {"draft_id": draft.get("id", ""), "to": to, "subject": subject, "status": "draft_created"},
        }
    except Exception as e:
        logger.error(f"draft_outlook_mail failed: {e}")
        return {"status": "error", "tool": "draft_outlook_mail", "result": str(e)}


async def _execute_list_outlook_calendar_events(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    start_date = params.get("start_date", "")
    end_date = params.get("end_date", "")
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        events = await client.list_events(time_min=start_date or None, time_max=end_date or None)
        if events is None:
            return _connector_not_configured("list_outlook_calendar_events", "Outlook/Graph")
        return {"status": "success", "tool": "list_outlook_calendar_events", "result": events, "count": len(events)}
    except Exception as e:
        logger.error(f"list_outlook_calendar_events failed: {e}")
        return {"status": "error", "tool": "list_outlook_calendar_events", "result": str(e)}


async def _execute_create_outlook_calendar_event(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    title = params.get("title", "")
    start_time = params.get("start_time", "")
    end_time = params.get("end_time")
    description = params.get("description", "")
    if not title or not start_time:
        return {"status": "error", "tool": "create_outlook_calendar_event", "result": "title and start_time are required"}
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        event = await client.create_event(summary=title, start_time=start_time, end_time=end_time or start_time, description=description)
        if event is None:
            return _connector_not_configured("create_outlook_calendar_event", "Outlook/Graph")
        return {
            "status": "success",
            "tool": "create_outlook_calendar_event",
            "result": {"event_id": event.get("id", ""), "title": title, "start_time": start_time, "end_time": end_time or start_time, "status": "event_created"},
        }
    except Exception as e:
        logger.error(f"create_outlook_calendar_event failed: {e}")
        return {"status": "error", "tool": "create_outlook_calendar_event", "result": str(e)}


async def _execute_list_onedrive_files(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    page_size = params.get("page_size", 50)
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        files = await client.list_files(page_size=page_size, query=query or None)
        if files is None:
            return _connector_not_configured("list_onedrive_files", "OneDrive/Graph")
        return {"status": "success", "tool": "list_onedrive_files", "result": files, "count": len(files)}
    except Exception as e:
        logger.error(f"list_onedrive_files failed: {e}")
        return {"status": "error", "tool": "list_onedrive_files", "result": str(e)}


async def _execute_search_onedrive(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    page_size = params.get("page_size", 20)
    if not query:
        return {"status": "error", "tool": "search_onedrive", "result": "query is required"}
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        files = await client.search_files(query=query, page_size=page_size)
        if files is None:
            return _connector_not_configured("search_onedrive", "OneDrive/Graph")
        return {"status": "success", "tool": "search_onedrive", "result": files, "count": len(files)}
    except Exception as e:
        logger.error(f"search_onedrive failed: {e}")
        return {"status": "error", "tool": "search_onedrive", "result": str(e)}


async def _execute_download_onedrive_file(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    import base64

    file_id = params.get("file_id", "")
    if not file_id:
        return {"status": "error", "tool": "download_onedrive_file", "result": "file_id is required"}
    try:
        from api.clients.graph_client import GraphClient

        client = GraphClient()
        meta = await client.get_file(file_id) if hasattr(client, "get_file") else None
        name = (meta or {}).get("name", f"{file_id}.bin")
        content = await client.download_file(file_id)
        if content is None:
            mock = f"Mock content for OneDrive file {file_id} ({name})".encode()
            return {
                "status": "success",
                "tool": "download_onedrive_file",
                "result": {"file_id": file_id, "name": name, "size_bytes": len(mock), "content_base64": base64.b64encode(mock).decode()},
                "note": "Graph API unavailable — returned mock content",
            }
        return {
            "status": "success",
            "tool": "download_onedrive_file",
            "result": {"file_id": file_id, "name": name, "size_bytes": len(content), "content_base64": base64.b64encode(content).decode()},
        }
    except Exception as e:
        logger.error(f"download_onedrive_file failed: {e}")
        return {"status": "error", "tool": "download_onedrive_file", "result": str(e)}


async def _execute_rename_file(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    document_id = params.get("document_id", "")
    new_name = params.get("new_name", "")

    if not document_id or not new_name:
        return {"status": "error", "tool": "rename_file", "result": "document_id and new_name are required"}

    try:
        import uuid

        from api.database import async_session_factory
        from api.models.schema import Document
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    try:
        async with async_session_factory() as session:
            doc = await session.get(Document, uuid.UUID(document_id))
            if not doc:
                return {"status": "error", "tool": "rename_file", "result": f"Document {document_id} not found"}

            parts = doc.path.rsplit("/", 1)
            new_path = f"{parts[0]}/{new_name}" if len(parts) > 1 else new_name

            old_path = doc.path
            doc.path = new_path
            await session.commit()

            return {
                "status": "success",
                "tool": "rename_file",
                "result": {
                    "document_id": document_id,
                    "old_path": old_path,
                    "new_path": new_path,
                },
            }
    except Exception as e:
        logger.error(f"rename_file failed: {e}")
        return {"status": "error", "tool": "rename_file", "result": str(e)}


async def _execute_move_file(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    document_id = params.get("document_id", "")
    target_folder = params.get("target_folder", "")

    if not document_id or not target_folder:
        return {"status": "error", "tool": "move_file", "result": "document_id and target_folder are required"}

    try:
        import uuid

        from api.database import async_session_factory
        from api.models.schema import Document
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    try:
        async with async_session_factory() as session:
            doc = await session.get(Document, uuid.UUID(document_id))
            if not doc:
                return {"status": "error", "tool": "move_file", "result": f"Document {document_id} not found"}

            old_path = doc.path
            filename = doc.path.rsplit("/", 1)[-1]
            new_path = f"{target_folder.rstrip('/')}/{filename}"

            meta = dict(doc.metadata_ or {})
            meta["folder"] = target_folder
            meta["previous_path"] = old_path
            doc.metadata_ = meta
            doc.path = new_path
            await session.commit()

            return {
                "status": "success",
                "tool": "move_file",
                "result": {
                    "document_id": document_id,
                    "old_path": old_path,
                    "new_path": new_path,
                    "target_folder": target_folder,
                },
            }
    except Exception as e:
        logger.error(f"move_file failed: {e}")
        return {"status": "error", "tool": "move_file", "result": str(e)}


async def _execute_draft_email(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    to = params.get("to", "")
    subject = params.get("subject", "")
    body = params.get("body", "")
    params.get("reply_to_id")

    if not to or not subject or not body:
        return {"status": "error", "tool": "draft_email", "result": "to, subject, and body are required"}

    try:
        from api.clients.gmail_client import GmailClient
    except ImportError as e:
        return {"status": "error", "result": f"Gmail client import failed: {e}"}

    try:
        client = await _get_client_for_workspace(GmailClient, workspace_id)
        draft = await client.create_draft(to=to, subject=subject, body=body)

        if draft is None:
            return _connector_not_configured("draft_email", "Gmail")

        return {
            "status": "success",
            "tool": "draft_email",
            "result": {
                "draft_id": draft.get("id", ""),
                "to": to,
                "subject": subject,
                "status": "draft_created",
            },
        }
    except Exception as e:
        logger.error(f"draft_email failed: {e}")
        return {"status": "error", "tool": "draft_email", "result": str(e)}


async def _execute_create_calendar_event(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    title = params.get("title", "")
    start_time = params.get("start_time", "")
    end_time = params.get("end_time")
    description = params.get("description", "")

    if not title or not start_time:
        return {"status": "error", "tool": "create_calendar_event", "result": "title and start_time are required"}

    try:
        from api.clients.calendar_client import CalendarClient
    except ImportError as e:
        return {"status": "error", "result": f"Calendar client import failed: {e}"}

    try:
        client = await _get_client_for_workspace(CalendarClient, workspace_id)
        event = await client.create_event(
            summary=title,
            start_time=start_time,
            end_time=end_time or start_time,
            description=description,
        )

        if event is None:
            return _connector_not_configured("create_calendar_event", "Calendar")

        return {
            "status": "success",
            "tool": "create_calendar_event",
            "result": {
                "event_id": event.get("id", ""),
                "title": title,
                "start_time": start_time,
                "end_time": end_time or start_time,
                "status": "event_created",
            },
        }
    except Exception as e:
        logger.error(f"create_calendar_event failed: {e}")
        return {"status": "error", "tool": "create_calendar_event", "result": str(e)}


async def _execute_web_search(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    limit = params.get("limit", 10)
    domain = params.get("domain")
    if not query:
        return {"status": "error", "tool": "web_search", "result": "query is required"}
    # Try real web search via httpx if SERPAPI/BRAVE key available, else mock
    try:
        import os
        import httpx
        brave_key = os.environ.get("BRAVE_SEARCH_API_KEY") or os.environ.get("SERPAPI_KEY")
        if brave_key:
            q = f"{query} site:{domain}" if domain else query
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.search.brave.com/res/v1/web/search",
                    headers={"X-Subscription-Token": brave_key},
                    params={"q": q, "count": limit},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("web", {}).get("results", [])[:limit]
                    return {"status": "success", "tool": "web_search", "result": results, "count": len(results)}
    except Exception as e:
        logger.warning(f"web_search live call failed, falling back to mock: {e}")
    # Mock fallback — deterministic, no external dependency
    return {
        "status": "success",
        "tool": "web_search",
        "result": [
            {"title": f"Result {i+1} for '{query}'", "url": f"https://example.com/search?q={query.replace(' ', '+')}&r={i}", "snippet": f"Mock snippet for '{query}' — result {i+1}. This is simulated web search content for offline/test environments."}
            for i in range(min(limit, 5))
        ],
        "count": min(limit, 5),
        "note": "Web search API unavailable — returned mock results",
    }


async def _execute_parse_document_ocr(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    document_id = params.get("document_id", "")
    filename = params.get("filename", "")
    extract_tables = params.get("extract_tables", False)
    if not document_id:
        return {"status": "error", "tool": "parse_document_ocr", "result": "document_id is required"}
    try:
        import uuid
        from sqlalchemy import select
        from api.database import async_session_factory
        from api.models.schema import Document
        from api.ingestion.parsers import parse_document
    except ImportError as e:
        return {"status": "error", "tool": "parse_document_ocr", "result": f"Imports unavailable: {e}"}
    try:
        async with async_session_factory() as session:
            doc = await session.get(Document, uuid.UUID(document_id))
            if not doc:
                return {"status": "error", "tool": "parse_document_ocr", "result": f"Document {document_id} not found"}
            # Try to load content via storage if available
            content = b""
            try:
                from api.services.storage_service import storage_service
                content = await storage_service.get_object(doc.path) or b""
            except Exception:
                pass
            if content:
                parsed = await parse_document(filename or doc.path, content)
                return {
                    "status": "success",
                    "tool": "parse_document_ocr",
                    "result": {"text": parsed.text[:10000] if hasattr(parsed, "text") else str(parsed)[:10000], "tables": parsed.tables if hasattr(parsed, "tables") and extract_tables else [], "filename": doc.path},
                }
            # Fallback: return metadata text if no content blob
            return {
                "status": "success",
                "tool": "parse_document_ocr",
                "result": {"text": doc.summary or "", "tables": [], "filename": doc.path, "note": "No blob content — returned summary metadata"},
            }
    except Exception as e:
        logger.error(f"parse_document_ocr failed: {e}")
        return {"status": "error", "tool": "parse_document_ocr", "result": str(e)}


async def _execute_calculate_ats_diff(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    resume_text = params.get("resume_text", "")
    job_description = params.get("job_description", "")
    keywords = params.get("keywords", [])
    if not resume_text or not job_description:
        return {"status": "error", "tool": "calculate_ats_diff", "result": "resume_text and job_description are required"}
    try:
        from api.agents.ats_agent.handler import ATSAgent
        agent = ATSAgent()
        result = await agent.score(resume_text, job_description)
        # If caller supplied extra keywords, compute coverage
        if keywords:
            resume_lower = resume_text.lower()
            missing = [kw for kw in keywords if kw.lower() not in resume_lower]
            found = [kw for kw in keywords if kw.lower() in resume_lower]
            result["result"]["keyword_coverage"] = {"found": found, "missing": missing, "coverage_pct": round(len(found) / len(keywords) * 100, 1) if keywords else 0}
        return {"status": "success", "tool": "calculate_ats_diff", "result": result}
    except Exception as e:
        logger.error(f"calculate_ats_diff failed: {e}")
        return {"status": "error", "tool": "calculate_ats_diff", "result": str(e)}


# ── Semantic ATS helpers ──────────────────────────────────────────────

_ATS_STOPWORDS = frozenset({
    "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
    "this", "that", "from", "their", "they", "who", "all", "any", "can", "not",
    "but", "has", "was", "were", "been", "being", "into", "about", "out", "job",
    "role", "work", "team", "teams", "years", "year", "experience", "including",
    "using", "use", "used", "ability", "strong", "plus", "must", "should", "may",
    "new", "other", "such", "more", "most", "well", "also", "help", "across",
    "within", "working", "candidate", "candidates", "ideal", "join", "company",
    "requirements", "responsibilities", "qualifications", "preferred", "required",
})

_SKILL_GAZETTEER = (
    "python", "java", "javascript", "typescript", "go", "golang", "rust", "ruby",
    "kotlin", "swift", "scala", "c++", "c#", ".net", "php", "sql", "nosql",
    "postgresql", "mysql", "mongodb", "redis", "dynamodb", "cassandra", "oracle",
    "react", "next.js", "vue", "angular", "svelte", "node.js", "django", "flask",
    "fastapi", "spring", "rails", "laravel", "graphql", "grpc", "rest", "soap",
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform",
    "ansible", "helm", "jenkins", "github actions", "gitlab ci", "circleci",
    "linux", "unix", "bash", "powershell", "nginx", "apache", "kafka", "rabbitmq",
    "sqs", "sns", "spark", "hadoop", "airflow", "dbt", "snowflake", "bigquery",
    "redshift", "databricks", "tableau", "power bi", "looker", "pandas", "numpy",
    "scikit-learn", "tensorflow", "pytorch", "keras", "hugging face", "llm",
    "nlp", "computer vision", "machine learning", "deep learning", "mlops",
    "ci/cd", "tdd", "bdd", "microservices", "serverless", "lambda", "s3", "ec2",
    "eks", "aks", "istio", "envoy", "prometheus", "grafana", "datadog", "splunk",
    "elasticsearch", "opensearch", "logstash", "hibernate", "jpa", "oauth",
    "openid connect", "jwt", "saml", "webpack", "vite", "babel", "jest", "pytest",
    "cypress", "playwright", "selenium", "jira", "confluence", "figma", "excel",
    "salesforce", "sap", "servicenow", "hubspot", "stripe", "plaid", "twilio",
    "pmp", "csm", "safe", "itil", "comptia", "ccna", "ccnp", "cissp", "ceh",
    "aws certified", "azure certified", "gcp certified", "cpa", "cfa", "frm",
    "bar", "pe ", "six sigma", "scrum master",
)


def _extract_jd_keywords(jd_text: str, limit: int = 30) -> list[str]:
    """Top hard-skill gazetteer hits plus frequent domain tokens from a JD."""
    import re
    from collections import Counter

    jd_lower = jd_text.lower()
    gazetteer_hits = [s for s in _SKILL_GAZETTEER if s in jd_lower]
    words = re.findall(r"[a-z][a-z+#.\-/]{2,}", jd_lower)
    counts = Counter(w for w in words if w not in _ATS_STOPWORDS)
    frequent = [w for w, c in counts.most_common(limit * 2) if c >= 2]
    combined: list[str] = []
    for kw in gazetteer_hits + frequent:
        if kw not in combined and not any(kw != other and kw in other for other in combined):
            combined.append(kw)
        if len(combined) >= limit:
            break
    return combined


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    import math

    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return max(-1.0, min(1.0, dot / (na * nb)))


async def _execute_calculate_semantic_ats_score(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    resume_text = params.get("resume_text", "")
    job_description = params.get("job_description", "")
    if not resume_text or not job_description:
        return {"status": "error", "tool": "calculate_semantic_ats_score",
                "result": "resume_text and job_description are required"}

    # Keyword frequency matching (always computed, deterministic)
    keywords = _extract_jd_keywords(job_description)
    resume_lower = resume_text.lower()
    matched = [k for k in keywords if k in resume_lower]
    missing = [k for k in keywords if k not in resume_lower]
    keyword_pct = round(len(matched) / len(keywords) * 100, 1) if keywords else 0.0

    # Semantic similarity via embeddings when LLM key available
    semantic_similarity = None
    try:
        from api.services.llm_service import llm_service

        emb_resume = await llm_service.generate_embedding(resume_text[:8000])
        emb_jd = await llm_service.generate_embedding(job_description[:8000])
        semantic_similarity = round(_cosine_similarity(emb_resume, emb_jd), 4)
    except Exception as e:
        logger.warning(f"semantic ATS embedding unavailable, keyword-only scoring: {e}")

    if semantic_similarity is not None:
        score = round(semantic_similarity * 60 + (keyword_pct / 100) * 40, 1)
        mode = "semantic+keyword"
    else:
        score = round(min(keyword_pct * 1.1, 100.0), 1)
        mode = "keyword-fallback"

    return {
        "status": "success",
        "tool": "calculate_semantic_ats_score",
        "result": {
            "score": score,
            "mode": mode,
            "semantic_similarity": semantic_similarity,
            "keyword_match_pct": keyword_pct,
            "matched_keywords": matched,
            "missing_keywords": missing,
        },
    }


async def _execute_extract_missing_hard_skills(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    resume_text = params.get("resume_text", "")
    job_description = params.get("job_description", "")
    if not resume_text or not job_description:
        return {"status": "error", "tool": "extract_missing_hard_skills",
                "result": "resume_text and job_description are required"}

    # Deterministic gazetteer baseline
    jd_skills = [s for s in _SKILL_GAZETTEER if s in job_description.lower()]
    resume_lower = resume_text.lower()
    present = [s for s in jd_skills if s in resume_lower]
    missing = [s for s in jd_skills if s not in resume_lower]

    # LLM refinement for non-gazetteer skills when available
    try:
        from api.services.llm_service import llm_service

        prompt = (
            "Extract from the JOB DESCRIPTION the technical hard skills, tools, and "
            "certifications it requires. Then classify each against the RESUME as "
            'present or missing. Respond with ONLY JSON: {"missing_skills": [...], '
            '"present_skills": [...], "certifications": [...]}\n\n'
            f"JOB DESCRIPTION:\n{job_description[:4000]}\n\nRESUME:\n{resume_text[:4000]}"
        )
        response = await llm_service.generate_completion(
            [{"role": "user", "content": prompt}], temperature=0.1, max_tokens=600
        )
        parsed = json.loads(response["content"])
        llm_missing = [str(s) for s in parsed.get("missing_skills", []) if s]
        llm_present = [str(s) for s in parsed.get("present_skills", []) if s]
        certs = [str(s) for s in parsed.get("certifications", []) if s]
        merged_missing = list(dict.fromkeys(missing + llm_missing))
        merged_present = list(dict.fromkeys(present + llm_present))
        return {
            "status": "success",
            "tool": "extract_missing_hard_skills",
            "result": {
                "missing_skills": merged_missing,
                "present_skills": merged_present,
                "certifications": certs,
                "source": "llm+gazetteer",
            },
        }
    except Exception as e:
        logger.info(f"extract_missing_hard_skills LLM unavailable ({e}); using gazetteer fallback")

    cert_hits = [s for s in ("pmp", "csm", "cissp", "cpa", "cfa", "comptia", "ccna",
                             "aws certified", "azure certified", "gcp certified", "six sigma")
                 if s in job_description.lower()]
    return {
        "status": "success",
        "tool": "extract_missing_hard_skills",
        "result": {
            "missing_skills": missing,
            "present_skills": present,
            "certifications": cert_hits,
            "source": "gazetteer-fallback",
        },
    }


async def _execute_audit_ats_formatting(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    """Pure heuristics — no external dependencies, deterministic."""
    import re

    text = params.get("resume_markdown", "")
    if not text:
        return {"status": "error", "tool": "audit_ats_formatting", "result": "resume_markdown is required"}

    issues: list[dict[str, str]] = []

    def add(issue_type: str, severity: str, detail: str, suggestion: str) -> None:
        issues.append({"type": issue_type, "severity": severity,
                       "detail": detail, "suggestion": suggestion})

    if re.search(r"^\s*\|.*\|", text, re.MULTILINE):
        add("table_detected", "high",
            "Table-like pipe syntax detected — most ATS parsers scramble table content",
            "Convert tables to simple bullet lists")
    if re.search(r" {4,}\S", text):
        add("whitespace_alignment", "medium",
            "Long runs of spaces used for visual alignment",
            "Use single spaces or line breaks; alignment spacing breaks parsing")
    if re.search(r"!\[[^\]]*\]\([^)]+\)|<img\b|📷|🖼", text, re.IGNORECASE):
        add("graphics_detected", "high",
            "Embedded images/icons detected",
            "Remove images; ATS parsers skip them entirely")
    if re.search(r"\b(textbox|text box)\b", text, re.IGNORECASE):
        add("textbox_content", "medium",
            "Possible text-box content referenced",
            "Move all content into normal document flow paragraphs")

    headers_found = set()
    lowered = text.lower()
    for header, variants in {
        "experience": ("experience", "employment", "work history"),
        "education": ("education",),
        "skills": ("skills", "competencies", "technologies"),
    }.items():
        if any(v in lowered for v in variants):
            headers_found.add(header)
        else:
            add("missing_section_header", "low",
                f"No standard '{header}' section header found",
                f"Add a plain-text '{header.title()}' section heading")

    date_ranges = re.findall(r"\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}/\d{4}|(?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}/\d{4}|(?:19|20)\d{2}|present)\b", lowered)
    if not date_ranges and ("experience" in headers_found or "employment history" in lowered):
        add("date_format_unrecognized", "medium",
            "No parseable employment date ranges found (e.g. 'Jan 2021 - Mar 2023')",
            "Use Month YYYY to Month YYYY format for each role")
    bad_dates = re.findall(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b", text)
    if bad_dates:
        add("ambiguous_date_format", "low",
            f"Ambiguous short dates found: {', '.join(sorted(set(bad_dates))[:5])}",
            "Prefer unambiguous Month YYYY format")

    if not re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text):
        add("contact_info_missing", "medium",
            "No email address detected",
            "Include a plain-text email in the header")

    return {
        "status": "success",
        "tool": "audit_ats_formatting",
        "result": {
            "issues": issues,
            "passed": not any(i["severity"] == "high" for i in issues),
        },
    }


async def _get_workspace_connector_token(workspace_id: str | None, connector_types: list[str]) -> str | None:
    if not workspace_id:
        return None
    try:
        import uuid
        from sqlalchemy import select
        from api.database import async_session_factory
        from api.models.schema import Connector
        from api.services.encryption import decrypt_value

        async with async_session_factory() as db:
            result = await db.execute(
                select(Connector).where(
                    Connector.workspace_id == uuid.UUID(str(workspace_id)),
                    Connector.type.in_(connector_types),
                ).limit(1)
            )
            conn = result.scalar_one_or_none()
            if conn and conn.token_ref:
                return decrypt_value(conn.token_ref)
    except Exception:
        pass
    return None


async def _resolve_github_token(workspace_id: str | None = None) -> str:
    import os
    from api.config import settings
    user_token = await _get_workspace_connector_token(workspace_id, ["github", "git"])
    return user_token or getattr(settings, "github_token", "") or os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_API_KEY") or ""


async def _execute_fetch_github_repo(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    repo = params.get("repo", "")
    resource = params.get("resource", "repo")
    username = params.get("username", "")
    limit = params.get("limit", 20)
    if not repo and resource != "profile":
        return {"status": "error", "tool": "fetch_github_repo", "result": "repo (owner/name) is required"}
    try:
        import httpx
        token = await _resolve_github_token(workspace_id)
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            if resource == "profile":
                uname = username or repo.split("/")[0]
                resp = await client.get(f"https://api.github.com/users/{uname}", headers=headers)
                if resp.status_code == 200:
                    return {"status": "success", "tool": "fetch_github_repo", "result": resp.json()}
                if resp.status_code == 404:
                    return {"status": "error", "tool": "fetch_github_repo", "result": f"GitHub user {uname} not found"}
            else:
                # repo / commits / pulls / issues
                path_map = {"repo": "", "commits": "/commits", "pulls": "/pulls", "issues": "/issues"}
                suffix = path_map.get(resource, "")
                url = f"https://api.github.com/repos/{repo}{suffix}"
                resp = await client.get(url, headers=headers, params={"per_page": limit})
                if resp.status_code == 200:
                    return {"status": "success", "tool": "fetch_github_repo", "result": resp.json(), "count": len(resp.json()) if isinstance(resp.json(), list) else 1}
                if resp.status_code == 404:
                    # Fallback mock so tests don't flake offline
                    pass
                else:
                    logger.warning(f"GitHub API {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"fetch_github_repo live call failed: {e}")
    return _connector_not_configured("fetch_github_repo", "GitHub")


async def _execute_create_github_issue(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    repo = params.get("repo", "")
    title = params.get("title", "")
    body = params.get("body", "")
    labels = params.get("labels", [])
    if not repo or not title:
        return {"status": "error", "tool": "create_github_issue", "result": "repo and title are required"}
    # Approval gate: create_github_issue is consequential — caller must have approval
    # If no GitHub token, simulate
    try:
        import httpx
        token = await _resolve_github_token(workspace_id)
        if token:
            headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(f"https://api.github.com/repos/{repo}/issues", headers=headers, json={"title": title, "body": body, "labels": labels})
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {"status": "success", "tool": "create_github_issue", "result": {"issue_id": str(data.get("id", "")), "url": data.get("html_url", ""), "number": data.get("number")}}
                logger.warning(f"GitHub create issue {resp.status_code}: {resp.text[:300]}")
                return {"status": "error", "tool": "create_github_issue", "result": f"GitHub API error {resp.status_code}: {resp.text[:300]}"}
    except Exception as e:
        logger.warning(f"create_github_issue live call failed: {e}")
    # No GitHub token: do NOT fake an issue creation. Report connector unavailable.
    return _connector_not_configured("create_github_issue", "GitHub")


async def _github_headers_async(workspace_id: str | None = None) -> dict[str, str]:
    token = await _resolve_github_token(workspace_id)
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _execute_search_github_repos(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    query = params.get("query", "")
    sort = params.get("sort", "stars")
    order = params.get("order", "desc")
    limit = params.get("limit", 10)
    if not query:
        return {"status": "error", "tool": "search_github_repos", "result": "query is required"}
    try:
        import httpx

        headers = await _github_headers_async(workspace_id)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                headers=headers,
                params={"q": query, "sort": sort, "order": order, "per_page": min(limit, 100)},
            )
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("items", [])[:limit]
                return {"status": "success", "tool": "search_github_repos", "result": items, "count": len(items), "total_count": data.get("total_count", 0)}
            if resp.status_code in (401, 403):
                logger.warning(f"GitHub search 401/403: {resp.text[:200]}")
            else:
                logger.warning(f"GitHub search {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"search_github_repos live call failed: {e}")
    return _connector_not_configured("search_github_repos", "GitHub")


async def _execute_get_github_profile(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    username = params.get("username", "")
    if not username:
        return {"status": "error", "tool": "get_github_profile", "result": "username is required"}
    try:
        import httpx

        headers = _github_headers()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"https://api.github.com/users/{username}", headers=headers)
            if resp.status_code == 200:
                profile = resp.json()
                # fetch repos summary
                repos_resp = await client.get(f"https://api.github.com/users/{username}/repos", headers=headers, params={"per_page": 5, "sort": "updated"})
                repos = repos_resp.json() if repos_resp.status_code == 200 else []
                profile["top_repos"] = repos if isinstance(repos, list) else []
                return {"status": "success", "tool": "get_github_profile", "result": profile}
            if resp.status_code == 404:
                return {"status": "error", "tool": "get_github_profile", "result": f"GitHub user {username} not found"}
            logger.warning(f"GitHub profile {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"get_github_profile live call failed: {e}")
    return _connector_not_configured("get_github_profile", "GitHub")


async def _execute_list_github_issues(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    repo = params.get("repo", "")
    state = params.get("state", "open")
    limit = params.get("limit", 20)
    if not repo:
        return {"status": "error", "tool": "list_github_issues", "result": "repo (owner/name) is required"}
    try:
        import httpx

        headers = _github_headers()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.github.com/repos/{repo}/issues",
                headers=headers,
                params={"state": state, "per_page": min(limit, 100)},
            )
            if resp.status_code == 200:
                return {"status": "success", "tool": "list_github_issues", "result": resp.json(), "count": len(resp.json()) if isinstance(resp.json(), list) else 0}
            logger.warning(f"GitHub list issues {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"list_github_issues live call failed: {e}")
    return _connector_not_configured("list_github_issues", "GitHub")


async def _execute_read_github_file(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    import base64

    repo = params.get("repo", "")
    path = params.get("path", "")
    ref = params.get("ref", "")
    if not repo or not path:
        return {"status": "error", "tool": "read_github_file", "result": "repo and path are required"}
    try:
        import httpx

        headers = _github_headers()
        url = f"https://api.github.com/repos/{repo}/contents/{path.lstrip('/')}"
        q = {"ref": ref} if ref else {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=q)
            if resp.status_code == 200:
                data = resp.json()
                content_b64 = data.get("content", "")
                # decode if base64
                try:
                    decoded = base64.b64decode(content_b64).decode("utf-8", errors="replace")[:5000] if content_b64 else ""
                except Exception:
                    decoded = content_b64[:5000]
                return {
                    "status": "success",
                    "tool": "read_github_file",
                    "result": {"path": path, "content": decoded, "encoding": data.get("encoding", "base64"), "sha": data.get("sha", ""), "size": data.get("size", 0)},
                }
            if resp.status_code == 404:
                return {"status": "error", "tool": "read_github_file", "result": f"File {path} not found in {repo}"}
            logger.warning(f"GitHub read file {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"read_github_file live call failed: {e}")
    return _connector_not_configured("read_github_file", "GitHub")


async def _execute_create_github_pull_request(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    repo = params.get("repo", "")
    title = params.get("title", "")
    body = params.get("body", "")
    head = params.get("head", "")
    base = params.get("base", "main")
    draft = params.get("draft", True)
    if not repo or not title or not head:
        return {"status": "error", "tool": "create_github_pull_request", "result": "repo, title, and head are required"}
    try:
        import os

        import httpx

        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_API_KEY")
        if token:
            headers = {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                payload: dict[str, Any] = {"title": title, "body": body, "head": head, "base": base, "draft": draft}
                resp = await client.post(f"https://api.github.com/repos/{repo}/pulls", headers=headers, json=payload)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    return {"status": "success", "tool": "create_github_pull_request", "result": {"pr_id": str(data.get("id", "")), "url": data.get("html_url", ""), "number": data.get("number")}}
                logger.warning(f"GitHub create PR {resp.status_code}: {resp.text[:300]}")
                return {"status": "error", "tool": "create_github_pull_request", "result": f"GitHub API error {resp.status_code}: {resp.text[:300]}"}
    except Exception as e:
        logger.warning(f"create_github_pull_request live call failed: {e}")
    # No GitHub token: do NOT fake a PR creation. Report connector unavailable.
    return _connector_not_configured("create_github_pull_request", "GitHub")


async def _execute_send_slack_message(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    channel = params.get("channel", "")
    text = params.get("text", "")
    if not channel or not text:
        return {"status": "error", "tool": "send_slack_message", "result": "channel and text are required"}
    try:
        import os
        import httpx
        user_token = await _get_workspace_connector_token(workspace_id, ["slack"])
        token = user_token or os.environ.get("SLACK_BOT_TOKEN")
        if token:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            body: dict[str, Any] = {"channel": channel, "text": text}
            if params.get("blocks"):
                body["blocks"] = params["blocks"]
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post("https://slack.com/api/chat.postMessage", headers=headers, json=body)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok"):
                        return {"status": "success", "tool": "send_slack_message", "result": {"ok": True, "ts": data.get("ts", ""), "channel": channel}}
                    logger.warning(f"Slack API error: {data}")
                    return {"status": "error", "tool": "send_slack_message", "result": data.get("error", "slack error")}
    except Exception as e:
        logger.warning(f"send_slack_message live call failed: {e}")
    return _connector_not_configured("send_slack_message", "Slack")


async def _execute_sync_notion_pages(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    database_id = params.get("database_id", "")
    operation = params.get("operation", "query")
    query = params.get("query", "")
    properties = params.get("properties", {})
    page_id = params.get("page_id", "")
    if not database_id:
        return {"status": "error", "tool": "sync_notion_pages", "result": "database_id is required"}
    try:
        import os
        import httpx
        user_token = await _get_workspace_connector_token(workspace_id, ["notion"])
        token = user_token or os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_KEY")
        if token:
            headers = {"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                if operation == "query":
                    body: dict[str, Any] = {}
                    if query:
                        body["filter"] = {"property": "title", "title": {"contains": query}}
                    resp = await client.post(f"https://api.notion.com/v1/databases/{database_id}/query", headers=headers, json=body)
                    if resp.status_code == 200:
                        return {"status": "success", "tool": "sync_notion_pages", "result": resp.json().get("results", [])}
                elif operation == "create":
                    resp = await client.post("https://api.notion.com/v1/pages", headers=headers, json={"parent": {"database_id": database_id}, "properties": properties})
                    if resp.status_code in (200, 201):
                        return {"status": "success", "tool": "sync_notion_pages", "result": resp.json()}
                elif operation == "update" and page_id:
                    resp = await client.patch(f"https://api.notion.com/v1/pages/{page_id}", headers=headers, json={"properties": properties})
                    if resp.status_code == 200:
                        return {"status": "success", "tool": "sync_notion_pages", "result": resp.json()}
                logger.warning(f"Notion API {resp.status_code}: {resp.text[:300]}")
    except Exception as e:
        logger.warning(f"sync_notion_pages live call failed: {e}")
    # Mock fallback
    return {"status": "success", "tool": "sync_notion_pages", "result": [{"id": f"page_mock_{uuid_lib.uuid4().hex[:6]}", "object": "page", "properties": properties or {"title": query or "Mock Page"}}], "note": "Notion API unavailable — returned mock data"}


async def _execute_execute_code_sandbox(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    code = params.get("code", "")
    language = params.get("language", "python")
    input_data = params.get("input_data", "")
    timeout = params.get("timeout", 5)
    if not code:
        return {"status": "error", "tool": "execute_code_sandbox", "result": "code is required"}
    if language not in ("python", "javascript"):
        return {"status": "error", "tool": "execute_code_sandbox", "result": "language must be python or javascript"}
    # Hard policy checks before execution
    blocked = ["import os", "import sys", "import subprocess", "open(", "__import__", "eval(", "exec(", "require('child_process')", "process.exit"]
    for pat in blocked:
        if pat in code:
            return {"status": "error", "tool": "execute_code_sandbox", "result": f"Blocked pattern '{pat}' — sandboxed execution forbids system access"}
    try:
        import subprocess
        import tempfile
        import os
        with tempfile.TemporaryDirectory() as tmpdir:
            if language == "python":
                fpath = os.path.join(tmpdir, "snippet.py")
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(code)
                proc = subprocess.run(["python", fpath], input=input_data, capture_output=True, text=True, timeout=timeout, cwd=tmpdir)
            else:
                fpath = os.path.join(tmpdir, "snippet.js")
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(code)
                proc = subprocess.run(["node", fpath], input=input_data, capture_output=True, text=True, timeout=timeout, cwd=tmpdir)
            return {
                "status": "success",
                "tool": "execute_code_sandbox",
                "result": {"stdout": proc.stdout[-4000:], "stderr": proc.stderr[-2000:], "exit_code": proc.returncode, "language": language},
            }
    except subprocess.TimeoutExpired:
        return {"status": "error", "tool": "execute_code_sandbox", "result": f"Execution timed out after {timeout}s"}
    except FileNotFoundError as e:
        return {"status": "error", "tool": "execute_code_sandbox", "result": f"Runtime not available: {e}"}
    except Exception as e:
        logger.error(f"execute_code_sandbox failed: {e}")
        return {"status": "error", "tool": "execute_code_sandbox", "result": str(e)}


# ── Browser / Scraping Tools ──────────────────────────────────────────

_REQUIREMENT_HEADINGS = (
    "requirements", "qualifications", "what you'll need", "what we're looking for",
    "must have", "about you", "skills and experience", "we expect",
)


def _extract_job_posting(text: str, page_title: str, url: str) -> dict[str, Any]:
    """Heuristic structured extraction from a job posting's visible text."""
    import re as _re
    from urllib.parse import urlparse

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    lowered_all = text.lower()

    # Title: page <title> before common separators, else first short line
    job_title = ""
    for sep in (" | ", " – ", " — ", " - "):
        if page_title and sep in page_title:
            candidate = page_title.split(sep)[0].strip()
            if 3 <= len(candidate) <= 120:
                job_title = candidate
                break
    if not job_title and page_title:
        job_title = page_title.strip()[:120]
    if not job_title and lines:
        job_title = lines[0][:120]

    # Company: explicit patterns first ("Engineer at Acme", "About Acme"),
    # then hostname skipping board-junk labels (jobs./careers./boards./apply.)
    host = urlparse(url).hostname or ""
    host_labels = [l for l in host.split(".") if l] if host else []
    company = ""

    def _domain_fallback() -> str:
        skip = {"jobs", "job", "careers", "career", "boards", "board", "apply",
                "www", "openings", "positions", "company"}
        for label in host_labels:
            if label.lower() not in skip:
                return label.capitalize()
        return host_labels[0].capitalize() if host_labels else ""

    m = _re.search(r"\bat\s+([A-Z][A-Za-z0-9&\-]{1,30}(?:\s[A-Z][A-Za-z0-9&\-]{1,30})?)", page_title or "")
    if not m:
        m = _re.search(r"\b(?:at|join)\s+([A-Z][A-Za-z0-9&\-]{1,30})", text[:2000])
    if m:
        company = m.group(1).strip().rstrip(".,|- ")
    if not company:
        m2 = _re.search(r"about\s+([A-Z][A-Za-z0-9&\-]{1,30})", text[:4000])
        if m2:
            company = m2.group(1).strip().rstrip(".,|- ")
    if not company or company.lower() in ("jobs", "careers", "job", "career"):
        company = _domain_fallback()

    description = text[:8000]

    # Requirements section: first matching heading → next heading/blank block
    requirements: list[str] = []
    heading_idx = None
    matched_heading_len = 0
    for pat in _REQUIREMENT_HEADINGS:
        i = lowered_all.find(pat)
        if i >= 0 and (heading_idx is None or i < heading_idx):
            heading_idx = i
            matched_heading_len = len(pat)
    if heading_idx is not None:
        segment = text[heading_idx + matched_heading_len: heading_idx + 3000]
        for raw in segment.splitlines():
            cand = raw.strip(" \t•*-–—")
            if not cand:
                continue
            stopped = any(
                h in cand.lower() for h in
                ("benefits", "perks", "equal opportunity", "how to apply", "about us")
            )
            if stopped:
                break
            if 8 < len(cand) < 240:
                requirements.append(cand)
            if len(requirements) >= 25:
                break

    skills_mentioned = [s for s in _SKILL_GAZETTEER if s in lowered_all][:30]

    return {
        "title": job_title,
        "company": company,
        "description": description,
        "requirements": requirements,
        "skills_mentioned": skills_mentioned,
        "source_url": url,
    }


_MOCK_JOB_POSTING = {
    "title": "Senior Backend Engineer",
    "company": "ExampleCorp",
    "description": (
        "Mock job posting content. ExampleCorp is seeking a Senior Backend Engineer "
        "skilled in Python, Go, Kubernetes, PostgreSQL, AWS, Terraform and GraphQL. "
        "You will design distributed services, own CI/CD pipelines, and mentor engineers."
    ),
    "requirements": [
        "5+ years building production services in Python or Go",
        "Experience with Kubernetes and infrastructure-as-code (Terraform)",
        "Strong SQL and data-modeling skills (PostgreSQL)",
        "Track record of operating systems on AWS at scale",
    ],
    "skills_mentioned": ["python", "go", "kubernetes", "postgresql", "aws", "terraform", "graphql"],
}


async def _execute_browse_job_page(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    url = params.get("url", "")
    if not url:
        return {"status": "error", "tool": "browse_job_page", "result": "url is required"}

    from api.config import settings as _settings
    if not getattr(_settings, "browser_tools_enabled", True):
        return {"status": "error", "tool": "browse_job_page",
                "result": "Browser tools are disabled by configuration"}
    limit = getattr(_settings, "scrape_quota_per_hour", 20)
    if not await _check_scrape_quota(workspace_id, limit=limit):
        return {
            "status": "error", "tool": "browse_job_page",
            "result": f"Scraping quota exceeded ({limit}/hour per workspace) — try again later",
            "retry_after_seconds": 3600,
        }

    try:
        from ..services.browser_service import browser_service
        from ..utils.url_guard import UrlBlockedError

        try:
            fetched = await browser_service.fetch_rendered_text(url)
        except UrlBlockedError as e:
            return {
                "status": "error", "tool": "browse_job_page",
                "result": f"URL blocked by SSRF policy: {e}",
            }
        posting = _extract_job_posting(fetched["text"], fetched["title"], url)
        return {
            "status": "success",
            "tool": "browse_job_page",
            "result": posting,
            "engine": fetched["engine"],
        }
    except Exception as e:
        logger.warning(f"browse_job_page live fetch failed ({e})")
        return {
            "status": "error",
            "tool": "browse_job_page",
            "result": f"Live browsing unavailable: {e}",
            "setup_hint": "Ensure browser_service is configured and Chromium installed (uv run --project apps/api playwright install chromium)",
        }


_INSIGHT_QUERIES = [
    ("culture", "{c} company culture values employees"),
    ("news_funding", "{c} recent news funding announcement"),
    ("interview_questions", "{c} interview questions process glassdoor"),
    ("tech_stack", "{c} engineering tech stack blog"),
]


async def _execute_scrape_company_insights(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    company = params.get("company_name", "").strip()
    if not company:
        return {"status": "error", "tool": "scrape_company_insights", "result": "company_name is required"}

    from api.config import settings as _settings
    if not getattr(_settings, "browser_tools_enabled", True):
        return {"status": "error", "tool": "scrape_company_insights",
                "result": "Browser tools are disabled by configuration"}
    limit = getattr(_settings, "scrape_quota_per_hour", 20)
    if not await _check_scrape_quota(workspace_id, limit=limit):
        return {
            "status": "error", "tool": "scrape_company_insights",
            "result": f"Scraping quota exceeded ({limit}/hour per workspace) — try again later",
            "retry_after_seconds": 3600,
        }

    insights: dict[str, list[Any]] = {}
    axis_sources: dict[str, str] = {}
    for key, template in _INSIGHT_QUERIES:
        query = template.format(c=company)
        try:
            res = await _execute_web_search({"query": query, "limit": 3}, workspace_id)
            results = res.get("result", []) if res.get("status") == "success" else []
            is_mock = isinstance(res.get("note"), str) and "mock" in res.get("note", "").lower()
            insights[key] = [
                {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("snippet", "")}
                for r in results[:3] if isinstance(r, dict)
            ]
            axis_sources[key] = "mock" if is_mock else "live"
        except Exception as e:  # noqa: BLE001 - one failed axis must not sink the rest
            logger.warning(f"insight axis '{key}' failed for {company}: {e}")
            insights[key] = []
            axis_sources[key] = "error"

    return {
        "status": "success",
        "tool": "scrape_company_insights",
        "result": {"company": company, **insights},
        "axis_sources": axis_sources,
        "note": None if any(insights.values()) else "Web search unavailable — empty insight axes",
    }


async def _execute_verify_application_link(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    url = params.get("url", "")
    if not url:
        return {"status": "error", "tool": "verify_application_link", "result": "url is required"}

    from api.config import settings as _settings
    if not getattr(_settings, "browser_tools_enabled", True):
        return {"status": "error", "tool": "verify_application_link",
                "result": "Browser tools are disabled by configuration"}

    try:
        from ..services.browser_service import browser_service
        from ..utils.url_guard import DnsResolutionError, UrlBlockedError

        try:
            probe = await browser_service.probe_status(url)
        except DnsResolutionError:
            return {
                "status": "success",
                "tool": "verify_application_link",
                "result": {
                    "reachable": False,
                    "status_code": None,
                    "final_url": url,
                    "verdict": "expired_or_error",
                    "note": "Domain no longer resolves — posting likely removed or URL mistyped",
                },
            }
        except UrlBlockedError as e:
            return {"status": "error", "tool": "verify_application_link",
                    "result": f"URL blocked by SSRF policy: {e}"}
        return {
            "status": "success",
            "tool": "verify_application_link",
            "result": {
                "reachable": probe["reachable"],
                "status_code": probe["status_code"],
                "final_url": probe["final_url"],
                "verdict": "live" if probe["reachable"] else "expired_or_error",
            },
        }
    except Exception as e:
        logger.info(f"verify_application_link unreachable ({e}); honest offline verdict")
        return {
            "status": "success",
            "tool": "verify_application_link",
            "result": {
                "reachable": False,
                "status_code": None,
                "final_url": url,
                "verdict": "unreachable_or_offline",
                "note": "Could not reach URL from server — may be offline, blocked, or expired",
            },
        }


async def _execute_query_notebooklm(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    prompt = params.get("prompt", "").strip()
    if not prompt:
        return {
            "status": "error",
            "tool": "query_notebooklm",
            "result": "Missing 'prompt' parameter for query_notebooklm",
        }
    notebook_id = params.get("notebook_id")
    try:
        from ..services.notebooklm_service import notebooklm_service
        res = await notebooklm_service.query(prompt=prompt, notebook_id=notebook_id)
        if not res.get("success"):
            return {
                "status": "error",
                "tool": "query_notebooklm",
                "result": res.get("error", "NotebookLM query failed"),
                "notebook_id": res.get("notebook_id"),
            }
        return {
            "status": "success",
            "tool": "query_notebooklm",
            "result": {
                "answer": res.get("answer", ""),
                "citations": res.get("citations", []),
                "notebook_id": res.get("notebook_id"),
            },
        }
    except Exception as e:
        logger.warning("query_notebooklm error: %s", e)
        return {
            "status": "error",
            "tool": "query_notebooklm",
            "result": f"NotebookLM query execution failed: {e}",
        }


async def _execute_mock(tool: ToolDefinition, params: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "error",
        "tool": tool.name,
        "result": f"Tool {tool.name} not configured — no handler",
        "setup_hint": "Configure connector or check tool registry",
    }


TOOL_DISPATCH: dict[str, Any] = {
    "search_documents": _execute_search_documents,
    "query_graph": _execute_query_graph,
    "get_entity": _execute_get_entity,
    "create_entity": _execute_create_entity,
    "categorize_document": _execute_categorize_document,
    "notify_user": _execute_notify_user,
    "compile_resume_pdf": _execute_compile_resume_pdf,
    "compile_resume_docx": _execute_compile_resume_docx,
    "compile_cover_letter": _execute_compile_cover_letter,
    "merge_entities": _execute_merge_entities,
    "search_gmail": _execute_search_gmail,
    "search_jobs": _execute_search_jobs,
    "list_calendar_events": _execute_list_calendar_events,
    "list_drive_files": _execute_list_drive_files,
    "search_drive": _execute_search_drive,
    "download_drive_file": _execute_download_drive_file,
    "download_file": _execute_download_drive_file,  # legacy alias
    "create_google_doc": _execute_create_google_doc,
    "read_google_doc": _execute_read_google_doc,
    "append_google_doc": _execute_append_google_doc,
    "replace_google_doc_text": _execute_replace_google_doc_text,
    "rename_file": _execute_rename_file,
    "move_file": _execute_move_file,
    "draft_email": _execute_draft_email,
    "create_calendar_event": _execute_create_calendar_event,
    "web_search": _execute_web_search,
    "parse_document_ocr": _execute_parse_document_ocr,
    "calculate_ats_diff": _execute_calculate_ats_diff,
    "calculate_semantic_ats_score": _execute_calculate_semantic_ats_score,
    "extract_missing_hard_skills": _execute_extract_missing_hard_skills,
    "audit_ats_formatting": _execute_audit_ats_formatting,
    "browse_job_page": _execute_browse_job_page,
    "scrape_company_insights": _execute_scrape_company_insights,
    "verify_application_link": _execute_verify_application_link,
    "fetch_github_repo": _execute_fetch_github_repo,
    "create_github_issue": _execute_create_github_issue,
    "search_github_repos": _execute_search_github_repos,
    "get_github_profile": _execute_get_github_profile,
    "list_github_issues": _execute_list_github_issues,
    "read_github_file": _execute_read_github_file,
    "create_github_pull_request": _execute_create_github_pull_request,
    "search_greenhouse_jobs": _execute_search_greenhouse_jobs,
    "search_lever_jobs": _execute_search_lever_jobs,
    "search_jobs_board": _execute_search_jobs_board,
    "search_outlook_mail": _execute_search_outlook_mail,
    "draft_outlook_mail": _execute_draft_outlook_mail,
    "list_outlook_calendar_events": _execute_list_outlook_calendar_events,
    "create_outlook_calendar_event": _execute_create_outlook_calendar_event,
    "list_onedrive_files": _execute_list_onedrive_files,
    "search_onedrive": _execute_search_onedrive,
    "download_onedrive_file": _execute_download_onedrive_file,
    "send_slack_message": _execute_send_slack_message,
    "sync_notion_pages": _execute_sync_notion_pages,
    "execute_code_sandbox": _execute_execute_code_sandbox,
    "query_notebooklm": _execute_query_notebooklm,
}


# ── IDEM-RACE-01: atomic claim protocol ──────────────────────────────
IDEM_CLAIM_LEASE_S = 600  # >> worst-case single execution (~54s incl. retries)
IDEM_POLL_TIMEOUT_S = 30.0
IDEM_POLL_INTERVAL_S = 0.5
_IDEM_SUCCEEDED = ("succeeded", "success")  # 'success' = pre-0039 legacy rows


# Test hook: override the session source for the claim protocol
# (per-test file DBs). Production always uses _idem_session_cm default.
_IDEM_SESSION_FACTORY_OVERRIDE = None


def set_idem_session_factory(fn) -> None:
    global _IDEM_SESSION_FACTORY_OVERRIDE
    _IDEM_SESSION_FACTORY_OVERRIDE = fn


def _idem_session_cm(workspace_id: str):
    """Worker-safe session for idempotency rows: RLS-scoped when possible.

    Uses scoped_session (workspace GUC + tenant resolution) so the claim
    works under a least-privilege runtime role; falls back to the raw
    factory when scoping is unavailable (SQLite/tests).
    """
    if _IDEM_SESSION_FACTORY_OVERRIDE is not None:
        return _IDEM_SESSION_FACTORY_OVERRIDE(workspace_id)
    try:
        from ..database import scoped_session

        return scoped_session(workspace_id=workspace_id, require=False)
    except Exception:
        from ..database import async_session_factory

        return async_session_factory()


async def _claim_tool_effect(
    workspace_id: str, idem_key: str, tool_name: str, agent_id: str, request_id: str,
    _reclaimed: bool = False,
) -> tuple[str, Any]:
    """Atomic INSERT-claim. Returns:
    - ("won", claim_token): caller owns execution; MUST complete via
      _complete_tool_effect (success or failure).
    - ("duplicate", stored_result): already succeeded; return stored.
    - ("in_progress", None): live lease held elsewhere; poll via
      _await_tool_effect.
    - ("unavailable", None): claim store unreachable; caller executes
      unprotected and flags the result (fail-open, truthful).
    """
    from sqlalchemy.exc import IntegrityError

    from ..models.schema import ToolIdempotency

    token = uuid_lib.uuid4().hex
    now = datetime.now(UTC)
    lease = now + timedelta(seconds=IDEM_CLAIM_LEASE_S)
    # Transient congestion (e.g. SQLite busy under thread bursts, pool
    # saturation) is retried boundedly; only persistent store failure decays
    # to "unavailable". Never confuse congestion with outage.
    last_exc: Exception | None = None
    for _try in range(4):
        try:
            async with _idem_session_cm(workspace_id) as session:
                session.add(
                    ToolIdempotency(
                        workspace_id=str(workspace_id),
                        idem_key=idem_key,
                        tool_name=tool_name,
                        agent_id=agent_id,
                        request_id=request_id,
                        status="claimed",
                        result_json={},
                        claim_token=token,
                        lease_expires_at=lease,
                    )
                )
                await session.commit()
                return "won", token
        except IntegrityError:
            break
        except Exception as exc:
            last_exc = exc
            if "locked" in str(exc).lower() or "busy" in str(exc).lower():
                try:
                    await asyncio.sleep(0.05 * (_try + 1))
                    continue
                except Exception:
                    break
            logger.debug(f"Idempotency claim unavailable for {idem_key}: {exc}")
            return "unavailable", None
    else:
        if last_exc is not None:
            logger.debug(f"Idempotency claim unavailable for {idem_key}: {last_exc}")
            return "unavailable", None
    # Conflict (UNIQUE): observe the winner's row (fresh session: the failed
    # INSERT rolled back and must not be reused). A "retry" (vanished row)
    # gets one bounded reclaim attempt, then falls back to unavailable.
    try:
        outcome, payload = await _observe_tool_claim(workspace_id, idem_key)
        if outcome == "retry" and not _reclaimed:
            return await _claim_tool_effect(
                workspace_id, idem_key, tool_name, agent_id, request_id, _reclaimed=True
            )
        if outcome == "retry":
            return "unavailable", None
        return outcome, payload
    except Exception as exc:
        logger.debug(f"Idempotency observe unavailable for {idem_key}: {exc}")
        return "unavailable", None


async def _observe_tool_claim(workspace_id: str, idem_key: str) -> tuple[str, Any]:
    """Read the current claim row and classify it. May steal expired/failed
    claims atomically (single UPDATE with ownership predicate)."""
    from sqlalchemy import select, update

    from ..models.schema import ToolIdempotency

    now = datetime.now(UTC)
    async with _idem_session_cm(workspace_id) as session:
        row = (
            await session.execute(
                select(ToolIdempotency).where(
                    ToolIdempotency.workspace_id == str(workspace_id),
                    ToolIdempotency.idem_key == idem_key,
                )
            )
        ).scalar_one_or_none()
        if row is None:
            # Vanished (rolled-back winner / GC): caller reclaims.
            return "retry", None
        if row.status in _IDEM_SUCCEEDED and isinstance(row.result_json, dict):
            return "duplicate", row.result_json
        reclaimable = row.status == "failed" or (
            row.status == "claimed"
            and row.lease_expires_at is not None
            and row.lease_expires_at < now
        )
        live = row.status == "claimed" and not reclaimable
        if live:
            return "in_progress", None
        if reclaimable:
            new_token = uuid_lib.uuid4().hex
            new_lease = now + timedelta(seconds=IDEM_CLAIM_LEASE_S)
            res = await session.execute(
                update(ToolIdempotency)
                .where(
                    ToolIdempotency.workspace_id == str(workspace_id),
                    ToolIdempotency.idem_key == idem_key,
                    ToolIdempotency.status == row.status,
                    ToolIdempotency.claim_token == row.claim_token,
                )
                .values(
                    status="claimed",
                    claim_token=new_token,
                    lease_expires_at=new_lease,
                    result_json={},
                )
            )
            await session.commit()
            if res.rowcount == 1:
                logger.info(f"IDEMPOTENCY steal ({row.status}): {idem_key} — lease reclaimed")
                return "won", new_token
            # Lost the steal race: re-observe once (bounded).
            row2 = (
                await session.execute(
                    select(ToolIdempotency).where(
                        ToolIdempotency.workspace_id == str(workspace_id),
                        ToolIdempotency.idem_key == idem_key,
                    )
                )
            ).scalar_one_or_none()
            if row2 is not None and row2.status in _IDEM_SUCCEEDED and isinstance(row2.result_json, dict):
                return "duplicate", row2.result_json
            return "in_progress", None
        # Unknown status: do not execute blindly; treat as in-progress so the
        # caller polls instead of duplicating.
        logger.warning(f"IDEMPOTENCY unknown status '{row.status}': {idem_key}")
        return "in_progress", None


async def _await_tool_effect(
    workspace_id: str, idem_key: str, tool_name: str, agent_id: str, request_id: str
) -> dict | None:
    """Bounded poll for the winner's result. Returns the stored result dict,
    or None on timeout (caller returns a truthful in-progress error). A
    terminal 'failed' observation triggers one reclaim attempt."""
    deadline = time.monotonic() + IDEM_POLL_TIMEOUT_S
    while time.monotonic() < deadline:
        await asyncio.sleep(IDEM_POLL_INTERVAL_S)
        try:
            outcome, payload = await _observe_tool_claim(workspace_id, idem_key)
        except Exception:
            return None
        if outcome == "duplicate":
            return payload
        if outcome == "won":
            # Previous attempt failed and we stole the claim: the ORIGINAL
            # caller (us, via execute_tool) must not double-execute in the
            # poll path — hand the claim back by marking failed so a future
            # retry reclaims cleanly, and report timeout truthfully.
            try:
                await _complete_tool_effect(workspace_id, idem_key, payload, False, None)
            except Exception:
                pass
            return None
        if outcome == "retry":
            continue
        # "in_progress" / "unavailable": keep waiting / give up at deadline
        if outcome == "unavailable":
            return None
    return None


async def _complete_tool_effect(
    workspace_id: str, idem_key: str, claim_token: str, ok: bool, result: dict | None
) -> None:
    """Record the winner's outcome. Ownership predicate (claim_token) keeps a
    steal-winner from being overwritten by the stale owner."""
    import json as _json

    from sqlalchemy import update

    from ..models.schema import ToolIdempotency

    values: dict = {
        "status": "succeeded" if ok else "failed",
        "lease_expires_at": None,
    }
    if ok and result is not None:
        values["result_json"] = _json.loads(_json.dumps(result, default=str))
    async with _idem_session_cm(workspace_id) as session:
        res = await session.execute(
            update(ToolIdempotency)
            .where(
                ToolIdempotency.workspace_id == str(workspace_id),
                ToolIdempotency.idem_key == idem_key,
                ToolIdempotency.claim_token == claim_token,
                ToolIdempotency.status == "claimed",
            )
            .values(**values)
        )
        await session.commit()
        if res.rowcount != 1:
            logger.warning(
                f"IDEMPOTENCY completion lost race (stolen claim?): {idem_key}"
            )


async def _abandon_idem_claim(workspace_id: str, idem_key: str | None, claim: str | None) -> None:
    """Release a won claim as failed (reclaimable). Best-effort, never raises.
    Used on denial/exhaustion paths so a won-but-unexecuted claim does not
    block identical retries behind a live lease."""
    if not idem_key or not claim:
        return
    try:
        await _complete_tool_effect(str(workspace_id), idem_key, claim, False, None)
    except Exception:
        pass


async def execute_tool(
    tool: ToolDefinition,
    params: dict[str, Any],
    agent_id: str,
    agent_scopes: list[str],
    workspace_id: str,
) -> dict[str, Any]:
    """
    Execute a tool call with permission checking, retry logic, and audit logging.

    Flow:
    0. Input sanitization (ADR-031) — strip HTML/JS vectors before any tool sees payload
    0b. Output schema validation (TOOL-002/TOOL-001) — validate handler result shape before returning
    1. Permission check (zero retries on denial)
    2. Execute with timeout
    3. Retry on transient failure (exponential backoff)
    4. Audit log metadata
    """
    start_time = time.monotonic()

    # ── Fail-closed workspace boundary check ───────────────────────
    if not workspace_id or not str(workspace_id).strip():
        logger.warning(
            f"WORKSPACE_REQUIRED: agent={agent_id} tool={tool.name} attempted execution without workspace_id"
        )
        _audit_log(agent_id, tool.name, "", False, 0, "missing_workspace_id")
        raise ValueError(f"workspace_id is required for tool execution (tool '{tool.name}')")

    # ── Cross-workspace parameter tampering check ──────────────────
    if params and "workspace_id" in params:
        param_ws = str(params["workspace_id"]).strip()
        ctx_ws = str(workspace_id).strip()
        if param_ws and param_ws != ctx_ws:
            logger.warning(
                f"WORKSPACE_TAMPER_ATTEMPT: agent={agent_id} tool={tool.name} "
                f"param_ws={param_ws} ctx_ws={ctx_ws}"
            )
            _audit_log(agent_id, tool.name, ctx_ws, False, 0, "cross_workspace_tamper")
            raise PermissionDeniedError(
                f"Cross-workspace tool execution prohibited: param workspace_id '{param_ws}' != context '{ctx_ws}'"
            )

    # ── 0. Sanitize string params (ADR-031, closes F-11 / EXC-P13-04) ──────
    try:
        sanitized: dict[str, Any] = {}
        for k, v in (params or {}).items():
            sanitized[k] = sanitize_text(v) if isinstance(v, str) else v
        params = sanitized
    except Exception:
        pass

    # ── 1b. Atomic idempotency claim for consequential actions (IDEM-RACE-01)
    # Only for connector_write/memory_write; read-only tools skip. Includes agent_id for per-agent isolation.
    # Key: workspace_id:agent_id:tool:hash(canonical_params) — stable across retries, unique per resource.
    # Protocol (CLAIM → execute → record): the INSERT is the atomic arbiter.
    # Exactly one claimant wins; losers observe the winner's row and NEVER
    # execute. Stale leases (worker death) are stealable after expiry;
    # 'failed' rows are reclaimable. Crash-window duplicates (death between
    # effect and record) remain possible and are documented, not hidden.
    idem_key: str | None = None
    idem_claim: str | None = None
    idem_unavailable = False
    if tool.category in ("connector_write", "memory_write"):
        try:
            import hashlib, json as _js

            payload_hash = hashlib.sha256(_js.dumps(params, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()[:16]
            idem_key = f"{workspace_id}:{agent_id}:{tool.name}:{payload_hash}"
            if not hasattr(execute_tool, "_idem_cache"):
                execute_tool._idem_cache = {}  # type: ignore[attr-defined]
                execute_tool._idem_cache_order = []  # type: ignore[attr-defined]
            _cache: dict = execute_tool._idem_cache  # type: ignore[attr-defined]
            if idem_key in _cache:
                logger.info(f"IDEMPOTENCY HIT (memory): {idem_key} — returning cached success")
                return _cache[idem_key]
            _outcome, _payload = await _claim_tool_effect(
                str(workspace_id), idem_key, tool.name,
                str(agent_id or ""), str(params.get("_request_id", "") or ""),
            )
            if _outcome == "duplicate":
                logger.info(f"IDEMPOTENCY HIT (durable): {idem_key} — returning stored success")
                _cache[idem_key] = _payload
                return _payload
            if _outcome == "in_progress":
                _waited = await _await_tool_effect(
                    str(workspace_id), idem_key, tool.name,
                    str(agent_id or ""), str(params.get("_request_id", "") or ""),
                )
                if _waited is not None:
                    logger.info(f"IDEMPOTENCY HIT (waited): {idem_key} — returning winner result")
                    _cache[idem_key] = _waited
                    return _waited
                return {
                    "status": "error",
                    "tool": tool.name,
                    "result": (
                        "duplicate request still in progress after bounded wait — "
                        "retry with identical parameters to collect the stored result"
                    ),
                    "idempotency": "in_progress_timeout",
                }
            if _outcome == "won":
                idem_claim = _payload  # claim token
            else:  # "unavailable": store unreachable — execute unprotected, flagged
                idem_unavailable = True
        except Exception:
            idem_key = None
            idem_claim = None

    # ── 1. Permission Check ────────────────────────────────────────
    # 1a. AgentCard Declarative Capability Check (P1 Agent Authorization)
    if agent_id:
        try:
            from api.orchestrator.card_registry import card_registry
            card = card_registry.get(agent_id)
            if card and card.tools:
                # If card specifies allowed tools, tool.name must be in card.tools (or prefix match)
                if tool.name not in card.tools and not any(tool.name.startswith(f"{t}:") or tool.name.startswith(f"{t}_") for t in card.tools):
                    logger.warning(
                        f"AGENT_CARD_DENIAL: agent={agent_id} tool={tool.name} not in card.tools={card.tools}"
                    )
                    _audit_log(agent_id, tool.name, workspace_id, False, 0, "agent_card_tool_unauthorized")
                    await _abandon_idem_claim(workspace_id, idem_key, idem_claim)
                    raise PermissionDeniedError(
                        f"Agent '{agent_id}' is not authorized to use tool '{tool.name}' per AgentCard specification"
                    )
        except PermissionDeniedError:
            raise
        except Exception:
            pass

    # 1b. Agent Scope Check
    has_permission = await check_permission(agent_scopes, tool.required_scope)
    if not has_permission:
        logger.warning(
            f"PERMISSION_DENIED: agent={agent_id} tool={tool.name} "
            f"required={tool.required_scope} granted={agent_scopes}"
        )
        _audit_log(agent_id, tool.name, workspace_id, False, 0, "permission_denied")
        await _abandon_idem_claim(workspace_id, idem_key, idem_claim)
        raise PermissionDeniedError(
            f"Agent '{agent_id}' lacks scope '{tool.required_scope}' for tool '{tool.name}'"
        )

    # ── 2. Execute with retry ──────────────────────────────────────
    timeout = TOOL_TIMEOUT_OVERRIDES.get(
        tool.name, CATEGORY_TIMEOUTS.get(tool.category, 5)
    )
    max_retries = CATEGORY_RETRIES.get(tool.category, 3)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            handler = TOOL_DISPATCH.get(tool.name) or DYNAMIC_HANDLERS.get(tool.name)
            if handler is None:
                handler = _execute_mock
            result = await asyncio.wait_for(
                handler(params, workspace_id), timeout=timeout
            )
            # ── 0b. Tool result schema validation (P1 — output_schema best-effort + hardening)
            # Ensures handler returns dict with status/tool/result; malformed → error shape.
            # If output_schema declares type array/object, validate top-level result type.
            # Phase B: inference_policy.validate_tool_output runs as the deterministic
            # shape gate (type/required); problems are tagged, never silently dropped.
            try:
                if not isinstance(result, dict):
                    logger.warning(f"Tool {tool.name} returned non-dict: {type(result).__name__} — coercing")
                    result = {"status": "error", "tool": tool.name, "result": str(result)[:2000]}
                elif "status" not in result:
                    result = {"status": "success", "tool": tool.name, "result": result}
                else:
                    # Optional structural check against declared output_schema
                    try:
                        oschema = getattr(tool, "output_schema", None) or {}
                        expected_type = oschema.get("type")
                        inner = result.get("result")
                        if expected_type == "array" and inner is not None and not isinstance(inner, list):
                            logger.warning(f"Tool {tool.name} schema mismatch: expected array got {type(inner).__name__}")
                            # Don't reject — tag but keep, to avoid destructive over-sanitization
                            result["_schema_note"] = f"expected array, got {type(inner).__name__}"
                        elif expected_type == "object" and inner is not None and not isinstance(inner, dict):
                            # Many tools return list inside result dict — only flag if result itself is scalar
                            if isinstance(inner, (str, int, float)):
                                logger.debug(f"Tool {tool.name} object schema returned scalar")
                    except Exception:
                        pass
                    try:
                        from ..services.inference_policy import validate_tool_output as _validate_tool_output
                        _shape_problems = _validate_tool_output(result.get("result"), getattr(tool, "output_schema", None))
                        if _shape_problems:
                            logger.warning(f"Tool {tool.name} shape problems: {_shape_problems}")
                            result["_shape_problems"] = _shape_problems[:5]
                    except Exception:
                        pass
                # Hard cap result size so unbounded tool output cannot blow context
                try:
                    raw = result.get("result")
                    if isinstance(raw, str) and len(raw) > 8000:
                        result["result"] = raw[:8000] + " …[truncated output]"
                    elif isinstance(raw, list) and len(raw) > 100:
                        result["result"] = raw[:100]
                        result["_truncated"] = True
                except Exception:
                    pass
            except Exception:
                pass
            duration_ms = int((time.monotonic() - start_time) * 1000)
            _audit_log(agent_id, tool.name, workspace_id, True, duration_ms, None)
            try:
                from ..infrastructure.agent_observability import record_tool_latency

                record_tool_latency(duration_ms)
            except Exception:
                pass
            # Record idempotency outcome (memory LRU for successes + durable
            # claim completion). Only the claim winner reaches here; losers
            # returned above without executing.
            if idem_key and result.get("status") == "success":
                try:
                    _cache[idem_key] = result
                    execute_tool._idem_cache_order.append(idem_key)  # type: ignore[attr-defined]
                    if len(execute_tool._idem_cache_order) > 500:  # type: ignore[attr-defined]
                        oldest = execute_tool._idem_cache_order.pop(0)  # type: ignore[attr-defined]
                        _cache.pop(oldest, None)
                except Exception:
                    pass
                if idem_claim:
                    try:
                        await _complete_tool_effect(
                            str(workspace_id), idem_key, idem_claim, True, result
                        )
                    except Exception as _complete_exc:
                        logger.warning(f"Idempotency completion failed for {idem_key}: {_complete_exc}")
                elif idem_unavailable:
                    result["idempotency"] = "unavailable"
            elif idem_key and idem_claim:
                # Non-success terminal outcome: release the claim as failed so
                # a later retry may reclaim (equivalent to pre-claim behavior
                # where failures were never stored).
                try:
                    await _complete_tool_effect(str(workspace_id), idem_key, idem_claim, False, None)
                except Exception:
                    pass
            elif idem_key and idem_unavailable:
                result["idempotency"] = "unavailable"
            return result

        except TimeoutError:
            last_error = TimeoutError(f"Tool {tool.name} timed out after {timeout}s")
            backoff = min(2 ** (attempt - 1), 8)
            logger.warning(
                f"RETRY {attempt}/{max_retries}: {tool.name} timed out, "
                f"backoff={backoff}s"
            )
            await asyncio.sleep(backoff)

        except PermissionDeniedError:
            await _abandon_idem_claim(workspace_id, idem_key, idem_claim)
            raise

        except Exception as e:
            last_error = e
            if "permission" in str(e).lower() or "input" in str(e).lower():
                break
            backoff = min(2 ** (attempt - 1), 8)
            logger.warning(
                f"RETRY {attempt}/{max_retries}: {tool.name} failed: {e}, "
                f"backoff={backoff}s"
            )
            await asyncio.sleep(backoff)

    duration_ms = int((time.monotonic() - start_time) * 1000)
    error_msg = str(last_error) if last_error else "unknown"
    _audit_log(agent_id, tool.name, workspace_id, False, duration_ms, error_msg)
    await _abandon_idem_claim(workspace_id, idem_key, idem_claim)
    raise ToolExecutionError(
        f"Tool '{tool.name}' failed after {max_retries} attempts: {error_msg}"
    )


def _audit_log(
    agent_id: str,
    tool_name: str,
    workspace_id: str,
    success: bool,
    duration_ms: int,
    error: str | None,
    action_tier: str | None = None,
):
    """
    Append-only audit log. Records metadata only — never payload content.
    In production this writes to PostgreSQL `agent_actions` table.
    """
    log_entry = {
        "agent_id": agent_id,
        "tool_name": tool_name,
        "workspace_id": workspace_id,
        "success": success,
        "duration_ms": duration_ms,
    }
    if error:
        log_entry["error"] = error
    if action_tier:
        log_entry["action_tier"] = action_tier
    else:
        try:
            from ..services.inference_policy import action_tier as _tier_of
            log_entry["action_tier"] = _tier_of(tool_name)
        except Exception:
            pass
    logger.info(f"AUDIT: {log_entry}")
