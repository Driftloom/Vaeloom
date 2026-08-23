"""
Tool executor with permission checking, retry logic, and audit logging.
"""
import asyncio
import json
import logging
import time
import uuid as uuid_lib
from typing import Any

from .definitions import ToolDefinition
from ..utils.sanitize import sanitize_text

logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
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
}

# Per-workspace scraping quota (sliding window, in-process; matches the
# MemoryBackend rate-limiter precedent). Applied to network-heavy fetches.
_SCRAPE_TIMESTAMPS: dict[str, list[float]] = {}


def _check_scrape_quota(workspace_id: str, limit: int = 20, window_s: float = 3600.0) -> bool:
    """True if workspace is under the scraping quota; records the hit."""
    import time as _time

    now = _time.monotonic()
    hits = _SCRAPE_TIMESTAMPS.get(workspace_id)
    if hits is None:
        hits = _SCRAPE_TIMESTAMPS[workspace_id] = []
    while hits and hits[0] <= now - window_s:
        hits.pop(0)
    if len(hits) >= limit:
        return False
    hits.append(now)
    return True


# ── Dynamic tool registry (MCP-bridged tools) ─────────────────────────
# Static tools live in TOOL_DISPATCH; MCP servers register here at runtime.
DYNAMIC_HANDLERS: dict[str, Any] = {}
DYNAMIC_TOOL_DEFS: dict[str, ToolDefinition] = {}
_DYNAMIC_APPROVAL_GATED: set[str] = set()

