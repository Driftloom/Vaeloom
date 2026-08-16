"""
MCP-shaped tool definitions for Vaeloom agents.
Every tool follows the MCP format: name, description, input_schema, output_schema, required_scope.
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class ToolDefinition(BaseModel):
    """MCP-shaped tool definition."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    required_scope: str
    category: str  # memory_read | memory_write | connector_read | connector_write | system


# ── Memory Read Tools ──────────────────────────────────────────────

SEARCH_DOCUMENTS = ToolDefinition(
    name="search_documents",
    description="Search across user documents with semantic search",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "limit": {"type": "integer", "default": 10},
        },
        "required": ["query"],
    },
    output_schema={"type": "array", "items": {"$ref": "Document"}},
    required_scope="memory.read",
    category="memory_read",
)

QUERY_GRAPH = ToolDefinition(
    name="query_graph",
    description="Query the knowledge graph for entities and relationships",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "entity_type": {"type": "string", "default": "any"},
            "limit": {"type": "integer", "default": 20},
        },
        "required": ["query"],
    },
    output_schema={"type": "array", "items": {"$ref": "GraphNode"}},
    required_scope="memory.read",
    category="memory_read",
)

GET_ENTITY = ToolDefinition(
    name="get_entity",
    description="Retrieve a specific entity by ID from the knowledge graph",
    input_schema={
        "type": "object",
        "properties": {"entity_id": {"type": "string"}},
        "required": ["entity_id"],
    },
    output_schema={"$ref": "GraphNode"},
    required_scope="memory.read",
    category="memory_read",
)


# ── Memory Write Tools ─────────────────────────────────────────────

CREATE_ENTITY = ToolDefinition(
    name="create_entity",
    description="Create a new entity in the knowledge graph",
    input_schema={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "entity_type": {"type": "string"},
            "properties": {"type": "object"},
        },
        "required": ["name", "entity_type"],
    },
    output_schema={"$ref": "GraphNode"},
    required_scope="memory.write",
    category="memory_write",
)

MERGE_ENTITIES = ToolDefinition(
    name="merge_entities",
    description="Merge two duplicate entities in the knowledge graph",
    input_schema={
        "type": "object",
        "properties": {
            "source_id": {"type": "string"},
            "target_id": {"type": "string"},
        },
        "required": ["source_id", "target_id"],
    },
    output_schema={"$ref": "GraphNode"},
    required_scope="memory.write",
    category="memory_write",
)

CATEGORIZE_DOCUMENT = ToolDefinition(
    name="categorize_document",
    description="Assign a category and folder to a document",
    input_schema={
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "category": {"type": "string"},
            "folder": {"type": "string"},
        },
        "required": ["document_id", "category"],
    },
    output_schema={"type": "object", "properties": {"status": {"type": "string"}}},
    required_scope="memory.write",
    category="memory_write",
)


# ── Connector Read Tools ───────────────────────────────────────────

SEARCH_GMAIL = ToolDefinition(
    name="search_gmail",
    description="Search the user's Gmail for emails matching a query",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "max_results": {"type": "integer", "default": 20},
            "after_date": {"type": "string", "format": "date"},
        },
        "required": ["query"],
    },
    output_schema={"type": "array", "items": {"$ref": "Email"}},
    required_scope="connector.gmail.read",
    category="connector_read",
)

SEARCH_JOBS = ToolDefinition(
    name="search_jobs",
    description="Search connected job platforms for matching roles",
    input_schema={
        "type": "object",
        "properties": {
            "keywords": {"type": "array", "items": {"type": "string"}},
            "location": {"type": "string"},
            "remote_ok": {"type": "boolean", "default": True},
            "limit": {"type": "integer", "default": 20},
        },
        "required": ["keywords"],
    },
    output_schema={"type": "array", "items": {"$ref": "JobPosting"}},
    required_scope="connector.jobs.read",
    category="connector_read",
)

LIST_CALENDAR_EVENTS = ToolDefinition(
    name="list_calendar_events",
    description="List calendar events in a date range",
    input_schema={
        "type": "object",
        "properties": {
            "start_date": {"type": "string", "format": "date"},
            "end_date": {"type": "string", "format": "date"},
        },
        "required": ["start_date", "end_date"],
    },
    output_schema={"type": "array", "items": {"$ref": "CalendarEvent"}},
    required_scope="connector.calendar.read",
    category="connector_read",
)


# ── Connector Write Tools ──────────────────────────────────────────

RENAME_FILE = ToolDefinition(
    name="rename_file",
    description="Rename a file in the user's workspace",
    input_schema={
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "new_name": {"type": "string"},
        },
        "required": ["document_id", "new_name"],
    },
    output_schema={"type": "object", "properties": {"status": {"type": "string"}}},
    required_scope="connector.write",
    category="connector_write",
)

MOVE_FILE = ToolDefinition(
    name="move_file",
    description="Move a file to a different folder in the workspace",
    input_schema={
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "target_folder": {"type": "string"},
        },
        "required": ["document_id", "target_folder"],
    },
    output_schema={"type": "object", "properties": {"status": {"type": "string"}}},
    required_scope="connector.write",
    category="connector_write",
)

DRAFT_EMAIL = ToolDefinition(
    name="draft_email",
    description="Draft an email response (never sends — user must approve)",
    input_schema={
        "type": "object",
        "properties": {
            "to": {"type": "string"},
            "subject": {"type": "string"},
            "body": {"type": "string"},
            "reply_to_id": {"type": "string"},
        },
        "required": ["to", "subject", "body"],
    },
    output_schema={"type": "object", "properties": {"draft_id": {"type": "string"}}},
    required_scope="connector.gmail.write",
    category="connector_write",
)

CREATE_CALENDAR_EVENT = ToolDefinition(
    name="create_calendar_event",
    description="Create a calendar event (requires user approval unless reminder-only)",
    input_schema={
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "start_time": {"type": "string", "format": "date-time"},
            "end_time": {"type": "string", "format": "date-time"},
            "description": {"type": "string"},
        },
        "required": ["title", "start_time"],
    },
    output_schema={"type": "object", "properties": {"event_id": {"type": "string"}}},
    required_scope="connector.calendar.write",
    category="connector_write",
)


# ── System Tools ───────────────────────────────────────────────────

NOTIFY_USER = ToolDefinition(
    name="notify_user",
    description="Send a notification to the user",
    input_schema={
        "type": "object",
        "properties": {
            "message": {"type": "string"},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
        },
        "required": ["message"],
    },
    output_schema={"type": "object", "properties": {"delivered": {"type": "boolean"}}},
    required_scope="system.notify",
    category="system",
)


# ── Registry ───────────────────────────────────────────────────────

ALL_TOOLS: Dict[str, ToolDefinition] = {
    t.name: t
    for t in [
        SEARCH_DOCUMENTS, QUERY_GRAPH, GET_ENTITY,
        CREATE_ENTITY, MERGE_ENTITIES, CATEGORIZE_DOCUMENT,
        SEARCH_GMAIL, SEARCH_JOBS, LIST_CALENDAR_EVENTS,
        RENAME_FILE, MOVE_FILE, DRAFT_EMAIL, CREATE_CALENDAR_EVENT,
        NOTIFY_USER,
    ]
}


def get_tools_for_agent(tool_names: List[str]) -> List[ToolDefinition]:
    """Return tool definitions for a given agent's declared tool list."""
    return [ALL_TOOLS[name] for name in tool_names if name in ALL_TOOLS]
