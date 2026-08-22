import asyncio
import logging
from datetime import UTC
from typing import Any

from sqlalchemy import text

from ..config import settings
from ..infrastructure.agent_limits import AgentRateLimiter, AgentRateLimitError
from ..infrastructure.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError
from .base import BaseAgent
from .state import LoopState, load_or_create_state, save_checkpoint

# ReAct dynamic tool loop — imported lazily to avoid circular deps
try:
    from ..tools.definitions import ALL_TOOLS, get_tools_for_agent  # noqa: F401
    from ..tools.executor import execute_tool as _exec_tool  # noqa: F401
    _REACT_AVAILABLE = True
except Exception:
    _REACT_AVAILABLE = False

logger = logging.getLogger(__name__)

# ── Shared Infrastructure ──────────────────────────────────────────

_circuit_breakers: dict[str, CircuitBreaker] = {}
_rate_limiter = AgentRateLimiter()


def _get_circuit_breaker(agent_name: str) -> CircuitBreaker:
    if agent_name not in _circuit_breakers:
        # Per-agent overrides via AGENT_CIRCUIT_CONFIG JSON, else global defaults
        cfg = {}
        try:
            raw_cfg = getattr(settings, "agent_circuit_config", {}) or {}
            if isinstance(raw_cfg, dict):
                cfg = raw_cfg.get(agent_name, {}) or {}
        except Exception:
            cfg = {}
        threshold = int(cfg.get("failure_threshold", getattr(settings, "agent_circuit_failure_threshold", 3)))
        recovery = float(cfg.get("recovery_timeout", getattr(settings, "agent_circuit_recovery_timeout", 30.0)))
        _circuit_breakers[agent_name] = CircuitBreaker(
            failure_threshold=threshold,
            recovery_timeout=recovery,
            name=agent_name,
        )
    return _circuit_breakers[agent_name]


# ── Approval Lookup ────────────────────────────────────────────────

async def fetch_pending_approvals(workspace_id: str) -> list[dict[str, Any]]:
    """Return fresh PENDING approval records for a workspace, oldest first.

    Used by the orchestrator to surface actionable approval cards in chat
    responses (each card carries the approval_id for the decide endpoints).
    """
    from ..database import async_session_factory

    try:
        async with async_session_factory() as db:
            from datetime import datetime
            now = datetime.now(UTC)
            await db.execute(
                text("""
                    UPDATE agent_approvals
                    SET status = 'EXPIRED', updated_at = :now
                    WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < :now
                """),
                {"now": now},
            )
            await db.commit()
            result = await db.execute(
                text("""
                    SELECT id, agent_name, action_type, reason, expires_at
                    FROM agent_approvals
                    WHERE workspace_id = :workspace_id AND status = 'PENDING'
                    ORDER BY created_at ASC
                    LIMIT 20
                """),
                {"workspace_id": workspace_id},
            )
            rows = result.fetchall()
            return [
                {
                    "title": f"{row[1]}: {row[2]}",
                    "detail": row[3] or None,
                    "requires_approval": True,
                    "approval_id": str(row[0]),
                }
                for row in rows
            ]
    except Exception as exc:
        logger.warning(f"Pending approval fetch failed (non-blocking): {exc}")
        return []


async def lookup_approval(
    workspace_id: str,
    agent_name: str,
    action_type: str,
) -> dict[str, Any] | None:
    """Look up an approved approval decision for the given agent/action.

    Returns the approval record if found and APPROVED, None otherwise.
    This replaces the hardcoded has_approval=False in the agent loop.
    """
    import json

    from ..database import async_session_factory

    try:
        async with async_session_factory() as db:
            from datetime import datetime
            now = datetime.now(UTC)

            # Expire any stale approvals
            await db.execute(
                text("""
                    UPDATE agent_approvals
                    SET status = 'EXPIRED', updated_at = :now
                    WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < :now
                """),
                {"now": now},
            )
            await db.commit()

            # Look up approved approvals for this agent/action
            result = await db.execute(
                text("""
                    SELECT id, workspace_id, agent_name, action_type, payload, status
                    FROM agent_approvals
                    WHERE workspace_id = :workspace_id
                      AND agent_name = :agent_name
                      AND action_type = :action_type
                      AND status = 'APPROVED'
                    ORDER BY created_at DESC
                    LIMIT 1
                """),
                {
                    "workspace_id": workspace_id,
                    "agent_name": agent_name,
                    "action_type": action_type,
                },
            )
            row = result.fetchone()
            if row:
                # Handle payload: may be JSON string (SQLite) or dict (PostgreSQL)
                payload = row[4]
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except (json.JSONDecodeError, TypeError):
                        payload = {}
                elif not isinstance(payload, dict):
                    payload = {}
                return {
                    "id": str(row[0]),
                    "workspace_id": str(row[1]),
                    "agent_name": row[2],
                    "action_type": row[3],
                    "payload": payload,
                    "status": row[5],
                }
            return None
    except Exception as exc:
        logger.warning(f"Approval lookup failed (non-blocking): {exc}")
        return None


