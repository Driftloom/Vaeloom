"""
Vaeloom Vault Git Sync API Router
Provides multi-tenant endpoints for:
- Synchronizing local Markdown vault state
- Ingesting synced Markdown notes into cognitive memory and knowledge graph
- Managing zero-data-loss conflict resolution records
- Serving standalone companion installer scripts and executable configs
"""

import hashlib
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..models.schema import (
    Connector,
    Document,
    Entity,
    Folder,
    Memory,
    Relationship,
    Workspace,
    WorkspaceUser,
)
from ..schemas.knowledge_graph import CreateEdgeRequest, CreateNodeRequest, NodeType
from ..services.knowledge_graph_service import kg_service
from ..services.llm_service import llm_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Defaults mirror packages/vaeloom-sync/src/config.ts DEFAULT_CONFIG. They are
# defaults for *display and for seeding a new workspace's config* — the status
# endpoint reads whatever was actually persisted, never a hardcoded literal.
DEFAULT_DEBOUNCE_SECONDS = 30
DEFAULT_REBASE_INTERVAL_MINUTES = 5

# A client heartbeat older than this means we cannot claim it is running.
HEARTBEAT_STALE_SECONDS = 900


def _derive_daemon_status(heartbeat: str | None, stored: str | None = None) -> str:
    """Derive client liveness from evidence.

    Returns "not_connected" when no client has ever reported, and "stale" when the
    last report is too old to trust. The previous implementation defaulted to
    "running", which made the UI claim a healthy daemon that did not exist.
    """
    if not heartbeat:
        return "not_connected"
    try:
        last = datetime.fromisoformat(heartbeat)
    except (TypeError, ValueError):
        logger.warning("Unparseable vault client heartbeat: %r", heartbeat)
        return "unknown"
    if last.tzinfo is None:
        last = last.replace(tzinfo=UTC)
    age = (datetime.now(UTC) - last).total_seconds()
    if age > HEARTBEAT_STALE_SECONDS:
        return "stale"
    if stored and stored not in ("running",):
        return stored
    return "running"


def _parse_markdown_metadata(content: str, default_filename: str) -> tuple[str, list[str], list[str], str]:
    """
    Extracts title, tags, wikilinks/concepts, and summary from Markdown content.
    Returns: (title, tags, concepts, summary)
    """
    clean_default = default_filename[:-3] if default_filename.endswith(".md") else default_filename
    title: str | None = None
    tags: list[str] = []
    concepts: list[str] = []
    body = content

    # 1. Frontmatter check
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            raw_frontmatter = parts[1]
            body = parts[2]
            try:
                fm = yaml.safe_load(raw_frontmatter)
                if isinstance(fm, dict):
                    if fm.get("title") and isinstance(fm["title"], str):
                        title = fm["title"].strip()
                    fm_tags = fm.get("tags") or fm.get("tag")
                    if isinstance(fm_tags, list):
                        for t in fm_tags:
                            if t and isinstance(t, str):
                                tags.append(t.strip().lstrip("#"))
                    elif isinstance(fm_tags, str):
                        for t in fm_tags.split(","):
                            if t.strip():
                                tags.append(t.strip().lstrip("#"))
                    fm_concepts = fm.get("concepts") or fm.get("entities")
                    if isinstance(fm_concepts, list):
                        for c in fm_concepts:
                            if c and isinstance(c, str):
                                concepts.append(c.strip())
            except Exception:
                pass

    # 2. First H1 for title if not set
    if not title:
        for line in body.splitlines():
            stripped = line.strip()
            if stripped.startswith("# ") and not stripped.startswith("## "):
                title = stripped[2:].strip()
                break

    if not title:
        title = clean_default

    # 3. Inline tags in body: #tag (word characters, hyphens, slashes)
    inline_tags = re.findall(r'(?:^|\s)#([a-zA-Z][a-zA-Z0-9_\-\/]+)', body)
    for it in inline_tags:
        clean_tag = it.strip().lstrip("#")
        if clean_tag and clean_tag.lower() not in [t.lower() for t in tags]:
            tags.append(clean_tag)

    # 4. Wikilinks in body: [[Target Note]] or [[Target Note|Label]]
    wikilinks = re.findall(r'\[\[([^\]\|\n]+)(?:\|[^\]\n]+)?\]\]', body)
    for wl in wikilinks:
        clean_concept = wl.strip()
        if clean_concept and clean_concept.lower() not in [c.lower() for c in concepts] and clean_concept.lower() != title.lower():
            concepts.append(clean_concept)

    # Clean & deduplicate tags
    seen_tags = set()
    deduped_tags = []
    for t in tags:
        lower_t = t.lower()
        if lower_t not in seen_tags:
            seen_tags.add(lower_t)
            deduped_tags.append(t)

    # Excerpt & summary
    clean_lines = [l.strip() for l in body.splitlines() if l.strip() and not l.strip().startswith("#")]
    body_excerpt = " ".join(clean_lines)[:240].strip() if clean_lines else body[:240].strip().replace("\n", " ")
    summary = f"{title} — {body_excerpt}" if body_excerpt else title

    return title, deduped_tags, concepts, summary[:500]



