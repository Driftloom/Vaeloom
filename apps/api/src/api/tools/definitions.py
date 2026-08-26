"""
MCP-shaped tool definitions for Vaeloom agents.
Every tool follows the MCP format: name, description, input_schema, output_schema, required_scope.
"""
from typing import Any

from pydantic import BaseModel


class ToolDefinition(BaseModel):
    """MCP-shaped tool definition."""
    name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
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


# ── Web / Research Tools ─────────────────────────────────────────

WEB_SEARCH = ToolDefinition(
    name="web_search",
    description="Real-time web search for company news, salaries, and industry trends",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query"},
            "limit": {"type": "integer", "default": 10},
            "domain": {"type": "string", "description": "Optional domain filter e.g. linkedin.com"},
        },
        "required": ["query"],
    },
    output_schema={"type": "array", "items": {"type": "object"}},
    required_scope="system.web_search",
    category="system",
)

PARSE_DOCUMENT_OCR = ToolDefinition(
    name="parse_document_ocr",
    description="Extract structured text from PDFs, DOCX, scanned images, certificates",
    input_schema={
        "type": "object",
        "properties": {
            "document_id": {"type": "string"},
            "filename": {"type": "string"},
            "extract_tables": {"type": "boolean", "default": False},
        },
        "required": ["document_id"],
    },
    output_schema={"type": "object", "properties": {"text": {"type": "string"}, "tables": {"type": "array"}}},
    required_scope="memory.read",
    category="memory_read",
)

CALCULATE_ATS_DIFF = ToolDefinition(
    name="calculate_ats_diff",
    description="Compute granular diffs between master resume and target job descriptions",
    input_schema={
        "type": "object",
        "properties": {
            "resume_text": {"type": "string"},
            "job_description": {"type": "string"},
            "keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["resume_text", "job_description"],
    },
    output_schema={"type": "object"},
    required_scope="memory.read",
    category="memory_read",
)

CALCULATE_SEMANTIC_ATS_SCORE = ToolDefinition(
    name="calculate_semantic_ats_score",
    description=(
        "Score resume-to-job-description compatibility 0-100 using embedding "
        "cosine similarity plus keyword frequency matching"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "resume_text": {"type": "string"},
            "job_description": {"type": "string"},
            "target_title": {"type": "string"},
        },
        "required": ["resume_text", "job_description"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "semantic_similarity": {"type": "number"},
            "keyword_match_pct": {"type": "number"},
            "matched_keywords": {"type": "array", "items": {"type": "string"}},
            "missing_keywords": {"type": "array", "items": {"type": "string"}},
        },
    },
    required_scope="memory.read",
    category="memory_read",
)

EXTRACT_MISSING_HARD_SKILLS = ToolDefinition(
    name="extract_missing_hard_skills",
    description="Identify technical skills, certifications, and tooling present in a job description but missing from the resume",
    input_schema={
        "type": "object",
        "properties": {
            "resume_text": {"type": "string"},
            "job_description": {"type": "string"},
        },
        "required": ["resume_text", "job_description"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "missing_skills": {"type": "array", "items": {"type": "string"}},
            "present_skills": {"type": "array", "items": {"type": "string"}},
            "certifications": {"type": "array", "items": {"type": "string"}},
        },
    },
    required_scope="memory.read",
    category="memory_read",
)

AUDIT_ATS_FORMATTING = ToolDefinition(
    name="audit_ats_formatting",
    description="Scan resume text/markdown for ATS parser failure points: tables, non-standard headers, invalid date formats, graphics",
    input_schema={
        "type": "object",
        "properties": {
            "resume_markdown": {"type": "string"},
        },
        "required": ["resume_markdown"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "issues": {"type": "array", "items": {"type": "object"}},
            "passed": {"type": "boolean"},
        },
    },
    required_scope="memory.read",
    category="memory_read",
)

# ── Browser / Scraping Tools ──────────────────────────────────────

BROWSE_JOB_PAGE = ToolDefinition(
    name="browse_job_page",
    description=(
        "Open a public job-posting URL in a headless browser and extract "
        "structured data: title, company, description, requirements, skills"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "Public https URL of the job posting"},
        },
        "required": ["url"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "company": {"type": "string"},
            "description": {"type": "string"},
            "requirements": {"type": "array", "items": {"type": "string"}},
            "skills_mentioned": {"type": "array", "items": {"type": "string"}},
        },
    },
    required_scope="system.browser.read",
    category="connector_read",
)