class AgentRequest:
    def __init__(self, agent: BaseAgent, request_id: str, message: str, workspace_id: str, agent_name: str = ""):
        self.agent = agent
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id
        self.agent_name = agent_name or self._derive_agent_name()

    def _derive_agent_name(self) -> str:
        name = type(self.agent).__name__
        for suffix in ["AgentHandler", "Agent", "Handler"]:
            name = name.replace(suffix, "")
        return name.lower()


class AgentResponse:
    def __init__(self, status: str, final_result: Any):
        self.status = status
        self.final_result = final_result


class ReflectResult:
    def __init__(self, is_satisfied: bool, reason: str = ""):
        self.is_satisfied = is_satisfied
        self.reason = reason


# ── RAG Pre-Execution Context Assembler ───────────────────────────

async def _assemble_rag_context(workspace_id: str, query: str, agent: BaseAgent) -> dict[str, Any]:
    """Hybrid RAG: vector-ish + graph lookup before Plan/Act. Non-blocking, best-effort."""
    if not workspace_id or not query.strip():
        return {"entities": [], "documents": [], "preferences": []}
    try:
        from sqlalchemy import or_, select
        from api.database import async_session_factory
        from api.models.schema import Document, Entity

        read_types = getattr(getattr(agent, "memory_scopes", None), "read_types", []) or []
        keywords = [w for w in query.split() if len(w) > 2][:5]
        if not keywords:
            return {"entities": [], "documents": [], "preferences": []}

        entities: list[dict[str, Any]] = []
        documents: list[dict[str, Any]] = []
        preferences: list[dict[str, Any]] = []

        async with async_session_factory() as session:
            # ── Vector search (hybrid, preferred) — pgvector <=> distance ──
            # AC-05: skip expensive embedding on short queries, in tests, or without vector store (saves latency on every plan)
            vector_done = False
            try:
                import os as _os
                if settings.llm_api_key and len(query.strip()) >= 10 and not _os.environ.get("PYTEST_CURRENT_TEST"):
                    # Only attempt vector when a vector store is likely available
                    db_url = _os.environ.get("DATABASE__URL", "") + _os.environ.get("QDRANT_URL", "")
                    has_vector_store = "postgres" in db_url.lower() or bool(_os.environ.get("QDRANT_URL"))
                    if has_vector_store or _os.environ.get("ENABLE_VECTOR_RAG") == "1":
                        from api.services.llm_service import llm_service
                        from sqlalchemy import text as _text
                        import uuid as _uuid
                        vec = await llm_service.generate_embedding(query[:2000])
                        vec_str = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
                        # Try embeddings table (works on Postgres with pgvector; falls back on SQLite mock)
                        try:
                            res = await session.execute(
                                _text("""
                                    SELECT source_id, source_type, 1 - (vector <=> :vec::vector) AS score
                                    FROM embeddings
                                    WHERE workspace_id = :wid AND source_type IN ('entity', 'memory', 'document', 'document_chunk')
                                    ORDER BY vector <=> :vec::vector
                                    LIMIT 8
                                """),
                                {"wid": workspace_id, "vec": vec_str},
                            )
                            rows = res.fetchall()
                            for row in rows:
                                sid = str(row[0])
                                stype = row[1]
                                try:
                                    if stype in ('entity', 'memory') and len(entities) < 8:
                                        ent = await session.get(Entity, _uuid.UUID(sid))
                                        if ent and not any(e["id"] == sid for e in entities):
                                            entities.append({"id": sid, "name": ent.canonical_name, "type": ent.type, "aliases": ent.aliases})
                                    elif stype in ('document', 'document_chunk') and len(documents) < 8:
                                        doc = await session.get(Document, _uuid.UUID(sid))
                                        if doc and not any(d["id"] == sid for d in documents):
                                            documents.append({"id": sid, "path": doc.path, "summary": (doc.summary or "")[:300]})
                                except Exception:
                                    continue
                            if entities or documents:
                                vector_done = True
                                logger.info(f"RAG vector search: {len(entities)} entities, {len(documents)} docs via embeddings")
                        except Exception as ve:
                            logger.debug(f"RAG vector SQL failed, falling back to LIKE: {ve}")
            except Exception as ve:
                logger.debug(f"RAG vector embedding failed, falling back to LIKE: {ve}")

            # ── Graph entities matching query keywords (LIKE fallback or supplement) ──
            if not vector_done or len(entities) < 4:
                try:
                    # Filter by read_types if agent declares them; otherwise search all
                    for kw in keywords[:3]:
                        stmt = select(Entity).where(Entity.workspace_id == workspace_id).where(Entity.canonical_name.ilike(f"%{kw}%")).limit(5)
                        if read_types and "any" not in read_types:
                            stmt = stmt.where(or_(*[Entity.type == rt for rt in read_types if rt]))
                        res = await session.execute(stmt)
                        for ent in res.scalars().all():
                            if not any(e["id"] == str(ent.id) for e in entities):
                                entities.append({"id": str(ent.id), "name": ent.canonical_name, "type": ent.type, "aliases": ent.aliases})
                        if len(entities) >= 10:
                            break
                except Exception as e:
                    logger.warning(f"RAG graph lookup failed: {e}")

            # ── Documents matching keywords (LIKE fallback or supplement) ──
            if not vector_done or len(documents) < 4:
                try:
                    for kw in keywords[:3]:
                        stmt = select(Document).where(Document.workspace_id == workspace_id).where(
                            or_(Document.path.ilike(f"%{kw}%"), Document.summary.ilike(f"%{kw}%"))
                        ).limit(5)
                        res = await session.execute(stmt)
                        for doc in res.scalars().all():
                            if not any(d["id"] == str(doc.id) for d in documents):
                                documents.append({"id": str(doc.id), "path": doc.path, "summary": (doc.summary or "")[:300]})
                        if len(documents) >= 10:
                            break
                except Exception as e:
                    logger.warning(f"RAG document lookup failed: {e}")

            # ── Preferences / memory snippets ───────────────────────────
            try:
                # Look for preference-type entities
                stmt = select(Entity).where(Entity.workspace_id == workspace_id).where(Entity.type == "preference").limit(10)
                res = await session.execute(stmt)
                for pref in res.scalars().all():
                    # If query overlaps preference name, keep it
                    if any(kw.lower() in (pref.canonical_name or "").lower() for kw in keywords):
                        preferences.append({"id": str(pref.id), "name": pref.canonical_name, "metadata": pref.metadata_})
                    elif len(preferences) < 3:
                        preferences.append({"id": str(pref.id), "name": pref.canonical_name, "metadata": pref.metadata_})
            except Exception as e:
                logger.warning(f"RAG preference lookup failed: {e}")

        # Truncate
        return {"entities": entities[:8], "documents": documents[:8], "preferences": preferences[:5]}
    except Exception as e:
        logger.warning(f"RAG assembler non-blocking error: {e}")
        return {"entities": [], "documents": [], "preferences": []}