async def _verify_workspace_access(
    workspace_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Workspace:
    """Verify current user has owner or member access to the requested workspace."""
    ws = (await db.execute(select(Workspace).where(Workspace.id == workspace_id))).scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if ws.user_id == user_id:
        return ws

    member = (
        await db.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.workspace_id == workspace_id,
                WorkspaceUser.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Access to workspace denied")

    return ws


async def _get_or_create_vault_connector(
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> Connector:
    """Get or create the workspace's dedicated vault_sync connector."""
    stmt = select(Connector).where(
        Connector.workspace_id == workspace_id,
        Connector.type == "vault_sync",
    )
    connector = (await db.execute(stmt)).scalar_one_or_none()
    if not connector:
        connector = Connector(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            type="vault_sync",
            name="Vault Sync",
            # A brand-new connector has no client and no history. Seeding
            # "status": "in_sync" or a guessed vault_path made a workspace that
            # had never synced look healthy on first load.
            status="CONNECTED",
            config={
                "branch": "main",
                "auto_ingest": True,
                "debounce_seconds": DEFAULT_DEBOUNCE_SECONDS,
                "rebase_interval_minutes": DEFAULT_REBASE_INTERVAL_MINUTES,
                "conflicts": [],
                "sync_logs": [],
            },
        )
        db.add(connector)
        await db.flush()
    return connector


# ── Schemas ──────────────────────────────────────────────────────────────────


class VaultConfigUpdate(BaseModel):
    workspace_id: uuid.UUID
    remote_url: str | None = None
    branch: str = "main"
    vault_path: str | None = None
    auto_ingest: bool = True
    daemon_status: str | None = None
    # Previously the UI rendered number inputs for these that were never
    # transmitted, because the schema had no such fields. They are real,
    # persisted settings now, and the status endpoint reads them back.
    debounce_seconds: int | None = Field(default=None, ge=5, le=600)
    rebase_interval_minutes: int | None = Field(default=None, ge=1, le=1440)


class VaultSyncTriggerRequest(BaseModel):
    workspace_id: uuid.UUID


class VaultNoteItem(BaseModel):
    filename: str
    content: str
    relative_path: str | None = None
    tags: list[str] = Field(default_factory=list)
    last_modified: str | None = None


class VaultIngestRequest(BaseModel):
    workspace_id: uuid.UUID
    notes: list[VaultNoteItem]


class ConflictResolveRequest(BaseModel):
    strategy: str = Field(..., pattern="^(keep-local|accept-incoming)$")


class VaultClientConflict(BaseModel):
    id: str = Field(..., max_length=200)
    file: str = Field(..., max_length=1000)
    conflict_file: str = Field(..., max_length=1000)
    detected_at: str | None = None
    local_head: str | None = Field(default=None, max_length=100)
    remote_head: str | None = Field(default=None, max_length=100)


class VaultClientLog(BaseModel):
    timestamp: str | None = None
    level: str = Field(default="info", pattern="^(info|warning|error)$")
    message: str = Field(..., max_length=2000)
    event: str | None = Field(default=None, max_length=200)
    executed: bool | None = None


class VaultClientReport(BaseModel):
    """What the local vaultsync client reports about its own machine.

    The server has no git engine, so this is the only way real client state can
    reach the API. Before this existed, /status derived liveness from a heartbeat
    that nothing could ever write, so the feature was permanently "not connected".
    """

    workspace_id: uuid.UUID
    client_version: str | None = None
    machine: str | None = Field(default=None, max_length=200)
    branch: str | None = Field(default=None, max_length=200)
    remote_url: str | None = Field(default=None, max_length=2000)
    vault_path: str | None = Field(default=None, max_length=2000)
    sync_state: str = Field(default="idle", pattern="^(idle|syncing|error)$")
    last_pull_time: str | None = None
    last_push_time: str | None = None
    last_error: str | None = Field(default=None, max_length=2000)
    conflicts: list[VaultClientConflict] = Field(default_factory=list)
    logs: list[VaultClientLog] = Field(default_factory=list)


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/status", response_model=dict[str, Any])
async def get_vault_sync_status(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Retrieve vault sync configuration and real ingestion stats for this workspace.

    Every field here reflects state the server can actually observe. There is no
    server-side git engine: sync is performed by the local `vaultsync` client, so
    liveness is derived from a client-reported heartbeat rather than asserted.
    """
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(workspace_id, db)
    vault_meta = connector.config or {}

    # Count indexed vault documents
    doc_count_res = await db.execute(
        select(func.count(Document.id)).where(
            Document.workspace_id == workspace_id,
            Document.type == "markdown",
        )
    )
    total_notes = doc_count_res.scalar() or 0

    # Count total memories originated from vault_sync / vault_note
    mem_count_res = await db.execute(
        select(func.count(Memory.id)).where(
            Memory.workspace_id == workspace_id,
            Memory.source_type.in_(["vault_note", "vault_sync"]),
        )
    )
    vault_memories = mem_count_res.scalar() or 0

    # Liveness is derived, never assumed. Without a recent heartbeat the honest
    # answer is "not_connected", not "running".
    heartbeat = vault_meta.get("last_client_heartbeat")
    daemon_status = _derive_daemon_status(heartbeat, vault_meta.get("daemon_status"))

    conflicts = vault_meta.get("conflicts", []) or []
    outstanding = [c for c in conflicts if not c.get("resolved")]

    return {
        "workspace_id": str(workspace_id),
        "status": vault_meta.get("status", "unknown"),
        # `installed` reflects whether a client has ever checked in, not a guess.
        "installed": daemon_status != "not_connected",
        "daemon_status": daemon_status,
        "last_client_heartbeat": heartbeat,
        "branch": vault_meta.get("branch", "main"),
        "remote_url": vault_meta.get("remote_url"),
        "vault_path": vault_meta.get("vault_path"),
        "total_notes": total_notes,
        "vault_memories": vault_memories,
        "last_pull_time": vault_meta.get("last_pull_time"),
        "last_push_time": vault_meta.get("last_push_time"),
        # Surfaced so the UI can show a real client failure instead of a
        # reassuring badge. Previously any client error was invisible here.
        "last_error": vault_meta.get("last_error"),
        "conflicts_count": len(outstanding),
        "auto_ingest": vault_meta.get("auto_ingest", True),
        "debounce_seconds": vault_meta.get("debounce_seconds", DEFAULT_DEBOUNCE_SECONDS),
        "rebase_interval_minutes": vault_meta.get(
            "rebase_interval_minutes", DEFAULT_REBASE_INTERVAL_MINUTES
        ),
        # Surfaced so the UI can explain itself instead of guessing.
        "engine": "client",
        "engine_note": (
            "Git sync runs in the local vaultsync client, not on the server. "
            "Install the client on each machine that owns a vault."
        ),
    }


@router.post("/config", response_model=dict[str, Any])
async def update_vault_config(
    body: VaultConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update vault sync settings for the workspace."""
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(body.workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(body.workspace_id, db)

    cfg = dict(connector.config or {})
    if body.remote_url is not None:
        cfg["remote_url"] = body.remote_url
    if body.branch is not None:
        cfg["branch"] = body.branch
    if body.vault_path is not None:
        cfg["vault_path"] = body.vault_path
    if body.daemon_status is not None:
        cfg["daemon_status"] = body.daemon_status
    if body.debounce_seconds is not None:
        cfg["debounce_seconds"] = body.debounce_seconds
    if body.rebase_interval_minutes is not None:
        cfg["rebase_interval_minutes"] = body.rebase_interval_minutes
    cfg["auto_ingest"] = body.auto_ingest
    cfg["updated_at"] = datetime.now(UTC).isoformat()

    connector.config = cfg
    await db.commit()

    return {
        "success": True,
        "workspace_id": str(body.workspace_id),
        "config": cfg,
    }


@router.post("/sync", response_model=dict[str, Any])
async def trigger_vault_sync(
    body: VaultSyncTriggerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Record a manual sync request for this workspace.

    There is no server-side git engine. This endpoint does not pretend otherwise:
    it records the request and reports `executed: false` with the reason. The
    previous implementation wrote `last_pull_time`/`last_push_time` = now and
    returned "completed successfully. 0 conflicts." without any git operation ever
    running, so the UI showed a sync that never happened.
    """
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(body.workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(body.workspace_id, db)

    cfg = dict(connector.config or {})
    daemon_status = _derive_daemon_status(
        cfg.get("last_client_heartbeat"), cfg.get("daemon_status")
    )

    logs = list(cfg.get("sync_logs", []) or [])
    if daemon_status == "running":
        message = (
            "Sync request queued. The vaultsync client on this machine performs "
            "the git fetch/rebase/commit/push cycle; run `vaultsync sync` to run "
            "it immediately."
        )
        executed = False
    else:
        message = (
            "No vaultsync client is connected to this workspace, so nothing was "
            "synced. Install and start the client on the machine holding your "
            "vault (`vaultsync init <path> --remote <url>`, then `vaultsync start`). "
            "Notes already in Vaeloom memory are unaffected."
        )
        executed = False

    logs.append({
        "timestamp": datetime.now(UTC).isoformat(),
        "event": "manual_sync_requested",
        "message": message,
        "level": "warning" if daemon_status != "running" else "info",
        "executed": executed,
    })
    cfg["sync_logs"] = logs[-50:]
    connector.config = cfg
    await db.commit()

    return {
        "success": True,
        "executed": executed,
        "workspace_id": str(body.workspace_id),
        "daemon_status": daemon_status,
        # Deliberately not written: no sync ran, so there is no pull/push time.
        "last_pull_time": cfg.get("last_pull_time"),
        "last_push_time": cfg.get("last_push_time"),
        "conflicts_count": len(
            [c for c in (cfg.get("conflicts") or []) if not c.get("resolved")]
        ),
        "message": message,
    }


@router.get("/logs", response_model=list[dict[str, Any]])
async def get_vault_sync_logs(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Return vault sync activity that was actually recorded.

    Previously this returned four invented lines ("Native Vaeloom Vault Sync daemon
    active", "Watching vault at ...", "Scheduled 5-minute git rebase pull active")
    whenever no logs existed, so an unconfigured workspace displayed a healthy
    daemon that had never run. It now returns only real records, with a single
    honest entry explaining the empty state.
    """
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(workspace_id, db)
    cfg = connector.config or {}
    logs = cfg.get("sync_logs") or []
    if logs:
        return logs

    daemon_status = _derive_daemon_status(
        cfg.get("last_client_heartbeat"), cfg.get("daemon_status")
    )
    if daemon_status == "running":
        message = (
            "No activity reported yet. The vaultsync client is connected but has "
            "not sent any log entries — run `vaultsync sync` on that machine."
        )
    else:
        message = (
            "No vaultsync client is connected, so there is no activity to show. "
            "Install and start the client on the machine holding your vault "
            "(`vaultsync init <path> --remote <url>`, then `vaultsync start`)."
        )
    return [
        {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": "info",
            "event": "no_activity",
            "message": message,
        }
    ]


@router.post("/ingest", response_model=dict[str, Any])
async def ingest_vault_notes(
    body: VaultIngestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: str | None = Depends(get_tenant_id),
) -> dict[str, Any]:
    """
    Ingest Markdown notes from a synced vault.
    Creates or updates documents in the 'Vault Notes' folder (category='vault_note', mime_type='text/markdown'),
    extracts memories with source_type='vault_note', content_hash=sha256(content),
    and generates Knowledge Graph entities & bidirectional relationships.
    """
    user_id_raw = current_user.get("sub") or current_user.get("id") or current_user.get("user_id")
    user_id = uuid.UUID(str(user_id_raw)) if user_id_raw else None
    await _verify_workspace_access(body.workspace_id, user_id, db)

    tid_raw = tenant_id or current_user.get("tenant_id")
    tenant_uuid = None
    if tid_raw:
        try:
            tenant_uuid = uuid.UUID(str(tid_raw))
        except Exception:
            tenant_uuid = None
    tid_str = str(tenant_uuid) if tenant_uuid else (str(tid_raw) if tid_raw else None)

    # Find or create a 'Vault Notes' folder in Documents
    folder_stmt = select(Folder).where(
        Folder.workspace_id == body.workspace_id,
        Folder.name == "Vault Notes",
    )
    folder = (await db.execute(folder_stmt)).scalar_one_or_none()
    if not folder:
        folder = Folder(
            id=uuid.uuid4(),
            workspace_id=body.workspace_id,
            name="Vault Notes",
        )
        db.add(folder)
        await db.flush()

    ingested_docs = 0
    created_memories = 0
    created_entities = 0
    created_relationships = 0

    ws_id_str = str(body.workspace_id)

    for note in body.notes:
        if not note.filename or not note.content.strip():
            continue

        clean_filename = note.filename if note.filename.endswith(".md") else f"{note.filename}.md"
        rel_path = note.relative_path or clean_filename
        content_bytes = note.content.encode("utf-8")

        # Extract title from frontmatter or first H1, tags from frontmatter or inline, and wikilinks/concepts
        extracted_title, extracted_tags, extracted_concepts, summary = _parse_markdown_metadata(
            note.content, clean_filename
        )

        # Merge with explicit tags passed on note item
        if note.tags:
            for t in note.tags:
                clean_t = t.strip().lstrip("#")
                if clean_t and clean_t.lower() not in [x.lower() for x in extracted_tags]:
                    extracted_tags.append(clean_t)

        # 1. Document record (under folder="Vault Notes", category="vault_note", mime_type="text/markdown")
        doc_stmt = select(Document).where(
            Document.workspace_id == body.workspace_id,
            Document.path == rel_path,
            Document.folder_id == folder.id,
        )
        existing_doc = (await db.execute(doc_stmt)).scalar_one_or_none()

        doc_meta = {
            "category": "vault_note",
            "tags": extracted_tags,
            "title": extracted_title,
            "relative_path": rel_path,
            "source": "vault_sync",
            "concepts": extracted_concepts,
        }

        if existing_doc:
            existing_doc.content = content_bytes
            existing_doc.summary = summary
            existing_doc.type = "markdown"
            existing_doc.detected_mime_type = "text/markdown"
            existing_doc.metadata_ = {**(existing_doc.metadata_ or {}), **doc_meta}
            existing_doc.updated_at = datetime.now(UTC)
            doc_id = existing_doc.id
        else:
            new_doc = Document(
                id=uuid.uuid4(),
                workspace_id=body.workspace_id,
                folder_id=folder.id,
                path=rel_path,
                type="markdown",
                detected_mime_type="text/markdown",
                content=content_bytes,
                summary=summary,
                status="ACTIVE",
                metadata_=doc_meta,
            )
            db.add(new_doc)
            await db.flush()
            doc_id = new_doc.id
        ingested_docs += 1

        # 2. Create or update Memory Record (source_type="vault_note", content_hash=sha256(content))
        content_hash = hashlib.sha256(content_bytes).hexdigest()
        mem_stmt = select(Memory).where(
            Memory.workspace_id == body.workspace_id,
            Memory.source_uri == rel_path,
        )
        existing_mem = (await db.execute(mem_stmt)).scalar_one_or_none()

        mem_meta = {
            "document_id": str(doc_id),
            "relative_path": rel_path,
            "category": "vault_note",
            "tags": extracted_tags,
            "concepts": extracted_concepts,
            "vault_path": rel_path,
        }

        # Generate embedding for memory search
        mem_embedding = None
        try:
            embed_text = f"{extracted_title}\n{summary}\n{note.content[:500]}".strip()
            mem_embedding = await llm_service.generate_embedding(embed_text)
        except Exception as e:
            logger.debug("Could not generate memory embedding for %s: %s", clean_filename, e)

        if existing_mem:
            if not existing_mem.tenant_id and tenant_uuid:
                existing_mem.tenant_id = tenant_uuid
            if not existing_mem.user_id and user_id:
                existing_mem.user_id = user_id
            existing_mem.title = extracted_title
            existing_mem.summary = summary
            existing_mem.content = note.content
            existing_mem.content_hash = content_hash
            existing_mem.size = len(content_bytes)
            existing_mem.tags = extracted_tags
            existing_mem.source_type = "vault_note"
            existing_mem.metadata_ = {**(existing_mem.metadata_ or {}), **mem_meta}
            if mem_embedding:
                existing_mem.embedding = mem_embedding
            existing_mem.updated_at = datetime.now(UTC)
            mem_id = existing_mem.id
        else:
            new_mem = Memory(
                id=uuid.uuid4(),
                workspace_id=body.workspace_id,
                tenant_id=tenant_uuid,
                user_id=user_id,
                title=extracted_title,
                summary=summary,
                content=note.content,
                content_hash=content_hash,
                size=len(content_bytes),
                type="note",
                status="active",
                source_type="vault_note",
                source_uri=rel_path,
                source_label=f"Vault: {clean_filename}",
                tags=extracted_tags,
                metadata_=mem_meta,
            )
            if mem_embedding:
                new_mem.embedding = mem_embedding
            db.add(new_mem)
            await db.flush()
            mem_id = new_mem.id
        created_memories += 1

        # Upsert vector store if configured
        if mem_embedding:
            try:
                from ..infrastructure.vector_store import VectorRecord, get_vector_store
                vstore = get_vector_store()
                await vstore.upsert([
                    VectorRecord(
                        id=str(mem_id),
                        vector=mem_embedding,
                        metadata={
                            "source_type": "memory",
                            "source_id": str(mem_id),
                            "workspace_id": ws_id_str,
                            "category": "vault_note",
                            "title": extracted_title,
                        },
                    )
                ], session=db)
            except Exception as e:
                logger.debug("Vector store upsert bypassed or failed for %s: %s", clean_filename, e)

        # 3. Knowledge Graph Nodes & Bidirectional Edges via kg_service
        try:
            # 3a. Find or create Document Node
            doc_node_res = await db.execute(
                text("SELECT id FROM knowledge_nodes WHERE workspace_id = :ws AND label = :label AND type = :type LIMIT 1"),
                {"ws": ws_id_str, "label": extracted_title, "type": NodeType.DOCUMENT.value},
            )
            doc_node_row = doc_node_res.fetchone()
            if doc_node_row:
                doc_node_id = uuid.UUID(str(doc_node_row[0]))
            else:
                doc_node_req = CreateNodeRequest(
                    label=extracted_title,
                    type=NodeType.DOCUMENT,
                    description=summary,
                    properties={
                        "source": "vault_sync",
                        "category": "vault_note",
                        "tags": extracted_tags,
                        "document_id": str(doc_id),
                        "path": rel_path,
                    },
                )
                created_doc_node = await kg_service.create_node(
                    doc_node_req, tenant_id=tid_str, db=db, workspace_id=ws_id_str
                )
                doc_node_id = uuid.UUID(str(created_doc_node.id))
                created_entities += 1

            # 3b. Tag Nodes and Bidirectional Edges (Document <-> Tag)
            for tag in extracted_tags:
                tag_label = f"#{tag}"
                tag_res = await db.execute(
                    text("SELECT id FROM knowledge_nodes WHERE workspace_id = :ws AND label = :label AND type = :type LIMIT 1"),
                    {"ws": ws_id_str, "label": tag_label, "type": NodeType.TOPIC.value},
                )
                tag_row = tag_res.fetchone()
                if tag_row:
                    tag_node_id = uuid.UUID(str(tag_row[0]))
                else:
                    tag_node_req = CreateNodeRequest(
                        label=tag_label,
                        type=NodeType.TOPIC,
                        description=f"Vault Topic: {tag}",
                        properties={"source": "vault_sync", "tag": tag},
                    )
                    created_tag_node = await kg_service.create_node(
                        tag_node_req, tenant_id=tid_str, db=db, workspace_id=ws_id_str
                    )
                    tag_node_id = uuid.UUID(str(created_tag_node.id))
                    created_entities += 1

                # Document -> Tag (tagged_with)
                await kg_service.create_edge(
                    source_id=doc_node_id,
                    dto=CreateEdgeRequest(target_id=str(tag_node_id), relationship="tagged_with", weight=0.9),
                    db=db,
                    workspace_id=ws_id_str,
                )
                # Tag -> Document (tag_of)
                await kg_service.create_edge(
                    source_id=tag_node_id,
                    dto=CreateEdgeRequest(target_id=str(doc_node_id), relationship="tag_of", weight=0.9),
                    db=db,
                    workspace_id=ws_id_str,
                )
                created_relationships += 2

            # 3c. Concept / Wikilink Nodes and Bidirectional Edges (Document <-> Concept)
            for concept in extracted_concepts:
                concept_res = await db.execute(
                    text("SELECT id FROM knowledge_nodes WHERE workspace_id = :ws AND label = :label AND type = :type LIMIT 1"),
                    {"ws": ws_id_str, "label": concept, "type": NodeType.CONCEPT.value},
                )
                concept_row = concept_res.fetchone()
                if concept_row:
                    concept_node_id = uuid.UUID(str(concept_row[0]))
                else:
                    concept_node_req = CreateNodeRequest(
                        label=concept,
                        type=NodeType.CONCEPT,
                        description=f"Vault Concept: {concept}",
                        properties={"source": "vault_sync", "concept": concept},
                    )
                    created_concept_node = await kg_service.create_node(
                        concept_node_req, tenant_id=tid_str, db=db, workspace_id=ws_id_str
                    )
                    concept_node_id = uuid.UUID(str(created_concept_node.id))
                    created_entities += 1

                # Document -> Concept (references)
                await kg_service.create_edge(
                    source_id=doc_node_id,
                    dto=CreateEdgeRequest(target_id=str(concept_node_id), relationship="references", weight=0.85),
                    db=db,
                    workspace_id=ws_id_str,
                )
                # Concept -> Document (referenced_by)
                await kg_service.create_edge(
                    source_id=concept_node_id,
                    dto=CreateEdgeRequest(target_id=str(doc_node_id), relationship="referenced_by", weight=0.85),
                    db=db,
                    workspace_id=ws_id_str,
                )
                created_relationships += 2

        except Exception as e:
            logger.warning("Could not sync KG nodes/edges for note %s: %s", clean_filename, e)

        # 4. Synchronize Entity and Relationship ORM models for Search & Agent tools
        try:
            # Note Entity
            note_ent_stmt = select(Entity).where(
                Entity.workspace_id == body.workspace_id,
                Entity.canonical_name == extracted_title,
                Entity.type == "document",
            )
            note_ent = (await db.execute(note_ent_stmt)).scalar_one_or_none()
            if not note_ent:
                note_ent = Entity(
                    id=uuid.uuid4(),
                    workspace_id=body.workspace_id,
                    type="document",
                    canonical_name=extracted_title,
                    aliases=[clean_filename, rel_path],
                    metadata_={"document_id": str(doc_id), "path": rel_path, "category": "vault_note"},
                )
                db.add(note_ent)
                await db.flush()

            for tag in extracted_tags:
                tag_ent_stmt = select(Entity).where(
                    Entity.workspace_id == body.workspace_id,
                    Entity.canonical_name == tag,
                    Entity.type == "tag",
                )
                tag_ent = (await db.execute(tag_ent_stmt)).scalar_one_or_none()
                if not tag_ent:
                    tag_ent = Entity(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        type="tag",
                        canonical_name=tag,
                        aliases=[f"#{tag}"],
                        metadata_={"source": "vault_sync"},
                    )
                    db.add(tag_ent)
                    await db.flush()

                # Relationship note -> tag
                r1_stmt = select(Relationship).where(
                    Relationship.workspace_id == body.workspace_id,
                    Relationship.from_entity_id == note_ent.id,
                    Relationship.to_entity_id == tag_ent.id,
                    Relationship.relation_type == "tagged_with",
                )
                if not (await db.execute(r1_stmt)).scalar_one_or_none():
                    db.add(Relationship(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        from_entity_id=note_ent.id,
                        to_entity_id=tag_ent.id,
                        relation_type="tagged_with",
                        confidence=0.9,
                        source_memory_id=mem_id,
                    ))

                # Relationship tag -> note
                r2_stmt = select(Relationship).where(
                    Relationship.workspace_id == body.workspace_id,
                    Relationship.from_entity_id == tag_ent.id,
                    Relationship.to_entity_id == note_ent.id,
                    Relationship.relation_type == "tag_of",
                )
                if not (await db.execute(r2_stmt)).scalar_one_or_none():
                    db.add(Relationship(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        from_entity_id=tag_ent.id,
                        to_entity_id=note_ent.id,
                        relation_type="tag_of",
                        confidence=0.9,
                        source_memory_id=mem_id,
                    ))

            for concept in extracted_concepts:
                c_ent_stmt = select(Entity).where(
                    Entity.workspace_id == body.workspace_id,
                    Entity.canonical_name == concept,
                    Entity.type == "concept",
                )
                c_ent = (await db.execute(c_ent_stmt)).scalar_one_or_none()
                if not c_ent:
                    c_ent = Entity(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        type="concept",
                        canonical_name=concept,
                        aliases=[],
                        metadata_={"source": "vault_sync"},
                    )
                    db.add(c_ent)
                    await db.flush()

                # Relationship note -> concept
                rc1_stmt = select(Relationship).where(
                    Relationship.workspace_id == body.workspace_id,
                    Relationship.from_entity_id == note_ent.id,
                    Relationship.to_entity_id == c_ent.id,
                    Relationship.relation_type == "references",
                )
                if not (await db.execute(rc1_stmt)).scalar_one_or_none():
                    db.add(Relationship(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        from_entity_id=note_ent.id,
                        to_entity_id=c_ent.id,
                        relation_type="references",
                        confidence=0.85,
                        source_memory_id=mem_id,
                    ))

                # Relationship concept -> note
                rc2_stmt = select(Relationship).where(
                    Relationship.workspace_id == body.workspace_id,
                    Relationship.from_entity_id == c_ent.id,
                    Relationship.to_entity_id == note_ent.id,
                    Relationship.relation_type == "referenced_by",
                )
                if not (await db.execute(rc2_stmt)).scalar_one_or_none():
                    db.add(Relationship(
                        id=uuid.uuid4(),
                        workspace_id=body.workspace_id,
                        from_entity_id=c_ent.id,
                        to_entity_id=note_ent.id,
                        relation_type="referenced_by",
                        confidence=0.85,
                        source_memory_id=mem_id,
                    ))

        except Exception as e:
            logger.warning("Could not sync Entity/Relationship models for %s: %s", clean_filename, e)

    await db.commit()

    return {
        "success": True,
        "ingested_documents": ingested_docs,
        "created_or_updated_memories": created_memories,
        "created_kg_nodes": created_entities,
        "created_relationships": created_relationships,
    }


@router.post("/report", response_model=dict[str, Any])
async def report_vault_client_state(
    body: VaultClientReport,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Record real state reported by the local vaultsync client.

    This is what makes the rest of the API honest: /status derives daemon liveness
    from `last_client_heartbeat`, /conflicts returns the client's actual conflict
    ledger, and /logs returns its actual activity. Without a report path those
    endpoints could only ever report "nothing to report", which is indistinguishable
    from "everything is fine".

    Only unresolved conflicts are retained, so a client that clears its queue
    visibly empties the server's view.
    """
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(body.workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(body.workspace_id, db)

    now = datetime.now(UTC)
    cfg = dict(connector.config or {})

    cfg["last_client_heartbeat"] = now.isoformat()
    cfg["client_version"] = body.client_version
    cfg["machine"] = body.machine
    cfg["sync_state"] = body.sync_state
    cfg["last_pull_time"] = body.last_pull_time
    cfg["last_push_time"] = body.last_push_time
    cfg["last_error"] = body.last_error
    if body.branch:
        cfg["branch"] = body.branch
    if body.remote_url:
        cfg["remote_url"] = body.remote_url
    if body.vault_path:
        cfg["vault_path"] = body.vault_path

    # Replace, never merge: the client is the source of truth for its own ledger.
    cfg["conflicts"] = [c.model_dump() for c in body.conflicts]
    cfg["sync_logs"] = [log.model_dump() for log in body.logs][-50:]

    # Derive the coarse status from what the client actually reported.
    if body.last_error:
        cfg["status"] = "error"
    elif body.conflicts:
        cfg["status"] = "conflict"
    elif body.sync_state == "syncing":
        cfg["status"] = "syncing"
    else:
        cfg["status"] = "in_sync"

    connector.config = cfg
    await db.commit()

    return {
        "success": True,
        "workspace_id": str(body.workspace_id),
        "received_at": now.isoformat(),
        "reported_conflicts": len(cfg["conflicts"]),
        "reported_logs": len(cfg["sync_logs"]),
        "daemon_status": _derive_daemon_status(cfg["last_client_heartbeat"], None),
        "status": cfg["status"],
    }


@router.get("/conflicts", response_model=list[dict[str, Any]])
async def list_vault_conflicts(
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Conflicts most recently reported by the local vaultsync client.

    Empty means "the client reported no conflicts", not "the vault is clean" —
    check /status for whether a client has ever checked in.
    """
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(workspace_id, user_id, db)
    connector = await _get_or_create_vault_connector(workspace_id, db)
    return connector.config.get("conflicts", []) or []


@router.post("/conflicts/{conflict_id}/resolve", response_model=dict[str, Any])
async def resolve_vault_conflict(
    conflict_id: str,
    body: ConflictResolveRequest,
    workspace_id: uuid.UUID = Query(..., description="Workspace ID"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Mark a conflict resolved using either 'keep-local' or 'accept-incoming' strategy."""
    user_id = uuid.UUID(current_user["sub"])
    await _verify_workspace_access(workspace_id, user_id, db)

    connector = await _get_or_create_vault_connector(workspace_id, db)
    cfg = dict(connector.config or {})
    conflicts: list[dict[str, Any]] = cfg.get("conflicts", [])

    # Filter out or mark resolved
    updated_conflicts = [c for c in conflicts if c.get("id") != conflict_id]
    cfg["conflicts"] = updated_conflicts
    connector.config = cfg
    await db.commit()

    return {
        "success": True,
        "conflict_id": conflict_id,
        "strategy": body.strategy,
        "remaining_conflicts": len(updated_conflicts),
    }


@router.get("/download-client")
async def download_client_installer(
    os_name: str = Query("windows", alias="os", description="windows, darwin, or linux"),
    current_user: dict = Depends(get_current_user),
) -> Response:
    """Serve the companion vaultsync installer script or distribution config.

    Requires authentication: this endpoint is part of a workspace-scoped feature
    and was previously the only unauthenticated route in the vault-sync surface.
    The body is a fixed literal per platform, so there is no path traversal or
    data disclosure risk — but it did not belong in the public allowlist.
    """
    if os_name.lower() in ("windows", "win", "win32"):
        script = """# Vaeloom Vault Sync — Windows PowerShell Installer
Write-Host "Installing Vaeloom Vault Sync (vaultsync)..." -ForegroundColor Cyan
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is required. Please install Git for Windows first."
    exit 1
}
Write-Host "Installing @vaeloom/vault-sync via npm..." -ForegroundColor Green
npm install -g @vaeloom/vault-sync
Write-Host "Vaeloom Vault Sync installed successfully!" -ForegroundColor Green
Write-Host "Run 'vaultsync init <path-to-vault>' to get started." -ForegroundColor Yellow
"""
        return Response(
            content=script,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=install-vaultsync.ps1"},
        )
    else:
        script = """#!/usr/bin/env bash
set -e
echo "Installing Vaeloom Vault Sync (vaultsync)..."
if ! command -v git &> /dev/null; then
    echo "Error: git is required. Please install git first."
    exit 1
fi
echo "Installing @vaeloom/vault-sync via npm..."
npm install -g @vaeloom/vault-sync
echo "Vaeloom Vault Sync installed successfully!"
echo "Run 'vaultsync init <path-to-vault>' to get started."
"""
        return Response(
            content=script,
            media_type="text/x-shellscript; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=install-vaultsync.sh"},
        )