SCRAPE_COMPANY_INSIGHTS = ToolDefinition(
    name="scrape_company_insights",
    description=(
        "Aggregate web intelligence about a company: culture, recent news and "
        "funding, interview questions, and engineering tech stack"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "company_name": {"type": "string"},
        },
        "required": ["company_name"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "culture": {"type": "array"},
            "news_funding": {"type": "array"},
            "interview_questions": {"type": "array"},
            "tech_stack": {"type": "array"},
        },
    },
    required_scope="system.browser.read",
    category="connector_read",
)

VERIFY_APPLICATION_LINK = ToolDefinition(
    name="verify_application_link",
    description=(
        "Check that an application URL is live before the user applies — "
        "cheap HEAD probe (GET fallback), never renders the page"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "url": {"type": "string", "description": "Public https application URL"},
        },
        "required": ["url"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "reachable": {"type": "boolean"},
            "status_code": {"type": "integer"},
            "final_url": {"type": "string"},
        },
    },
    required_scope="system.browser.read",
    category="connector_read",
)

# ── GitHub / Slack / Notion / Sandbox Tools ──────────────────────────

FETCH_GITHUB_REPO = ToolDefinition(
    name="fetch_github_repo",
    description="Fetch commits, PRs, repos, and issues from GitHub API",
    input_schema={
        "type": "object",
        "properties": {
            "repo": {"type": "string", "description": "owner/repo"},
            "resource": {"type": "string", "enum": ["repo", "commits", "pulls", "issues", "profile"], "default": "repo"},
            "username": {"type": "string", "description": "GitHub username for profile resource"},
            "limit": {"type": "integer", "default": 20},
        },
        "required": ["repo"],
    },
    output_schema={"type": "object"},
    required_scope="connector.github.read",
    category="connector_read",
)