# ── Plan ────────────────────────────────────────────────────────────

async def plan_phase(request: AgentRequest, state: LoopState) -> dict[str, Any]:
    logger.info(f"PLAN: agent={request.agent_name}, request={request.id}")
    # Automated RAG context injection
    rag_context: dict[str, Any] = {}
    try:
        rag_context = await _assemble_rag_context(request.workspace_id, request.message, request.agent)
        if rag_context.get("entities") or rag_context.get("documents"):
            logger.info(f"RAG injected: {len(rag_context.get('entities', []))} entities, {len(rag_context.get('documents', []))} docs, {len(rag_context.get('preferences', []))} prefs")
    except Exception as e:
        logger.warning(f"RAG injection failed (non-blocking): {e}")
    return {
        "agent_type": request.agent_name,
        "message": request.message,
        "workspace_id": request.workspace_id,
        "rag_context": rag_context,
        # Flatten for easy consumption by Act/ReAct
        "context_prompt": _build_context_prompt(rag_context),
    }


def _build_context_prompt(rag: dict[str, Any]) -> str:
    """Turn RAG bundles into compact LLM context string."""
    parts: list[str] = []
    for ent in (rag.get("entities") or [])[:5]:
        parts.append(f"Entity: {ent.get('name')} ({ent.get('type')})")
    for doc in (rag.get("documents") or [])[:3]:
        parts.append(f"Doc: {doc.get('path')} — {doc.get('summary','')[:120]}")
    for pref in (rag.get("preferences") or [])[:3]:
        parts.append(f"Preference: {pref.get('name')}")
    return "\n".join(parts) if parts else ""


# ── Dynamic ReAct Tool Loop ─────────────────────────────────────

