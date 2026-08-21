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
    1. Permission check (zero retries on denial)
    2. Execute with timeout
    3. Retry on transient failure (exponential backoff)
    4. Audit log metadata
    """
    start_time = time.monotonic()

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
    timeout = CATEGORY_TIMEOUTS.get(tool.category, 5)
    max_retries = CATEGORY_RETRIES.get(tool.category, 3)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            handler = TOOL_DISPATCH.get(tool.name, _execute_mock)
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