CREATE_GITHUB_ISSUE = ToolDefinition(
    name="create_github_issue",
    description="Create GitHub issues/PRs (approval-gated)",
    input_schema={
        "type": "object",
        "properties": {
            "repo": {"type": "string", "description": "owner/repo"},
            "title": {"type": "string"},
            "body": {"type": "string"},
            "labels": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["repo", "title"],
    },
    output_schema={"type": "object", "properties": {"issue_id": {"type": "string"}, "url": {"type": "string"}}},
    required_scope="connector.github.write",
    category="connector_write",
)

SEND_SLACK_MESSAGE = ToolDefinition(
    name="send_slack_message",
    description="Send Slack alerts and notifications to workspaces",
    input_schema={
        "type": "object",
        "properties": {
            "channel": {"type": "string"},
            "text": {"type": "string"},
            "blocks": {"type": "array", "items": {"type": "object"}},
        },
        "required": ["channel", "text"],
    },
    output_schema={"type": "object", "properties": {"ts": {"type": "string"}, "ok": {"type": "boolean"}}},
    required_scope="connector.slack.write",
    category="connector_write",
)

SYNC_NOTION_PAGES = ToolDefinition(
    name="sync_notion_pages",
    description="Read and write Notion workspace databases",
    input_schema={
        "type": "object",
        "properties": {
            "database_id": {"type": "string"},
            "query": {"type": "string"},
            "page_id": {"type": "string"},
            "properties": {"type": "object"},
            "operation": {"type": "string", "enum": ["query", "create", "update"], "default": "query"},
        },
        "required": ["database_id"],
    },
    output_schema={"type": "array"},
    required_scope="connector.notion.read_write",
    category="connector_read",
)

EXECUTE_CODE_SANDBOX = ToolDefinition(
    name="execute_code_sandbox",
    description="Safe sandboxed Python/JavaScript execution for coding problems",
    input_schema={
        "type": "object",
        "properties": {
            "code": {"type": "string"},
            "language": {"type": "string", "enum": ["python", "javascript"], "default": "python"},
            "input_data": {"type": "string"},
            "timeout": {"type": "integer", "default": 5},
        },
        "required": ["code"],
    },
    output_schema={"type": "object", "properties": {"stdout": {"type": "string"}, "stderr": {"type": "string"}, "exit_code": {"type": "integer"}}},
    required_scope="system.sandbox_exec",
    category="system",
)


# ── Document Compilation Tools (ReAct-exposed, service-backed) ───────
# Agents can now compile resume/cover-letter via executor rather than only via
# HTTP POST /resumes/{id}/compile . Handlers delegate to services/document_builder.
COMPILE_RESUME_PDF = ToolDefinition(
    name="compile_resume_pdf",
    description="Compile structured resume JSON into a styled PDF (via Playwright Chromium, template-aware, page-fit). Returns artifact bytes metadata or simulation when Chromium unavailable.",
    input_schema={
        "type": "object",
        "properties": {
            "template_slug": {"type": "string", "description": "One of classic-harvard, tech-modern, executive-leadership, minimalist-clean, creative-portfolio", "default": "minimalist-clean"},
            "resume_content": {"type": "object", "description": "Canonical resume_content dict (normalize_resume_content schema). If omitted, master resume for workspace is used"},
            "resume_id": {"type": "string", "description": "Optional resume ID to load content from DB when resume_content not supplied"},
            "max_pages": {"type": "integer", "default": 2, "description": "Page budget for auto-shrink fit loop"},
        },
        "required": [],
    },
    output_schema={"type": "object", "properties": {"media_type": {"type": "string"}, "extension": {"type": "string"}, "size_bytes": {"type": "integer"}, "template": {"type": "string"}}},
    required_scope="system.document.compile",
    category="system",
)

COMPILE_RESUME_DOCX = ToolDefinition(
    name="compile_resume_docx",
    description="Compile structured resume JSON into an editable Word .docx (python-docx, ATS-parseable).",
    input_schema={
        "type": "object",
        "properties": {
            "template_slug": {"type": "string", "default": "minimalist-clean"},
            "resume_content": {"type": "object", "description": "Canonical resume_content dict. If omitted, master resume for workspace is used"},
            "resume_id": {"type": "string"},
        },
        "required": [],
    },
    output_schema={"type": "object", "properties": {"media_type": {"type": "string"}, "extension": {"type": "string"}, "size_bytes": {"type": "integer"}}},
    required_scope="system.document.compile",
    category="system",
)

COMPILE_COVER_LETTER = ToolDefinition(
    name="compile_cover_letter",
    description="Compile a cover letter (resume header + body) into PDF/DOCX/HTML via the resume template engine.",
    input_schema={
        "type": "object",
        "properties": {
            "template_slug": {"type": "string", "default": "minimalist-clean"},
            "resume_content": {"type": "object"},
            "resume_id": {"type": "string"},
            "body": {"type": "string", "description": "Letter body text (paragraphs separated by blank lines)"},
            "company": {"type": "string"},
            "role": {"type": "string"},
            "recipient": {"type": "string"},
            "format": {"type": "string", "enum": ["pdf", "docx", "html"], "default": "pdf"},
        },
        "required": [],
    },
    output_schema={"type": "object"},
    required_scope="system.document.compile",
    category="system",
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

ALL_TOOLS: dict[str, ToolDefinition] = {
    t.name: t
    for t in [
        SEARCH_DOCUMENTS, QUERY_GRAPH, GET_ENTITY,
        CREATE_ENTITY, MERGE_ENTITIES, CATEGORIZE_DOCUMENT,
        SEARCH_GMAIL, SEARCH_JOBS, LIST_CALENDAR_EVENTS,
        RENAME_FILE, MOVE_FILE, DRAFT_EMAIL, CREATE_CALENDAR_EVENT,
        NOTIFY_USER,
        COMPILE_RESUME_PDF, COMPILE_RESUME_DOCX, COMPILE_COVER_LETTER,
        WEB_SEARCH, PARSE_DOCUMENT_OCR, CALCULATE_ATS_DIFF,
        CALCULATE_SEMANTIC_ATS_SCORE, EXTRACT_MISSING_HARD_SKILLS,
        AUDIT_ATS_FORMATTING,
        BROWSE_JOB_PAGE, SCRAPE_COMPANY_INSIGHTS, VERIFY_APPLICATION_LINK,
        FETCH_GITHUB_REPO, CREATE_GITHUB_ISSUE, SEND_SLACK_MESSAGE,
        SYNC_NOTION_PAGES, EXECUTE_CODE_SANDBOX,
    ]
}


def get_tools_for_agent(tool_names: list[str]) -> list[ToolDefinition]:
    """Return tool definitions for a given agent's declared tool list."""
    return [ALL_TOOLS[name] for name in tool_names if name in ALL_TOOLS]