async def _try_react_loop(agent: BaseAgent, message: str, workspace_id: str, agent_name: str) -> dict[str, Any] | None:
    """Attempt dynamic LLM-driven tool calling. Returns result dict or None to fallback."""
    if not _REACT_AVAILABLE or not settings.llm_api_key:
        return None
    # Only attempt ReAct for agents that could benefit from live tools
    # Skip for very short messages to avoid overhead — still allow via explicit flag
    if len(message.strip()) < 3:
        return None
    try:
        from ..services.llm_service import llm_service
        import json

        # Build tool schemas — least-privilege: only offer tools the agent is explicitly allowed (OWASP LLM06/PATI)
        declared = {t.name for t in getattr(agent, "tools", []) or []}
        ordered = [td for td in ALL_TOOLS.values() if td.name in declared][:12]
        if not ordered:
            return None
        agent_allowed_scopes = [td.required_scope for td in ordered]
        tool_schemas = [
            {"type": "function", "function": {"name": td.name, "description": td.description, "parameters": td.input_schema}}
            for td in ordered
        ]

        system_content = (getattr(agent, "mission", "") or f"You are the {agent_name} agent.").strip()
        system_content += " You have access to tools. Call them when they help answer the user's request. After tool results, synthesise a helpful answer."

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": message},
        ]

        for _round in range(3):
            try:
                resp = await llm_service.generate_completion_with_tools(messages=messages, tools=tool_schemas)
            except Exception as e:
                logger.warning(f"ReAct LLM call failed (round {_round}): {e}")
                return None

            tool_calls = resp.get("tool_calls") or []
            content = resp.get("content", "")

            # No tool calls → LLM produced direct answer
            if not tool_calls:
                if content:
                    # Handle content that may be list of blocks (Anthropic style)
                    if isinstance(content, list):
                        content_str = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
                    else:
                        content_str = str(content)
                    if content_str.strip():
                        return {
                            "agent_name": agent_name,
                            "action": "suggest",
                            "confidence": 0.88,
                            "result": {"summary": content_str[:800], "details": content_str, "proposals": [], "questions": []},
                        }
                return None

            # Execute each tool call sequentially (preserving order)
            for tc in tool_calls:
                func = tc.get("function", {}) or {}
                tname = func.get("name", "")
                args = func.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}
                if not isinstance(args, dict):
                    args = {}
                td = ALL_TOOLS.get(tname)
                if not td:
                    logger.warning(f"ReAct: unknown tool '{tname}' requested by LLM — skipping")
                    continue
                # Enforce least-privilege: LLM output is untrusted, check against agent's allowed scopes (PATI/OWASP LLM06)
                from ..tools.executor import check_permission
                allowed = await check_permission(agent_allowed_scopes, td.required_scope)
                if not allowed:
                    logger.warning(f"ReAct: tool '{tname}' denied — scope {td.required_scope} not in agent allowed {agent_allowed_scopes}")
                    result = {"status": "error", "tool": tname, "result": f"Permission denied: scope {td.required_scope} not allowed for agent {agent_name}"}
                else:
                    # Approval gate for high-risk writes — fail closed, require human (OWASP LLM06 excessive autonomy)
                    APPROVAL_GATED_TOOLS = {"create_github_issue", "send_slack_message", "create_calendar_event", "draft_email", "rename_file", "move_file", "categorize_document", "create_entity", "merge_entities"}
                    if tname in APPROVAL_GATED_TOOLS:
                        logger.info(f"ReAct: tool '{tname}' requires approval — not auto-executing")
                        result = {"status": "error", "tool": tname, "result": f"Approval required for {tname} — awaiting user approval", "requires_approval": True}
                    else:
                        try:
                            result = await _exec_tool(td, args, agent_id=agent_name, agent_scopes=agent_allowed_scopes, workspace_id=workspace_id)
                        except Exception as e:
                            result = {"status": "error", "tool": tname, "result": str(e)}
                # Feed tool result back to LLM
                # OpenAI expects assistant with tool_calls + tool role; Anthropic uses tool_result blocks — we add both forms for compat
                messages.append({"role": "assistant", "content": content or None, "tool_calls": [tc]})
                messages.append({"role": "tool", "tool_call_id": tc.get("id", tname), "content": json.dumps(result)[:4000]})
                # Keep content for next round's synthesis

            # Loop continues — LLM will synthesise after seeing tool outputs
        return None
    except Exception as e:
        logger.warning(f"ReAct loop exception: {e}")
        return None


# ── Act ─────────────────────────────────────────────────────────────

async def act_phase(plan: dict[str, Any], request: AgentRequest) -> dict[str, Any]:
    agent = request.agent
    message = plan.get("message", request.message)
    # Enrich message with RAG context if available (plan_phase injected it)
    context_prompt = plan.get("context_prompt", "")
    if context_prompt:
        message = f"{message}\n\n[Context from knowledge graph & documents:\n{context_prompt}]"
    agent_type = type(agent).__name__
    agent_name = request.agent_name

    logger.info(f"ACT: dispatching to {agent_type}")

    # ── Rate limit check ────────────────────────────────────────
    if not await _rate_limiter.acquire(agent_name):
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": f"Rate limit exceeded for agent '{agent_name}'",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }

    # ── Dynamic ReAct (LLM-driven tool calling) — best-effort before static dispatch ──
    try:
        react_result = await _try_react_loop(agent, message, request.workspace_id, agent_name)
        if react_result is not None:
            logger.info(f"ACT: ReAct loop succeeded for {agent_name}")
            return react_result
    except Exception as e:
        logger.warning(f"ReAct dispatch failed, falling back to static: {e}")

    # ── Circuit breaker + timeout (static dispatch fallback) ─────
    cb = _get_circuit_breaker(agent_name)
    timeout = settings.agent_timeout_seconds

    try:
        result = await asyncio.wait_for(
            cb.call(_dispatch_agent(agent_type, agent, message, request)),
            timeout=timeout,
        )
        return result
    except CircuitBreakerOpenError:
        logger.warning(f"Circuit breaker OPEN for {agent_name}, using fallback")
        return await agent.fallback()
    except TimeoutError:
        logger.error(f"Agent {agent_name} timed out after {timeout}s")
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": f"Agent '{agent_name}' timed out after {timeout}s",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }
    except AgentRateLimitError:
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": f"Rate limit exceeded for agent '{agent_name}'",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }
    except Exception as exc:
        logger.exception(f"ACT phase failed: {exc}")
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"Execution error: {exc}", "details": None, "proposals": [], "questions": []},
        }
    finally:
        await _rate_limiter.release(agent_name)