_BASE_APPROVAL_GATED = frozenset({
    "create_github_issue", "send_slack_message", "create_calendar_event",
    "draft_email", "rename_file", "move_file", "categorize_document",
    "create_entity", "merge_entities",
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
    try:
        from sqlalchemy import or_, select

        from api.database import async_session_factory
        from api.models.schema import Document
    except ImportError as e:
        return {"status": "error", "result": f"DB imports unavailable: {e}"}

    query = params.get("query", "")
    limit = params.get("limit", 10)

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

        client = GmailClient()
        emails = await client.fetch_emails(query=gmail_query, max_results=max_results)

        if emails is None:
            return {
                "status": "success",
                "tool": "search_gmail",
                "result": [
                    {"id": f"mock_{i}", "subject": f"Mock Email {i}", "sender": "mock@example.com", "body": "Gmail API not configured"}
                    for i in range(min(max_results, 3))
                ],
                "note": "Gmail API unavailable — returned mock data",
            }

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
            return {
                "status": "success",
                "tool": "search_jobs",
                "result": [
                    {"id": f"mock_{i}", "title": f"Mock {keywords_list[0]} Job {i}", "company": "Mock Corp", "location": location or "Remote"}
                    for i in range(min(limit, 3))
                ],
                "note": "Job board API unavailable — returned mock data",
            }

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
        client = CalendarClient()
        events = await client.list_events(time_min=start_date if start_date else None, time_max=end_date if end_date else None)

        if events is None:
            return {
                "status": "success",
                "tool": "list_calendar_events",
                "result": [
                    {"id": f"mock_{i}", "title": f"Mock Event {i}", "start_time": start_date or "2025-01-01T09:00:00Z", "end_time": end_date or "2025-01-01T10:00:00Z", "source": "calendar"}
                    for i in range(3)
                ],
                "note": "Calendar API unavailable — returned mock data",
            }

        return {
            "status": "success",
            "tool": "list_calendar_events",
            "result": events,
            "count": len(events),
        }
    except Exception as e:
        logger.error(f"list_calendar_events failed: {e}")
        return {"status": "error", "tool": "list_calendar_events", "result": str(e)}


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
        client = GmailClient()
        draft = await client.create_draft(to=to, subject=subject, body=body)

        if draft is None:
            mock_id = f"draft_mock_{uuid_lib.uuid4().hex[:8]}"
            return {
                "status": "success",
                "tool": "draft_email",
                "result": {
                    "draft_id": mock_id,
                    "to": to,
                    "subject": subject,
                    "status": "draft_simulated",
                },
                "note": "Gmail API unavailable — draft simulated",
            }

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
        client = CalendarClient()
        event = await client.create_event(
            summary=title,
            start_time=start_time,
            end_time=end_time or start_time,
            description=description,
        )

        if event is None:
            mock_id = f"event_mock_{uuid_lib.uuid4().hex[:8]}"
            return {
                "status": "success",
                "tool": "create_calendar_event",
                "result": {
                    "event_id": mock_id,
                    "title": title,
                    "start_time": start_time,
                    "end_time": end_time or start_time,
                    "status": "event_simulated",
                },
                "note": "Calendar API unavailable — event simulated",
            }

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


async def _execute_fetch_github_repo(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    repo = params.get("repo", "")
    resource = params.get("resource", "repo")
    username = params.get("username", "")
    limit = params.get("limit", 20)
    if not repo and resource != "profile":
        return {"status": "error", "tool": "fetch_github_repo", "result": "repo (owner/name) is required"}
    try:
        import os
        import httpx
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_API_KEY") or ""
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
    # Mock fallback
    mock_map = {
        "repo": {"full_name": repo or "octocat/Hello-World", "description": f"Mock repo data for {repo}", "stars": 42, "forks": 7},
        "commits": [{"sha": f"abc{i}", "message": f"Mock commit {i}"} for i in range(min(limit, 3))],
        "pulls": [{"id": i, "title": f"Mock PR {i}"} for i in range(min(limit, 3))],
        "issues": [{"id": i, "title": f"Mock Issue {i}"} for i in range(min(limit, 3))],
        "profile": {"login": username or "octocat", "name": "Mock User", "public_repos": 8},
    }
    return {"status": "success", "tool": "fetch_github_repo", "result": mock_map.get(resource, mock_map["repo"]), "note": "GitHub API unavailable — returned mock data"}


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
        import os
        import httpx
        token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_API_KEY")
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
    # Mock approval-gated simulation
    mock_id = f"issue_mock_{uuid_lib.uuid4().hex[:8]}"
    return {"status": "success", "tool": "create_github_issue", "result": {"issue_id": mock_id, "url": f"https://github.com/{repo}/issues/mock", "title": title, "status": "simulated_requires_approval"}, "note": "GitHub API unavailable — issue creation simulated (approval-gated)"}


async def _execute_send_slack_message(params: dict[str, Any], workspace_id: str) -> dict[str, Any]:
    channel = params.get("channel", "")
    text = params.get("text", "")
    if not channel or not text:
        return {"status": "error", "tool": "send_slack_message", "result": "channel and text are required"}
    try:
        import os
        import httpx
        token = os.environ.get("SLACK_BOT_TOKEN")
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
    return {"status": "success", "tool": "send_slack_message", "result": {"ok": True, "ts": f"mock_{uuid_lib.uuid4().hex[:8]}", "channel": channel, "text": text[:100]}, "note": "Slack API unavailable — message simulated"}


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
        token = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_KEY")
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
    if not _check_scrape_quota(workspace_id, limit=limit):
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
        logger.warning(f"browse_job_page live fetch failed ({e}); returning mock fixture")

    mock = dict(_MOCK_JOB_POSTING)
    mock["source_url"] = url
    return {
        "status": "success",
        "tool": "browse_job_page",
        "result": mock,
        "note": "Live browsing unavailable — returned deterministic mock fixture",
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
    if not _check_scrape_quota(workspace_id, limit=limit):
        return {
            "status": "error", "tool": "scrape_company_insights",
            "result": f"Scraping quota exceeded ({limit}/hour per workspace) — try again later",
            "retry_after_seconds": 3600,
        }

    insights: dict[str, list[Any]] = {}
    for key, template in _INSIGHT_QUERIES:
        query = template.format(c=company)
        try:
            res = await _execute_web_search({"query": query, "limit": 3}, workspace_id)
            results = res.get("result", []) if res.get("status") == "success" else []
            insights[key] = [
                {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("snippet", "")}
                for r in results[:3] if isinstance(r, dict)
            ]
        except Exception as e:  # noqa: BLE001 - one failed axis must not sink the rest
            logger.warning(f"insight axis '{key}' failed for {company}: {e}")
            insights[key] = []

    return {
        "status": "success",
        "tool": "scrape_company_insights",
        "result": {"company": company, **insights},
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


async def _execute_mock(tool: ToolDefinition, params: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "success",
        "tool": tool.name,
        "result": f"Mock result for {tool.name}",
        "params_received": list(params.keys()),
        "note": "Real implementation requires external connector or service",
    }


TOOL_DISPATCH: dict[str, Any] = {
    "search_documents": _execute_search_documents,
    "query_graph": _execute_query_graph,
    "get_entity": _execute_get_entity,
    "create_entity": _execute_create_entity,
    "categorize_document": _execute_categorize_document,
    "notify_user": _execute_notify_user,
    "merge_entities": _execute_merge_entities,
    "search_gmail": _execute_search_gmail,
    "search_jobs": _execute_search_jobs,
    "list_calendar_events": _execute_list_calendar_events,
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
    "send_slack_message": _execute_send_slack_message,
    "sync_notion_pages": _execute_sync_notion_pages,
    "execute_code_sandbox": _execute_execute_code_sandbox,
}


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
    1. Permission check (zero retries on denial)
    2. Execute with timeout
    3. Retry on transient failure (exponential backoff)
    4. Audit log metadata
    """
    start_time = time.monotonic()

    # ── 0. Sanitize string params (ADR-031, closes F-11 / EXC-P13-04) ──────
    try:
        sanitized: dict[str, Any] = {}
        for k, v in (params or {}).items():
            sanitized[k] = sanitize_text(v) if isinstance(v, str) else v
        params = sanitized
    except Exception:
        pass

    # ── 1. Permission Check ────────────────────────────────────────
    has_permission = await check_permission(agent_scopes, tool.required_scope)
    if not has_permission:
        logger.warning(
            f"PERMISSION_DENIED: agent={agent_id} tool={tool.name} "
            f"required={tool.required_scope} granted={agent_scopes}"
        )
        _audit_log(agent_id, tool.name, workspace_id, False, 0, "permission_denied")
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
            duration_ms = int((time.monotonic() - start_time) * 1000)
            _audit_log(agent_id, tool.name, workspace_id, True, duration_ms, None)
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
    logger.info(f"AUDIT: {log_entry}")