def _dispatch_agent(agent_type: str, agent: BaseAgent, message: str, request: AgentRequest):
    """Return a coroutine for the given agent type (used by circuit breaker).

    Handles all 8 canonical MVP agents + 14 enterprise agents.
    Enterprise routing uses both class-name (agent_type) and registry key (request.agent_name)
    for robustness whether the caller used explicit routing or classification.
    """
    # Normalise for enterprise routing: registry key is lower-case (career, github, etc.)
    registry_key = (request.agent_name or "").lower()
    msg_lower = message.lower()
    keywords = [w for w in message.split() if len(w) > 2]

    # ── Canonical MVP agents ──────────────────────────────────────────
    if agent_type == "OrganizationAgent":
        docs = [{"id": f"doc_{request.id}", "filename": message}]
        # Organization file moves/renames are consequential — approval-gated per ADR-031
        async def _org_handler(has_approval: bool):
            result = await agent.execute(docs)
            # Enrich proposals with approval metadata (human-in-loop)
            try:
                res = result.get("result", {}) if isinstance(result, dict) else {}
                props = res.get("proposals") if isinstance(res, dict) else None
                if isinstance(props, list) and props:
                    for p in props:
                        if isinstance(p, dict):
                            p.setdefault("requires_approval", not has_approval)
                            p.setdefault("approval_type", "file_organize")
                    if not has_approval:
                        result["action"] = "request_approval"
                        # Surface as approval card copy
                        if "result" in result and isinstance(result["result"], dict):
                            s = result["result"].get("summary", "")
                            if "awaiting approval" not in s.lower():
                                result["result"]["summary"] = f"{s} — awaiting approval."
                    else:
                        result["action"] = "execute"
                        logger.info(f"Organization APPROVED file_organize for {request.workspace_id}")
            except Exception as e:
                logger.warning(f"Organization approval enrichment failed: {e}")
            return result
        return _dispatch_with_approval(request, agent, "file_organize", _org_handler)

    if agent_type == "ResumeAgent":
        # Use extracted keywords as skills instead of raw message blob (fixes synthetic single-string skill)
        skill_list = keywords if keywords else ([message.strip()] if message.strip() else [])
        profile = {
            "name": "User",
            "email": "user@example.com",
            "education": [],
            "experience": [],
            "skills": skill_list,
        }
        return agent.execute(profile)

    if agent_type == "ATSAgent":
        parts = message.split(" vs ", 1) if " vs " in message.lower() else (message, "")
        return agent.score(parts[0].strip(), parts[1].strip() if len(parts) > 1 else "")

    if agent_type == "JobSearchAgent":
        return agent.search(keywords=keywords, user_skills=keywords, rejected_job_ids=[])

    if agent_type == "ApplicationAgent":
        job = {"id": f"job_{request.id}", "title": message, "company": "Target Company"}
        return _dispatch_with_approval(request, agent, "job_application", lambda has_approval: agent.prepare(
            job=job, resume_text="", user_profile={"name": "User", "skills": []}, has_approval=has_approval
        ))

    if agent_type in ("GmailAgent", "GmailAgentHandler") or registry_key == "gmail":
        emails = [{"id": f"email_{request.id}", "subject": message, "sender": "unknown", "body": message}]
        # Gmail is draft-only, no approval needed — classify directly
        return agent.classify_emails(emails=emails)

    if agent_type in ("DriveAgent", "DriveAgentHandler") or registry_key == "drive":
        # Drive sync can write documents/episodic — gate ingestion behind approval (suggest vs execute)
        async def _drive_handler(has_approval: bool):
            result = await agent.process(request)
            # Drive is read-heavy; only gate actual ingestion. If not approved, downgrade to suggest with notice
            if not has_approval and isinstance(result, dict):
                act = result.get("action")
                if act == "suggest":
                    # Ensure summary notes approval needed for writes without breaking read path
                    try:
                        r = result.get("result", {})
                        if isinstance(r, dict) and r.get("summary") and "ingested" in str(r.get("summary", "")).lower():
                            r["summary"] = str(r["summary"]) + " (ingestion requires approval for new files)"
                    except Exception:
                        pass
            return result
        return _dispatch_with_approval(request, agent, "drive_sync", _drive_handler)

    if agent_type == "SchedulerAgent" or registry_key == "scheduler":
        return _dispatch_with_approval(request, agent, "calendar_write", lambda has_approval: agent.check_conflicts(
            events=[], has_approval=has_approval
        ))

    if agent_type in ("MemoryAgent", "MemoryAgentHandler") or registry_key == "memory":
        return agent.execute(
            content=message,
            source_type="user_input",
            source_id=f"input_{request.id}",
            workspace_id=request.workspace_id,
        )

    # ── Enterprise agents ─────────────────────────────────────────────
    if agent_type == "CareerAgent" or registry_key == "career":
        # Route to best Career method by keywords
        if any(kw in msg_lower for kw in ["gap", "missing skill", "skill gap"]):
            return agent.identify_skill_gaps(current_skills=keywords, target_role=message[:120])
        if any(kw in msg_lower for kw in ["course", "recommend", "learn", "training"]):
            return agent.recommend_courses(skill_gaps=keywords)
        return agent.analyze_career_path(current_role=message[:120] or "Current Role", skills=keywords, target_role=None)

    if agent_type == "LearningAgent" or registry_key == "learning":
        if any(kw in msg_lower for kw in ["progress", "track", "completed"]):
            return agent.track_progress(completed_items=[message], current_goal=None)
        if any(kw in msg_lower for kw in ["material", "resource", "book", "article"]):
            return agent.recommend_materials(skill=message[:80] or "general", goal=None)
        # Default: course search
        topic = message.strip() or "general"
        return agent.search_courses(topic=topic, level="beginner")

    if agent_type == "ResearchAgent" or registry_key == "research":
        if any(kw in msg_lower for kw in ["trend", "emerging", "future"]):
            return agent.spot_trends(domain=message[:100] or "technology", timeframe="6 months")
        if any(kw in msg_lower for kw in ["industry", "market", "sector"]):
            return agent.analyze_industry(industry=message[:100] or "technology")
        return agent.research_company(company_name=message[:100] or "Acme Corp")

    if agent_type == "GitHubAgent" or registry_key == "github":
        # Try to extract username / repo from message
        username = message.strip().split()[0][:39] if message.strip() else "octocat"
        if "/" in message and any(c in message for c in ["/"]):
            # Looks like owner/repo
            repo = message.strip().split()[0]
            if "/" in repo:
                return agent.get_repo_stats(repo_full_name=repo)
        if any(kw in msg_lower for kw in ["repo", "repository", "stats"]):
            return agent.get_repo_stats(repo_full_name=username if "/" in username else f"{username}/repo")
        if any(kw in msg_lower for kw in ["skill", "assess"]):
            return agent.assess_skills(username=username)
        return agent.analyze_profile(username=username)

    if agent_type == "CodingAgent" or registry_key == "coding":
        if any(kw in msg_lower for kw in ["review", "check code", "audit code"]):
            return agent.review_code(code_snippet=message, language="python")
        if any(kw in msg_lower for kw in ["practice", "generate", "exercise"]):
            return agent.generate_practice(topics=keywords or ["algorithms"], difficulty="medium")
        return agent.solve_challenge(problem_statement=message, language="python")

    if agent_type == "ReminderAgent" or registry_key == "reminder":
        if any(kw in msg_lower for kw in ["priority", "sort", "prioritize"]):
            return agent.sort_by_priority(items=[{"name": message, "due_date": "soon"}])
        if any(kw in msg_lower for kw in ["follow", "schedule"]):
            return agent.schedule_followup(context=message)
        return agent.check_deadlines(tasks=[{"name": message, "due_date": "2026-08-30", "priority": "medium"}])

    if agent_type == "AnalyticsAgent" or registry_key == "analytics":
        if any(kw in msg_lower for kw in ["report", "generate report"]):
            return agent.generate_report(report_type=message[:60] or "activity", data_sources=["activity"], period="30d")
        if any(kw in msg_lower for kw in ["application", "funnel", "conversion"]):
            return agent.analyze_applications(applications=[{"role": message[:60], "company": "Unknown", "status": "applied"}])
        return agent.get_activity_trends(metrics=keywords or ["activity"], period="30d")

    if agent_type == "RecommendationAgent" or registry_key == "recommendation":
        if any(kw in msg_lower for kw in ["connection", "network", "mentor"]):
            return agent.suggest_connections(profile={"title": message[:60], "industry": "General"})
        if any(kw in msg_lower for kw in ["content", "article", "curate"]):
            return agent.curate_content(interests=keywords or [message[:40]])
        return agent.match_jobs(profile={"skills": keywords or [message[:40]], "experience": message[:120]})

    if agent_type == "ReflectionAgent" or registry_key == "reflection":
        if any(kw in msg_lower for kw in ["goal", "track goal"]):
            return agent.track_goals(goals=[{"name": message[:60], "target": "Q4", "progress": 50}])
        if any(kw in msg_lower for kw in ["monthly", "month"]):
            return agent.monthly_review(monthly_data={"applications": 5, "connections": 3, "skills_added": 2})
        return agent.generate_weekly_digest(activity_log=[{"action": message, "date": "2026-08-22"}])

    if agent_type == "SecurityAgent" or registry_key == "security":
        if any(kw in msg_lower for kw in ["access log", "access", "log"]):
            return agent.analyze_access_logs(logs=[{"user": "user", "resource": message[:60], "ip": "127.0.0.1", "time": "now"}])
        if any(kw in msg_lower for kw in ["monitor", "activity"]):
            return agent.monitor_activity(recent_actions=[{"action": message, "user": "user", "time": "now"}])
        return agent.scan_for_pii(content=message)

    if agent_type == "ConnectorAgent" or registry_key == "connector":
        if any(kw in msg_lower for kw in ["setup", "guide", "configure"]):
            return agent.guide_setup(connector_name=message[:60] or "generic")
        if any(kw in msg_lower for kw in ["health", "monitor", "status"]):
            return agent.monitor_health(connectors=[{"name": message[:40], "status": "unknown"}])
        return agent.discover_connectors(category=None, search_query=message)

    if agent_type == "PluginAgent" or registry_key == "plugin":
        if any(kw in msg_lower for kw in ["update", "manage update"]):
            return agent.manage_updates(installed_plugins=[{"name": message[:40], "version": "1.0.0"}])
        if any(kw in msg_lower for kw in ["compat", "check compat"]):
            return agent.check_compatibility(plugin_name=message[:40] or "plugin", current_version="1.0.0", environment={})
        return agent.browse_plugins(category=None, query=message)

    if agent_type == "PlanningAgent" or registry_key == "planning":
        if any(kw in msg_lower for kw in ["milestone", "milestone", "checkpoint"]):
            return agent.suggest_milestones(roadmap={"title": message[:80]}, timeline_months=12)
        if any(kw in msg_lower for kw in ["resource", "recommend"]):
            return agent.recommend_resources(topic=message[:80] or "career", skill_level="intermediate")
        return agent.build_roadmap(profile={"background": message[:200]}, goals=[message[:120]])

    logger.warning(
        "dispatch_unknown_agent",
        extra={"agent_type": agent_type, "request_id": str(request.id), "action": "fallback"},
    )
    return agent.fallback()


async def _dispatch_with_approval(
    request: AgentRequest,
    agent: BaseAgent,
    action_type: str,
    handler,
):
    """Dispatch an agent action that requires approval lookup."""
    approval = await lookup_approval(
        workspace_id=request.workspace_id,
        agent_name=request.agent_name,
        action_type=action_type,
    )
    has_approval = approval is not None and approval.get("status") == "APPROVED"
    if has_approval:
        logger.info(f"APPROVAL FOUND: {approval['id']} for action {action_type}")
    return await handler(has_approval)


# ── Observe ─────────────────────────────────────────────────────────

async def observe_phase(act_result: dict[str, Any]) -> dict[str, Any]:
    result = act_result.get("result", {})
    logger.info(f"OBSERVE: action={act_result.get('action')}, summary={str(result.get('summary', ''))[:80]}")
    return {
        "observation": result.get("summary", ""),
        "action": act_result.get("action"),
        "confidence": act_result.get("confidence", 0.0),
        "payload": act_result,
    }


# ── Reflect ─────────────────────────────────────────────────────────

async def reflect_phase(request: AgentRequest, observe_result: dict[str, Any], iteration: int) -> ReflectResult:
    action = observe_result.get("action", "")
    confidence = observe_result.get("confidence", 0.0)

    logger.info(f"REFLECT: action={action}, confidence={confidence}, iteration={iteration}")

    if action == "execute":
        return ReflectResult(True, "Executed successfully")

    if action == "request_approval":
        return ReflectResult(True, "Approval required — proposal ready")

    if action == "suggest" and confidence >= 0.7:
        return ReflectResult(True, f"Good suggestion (confidence={confidence:.2f})")

    if action == "error":
        return ReflectResult(iteration >= 2, "Error - escalating" if iteration >= 2 else "Error - retrying")

    if action == "ask_clarification":
        return ReflectResult(
            iteration >= 2,
            "Clarification needed - escalating" if iteration >= 2 else "Need more info",
        )

    return ReflectResult(iteration >= 2, "Max iterations reached")


# ── Improve ─────────────────────────────────────────────────────────

async def improve_phase(state: LoopState, request: AgentRequest) -> AgentResponse:
    logger.info("IMPROVE: packaging final result")

    for i in range(2, -1, -1):
        key = f"observe_{i}"
        if key in state.phases:
            payload = state.phases[key].get("payload", {})
            summary = payload.get("result", {}).get("summary", "Task completed")
            return AgentResponse(status="success", final_result=summary)

    return AgentResponse(status="success", final_result="Task completed")


# ── Escalate ────────────────────────────────────────────────────────

async def escalate_to_user(state: LoopState) -> AgentResponse:
    logger.warning("ESCALATE: max iterations exceeded")
    return AgentResponse(status="escalated", final_result="max retries exceeded")


# ── Streaming Loop — phase-by-phase SSE events ──────────────────────

from collections.abc import AsyncGenerator


async def run_agent_loop_stream(request: AgentRequest) -> AsyncGenerator[dict[str, Any], None]:
    """Streaming variant of run_agent_loop. Yields SSE-ready event dicts.

    Event types: intent, plan, act, observe, reflect, token, approval_required, done, error
    Caller is responsible for mapping to SSE `event:` + `data:` framing.
    """
    import json as _json
    from ..services.llm_service import llm_service  # lazy to avoid circular

    logger.info(f"START stream loop: request={request.id}, agent={request.agent_name}")
    state = await load_or_create_state(request.id)

    # Emit intent classification immediately (re-emit from router context if available)
    yield {"event": "intent", "data": {"agent": request.agent_name, "request_id": str(request.id)}}

    for iteration in range(3):
        logger.info(f"─── Stream Iteration {iteration + 1}/3 ───")

        plan = await plan_phase(request, state)
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)
        yield {"event": "plan", "data": {"iteration": iteration, "plan": plan}}

        # Stream tokens if LLM is involved in Act — weemit incremental token events
        # For now, act_phase is non-streaming; we wrap it and if it did ReAct with streaming, we would forward tokens.
        # We attempt to stream LLM tokens for the final synthesis if available
        act_result = await act_phase(plan, request)
        state.add_phase(f"act_{iteration}", act_result)
        await save_checkpoint(state)
        yield {"event": "act", "data": {"iteration": iteration, "result": act_result}}

        # Emit tool-level events if act_result contains tool calls info
        tool_calls = act_result.get("tool_calls") or act_result.get("result", {}).get("tool_calls") or []
        for tc in tool_calls:
            yield {"event": "tool_start", "data": {"tool": tc.get("function", {}).get("name", "unknown"), "params": tc.get("function", {}).get("arguments", {})}}
        # If approval gate surfaced a pending approval inside result
        proposals = act_result.get("result", {}).get("proposals") or []
        for p in proposals:
            if p.get("requires_approval"):
                yield {"event": "approval_required", "data": p}

        observe_result = await observe_phase(act_result)
        state.add_phase(f"observe_{iteration}", observe_result)
        await save_checkpoint(state)
        yield {"event": "observe", "data": {"iteration": iteration, "observation": observe_result}}

        reflect_result = await reflect_phase(request, observe_result, iteration)
        state.add_phase(f"reflect_{iteration}", {"is_satisfied": reflect_result.is_satisfied, "reason": reflect_result.reason})
        await save_checkpoint(state)
        yield {"event": "reflect", "data": {"iteration": iteration, "is_satisfied": reflect_result.is_satisfied, "reason": reflect_result.reason}}

        if reflect_result.is_satisfied:
            improve_resp = await improve_phase(state, request)
            # Stream final answer as token events for typewriter effect (chunk by 40 chars)
            final_text = str(improve_resp.final_result or "")
            chunk_size = 40
            for i in range(0, len(final_text), chunk_size):
                yield {"event": "token", "data": {"text": final_text[i:i+chunk_size]}}
                await asyncio.sleep(0)  # allow event loop to flush
            yield {"event": "done", "data": {"status": improve_resp.status, "result": improve_resp.final_result}}
            return

    escalated = await escalate_to_user(state)
    yield {"event": "error", "data": {"status": escalated.status, "result": escalated.final_result}}
    yield {"event": "done", "data": {"status": escalated.status, "result": escalated.final_result}}


# ── Main Loop ───────────────────────────────────────────────────────

async def run_agent_loop(request: AgentRequest) -> AgentResponse:
    logger.info(f"START loop: request={request.id}, agent={request.agent_name}")
    state = await load_or_create_state(request.id)

    for iteration in range(3):
        logger.info(f"─── Iteration {iteration + 1}/3 ───")

        plan = await plan_phase(request, state)
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)

        act_result = await act_phase(plan, request)
        state.add_phase(f"act_{iteration}", act_result)
        await save_checkpoint(state)

        observe_result = await observe_phase(act_result)
        state.add_phase(f"observe_{iteration}", observe_result)
        await save_checkpoint(state)

        reflect_result = await reflect_phase(request, observe_result, iteration)
        state.add_phase(f"reflect_{iteration}", {
            "is_satisfied": reflect_result.is_satisfied,
            "reason": reflect_result.reason,
        })
        await save_checkpoint(state)

        if reflect_result.is_satisfied:
            return await improve_phase(state, request)

    return await escalate_to_user(state)
