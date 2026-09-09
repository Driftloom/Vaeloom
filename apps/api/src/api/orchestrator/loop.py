import asyncio
import logging
import re
from datetime import UTC
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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


# ── Spend & Quota Gate (Wave 1, 2026-09-06) ──────────────────────────

async def _check_spend_and_quota(workspace_id: str, agent_name: str) -> tuple[str | None, str]:
    """Enforce daily request quota + USD spend budget before LLM work.

    Returns (error summary or None, ceiling kind). Kind is a LoopState
    termination reason: "policy_stop" for quota, "cost_budget" for spend.
    Quota reuses temporal/quota.py (one system, both loop paths). Spend uses
    services/agent_costs.py budgets. Fail-open locally, fail-closed in
    non-local environments (mirrors quota.py semantics).
    """
    # ── Daily request quota (shared Redis counters with Temporal path) ──
    try:
        from ..temporal.quota import check_and_reserve

        allowed, cur = await check_and_reserve(workspace_id, metric="requests", increment=1)
        if not allowed:
            logger.warning(f"Quota gate: workspace={workspace_id} agent={agent_name} daily requests exhausted ({cur})")
            return (f"Daily request quota exhausted for this workspace ({cur} used). Please try again tomorrow.",
                    "policy_stop")
    except ImportError as e:
        logger.error(f"Quota gate: temporal.quota unavailable: {e}")
        try:
            if settings.service_environment != "local":
                return ("Quota service unavailable — loop halted (fail-closed in non-local).", "policy_stop")
        except Exception:
            pass
    except Exception as e:
        logger.warning(f"Quota gate check failed (non-blocking): {e}")

    # ── USD spend budget ──
    try:
        from ..services.agent_costs import agent_cost_tracker

        status = await agent_cost_tracker.check_budget(workspace_id)
        if not status.get("allowed", True):
            logger.warning(
                f"Budget gate: workspace={workspace_id} agent={agent_name} spent={status.get('spent_usd')} limit={status.get('limit_usd')}"
            )
            return (
                f"Workspace LLM spend budget exhausted "
                f"(${status.get('spent_usd', 0):.4f} / ${status.get('limit_usd', 0):.4f}). "
                f"Please raise the budget or try again in the next period.",
                "cost_budget",
            )
    except Exception as e:
        logger.warning(f"Budget gate check failed (non-blocking): {e}")
    return None, "cost_budget"


def _ceiling_error_card(agent_name: str, summary: str, kind: str = "cost_budget") -> dict[str, Any]:
    """User-facing error card for ceiling/quota/budget stops (matches rate-limit shape).

    kind is a LoopState termination reason ("cost_budget" for spend, "policy_stop"
    for quota). Carried in result._ceiling so the run loops can terminate with
    the truthful reason instead of decaying into no_progress/escalated.
    """
    return {
        "agent_name": agent_name,
        "action": "error",
        "confidence": 0.0,
        "result": {
            "summary": summary,
            "details": None,
            "proposals": [],
            "questions": [],
            "_ceiling": kind,
        },
    }


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


def _canonical_payload_hash(payload: dict | None) -> str:
    import hashlib
    import json
    if not payload:
        return ""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


async def _lookup_approval_internal(
    workspace_id: str | None,
    agent_name: str,
    action_type: str,
    payload: dict | None = None,
    approval_id: str | None = None,
    consume: bool = True,
    db: AsyncSession | None = None,
) -> dict[str, Any] | None:
    import json
    from datetime import UTC, datetime
    from ..database import async_session_factory

    async def _do_lookup(session: AsyncSession) -> dict[str, Any] | None:
        now = datetime.now(UTC)

        # 1. Expire stale pending approvals
        await session.execute(
            text("""
                UPDATE agent_approvals
                SET status = 'EXPIRED', updated_at = :now
                WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < :now
            """),
            {"now": now},
        )
        await session.commit()

        # 2. Query candidates with status APPROVED and unexpired
        query_parts = [
            "SELECT id, workspace_id, agent_name, action_type, payload, status, reason, expires_at",
            "FROM agent_approvals",
            "WHERE agent_name = :agent_name",
            "AND action_type = :action_type",
            "AND status = 'APPROVED'",
            "AND (expires_at IS NULL OR expires_at > :now)",
        ]
        params: dict[str, Any] = {
            "agent_name": agent_name,
            "action_type": action_type,
            "now": now,
        }

        if workspace_id:
            query_parts.append("AND workspace_id = :workspace_id")
            params["workspace_id"] = str(workspace_id)
        if approval_id:
            query_parts.append("AND id = :approval_id")
            params["approval_id"] = str(approval_id)

        query_parts.append("ORDER BY created_at DESC LIMIT 10")
        stmt = " ".join(query_parts)

        result = await session.execute(text(stmt), params)
        rows = result.fetchall()

        for row in rows:
            row_id = str(row[0])
            stored_payload = row[4]
            if isinstance(stored_payload, str):
                try:
                    stored_payload = json.loads(stored_payload)
                except (json.JSONDecodeError, TypeError):
                    stored_payload = {}
            elif not isinstance(stored_payload, dict):
                stored_payload = {}

            # Verify payload match if caller passed payload (handoff invariant #7:
            # approvals bind to the stable canonical hash of the action payload;
            # a tampered/swapped payload MUST invalidate the match — unkeyed
            # canonical equality is the binding check and needs no secret).
            if payload is not None and stored_payload:
                import re as _re
                expected_hash = _canonical_payload_hash(payload)
                actual_hash = _canonical_payload_hash(stored_payload)
                if expected_hash != actual_hash:
                    continue
                # Defense in depth: when a secret is available, verify the
                # keyed reason-HMAC (same derivation as
                # ApprovalManager.request_approval). A present-but-wrong HMAC
                # means the row was tampered with after creation → skip.
                # Rows without HMAC (legacy) pass on equality alone.
                try:
                    import os as _os
                    _secret = _os.getenv("ENCRYPTION_KEY", "") or _os.getenv("JWT_SECRET", "")
                    if _secret:
                        from ..services.approval import _payload_hmac as _phmac
                        _m = _re.search(r"\[hmac:([0-9a-f]{32})\]", row[6] or "")
                        if _m and _m.group(1) != _phmac(stored_payload, _secret):
                            logger.warning(f"Approval {row_id} reason-HMAC mismatches stored payload — possible tampering, skipping")
                            continue
                except Exception:
                    pass

            if consume:
                # Atomic consumption — only 1 worker wins
                update_res = await session.execute(
                    text("""
                        UPDATE agent_approvals
                        SET status = 'CONSUMED', updated_at = :now
                        WHERE id = :id AND status = 'APPROVED'
                    """),
                    {"id": row_id, "now": now},
                )
                await session.commit()
                if update_res.rowcount == 0:
                    continue

            return {
                "id": row_id,
                "workspace_id": str(row[1]) if row[1] else None,
                "agent_name": row[2],
                "action_type": row[3],
                "payload": stored_payload,
                "status": "CONSUMED" if consume else row[5],
            }

        return None

    try:
        if db is not None:
            return await _do_lookup(db)
        async with async_session_factory() as session:
            return await _do_lookup(session)
    except Exception as exc:
        logger.warning(f"Approval lookup failed (non-blocking): {exc}")
        return None


async def inspect_approval(
    workspace_id: str | None,
    agent_name: str,
    action_type: str,
    payload: dict | None = None,
    approval_id: str | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any] | None:
    """Inspect if an active, unexpired APPROVED approval exists without consuming it."""
    return await _lookup_approval_internal(
        workspace_id=workspace_id,
        agent_name=agent_name,
        action_type=action_type,
        payload=payload,
        approval_id=approval_id,
        consume=False,
        db=db,
    )


async def consume_approval_for_action(
    workspace_id: str | None,
    agent_name: str,
    action_type: str,
    payload: dict | None = None,
    approval_id: str | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any] | None:
    """Atomically consume an active, unexpired APPROVED approval for consequential execution."""
    return await _lookup_approval_internal(
        workspace_id=workspace_id,
        agent_name=agent_name,
        action_type=action_type,
        payload=payload,
        approval_id=approval_id,
        consume=True,
        db=db,
    )


async def lookup_approval(
    workspace_id: str | None,
    agent_name: str,
    action_type: str,
    payload: dict | None = None,
    approval_id: str | None = None,
    consume: bool = True,
    db: AsyncSession | None = None,
) -> dict[str, Any] | None:
    """Look up and optionally consume an approval decision for the given agent/action.

    Consequential execution paths default to consume=True (single-use token semantics).
    """
    if consume:
        return await consume_approval_for_action(
            workspace_id=workspace_id,
            agent_name=agent_name,
            action_type=action_type,
            payload=payload,
            approval_id=approval_id,
            db=db,
        )
    return await inspect_approval(
        workspace_id=workspace_id,
        agent_name=agent_name,
        action_type=action_type,
        payload=payload,
        approval_id=approval_id,
        db=db,
    )


class AgentRequest:
    def __init__(self, agent: BaseAgent, request_id: str, message: str, workspace_id: str, agent_name: str = "", db: Any = None, correlation_id: str | None = None, user_id: str | None = None, tenant_id: str | None = None):
        self.agent = agent
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id
        self.agent_name = agent_name or self._derive_agent_name()
        self.db = db
        # §29 trace correlation (middleware/queue/envelope or run id).
        self.correlation_id = correlation_id or request_id
        # BYOK/auth context for model fallback resolution (fail-safe: system key when absent).
        self.user_id = user_id
        # Tenant binding for policy/observability (middleware context authoritative).
        self.tenant_id = tenant_id

    def _derive_agent_name(self) -> str:
        name = type(self.agent).__name__
        for suffix in ["AgentHandler", "Agent", "Handler"]:
            name = name.replace(suffix, "")
        return name.lower()


class AgentResponse:
    def __init__(self, status: str, final_result: Any, termination_reason: str | None = None):
        self.status = status
        self.final_result = final_result
        self.termination_reason = termination_reason
        try:
            from .state import failure_code_for
            self.failure_code = failure_code_for(status, termination_reason)
        except Exception:
            self.failure_code = "OK" if status == "success" else "TOOL_FAILURE"


class ReflectResult:
    def __init__(self, is_satisfied: bool, reason: str = ""):
        self.is_satisfied = is_satisfied
        self.reason = reason


def _runtime_contract(agent_name: str, agent: BaseAgent | None = None):
    """Resolve the enforceable runtime contract for an agent (Phase B §8).

    The contract is synthesized from the AgentCard + agent-declared tools
    (real tool names) and returned ephemerally — never overwriting registry
    seeds. Returns None when the agent declares no tool identity, in which
    case only scope checks apply (static handlers are policy-coded).
    """
    try:
        card_tools: set[str] = set()
        try:
            from .card_registry import get_agent_card
            _card = getattr(agent, "card", None) or get_agent_card(agent_name or "")
            if _card is not None:
                card_tools.update(getattr(_card, "tools", []) or [])
        except Exception:
            pass
        try:
            card_tools.update(t.name for t in (getattr(agent, "tools", []) or []))
        except Exception:
            pass
        if not card_tools:
            return None
        from ..services.agent_contracts import AgentContract, LoopPolicy
        return AgentContract(
            agent_id=(agent_name or "unknown").lower(),
            version="runtime-v1",
            mission=getattr(agent, "mission", "") or (agent_name or "unknown"),
            allowed_tools=sorted(card_tools),
            memory_read_scopes=list(getattr(getattr(agent, "memory_scopes", None), "read_types", []) or []),
            memory_write_scopes=list(getattr(getattr(agent, "memory_scopes", None), "write_types", []) or []),
            autonomy="SUGGEST",
            risk_class="medium",
            loop=LoopPolicy(),
        )
    except Exception as exc:
        logger.debug(f"Runtime contract resolution skipped for {agent_name}: {exc}")
        return None


# ── RAG Pre-Execution Context Assembler ───────────────────────────

async def _assemble_rag_context(
    workspace_id: str,
    query: str,
    agent: BaseAgent,
    session_factory: Any | None = None,
) -> dict[str, Any]:
    """Hybrid RAG: vector-ish + graph lookup before Plan/Act. Non-blocking, best-effort.

    session_factory is injectable for tests (defaults to the production
    factory). Production callers must not pass it.
    """
    import time as _t

    _rag_start = _t.monotonic()
    if not workspace_id or not query.strip():
        return {"entities": [], "documents": [], "preferences": []}
    try:
        from sqlalchemy import or_, select
        from api.models.schema import Document, Entity

        read_types = getattr(getattr(agent, "memory_scopes", None), "read_types", []) or []
        keywords = [w for w in query.split() if len(w) > 2][:5]
        if not keywords:
            return {"entities": [], "documents": [], "preferences": []}

        entities: list[dict[str, Any]] = []
        documents: list[dict[str, Any]] = []
        preferences: list[dict[str, Any]] = []

        import uuid as _uuid
        try:
            w_uuid = _uuid.UUID(str(workspace_id))
        except Exception:
            w_uuid = workspace_id

        _session_factory = session_factory
        if _session_factory is None:
            from api.database import async_session_factory as _default_factory
            _session_factory = _default_factory

        async with _session_factory() as session:
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
                        vec = await llm_service.generate_embedding(query[:2000])
                        vec_str = "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
                        # Try embeddings table (works on Postgres with pgvector; falls back on SQLite mock)
                        try:
                            res = await session.execute(
                                _text("""
                                    SELECT source_id, source_type, 1 - (vector <=> CAST(:vec AS vector)) AS score
                                    FROM embeddings
                                    WHERE workspace_id = :wid AND source_type IN ('entity', 'memory', 'document', 'document_chunk')
                                    ORDER BY vector <=> CAST(:vec AS vector)
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
                        stmt = select(Entity).where(Entity.workspace_id == w_uuid).where(Entity.canonical_name.ilike(f"%{kw}%")).limit(5)
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
            # P1b: try Postgres tsvector BM25 rank first (true hybrid), fall back to LIKE on SQLite
            if not vector_done or len(documents) < 4:
                tsv_tried = False
                try:
                    from sqlalchemy import text as _ts_text
                    import os as _os2

                    # Only attempt tsvector when Postgres (requires migration 0026)
                    if "postgres" in _os2.environ.get("DATABASE__URL", "").lower():
                        # Requires docs to have tsv column via migration 0042 or fallback plainto_tsquery on path+summary
                        q = " ".join(keywords[:5])
                        ts_res = await session.execute(
                            _ts_text("""
                                SELECT id, path, summary,
                                       ts_rank(to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,'')),
                                               plainto_tsquery('english', :q)) AS rank
                                FROM documents
                                WHERE workspace_id = :wid
                                  AND to_tsvector('english', coalesce(path,'') || ' ' || coalesce(summary,'')) @@ plainto_tsquery('english', :q)
                                ORDER BY rank DESC LIMIT 8
                            """),
                            {"q": q, "wid": str(w_uuid)},
                        )
                        for row in ts_res.fetchall():
                            did = str(row[0])
                            if not any(d["id"] == did for d in documents):
                                documents.append({"id": did, "path": row[1], "summary": (row[2] or "")[:300]})
                        tsv_tried = True
                        if documents:
                            logger.info(f"RAG tsvector: {len(documents)} docs via BM25 rank for q='{q[:40]}'")
                except Exception as te:
                    logger.debug(f"RAG tsvector skipped: {te}")
                if not tsv_tried:
                    try:
                        for kw in keywords[:3]:
                            stmt = select(Document).where(Document.workspace_id == w_uuid).where(
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
                stmt = select(Entity).where(Entity.workspace_id == w_uuid).where(Entity.type == "preference").limit(10)
                res = await session.execute(stmt)
                for pref in res.scalars().all():
                    # If query overlaps preference name, keep it
                    if any(kw.lower() in (pref.canonical_name or "").lower() for kw in keywords):
                        preferences.append({"id": str(pref.id), "name": pref.canonical_name, "metadata": pref.metadata_})
                    elif len(preferences) < 3:
                        preferences.append({"id": str(pref.id), "name": pref.canonical_name, "metadata": pref.metadata_})
            except Exception as e:
                logger.warning(f"RAG preference lookup failed: {e}")

        # ── P1: ranking re-rank (weighted relevance+recency+importance) when we have enough candidates
        # Over-fetch 20 LIKE candidates → score → keep top 8. Vector path already scored via distance.
        try:
            if (len(entities) >= 10 or len(documents) >= 10) or (entities or documents):
                from ..services.search_ranking import search_ranking_service

                # Convert to ranking service format without extra DB round-trips
                all_cands: list[dict] = []
                for e in entities:
                    all_cands.append({"id": e["id"], "text": e["name"], "source": "entity", "metadata": {"importance": 0.5}, "score": 1.0})
                for d in documents:
                    all_cands.append({"id": d["id"], "text": d["path"], "source": "document", "metadata": {"summary": d["summary"], "created_at": None}, "score": 1.0})
                if all_cands:
                    # WS01: wire preference_vector into ranking via user_context (learning loop closure)
                    _uc = None
                    try:
                        if preferences:
                            _tags = [p.get("name","").lower() for p in preferences[:5] if p.get("name")]
                            _types = list({p.get("metadata",{}).get("preferred_types",[]) for p in preferences if p.get("metadata")})
                            # flatten
                            flat_types = []
                            for t in _types:
                                if isinstance(t, list):
                                    flat_types.extend(t)
                            _uc = {"preferred_tags": _tags, "preferred_types": flat_types or ["memory","document"]}
                    except Exception:
                        _uc = None
                    ranked = search_ranking_service.rank_results(all_cands, query, user_context=_uc)
                    # Re-build truncated lists preserving order via rank
                    ent_ids = {r["id"] for r in ranked if r["source"] == "entity"}
                    doc_ids = {r["id"] for r in ranked if r["source"] == "document"}
                    # Keep original dicts but ordered by rank
                    ent_order = {cid: i for i, cid in enumerate([r["id"] for r in ranked if r["source"] == "entity"])}
                    doc_order = {cid: i for i, cid in enumerate([r["id"] for r in ranked if r["source"] == "document"])}
                    entities.sort(key=lambda e: ent_order.get(e["id"], 999))
                    documents.sort(key=lambda d: doc_order.get(d["id"], 999))
        except Exception as _rank_err:
            logger.debug(f"RAG ranking re-rank skipped: {_rank_err}")

        # ── Phase B §10: ContextEngine policy over the retrieved candidates ──
        # The SQL/vector lookups above are candidate suppliers; the engine is
        # the policy layer that decides what the agent actually sees
        # (strategy -> filter -> rank -> compress -> validate), and its
        # manifest (strategy, fingerprint, kept/excluded) is persisted for
        # provenance. Selection stays observable; raw content never enters
        # the manifest — ids and fingerprints only.
        context_manifest: dict[str, Any] = {"strategy": "vector", "engine": "context_engine/v1"}
        try:
            from ..services.context_engine import (
                ContextItem as _CI,
                assemble as _assemble,
                compress_to_budget as _compress,
                context_fingerprint as _cf,
                filter_items as _filter,
                plan_retrieval as _plan_retrieval,
                rank_items as _rank_items,
                validate_assembly as _validate_assembly,
            )
            _rplan = _plan_retrieval(query, task_type=getattr(agent, "mission", "general")[:64])
            _items: list[_CI] = []
            for e in entities:
                _items.append(_CI(kind="memory", content=f"{e.get('name','')} ({e.get('type','')})",
                                  relevance=0.7, confidence=0.6, freshness=0.5,
                                  provenance=f"ws:{workspace_id}:{e.get('id','')}",
                                  permission_scope="workspace"))
            for d in documents:
                _items.append(_CI(kind="evidence", content=f"{d.get('path','')} — {(d.get('summary','') or '')[:500]}",
                                  relevance=0.6, confidence=0.6, freshness=0.5,
                                  provenance=f"ws:{workspace_id}:{d.get('id','')}",
                                  permission_scope="workspace"))
            for p in preferences:
                _items.append(_CI(kind="user", content=str(p.get("name", "")),
                                  relevance=0.5, confidence=0.7, freshness=0.6,
                                  provenance=f"ws:{workspace_id}:{p.get('id','')}",
                                  permission_scope="workspace"))
            _kept, _excluded = _filter(_items, workspace_id=str(workspace_id or ""))
            _ranked = _rank_items(_kept, limit=16)
            _compressed, _dropped = _compress(_ranked, token_budget=2000)
            _assembled = _assemble(_compressed)
            _violations = _validate_assembly(_assembled, _compressed, workspace_id=str(workspace_id or ""))
            context_manifest = {
                "strategy": _rplan.strategy,
                "strategy_reason": _rplan.reason,
                "engine": "context_engine/v1",
                "candidates": len(_items),
                "kept": len(_compressed),
                "excluded": len(_excluded),
                "excluded_reasons": sorted(set(_excluded))[:8],
                "compressed_kinds": _dropped[:8],
                "violations": _violations[:5],
                "fingerprint": _cf(_compressed) if _compressed else "",
                "token_budget": 2000,
            }
            if _violations:
                logger.warning(f"ContextEngine assembly violations: {_violations}")
        except Exception as _ce:
            logger.debug(f"ContextEngine policy skipped: {_ce}")

        # Truncate
        try:
            from ..infrastructure.agent_observability import record_rag_latency

            record_rag_latency((_t.monotonic() - _rag_start) * 1000)
        except Exception:
            pass
        return {"entities": entities[:8], "documents": documents[:8], "preferences": preferences[:5],
                "context_manifest": context_manifest}
    except Exception as e:
        logger.warning(f"RAG assembler non-blocking error: {e}")
        try:
            from ..infrastructure.agent_observability import record_rag_latency

            record_rag_latency((_t.monotonic() - _rag_start) * 1000)
        except Exception:
            pass
        return {"entities": [], "documents": [], "preferences": []}


# ── Plan ────────────────────────────────────────────────────────────

async def plan_phase(request: AgentRequest, state: LoopState) -> dict[str, Any]:
    # P1c: OTel span per phase (optional, no-op if OTel not installed)
    _cm = None
    try:
        from ..infrastructure.agent_observability import agent_span as _agent_span

        _cm = _agent_span("loop.plan", agent=request.agent_name)
    except Exception:
        _cm = None
    if _cm is None:
        import contextlib as _cl

        _cm = _cl.nullcontext()
    with _cm:
        logger.info(f"PLAN: agent={request.agent_name}, request={request.id}")
        # Automated RAG context injection
        rag_context: dict[str, Any] = {}
        try:
            rag_context = await _assemble_rag_context(request.workspace_id, request.message, request.agent)
            if rag_context.get("entities") or rag_context.get("documents"):
                logger.info(f"RAG injected: {len(rag_context.get('entities', []))} entities, {len(rag_context.get('documents', []))} docs, {len(rag_context.get('preferences', []))} prefs")
        except Exception as e:
            logger.warning(f"RAG injection failed (non-blocking): {e}")

        # Wave 4: Standardized Workspace Memory Context Loader
        agent_context = None
        try:
            from .context_loader import context_loader
            agent_context = await context_loader.load_context(
                workspace_id=request.workspace_id,
                user_id=getattr(request, "user_id", None),
                rag_context=rag_context,
            )
        except Exception as e:
            logger.warning(f"Context loading failed (non-blocking): {e}")

        return {
            "agent_type": request.agent_name,
            "message": request.message,
            "workspace_id": request.workspace_id,
            "rag_context": rag_context,
            "agent_context": agent_context,
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

async def _react_approval_gate(
    tool_name: str,
    payload_args: dict[str, Any],
    agent_name: str,
    workspace_id: str,
    user_id: str | None,
    db: Any | None,
    correlation_id: str,
) -> dict[str, Any]:
    """Approval parity for ReAct-selected tools (mirrors static `_dispatch_with_approval`).

    Canonical payload is {"tool": name, "args": cleaned_args}. Execution is
    allowed ONLY after an atomic consume + hash/HMAC verify at this moment
    (`lookup_approval`), so an approval can never become stale authorization.
    Otherwise a PENDING request is created (idempotent-ish: an existing PENDING
    row for the same agent/action is reused) and the loop pauses with its id.
    Returns {"approved": bool, "approval_id": str|None, "error": str|None}.
    Fail-closed: any infrastructure failure refuses execution.
    """
    payload = {"tool": tool_name, "args": payload_args}
    try:
        hit = await lookup_approval(
            workspace_id=workspace_id, agent_name=agent_name, action_type=tool_name,
            payload=payload, consume=True, db=db,
        )
        if hit is not None and hit.get("status") in ("APPROVED", "CONSUMED"):
            logger.info(f"REACT_APPROVAL_CONSUMED correlation={correlation_id} approval={hit.get('id')} tool={tool_name}")
            return {"approved": True, "approval_id": hit.get("id"), "error": None}
    except Exception as _le:
        logger.debug(f"ReAct approval lookup skipped: {_le}")
    # No usable approval: create a PENDING request (reuse an existing one).
    # requested_by is UUID-typed in the ledger: pass the user id only when it
    # parses as UUID, else NULL (fail-open identity here would corrupt the ledger).
    _requested_by: str | None = None
    try:
        import uuid as _uuid
        _requested_by = str(_uuid.UUID(str(user_id))) if user_id else None
    except Exception:
        _requested_by = None
    try:
        from ..services.approval import ApprovalManager
        mgr = ApprovalManager()
        if db is not None:
            try:
                existing = await mgr.list_approvals(db, status="PENDING", workspace_id=workspace_id)
                for item in (existing.items or []):
                    try:
                        if (item.agent_name == agent_name and item.action_type == tool_name
                                and (item.payload or {}) == payload):
                            return {"approved": False, "approval_id": str(item.id), "error": None}
                    except Exception:
                        continue
            except Exception:
                pass
            resp = await mgr.request_approval(
                agent_name, tool_name, payload,
                f"ReAct tool '{tool_name}' requires approval", workspace_id,
                _requested_by, 60, db)
            try:
                await db.commit()
            except Exception:
                try:
                    await db.rollback()
                except Exception:
                    pass
                return {"approved": False, "approval_id": None, "error": "approval store unavailable"}
            return {"approved": False, "approval_id": str(resp.id), "error": None}
        from ..database import async_session_factory as _af
        async with _af() as _sess:
            resp = await mgr.request_approval(
                agent_name, tool_name, payload,
                f"ReAct tool '{tool_name}' requires approval", workspace_id,
                _requested_by, 60, _sess)
            await _sess.commit()
            return {"approved": False, "approval_id": str(resp.id), "error": None}
    except Exception as _ce:
        logger.warning(f"REACT_APPROVAL_REFUSED correlation={correlation_id} tool={tool_name} error={_ce}")
        return {"approved": False, "approval_id": None, "error": str(_ce)[:200]}


async def _try_react_loop(
    agent: BaseAgent,
    message: str,
    workspace_id: str,
    agent_name: str,
    on_token: Any = None,
    context: Any | None = None,
    user_id: str | None = None,
    db: Any | None = None,
    correlation_id: str | None = None,
    request_id: str | None = None,
    state: Any | None = None,
    tenant_id: str | None = None,
) -> dict[str, Any] | None:
    """Attempt dynamic LLM-driven tool calling with AgentCard prompt and schema contracts.

    Production ReAct mode (opt-in via `agent_react_enabled`): the model proposes
    tools, but every proposal passes the full Muse enforcement ladder —
    existence → arg-schema validation → scope → AgentCard contract → approval
    (lookup-consume or request-and-pause) → budgets → idempotent execution —
    with per-round checkpointing (resume without re-execution), durable
    cancellation, per-round provider failover, and an explicit
    termination_reason on every return. Returns result dict or None to fall
    back to static dispatch (deliberate best-effort ladder, observed).
    """
    if not settings.agent_react_enabled:
        return None
    if not _REACT_AVAILABLE or not settings.llm_api_key:
        return None
    # Only attempt ReAct for agents that could benefit from live tools
    # Skip for very short messages to avoid overhead — still allow via explicit flag
    if len(message.strip()) < 3:
        return None
    import time as _rt
    from .react_policy import (
        ReactRunRecord,
        build_resume_messages,
        check_react_cancel,
        compact_messages,
        estimate_tokens,
        record_react_run,
        redact_secrets,
    )
    _react_start = _rt.monotonic()
    run_id = request_id or __import__("uuid").uuid4().hex[:12]
    corr = correlation_id or run_id
    # Tenant binding: explicit param wins, middleware context is authoritative.
    _tenant = tenant_id
    if not _tenant:
        try:
            from ..middleware.tenant import TenantContext as _TC
            _tenant = _TC.get_tenant_id()
        except Exception:
            _tenant = None
    _run_budgets: dict[str, float] = {}
    try:
        _run_budgets = dict(getattr(state, "budgets", None) or {})
    except Exception:
        pass
    if not _run_budgets:
        try:
            from .state import DEFAULT_RUN_BUDGETS as _DRB
            _run_budgets = dict(_DRB)
        except Exception:
            _run_budgets = {"max_iterations": 3, "max_tool_calls": 12, "max_tokens": 12000,
                            "max_cost_usd": 0.50, "max_duration_s": 120.0}
    _deadline = _react_start + float(_run_budgets.get("max_duration_s", 120.0))
    _max_tools = int(_run_budgets.get("max_tool_calls", 12))
    _max_tokens = int(_run_budgets.get("max_tokens", 12000))
    _rec = ReactRunRecord(correlation_id=corr, run_id=str(run_id), agent_name=agent_name,
                          workspace_id=str(workspace_id), tenant_id=_tenant)
    _seen_tool_calls: list[dict[str, Any]] = []
    _round_records: list[dict[str, Any]] = []
    # Defined up-front so exception paths (before the compiler block) can
    # still build honest terminal cards.
    prompt_manifest: dict[str, Any] = {"compiler": "prompt_compiler/v1", "compiled": False}
    try:
        _rec.model_name = getattr(settings, "llm_model", "")
        _rec.model_provider = getattr(settings, "llm_provider", "")
    except Exception:
        pass

    async def _finish(termination: str, card: dict[str, Any] | None,
                      snapshot_status: str = "terminal") -> dict[str, Any] | None:
        """Attach termination + react metadata, checkpoint terminal status, record."""
        from .react_policy import REACT_TERMINATION_MAP
        _rec.termination = termination
        _rec.duration_ms = (_rt.monotonic() - _react_start) * 1000
        try:
            record_react_run(_rec)
        except Exception:
            pass
        if card is not None:
            try:
                card["termination_reason"] = REACT_TERMINATION_MAP.get(termination, termination)
                _react_meta = card.get("react") if isinstance(card.get("react"), dict) else {}
                _react_meta.update({"run_id": str(run_id), "rounds": _rec.rounds,
                                    "tool_calls": _rec.tool_calls, "termination": termination,
                                    "resumed": _rec.resumed,
                                    "provider_fallbacks": _rec.provider_fallbacks})
                card["react"] = _react_meta
                # Outer-loop budget/cycle accounting: expose provider tool_calls
                # so LoopSafetyTracker + SSE tool_start events see ReAct work.
                try:
                    if "tool_calls" not in card and _seen_tool_calls:
                        card["tool_calls"] = list(_seen_tool_calls)
                except Exception:
                    pass
            except Exception:
                pass
        # Checkpoint even on ladder-fallthrough (card None): the rounds ledger
        # stays observable and resumable; returning None claims nothing.
        if state is not None and request_id:
            try:
                _rounds = []
                try:
                    _snap = (getattr(state, "phases", {}) or {}).get(f"react_run_{request_id}") or {}
                    _rounds = _snap.get("rounds") or []
                except Exception:
                    pass
                state.add_phase(f"react_run_{request_id}",
                                {"status": snapshot_status, "termination": termination,
                                 "rounds": _rounds, "run_id": str(run_id)})
                await _save_react_checkpoint(state)
            except Exception as _cke:
                logger.debug(f"ReAct terminal checkpoint skipped: {_cke}")
        return card

    async def _save_react_checkpoint(_st: Any) -> None:
        try:
            await save_checkpoint(_st)
        except Exception as _ce:
            logger.warning(f"ReAct checkpoint save failed (run continues in-memory): {_ce}")

    async def _terminal_card(summary: str, reason: str, action: str = "error",
                       confidence: float = 0.0, extra: dict[str, Any] | None = None) -> dict[str, Any]:
        _card: dict[str, Any] = {
            "agent_name": agent_name,
            "action": action,
            "confidence": confidence,
            "result": {"summary": summary, "details": None, "proposals": [], "questions": []},
            "prompt_manifest": prompt_manifest,
        }
        # Budget/timeout terminations propagate the ceiling marker so the OUTER
        # run loop terminates with the truthful reason (never no_progress).
        try:
            from .react_policy import REACT_TERMINATION_MAP
            _mapped = REACT_TERMINATION_MAP.get(reason, reason)
            if _mapped in ("cost_budget", "policy_stop", "timeout", "tool_budget", "token_budget"):
                _card["result"]["_ceiling"] = _mapped
        except Exception:
            pass
        if extra:
            _card.update(extra)
        return await _finish(reason, _card)

    try:
        from ..services.llm_service import llm_service
        import json
        from .card_registry import get_agent_card

        # Retrieve declarative AgentCard for prompt templating & schema verification
        card = getattr(agent, "card", None) or get_agent_card(agent_name)

        # Build tool schemas — least-privilege: only offer tools the agent or its card is explicitly allowed (OWASP LLM06/PATI)
        card_tools = set(card.tools) if (card and getattr(card, "tools", None)) else set()
        agent_tools = {t.name for t in getattr(agent, "tools", []) or []}
        declared = agent_tools | card_tools
        ordered = [td for td in ALL_TOOLS.values() if td.name in declared]
        # Offer MCP-bridged tools (workspace ownership is enforced at call time)
        try:
            from ..tools.executor import dynamic_tool_definitions

            for name, mcp_td in dynamic_tool_definitions().items():
                if name not in declared:
                    ordered.append(mcp_td)
        except Exception:  # noqa: BLE001 - bridging must never break the loop
            pass
        ordered = ordered[:12]
        if not ordered:
            return None
        agent_allowed_scopes = [td.required_scope for td in ordered]
        tool_schemas = [
            {"type": "function", "function": {"name": td.name, "description": td.description, "parameters": td.input_schema}}
            for td in ordered
        ]

        # Render structured system prompt with safety boundaries, profile, and contracts
        if hasattr(agent, "get_system_prompt"):
            system_content = agent.get_system_prompt(context=context)
        elif card and hasattr(card, "render_system_prompt"):
            system_content = card.render_system_prompt(context=context)
        else:
            system_content = (getattr(agent, "mission", "") or f"You are the {agent_name} agent.").strip()
            system_content += " You have access to tools. Call them when they help answer the user's request. After tool results, synthesise a helpful answer."

        # (messages are built after the prompt manifest so resume-replay can
        # reuse the exact same system/user content — see below.)

        # Phase B §9: PromptCompiler manifest for provenance. The compiler runs
        # over the same parts (trusted system + quarantined untrusted context)
        # and its manifest — prompt_id/version, layers, budget, content hash,
        # injection flag — is attached to results. Message content is unchanged
        # (no behavior change); the manifest makes construction deterministic
        # enough for replay/provenance.
        try:
            from ..services.prompt_compiler import PromptCompiler, PromptLayers
            _tool_desc = "\n".join(f"- {td.name}: {td.description}" for td in ordered[:12])
            _layers = PromptLayers(
                platform_policy="Vaeloom agent runtime: least-privilege tools, approval gates, workspace isolation.",
                safety_policy="\n".join(getattr(card, "safety_guidelines", []) or []) if card else "",
                agent_contract=getattr(card, "description", "") or getattr(agent, "mission", ""),
                task_contract=message[:2000],
                user_intent=message[:2000],
                memory_context="",
                evidence="",
                tool_context=_tool_desc,
                observations="",
                current_state="",
                output_contract=json.dumps(getattr(card, "output_schema", {}) or {})[:2000] if card else "",
            )
            _compiled = PromptCompiler().compile(
                _layers, agent_name=agent_name,
                agent_version=getattr(card, "version", "v1.0") if card else "v1.0",
                task_type=agent_name,
                untrusted_sources={"tool_context": "tool-registry", "evidence": "rag_context"},
            )
            prompt_manifest = {**_compiled.manifest, "compiled": True}
        except Exception as _pc_exc:
            logger.debug(f"PromptCompiler manifest skipped: {_pc_exc}")

        # Loop budget: configurable max rounds per card or global setting
        card_max = getattr(card, "max_react_rounds", None) if card else None
        max_rounds = max(1, int(card_max or getattr(settings, "agent_max_react_rounds", 5) or 5))

        # Resume-from-checkpoint (§17): replay fully-recorded rounds WITHOUT
        # re-executing tools. A crashed run continues; completed side effects
        # are never replayed (executor durable idempotency is the second net).
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": message},
        ]
        _replayed_fps: list[str] = []
        if state is not None and request_id:
            try:
                _replayed, _done = build_resume_messages(
                    getattr(state, "phases", {}) or {}, request_id, system_content, message)
                if _replayed is not None:
                    messages = _replayed
                    _rec.resumed = True
                    for _rm in _replayed[2:]:
                        if isinstance(_rm, dict) and _rm.get("role") == "assistant":
                            for _rtc in (_rm.get("tool_calls") or []):
                                _fn = ((_rtc.get("function") or {}).get("name", ""))
                                _ag = ((_rtc.get("function") or {}).get("arguments", {}))
                                try:
                                    from .loop_safety import tool_fingerprint as _tfp
                                    _replayed_fps.append(_tfp(_fn, _ag if isinstance(_ag, dict) else {}))
                                except Exception:
                                    pass
                    _rec.tool_calls = len(_replayed_fps)
                    logger.info(f"REACT_RESUME correlation={corr} run={run_id} replayed={len(_replayed_fps)} rounds (no re-execution)")
            except Exception as _re:
                logger.debug(f"ReAct resume skipped: {_re}")

        # Inner-run safety tracker: repeat/cycle + budget detection scoped to
        # this ReAct execution (the outer loop tracks outer iterations only).
        from .loop_safety import LoopSafetyTracker
        _tracker = LoopSafetyTracker(
            max_iterations=max_rounds,
            max_tool_calls=_max_tools,
            max_tokens=_max_tokens,
            max_cost_usd=float(_run_budgets.get("max_cost_usd", 0.50)),
            max_duration_s=float(_run_budgets.get("max_duration_s", 120.0)),
        )
        try:
            for _fp in _replayed_fps:
                _tracker.tool_fingerprints.append(_fp)
                _tracker.tool_calls += 1
        except Exception:
            pass
        _consecutive_denials = 0
        _tokens_est = 0
        try:
            _tokens_est = estimate_tokens(system_content + message)
        except Exception:
            pass

        for _round in range(max_rounds):
            # ── Durable cancellation first: no new side effects after cancel.
            if await check_react_cancel(request_id):
                logger.info(f"REACT_CANCELLED correlation={corr} run={run_id} round={_round}")
                return await _terminal_card("ReAct run cancelled by user request.", "cancelled")
            _rec.rounds += 1
            # ── Wall-clock / tool-call / token budgets (deterministic stops).
            if _rt.monotonic() >= _deadline:
                return await _terminal_card(f"ReAct run exceeded wall-clock budget ({_run_budgets.get('max_duration_s')}s).", "budget_time")
            if _rec.tool_calls >= _max_tools:
                return await _terminal_card(f"ReAct run exceeded tool-call budget ({_max_tools}).", "budget_tools")
            if _tokens_est >= _max_tokens:
                return await _terminal_card(f"ReAct run exceeded token budget ({_max_tokens}).", "budget_tokens")
            # ── Repeat/cycle detection: the model must never loop forever.
            try:
                if _tracker.detect_cycle() == "cycle_detected":
                    return await _terminal_card("ReAct run stopped: repeated action cycle detected with no progress.", "cycle")
            except Exception:
                pass
            # Per-round spend re-check: every round burns an LLM call. On
            # exhaustion return the card directly (NOT None) so we don't fall
            # through to static dispatch and spend more. Round 0 already passed
            # the act-phase gate.
            if _round > 0:
                ceiling_msg, ceiling_kind = await _check_spend_and_quota(workspace_id, agent_name)
                if ceiling_msg:
                    return await _terminal_card(ceiling_msg, ceiling_kind)
            # Context bound: compact history before every provider call.
            try:
                messages, _compacted = compact_messages(messages)
                if _compacted:
                    _rec.compacted = True
            except Exception:
                pass
            # Streaming round — real text deltas forwarded via on_token as they arrive
            content_str = ""
            tool_calls: list[dict[str, Any]] = []
            _round_model = _rec.model_name
            _round_provider = _rec.model_provider
            try:
                async for evt in llm_service.generate_completion_with_tools_stream(
                    messages=messages, tools=tool_schemas,
                    user_id=user_id, workspace_id=workspace_id, db=db,
                    correlation_id=corr,
                ):
                    etype = evt.get("type")
                    if etype == "text_delta":
                        delta = evt.get("text", "")
                        content_str += delta
                        if on_token and delta:
                            try:
                                on_token(delta)
                            except Exception:
                                pass
                    elif etype == "tool_calls":
                        tool_calls = evt.get("tool_calls") or []
                    elif etype == "done":
                        pass
            except Exception as e:
                # Per-round provider failover (§18): the stream path is
                # single-attempt by design (a mid-stream hop would corrupt
                # tokens). On RETRYABLE provider failures, take exactly one
                # buffered round through generate_completion_with_tools — the
                # completed cross-provider fallback chain — and continue the
                # loop. Terminal failures fall through to static (None).
                _fell_back = False
                try:
                    from ..services.llm_service import _classify_exc
                    _pol = _classify_exc(e)
                    _rec.failure_category = _pol.get("category")
                    logger.warning(f"ReAct LLM stream failed (round {_round}): {e} category={_pol.get('category')} terminal={_pol.get('terminal')}")
                    if not _pol.get("terminal"):
                        from ..services.llm_service import llm_service as _fb_llm
                        _fb = await _fb_llm.generate_completion_with_tools(
                            messages=messages, tools=tool_schemas, temperature=0.7,
                            user_id=user_id, workspace_id=workspace_id, db=db,
                            correlation_id=corr,
                        )
                        _fell_back = True
                        _rec.provider_fallbacks += 1
                        _round_model = str(_fb.get("model") or _round_model)
                        try:
                            from ..services.llm_service import _infer_provider_from_model as _ipm
                            _round_provider = _ipm(_round_model)
                        except Exception:
                            pass
                        _fb_content = _fb.get("content", "")
                        if isinstance(_fb_content, list):
                            content_str = " ".join(b.get("text", "") for b in _fb_content if isinstance(b, dict))
                        else:
                            content_str = str(_fb_content or "")
                        tool_calls = _fb.get("tool_calls") or []
                except Exception as _fbe:
                    logger.warning(f"ReAct fallback round failed: {_fbe}")
                if not _fell_back and not tool_calls and not content_str.strip():
                    await _finish("provider_down", None)
                    return None
                # If the buffered round produced tool calls, fall through to
                # the tool-execution section below with them.

            # Token estimate for the run budget (streams carry no usage block).
            try:
                _tokens_est += estimate_tokens(content_str)
            except Exception:
                pass

            # No tool calls → LLM produced direct answer
            if not tool_calls:
                if content_str.strip():
                    parsed_json = None
                    cleaned = content_str.strip()
                    if cleaned.startswith("```json"):
                        cleaned = cleaned[7:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()
                    elif cleaned.startswith("```"):
                        cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]
                        cleaned = cleaned.strip()

                    if cleaned.startswith("{") and cleaned.endswith("}"):
                        try:
                            parsed_json = json.loads(cleaned)
                        except Exception:
                            parsed_json = None

                    if parsed_json and isinstance(parsed_json, dict):
                        # Structured-output gate (Phase B §11): validation controls
                        # flow. Invalid output gets one repair round with the
                        # errors fed back; persistent failure is an explicit
                        # validation failure, never a silent success.
                        _ok, _errs = True, []
                        try:
                            if hasattr(agent, "validate_output"):
                                _ok, _errs = agent.validate_output(parsed_json)
                            elif card and hasattr(card, "validate_output"):
                                _ok, _errs = card.validate_output(parsed_json)
                        except Exception as _ve:
                            _ok, _errs = False, [str(_ve)]
                        if not _ok:
                            logger.warning(f"ReAct: structured validation failed for {agent_name}: {_errs} — repair round")
                            messages.append({"role": "assistant", "content": content_str or None, "tool_calls": []})
                            messages.append({"role": "user", "content": (
                                "Your previous response failed output validation with these errors:\n"
                                + "\n".join(f"- {e}" for e in _errs[:5])
                                + "\nRespond with corrected JSON matching the output contract."
                            )})
                            try:
                                from ..services.llm_service import llm_service as _repair_llm
                                _repair = await _repair_llm.generate_completion(
                                    messages=messages, temperature=0.0, max_tokens=800,
                                    user_id=user_id, workspace_id=workspace_id, db=db,
                                    correlation_id=correlation_id,
                                )
                                _repaired = (_repair.get("content") or "").strip()
                                if _repaired.startswith("{") and _repaired.endswith("}"):
                                    try:
                                        parsed_json = json.loads(_repaired)
                                    except Exception:
                                        pass
                                    else:
                                        try:
                                            if hasattr(agent, "validate_output"):
                                                _ok, _errs = agent.validate_output(parsed_json)
                                            elif card and hasattr(card, "validate_output"):
                                                _ok, _errs = card.validate_output(parsed_json)
                                        except Exception as _ve2:
                                            _ok, _errs = False, [str(_ve2)]
                            except Exception as _re:
                                logger.warning(f"ReAct: validation repair call failed: {_re}")
                            if not _ok:
                                return await _terminal_card(
                                    "Response validation failed — output did not match the agent contract.",
                                    "validation_failed",
                                    extra={"validation_errors": _errs[:10]},
                                )

                        if "summary" in parsed_json or "proposals" in parsed_json:
                            return await _finish("answered_structured", {
                                "agent_name": agent_name,
                                "action": parsed_json.get("action", getattr(card, "autonomy", "suggest") if card else "suggest"),
                                "confidence": 0.92,
                                "result": parsed_json if "summary" in parsed_json else {
                                    "summary": parsed_json.get("summary", content_str[:800]),
                                    "details": parsed_json.get("details", content_str),
                                    "proposals": parsed_json.get("proposals", []),
                                    "questions": parsed_json.get("questions", []),
                                },
                                "prompt_manifest": prompt_manifest,
                            })

                    return await _finish("answered", {
                        "agent_name": agent_name,
                        "action": getattr(card, "autonomy", "suggest") if card else "suggest",
                        "confidence": 0.88,
                        "result": {"summary": content_str[:800], "details": content_str, "proposals": [], "questions": []},
                        "prompt_manifest": prompt_manifest,
                    })
                await _finish("failure", None)
                return None

            # Execute each tool call sequentially (preserving order) through the
            # full enforcement ladder. Model proposals are untrusted input.
            from .react_policy import (
                REACT_CHECKPOINT_OBS_CHARS as _OBS_CAP,
                validate_tool_arguments as _validate_args,
            )
            from .loop_safety import tool_fingerprint as _tool_fp

            async def _snapshot_running() -> None:
                if state is None or not request_id:
                    return
                try:
                    state.add_phase(f"react_run_{request_id}",
                                    {"status": "running", "run_id": str(run_id),
                                     "agent": agent_name, "rounds": list(_round_records)})
                    await _save_react_checkpoint(state)
                except Exception as _se:
                    logger.debug(f"ReAct running checkpoint skipped: {_se}")

            def _record_round(tname: str, tc_id: str, fp: str, args_red: Any,
                              status: str, observation: str, assistant_text: str) -> None:
                try:
                    _obs = str(observation or "")
                    if len(_obs) > _OBS_CAP:
                        _obs = _obs[:_OBS_CAP] + " …[checkpoint-truncated]"
                    _obs_red, _ = redact_secrets(_obs)
                    try:
                        _args_blob = json.dumps(args_red, default=str)
                        _args_stored: Any = args_red if len(_args_blob) <= 2000 else {"_truncated": True, "fp": fp}
                    except Exception:
                        _args_stored = {"_truncated": True, "fp": fp}
                    _asst = str(assistant_text or "")
                    if len(_asst) > 2000:
                        _asst = _asst[:2000] + " …[checkpoint-truncated]"
                    _asst_red, _ = redact_secrets(_asst)
                    _round_records.append({
                        "tool": tname, "tool_call_id": tc_id, "args_fp": fp,
                        "args_redacted": _args_stored, "result_status": status,
                        "observation": _obs_red if isinstance(_obs_red, str) else str(_obs_red),
                        "assistant_text": _asst_red if isinstance(_asst_red, str) else str(_asst_red),
                        "model": _round_model, "provider": _round_provider,
                        "at": __import__("datetime").datetime.now(__import__("datetime").UTC).isoformat(),
                    })
                except Exception as _rre:
                    logger.debug(f"ReAct round record skipped: {_rre}")

            for tc in tool_calls:
                # Durable cancellation before every consequential step.
                if await check_react_cancel(request_id):
                    logger.info(f"REACT_CANCELLED correlation={corr} run={run_id} during-tools")
                    return await _terminal_card("ReAct run cancelled by user request.", "cancelled")
                if _rt.monotonic() >= _deadline:
                    return await _terminal_card("ReAct run exceeded wall-clock budget.", "budget_time")
                if _rec.tool_calls >= _max_tools:
                    return await _terminal_card(f"ReAct run exceeded tool-call budget ({_max_tools}).", "budget_tools")
                func = tc.get("function", {}) or {}
                tname = func.get("name", "")
                tc_id = tc.get("id", tname) or tname
                args = func.get("arguments", {})
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}
                if not isinstance(args, dict):
                    args = {}
                # SSE/budget honesty: _seen_tool_calls feeds outer-budget
                # accounting + SSE tool_start events, so entries are appended
                # ONLY when execution is actually attempted below (denied /
                # unknown / rejected / paused proposals never "started").
                # The checkpoint ledger records every proposal regardless.
                # Merged lookup: static ALL_TOOLS ∪ dynamic MCP — fixes bug where mcp__* tools
                # were offered in tool_schemas but missed here (were incorrectly skipped).
                try:
                    from ..tools.executor import get_tool_definition as _get_td
                    td = _get_td(tname)
                except Exception:
                    td = ALL_TOOLS.get(tname)
                if not td:
                    logger.warning(f"ReAct: unknown tool '{tname}' requested by LLM — skipping")
                    # Feed back an error so LLM can self-correct in next round
                    messages.append({"role": "assistant", "content": content_str or None, "tool_calls": [tc]})
                    messages.append({"role": "tool", "tool_call_id": tc_id, "content": json.dumps({"status": "error", "tool": tname, "result": f"Unknown tool '{tname}' — not in available tool list"})[:4000]})
                    try:
                        _fp0 = _tool_fp(tname, {})
                        _tracker.tool_fingerprints.append(_fp0)
                        _record_round(tname, tc_id, _fp0, {}, "unknown_tool",
                                      f"Unknown tool '{tname}' — not in available tool list", content_str)
                        await _snapshot_running()
                    except Exception:
                        pass
                    continue
                # ── Argument validation (§8): schema/types/required/binding/size.
                _ok_args, _clean_args, _arg_errs = _validate_args(
                    td, args, workspace_id=str(workspace_id), tenant_id=_tenant, user_id=user_id)
                if not _ok_args:
                    logger.warning(f"ReAct: tool '{tname}' arguments rejected: {_arg_errs}")
                    try:
                        state.record_policy("react_arg_rejected", f"{tname}: {'; '.join(_arg_errs)[:300]}") if state is not None else None
                    except Exception:
                        pass
                    messages.append({"role": "assistant", "content": content_str or None, "tool_calls": [tc]})
                    messages.append({"role": "tool", "tool_call_id": tc_id, "content": json.dumps({"status": "error", "tool": tname, "result": f"Invalid arguments: {'; '.join(_arg_errs[:4])}"})[:4000]})
                    try:
                        _fp1 = _tool_fp(tname, args if isinstance(args, dict) else {})
                        _tracker.tool_fingerprints.append(_fp1)
                        _record_round(tname, tc_id, _fp1, {}, "arg_rejected",
                                      f"Invalid arguments: {'; '.join(_arg_errs[:4])}", content_str)
                        await _snapshot_running()
                    except Exception:
                        pass
                    continue
                args = _clean_args
                # Enforce least-privilege: LLM output is untrusted, check against agent's allowed scopes (PATI/OWASP LLM06)
                from ..tools.executor import check_permission
                allowed = await check_permission(agent_allowed_scopes, td.required_scope)
                if not allowed:
                    logger.warning(f"ReAct: tool '{tname}' denied — scope {td.required_scope} not in agent allowed {agent_allowed_scopes}")
                    result = {"status": "error", "tool": tname, "result": f"Permission denied: scope {td.required_scope} not allowed for agent {agent_name}"}
                else:
                    # Enforceable AgentContract (Phase B §8): the runtime contract's
                    # tool allow-list is checked here, on the live path — a denied
                    # tool is never executed, regardless of what the LLM requested.
                    # The runtime contract is synthesized from the AgentCard +
                    # agent-declared tools (real tool names), never the doc seeds.
                    _contract_denied: str | None = None
                    try:
                        _contract = _runtime_contract(agent_name, agent)
                        if _contract is not None:
                            _contract.check_tool(tname)
                    except Exception as _ce:
                        from ..services.agent_contracts import ContractViolation as _CV
                        if isinstance(_ce, _CV):
                            logger.warning(f"ReAct: contract denial for {agent_name}/{tname}: {_ce}")
                            _contract_denied = f"Contract denied: {tname} not allowed for agent {agent_name}"
                        else:
                            logger.debug(f"ReAct: contract check skipped: {_ce}")
                    if _contract_denied is not None:
                        result = {"status": "error", "tool": tname, "result": _contract_denied}
                    else:
                        # Approval parity with the static path (§14): consume a
                        # pre-existing approval for this exact tool+args, else
                        # create a PENDING request and pause with a durable card.
                        # Revalidation is inherent: execution happens only after
                        # an atomic consume + hash/HMAC verify at this moment.
                        from ..tools.executor import approval_gated_tools

                        if tname in approval_gated_tools():
                            _appr = await _react_approval_gate(
                                tname, args, agent_name, str(workspace_id), user_id, db, corr)
                            if _appr.get("approved"):
                                _rec.approvals_consumed += 1
                                try:
                                    if state is not None:
                                        state.approvals_consumed.append(str(_appr.get("approval_id") or ""))
                                except Exception:
                                    pass
                                try:
                                    _seen_tool_calls.append({"id": tc_id, "type": "function",
                                                             "function": {"name": tname, "arguments": args}})
                                except Exception:
                                    pass
                                try:
                                    result = await _exec_tool(td, args, agent_id=agent_name, agent_scopes=agent_allowed_scopes, workspace_id=workspace_id)
                                except Exception as e:
                                    from .react_policy import classify_tool_failure as _ctf
                                    _cls, _why = _ctf(e)
                                    result = {"status": "error", "tool": tname, "result": str(e)[:2000], "failure_class": _cls}
                            elif _appr.get("approval_id"):
                                _rec.approvals_requested += 1
                                try:
                                    if state is not None:
                                        state.record_policy("react_approval_requested",
                                                            f"{tname}:{_appr.get('approval_id')}")
                                except Exception:
                                    pass
                                logger.info(f"REACT_APPROVAL_PAUSE correlation={corr} run={run_id} tool={tname} approval={_appr.get('approval_id')}")
                                try:
                                    _record_round(tname, tc_id, _tool_fp(tname, args), args,
                                                  "approval_pending",
                                                  f"Tool '{tname}' requires approval — awaiting approval.",
                                                  content_str)
                                except Exception:
                                    pass
                                _pause: dict[str, Any] = {
                                    "agent_name": agent_name,
                                    "action": "request_approval",
                                    "confidence": 0.9,
                                    "result": {
                                        "summary": f"Tool '{tname}' requires approval — awaiting approval.",
                                        "details": None,
                                        "proposals": [{"tool": tname, "approval_id": _appr.get("approval_id"),
                                                       "requires_approval": True, "approval_type": tname}],
                                        "questions": [],
                                    },
                                    "prompt_manifest": prompt_manifest,
                                    "approval": {"approval_id": _appr.get("approval_id"), "tool": tname, "status": "pending"},
                                }
                                return await _finish("approval_paused", _pause, snapshot_status="awaiting_approval")
                            else:
                                result = {"status": "error", "tool": tname, "result": f"Approval required for {tname} — approval service unavailable, refusing (fail-closed)"}
                        else:
                            try:
                                _seen_tool_calls.append({"id": tc_id, "type": "function",
                                                         "function": {"name": tname, "arguments": args}})
                            except Exception:
                                pass
                            try:
                                result = await _exec_tool(td, args, agent_id=agent_name, agent_scopes=agent_allowed_scopes, workspace_id=workspace_id)
                            except Exception as e:
                                from .react_policy import classify_tool_failure as _ctf
                                _cls, _why = _ctf(e)
                                result = {"status": "error", "tool": tname, "result": str(e)[:2000], "failure_class": _cls}
                # Post-execution bookkeeping: fingerprints, budgets, mirror, checkpoint.
                _status = str(result.get("status", "error"))
                try:
                    _fp2 = _tool_fp(tname, args)
                    _tracker.tool_fingerprints.append(_fp2)
                    _tracker.tool_calls += 1
                    _rec.tool_calls += 1
                    try:
                        _tokens_est += estimate_tokens(json.dumps(result, default=str)[:8000])
                    except Exception:
                        pass
                    if _status != "success":
                        _rec.tool_failures += 1
                    else:
                        _consecutive_denials = 0
                    if _status == "error" and ("denied" in str(result.get("result", "")).lower()
                                              or "not allowed" in str(result.get("result", "")).lower()):
                        _consecutive_denials += 1
                    if state is not None:
                        try:
                            state.record_tool_call(tname, _fp2, _status)
                        except Exception:
                            pass
                except Exception:
                    _fp2 = ""
                if _consecutive_denials >= 3:
                    try:
                        if state is not None:
                            state.record_policy("react_policy_stop", f"{tname} denied x3")
                    except Exception:
                        pass
                    return await _terminal_card(f"ReAct run stopped: tool '{tname}' repeatedly denied by policy.", "policy_denied")
                # Feed tool result back to LLM — TOOL-002: sanitize tool output, never treat as instructions
                # OpenAI expects assistant with tool_calls + tool role; Anthropic uses tool_result blocks — we add both forms for compat
                try:
                    from ..utils.sanitize import looks_like_prompt_injection, sanitize_tool_output

                    raw_tool_str = json.dumps(result)
                    if looks_like_prompt_injection(raw_tool_str):
                        logger.warning(f"ReAct: tool '{tname}' output flagged as potential prompt injection — sanitizing")
                    sanitized_content = sanitize_tool_output(raw_tool_str, tool_name=tname)
                except Exception:
                    sanitized_content = json.dumps(result)[:4000]
                try:
                    from ..services.prompt_compiler import quarantine
                    quarantined_tool_output, _ = quarantine(sanitized_content, source=f"tool:{tname}")
                except Exception:
                    quarantined_tool_output = f"<untrusted-data source=\"tool:{tname}\">\n{sanitized_content}\n</untrusted-data>"
                messages.append({"role": "assistant", "content": content_str or None, "tool_calls": [tc]})
                messages.append({"role": "tool", "tool_call_id": tc_id, "content": quarantined_tool_output})
                # Durable per-tool checkpoint (resume replays, never re-executes).
                try:
                    if state is not None:
                        try:
                            state.record_observation(quarantined_tool_output)
                        except Exception:
                            pass
                    _record_round(tname, tc_id, _fp2, args, _status, quarantined_tool_output, content_str)
                    await _snapshot_running()
                except Exception:
                    pass
                # Keep content for next round's synthesis

            # Loop continues — LLM will synthesise after seeing tool outputs
            try:
                _obs_tail = ""
                for _m in reversed(messages):
                    if isinstance(_m, dict) and _m.get("role") == "tool":
                        _obs_tail = str(_m.get("content", ""))
                        break
                if _obs_tail:
                    from .loop_safety import fingerprint as _fp3
                    _tracker.observation_fingerprints.append(_fp3(_obs_tail))
                    if _tracker.detect_no_progress(len(_round_records)) == "no_progress":
                        return await _terminal_card("ReAct run stopped: no progress across tool observations.", "no_progress")
            except Exception:
                pass
        # Rounds exhausted without an answer: deterministic stop. Returning None
        # claims nothing and lets the static ladder attempt the task.
        await _finish("max_rounds", None)
        return None
    except Exception as e:
        logger.warning(f"ReAct loop exception: {e}")
        try:
            await _finish("failure", None)
        except Exception:
            pass
        return None


# ── Act ─────────────────────────────────────────────────────────────

async def act_phase(plan: dict[str, Any], request: AgentRequest, on_token: Any = None, state: Any | None = None) -> dict[str, Any]:
    # Otel span for act phase (mirrors plan_phase)
    _act_cm = None
    try:
        from ..infrastructure.agent_observability import agent_span as _act_span
        _act_cm = _act_span("loop.act", agent=request.agent_name)
    except Exception:
        _act_cm = None
    if _act_cm is None:
        import contextlib as _cl2
        _act_cm = _cl2.nullcontext()
    with _act_cm:
        return await _act_phase_inner(plan, request, on_token, state)


async def _act_phase_inner(plan: dict[str, Any], request: AgentRequest, on_token: Any = None, state: Any | None = None) -> dict[str, Any]:
    agent = request.agent
    message = plan.get("message", request.message)
    # Enrich message with RAG context if available (plan_phase injected it)
    # Context engineering cap: keep RAG prompt at most 2000 chars to prevent explosion
    context_prompt = plan.get("context_prompt", "")
    if context_prompt:
        try:
            from ..infrastructure.context_budget import calculate_budget, truncate_text_to_tokens

            budget = calculate_budget(total_budget=8192)
            context_prompt = truncate_text_to_tokens(context_prompt, max_tokens=budget.rag_cap)
        except Exception:
            if len(context_prompt) > 2000:
                context_prompt = context_prompt[:2000] + " …[truncated context]"
        try:
            from ..services.prompt_compiler import quarantine
            quarantined_ctx, _ = quarantine(context_prompt, source="rag_context")
        except Exception:
            quarantined_ctx = f"<untrusted-data source=\"rag_context\">\n{context_prompt}\n</untrusted-data>"
        message = f"{message}\n\n[Context from knowledge graph & documents:\n{quarantined_ctx}]"
    agent_type = type(agent).__name__
    agent_name = request.agent_name

    logger.info(f"ACT: dispatching to {agent_type}")

    # ── Rate limit check ────────────────────────────────────────
    # P1 (ReAct productionization): EVERY post-acquire return path must
    # release exactly once. The ReAct-success and ceiling early-returns below
    # used to bypass the static path's finally-release, leaking one
    # concurrency slot per successful ReAct act (self-DoS after 5 calls).
    _act_released = False

    async def _act_release_once() -> None:
        nonlocal _act_released
        if _act_released:
            return
        _act_released = True
        try:
            await _rate_limiter.release(agent_name)
        except Exception:
            pass

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

    # ── Spend & quota gate (Wave 1) — one check covers static + ReAct + stream ──
    ceiling_msg, ceiling_kind = await _check_spend_and_quota(request.workspace_id, agent_name)
    if ceiling_msg:
        await _act_release_once()
        return _ceiling_error_card(agent_name, ceiling_msg, ceiling_kind)

    # ── MODEL-001: auto-route per-agent task_type → model hint (logged, does not override explicit model)
    try:
        from ..services.model_router import AGENT_TASK_TYPE_MAP, TASK_MODEL_MAP, model_router

        task_hint = AGENT_TASK_TYPE_MAP.get(agent_name, "document_summarize")
        tier_hint = TASK_MODEL_MAP.get(task_hint, "balanced")
        logger.debug(f"MODEL ROUTE: agent={agent_name} hint={task_hint}→{tier_hint}")
        # Hint is surfaced via log/metric; llm_service will use its own selection when task_type is threaded
    except Exception:
        pass

    # ── Dynamic ReAct (LLM-driven tool calling) — opt-in via AGENT_REACT_ENABLED ──
    # Static dispatch below is the deterministic primary path; ReAct is best-effort.
    if settings.agent_react_enabled:
        try:
            agent_context = plan.get("agent_context")
            react_result = await _try_react_loop(
                agent,
                message,
                request.workspace_id,
                agent_name,
                on_token=on_token,
                context=agent_context,
                user_id=getattr(request, "user_id", None),
                db=getattr(request, "db", None),
                correlation_id=getattr(request, "correlation_id", None),
                request_id=str(getattr(request, "id", "")) or None,
                state=state,
                tenant_id=getattr(request, "tenant_id", None),
            )
            if react_result is not None:
                logger.info(f"ACT: ReAct loop succeeded for {agent_name}")
                await _act_release_once()
                return react_result
        except Exception as e:
            logger.warning(f"ReAct dispatch failed, falling back to static: {e}")

    # ── Circuit breaker + timeout (static dispatch fallback) ─────
    # Convergence note (ADR-037): static path now mirrors executor audit/timeout
    # semantics so both tiers share permission + observability. Future: route
    # static via execute_tool with a synthetic ToolDefinition per agent.
    cb = _get_circuit_breaker(agent_name)
    timeout = settings.agent_timeout_seconds
    import time as _time

    _static_start = _time.monotonic()
    # Helper to emit unified audit (mirrors executor._audit_log)
    def _audit_static(success: bool, err: str | None = None):
        try:
            from ..tools.executor import _audit_log as _exec_audit
            _exec_audit(agent_name, f"agent:{agent_type}", request.workspace_id, success, int((_time.monotonic() - _static_start) * 1000), err)
        except Exception:
            pass

    try:
        agent_context = plan.get("agent_context")
        result = await asyncio.wait_for(
            cb.call(_dispatch_agent(agent_type, agent, message, request, context=agent_context)),
            timeout=timeout,
        )
        # Audit success — log action + summary size, never payload
        try:
            _audit_static(True, None)
            logger.info(f"AUDIT static_success agent={agent_name} type={agent_type} action={result.get('action')} workspace={request.workspace_id}")
        except Exception:
            pass
        return result
    except CircuitBreakerOpenError:
        _audit_static(False, "circuit_open")
        logger.warning(f"Circuit breaker OPEN for {agent_name}, using fallback")
        return await agent.fallback()
    except TimeoutError:
        _audit_static(False, f"timeout_{timeout}s")
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
        _audit_static(False, "rate_limited")
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
        _audit_static(False, str(exc)[:200])
        logger.exception(f"ACT phase failed: {exc}")
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"Execution error: {exc}", "details": None, "proposals": [], "questions": []},
        }
    finally:
        await _act_release_once()


def _dispatch_agent(agent_type: str, agent: BaseAgent, message: str, request: AgentRequest, context: Any | None = None):
    """Return a coroutine for the given agent type (used by circuit breaker).

    Handles all 8 canonical MVP agents + 14 enterprise agents.
    Enterprise routing uses both class-name (agent_type) and registry key (request.agent_name)
    for robustness whether the caller used explicit routing or classification.
    """
    # Normalise for enterprise routing: registry key is lower-case (career, github, etc.)
    registry_key = (request.agent_name or "").lower()
    msg_lower = message.lower()
    keywords = [w for w in message.split() if len(w) > 2]

    # ── Zero-Trust Agent Authorization Gate (AgentCard convergence) ──────
    from .card_registry import card_registry, get_agent_card
    card_name = request.agent_name or registry_key or agent_type
    card = getattr(agent, "card", None) or get_agent_card(card_name)
    if card is None:
        card = card_registry.get(registry_key) or card_registry.get(agent_type)
    if card is None:
        card = card_registry.get_or_create(card_name, agent)

    if card:
        card_status = getattr(card, "status", None) or (card.metadata.get("status") if hasattr(card, "metadata") else None) or "ACTIVE"
        if card_status != "ACTIVE":
            raise PermissionError(f"Agent '{card.name}' is inactive (status={card_status})")

    # ── Enforceable runtime contract (Phase B §8) ─────────────────────
    # Static handlers are policy-coded (approval lookups per action); the
    # runtime contract adds tool-identity observability. Missing tool identity
    # does not fail closed here — dynamic tool calls are gated separately in
    # the ReAct path and at the executor boundary (Phase A).
    _contract = _runtime_contract(request.agent_name or card_name, agent)
    if _contract is None:
        logger.debug(f"No runtime contract tools for '{card_name}' — scope checks only")

    # ── Canonical MVP agents ──────────────────────────────────────────
    if agent_type == "OrganizationAgent" or registry_key == "organization":
        stable_docs = [{"filename": message}]
        # Organization file moves/renames are consequential — approval-gated per ADR-031
        async def _org_handler(has_approval: bool):
            result = await agent.execute([{"id": f"doc_{request.id}", "filename": message}])
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
        return _dispatch_with_approval(request, agent, "file_organize", _org_handler, payload={"docs": stable_docs})

    if agent_type == "ResumeAgent" or registry_key == "resume":
        # Hydrate from AgentContext if available, else keywords
        profile_skills = context.profile.get("skills") if (context and hasattr(context, "profile") and isinstance(context.profile, dict)) else None
        skill_list = profile_skills or keywords or ([message.strip()] if message.strip() else [])
        profile = {
            "name": (context.profile.get("name") if context and hasattr(context, "profile") and isinstance(context.profile, dict) else None) or "User",
            "email": (context.profile.get("email") if context and hasattr(context, "profile") and isinstance(context.profile, dict) else None) or "user@example.com",
            "education": (context.profile.get("education") if context and hasattr(context, "profile") and isinstance(context.profile, dict) else None) or [],
            "experience": (context.profile.get("experience") if context and hasattr(context, "profile") and isinstance(context.profile, dict) else None) or [],
            "skills": skill_list,
        }
        return agent.execute(profile)

    if agent_type == "ATSAgent" or registry_key == "ats":
        # Case-insensitive split on "vs"/"vs." so "Resume A VS Resume B" works (FINDING-011)
        parts = re.split(r"\s+vs\.?\s+", message, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) == 2:
            return agent.score(parts[0].strip(), parts[1].strip())
        return agent.score(message.strip(), "")

    if agent_type == "JobSearchAgent" or registry_key == "job_search":
        profile_skills = context.profile.get("skills") if (context and hasattr(context, "profile") and isinstance(context.profile, dict)) else None
        user_skills = profile_skills or keywords
        loc = None
        job_prefs = None
        if context and hasattr(context, "profile") and isinstance(context.profile, dict):
            loc = context.profile.get("location")
            job_prefs = context.profile.get("job_preferences") or context.profile.get("preferences")
        if not job_prefs and context and hasattr(context, "preferences"):
            job_prefs = context.preferences
        return agent.search(
            keywords=keywords,
            user_skills=user_skills,
            rejected_job_ids=[],
            location=loc,
            workspace_id=request.workspace_id,
            preferences=job_prefs,
        )

    if agent_type == "ApplicationAgent" or registry_key == "application":
        company_name = "Specified Company"
        match = re.search(r"\b(?:at|for)\s+([A-Z][A-Za-z0-9&]+)", message)
        if match:
            company_name = match.group(1)
        stable_job = {"title": message, "company": company_name}
        user_prof = (context.profile if context and hasattr(context, "profile") and isinstance(context.profile, dict) else None) or {"name": "User", "skills": []}
        master_res = (context.master_resume if context and hasattr(context, "master_resume") and isinstance(context.master_resume, dict) else None) or {}
        resume_str = json.dumps(master_res) if master_res else ""
        return _dispatch_with_approval(
            request,
            agent,
            "job_application",
            lambda has_approval: agent.prepare(
                job={"id": f"job_{request.id}", **stable_job}, resume_text=resume_str, user_profile=user_prof, has_approval=has_approval
            ),
            payload={"job": stable_job},
        )

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
        return _dispatch_with_approval(request, agent, "drive_sync", _drive_handler, payload={"action": "drive_sync"})

    if agent_type == "SchedulerAgent" or registry_key == "scheduler":
        return _dispatch_with_approval(
            request,
            agent,
            "calendar_write",
            lambda has_approval: agent.check_conflicts(events=[], has_approval=has_approval),
            payload={"events": []},
        )

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
        profile_skills = context.profile.get("skills") if (context and hasattr(context, "profile") and isinstance(context.profile, dict)) else None
        career_skills = profile_skills or keywords
        if any(kw in msg_lower for kw in ["gap", "missing skill", "skill gap"]):
            return agent.identify_skill_gaps(current_skills=career_skills, target_role=message[:120])
        if any(kw in msg_lower for kw in ["course", "recommend", "learn", "training"]):
            return agent.recommend_courses(skill_gaps=career_skills)
        return agent.analyze_career_path(current_role=message[:120] or "Current Role", skills=career_skills, target_role=None)

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
        rec_skills = (context.profile.get("skills") if (context and hasattr(context, "profile") and isinstance(context.profile, dict)) else None) or keywords or [message[:40]]
        rec_prefs = (
            context.profile.get("job_preferences")
            if (context and hasattr(context, "profile") and isinstance(context.profile, dict))
            else None
        ) or (context.preferences if context and hasattr(context, "preferences") else None)
        if any(kw in msg_lower for kw in ["connection", "network", "mentor"]):
            return agent.suggest_connections(profile={"title": message[:60], "industry": "General"})
        if any(kw in msg_lower for kw in ["content", "article", "curate"]):
            return agent.curate_content(interests=keywords or [message[:40]])
        return agent.match_jobs(profile={"skills": rec_skills, "experience": message[:120]}, preferences=rec_prefs)

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
        plan_exp = (context.profile.get("experience") if (context and hasattr(context, "profile") and isinstance(context.profile, dict)) else None)
        bg = (str(plan_exp) if plan_exp else None) or message[:200]
        if any(kw in msg_lower for kw in ["milestone", "milestone", "checkpoint"]):
            return agent.suggest_milestones(roadmap={"title": message[:80]}, timeline_months=12)
        if any(kw in msg_lower for kw in ["resource", "recommend"]):
            return agent.recommend_resources(topic=message[:80] or "career", skill_level="intermediate")
        return agent.build_roadmap(profile={"background": bg}, goals=[message[:120]])

    if agent_type == "MemoryConsolidatorAgent" or registry_key in ("consolidator", "memory_consolidator"):
        from ..agents.memory.consolidator import memory_consolidator
        return memory_consolidator.consolidate_trajectory(
            workspace_id=request.workspace_id,
            agent_name=request.agent_name,
            user_prompt=message,
            summary=message,
        )

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
    payload: dict | None = None,
):
    """Dispatch an agent action that requires approval lookup."""
    approval = await lookup_approval(
        workspace_id=request.workspace_id,
        agent_name=request.agent_name,
        action_type=action_type,
        payload=payload,
        consume=True,
        db=getattr(request, "db", None),
    )
    has_approval = approval is not None and approval.get("status") in ("APPROVED", "CONSUMED")
    if has_approval:
        logger.info(f"APPROVAL CONSUMED: {approval['id']} for action {action_type}")
    return await handler(has_approval)


# ── Observe ─────────────────────────────────────────────────────────

async def observe_phase(act_result: dict[str, Any]) -> dict[str, Any]:
    _cm = None
    try:
        from ..infrastructure.agent_observability import agent_span as _os
        _cm = _os("loop.observe", action=act_result.get("action", ""))
    except Exception:
        _cm = None
    if _cm is None:
        import contextlib as _cl3
        _cm = _cl3.nullcontext()
    with _cm:
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
    _cm = None
    try:
        from ..infrastructure.agent_observability import agent_span as _rs
        agent_val = getattr(request, "agent_name", "unknown")
        _cm = _rs("loop.reflect", agent=agent_val, iteration=iteration)
    except Exception:
        _cm = None
    if _cm is None:
        import contextlib as _cl4
        _cm = _cl4.nullcontext()
    with _cm:
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
    logger.info("IMPROVE: packaging final result and consolidating trajectory")

    final_summary = "Task completed"
    for i in range(2, -1, -1):
        key = f"observe_{i}"
        if key in state.phases:
            payload = state.phases[key].get("payload", {})
            final_summary = payload.get("result", {}).get("summary", "Task completed")
            break

    # Wave 5: Memory Learning Closure (Self-Improvement)
    # Best-effort by design: the primary op stays correct when learning fails,
    # but every learning outcome is explicitly observable (LEARNING_* logs +
    # learning_events ledger), never silently swallowed.
    try:
        from ..agents.memory.consolidator import memory_consolidator

        # Best-effort tenant resolution for learning binding (workspace-owned).
        _learn_tenant: str | None = None
        try:
            _db = getattr(request, "db", None)
            if _db is not None:
                from sqlalchemy import select as _sel
                from ..models.schema import Workspace as _WS
                import uuid as _uuid
                try:
                    _wrow = await _db.execute(
                        _sel(_WS.user_id).where(_WS.id == _uuid.UUID(str(request.workspace_id)))
                    )
                    _u = _wrow.scalar_one_or_none()
                    _learn_tenant = str(_u) if _u else None
                except Exception:
                    _learn_tenant = None
        except Exception:
            _learn_tenant = None
        _learn_corr = getattr(request, "correlation_id", None) or request.id
        _learn_event = f"traj:{request.id}"
        logger.info("LEARNING_IMPROVE_QUEUED correlation=%s workspace=%s agent=%s event=%s",
                    _learn_corr, str(request.workspace_id)[:8], request.agent_name, _learn_event)
        # Non-blocking trajectory consolidation into persistent workspace memory
        asyncio.create_task(
            memory_consolidator.consolidate_trajectory(
                workspace_id=request.workspace_id,
                agent_name=request.agent_name,
                user_prompt=request.message,
                summary=str(final_summary),
                event_id=_learn_event,
                tenant_id=_learn_tenant,
                correlation_id=_learn_corr,
                source="trajectory_feedback",
            )
        )
    except Exception as exc:
        logger.warning(f"LEARNING_IMPROVE_FAILED correlation={getattr(request, 'correlation_id', '?')} "
                       f"workspace={str(getattr(request, 'workspace_id', '?'))[:8]} error={exc}")

    return AgentResponse(status="success", final_result=final_summary)


# ── Escalate ────────────────────────────────────────────────────────

async def escalate_to_user(state: LoopState) -> AgentResponse:
    logger.warning("ESCALATE: max iterations exceeded")
    return AgentResponse(status="escalated", final_result="max retries exceeded")


# ── Streaming Loop — phase-by-phase SSE events ──────────────────────

from collections.abc import AsyncGenerator


async def run_agent_loop_stream(request: AgentRequest) -> AsyncGenerator[dict[str, Any], None]:
    """Streaming variant of run_agent_loop. Yields SSE-ready event dicts.

    Event types: intent, plan, act, observe, reflect, tool_start, approval_required,
    token, done, error. When ReAct is enabled and the LLM streams text deltas, `token`
    events carry REAL incremental provider output; otherwise (static dispatch) the
    final answer is typewriter-chunked as a fallback so clients always get a typewriter UX.
    Caller is responsible for mapping to SSE `event:` + `data:` framing.
    """
    logger.info(f"START stream loop: request={request.id}, agent={request.agent_name}")
    state = await load_or_create_state(request.id)

    # Emit intent classification immediately (re-emit from router context if available)
    yield {"event": "intent", "data": {"agent": request.agent_name, "request_id": str(request.id)}}

    for iteration in range(3):
        logger.info(f"--- Stream Iteration {iteration + 1}/3 ---")

        # §31 cooperative cancellation (stream path): same durable flag the
        # buffered loop honors. No new side effects after this point.
        try:
            _fresh = await load_or_create_state(request.id)
            if _fresh.cancel_requested:
                state.cancel_requested = True
                state.cancel_requested_at = _fresh.cancel_requested_at
        except Exception:
            pass
        if state.cancel_requested:
            try:
                state.terminate("cancelled", "user_cancel")
            except Exception:
                pass
            await save_checkpoint(state)
            logger.info(f"CANCELLED stream run={request.id} iter={iteration} — no further side effects")
            yield {"event": "error", "data": {"status": "cancelled", "result": "Run cancelled by user request"}}
            yield {"event": "done", "data": {"status": "cancelled", "result": "Run cancelled by user request"}}
            return

        plan = await plan_phase(request, state)
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)
        yield {"event": "plan", "data": {"iteration": iteration, "plan": plan}}

        # ── Act with live token streaming via queue pump ────────────
        # act_phase runs as a concurrent task; any on_token callbacks from the
        # streaming LLM are forwarded to the SSE consumer in real time.
        token_q: asyncio.Queue = asyncio.Queue()
        streamed_real_tokens = False

        async def _run_act(plan=plan, token_q=token_q) -> None:
            try:
                res = await act_phase(plan, request, on_token=lambda t: token_q.put_nowait(("token", t)), state=state)
            except BaseException as exc:
                token_q.put_nowait(("error", exc))
                raise
            token_q.put_nowait(("done", res))

        runner = asyncio.create_task(_run_act())
        act_result: dict[str, Any] | None = None
        try:
            while True:
                kind, payload = await token_q.get()
                if kind == "token":
                    streamed_real_tokens = True
                    yield {"event": "token", "data": {"text": str(payload)}}
                elif kind == "done":
                    act_result = payload
                    break
                else:  # error — re-raise the original exception from its task
                    await runner
                    return
        finally:
            if not runner.done():
                runner.cancel()

        if act_result is None:
            act_result = {"agent_name": request.agent_name, "action": "error", "confidence": 0.0, "result": {"summary": "Act phase produced no result"}}
        # Ceiling short-circuit (stream path mirrors run_agent_loop).
        try:
            from .state import TERMINATION_REASONS as _TR2
            _ck2 = (act_result.get("result", {}) or {}).get("_ceiling") if isinstance(act_result, dict) else None
            if _ck2 in _TR2:
                _csum = ((act_result.get("result", {}) or {}).get("summary") or f"Run stopped: {_ck2}")
                try:
                    state.terminate("failed", _ck2)
                except Exception:
                    pass
                await save_checkpoint(state)
                yield {"event": "error", "data": {"status": "failed", "result": str(_csum), "termination_reason": _ck2}}
                yield {"event": "done", "data": {"status": "failed", "result": str(_csum), "termination_reason": _ck2}}
                return
        except Exception:
            pass
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
            # QA Verification Gate: validate schema, PII, harm, and grounding before commit
            from ..agents.qa_agent.handler import QAAgent

            qa_agent = QAAgent()
            qa_res = await qa_agent.validate(act_result, context=plan.get("agent_context"))
            state.add_phase(f"qa_{iteration}", {"decision": qa_res.decision, "issues": qa_res.issues})
            await save_checkpoint(state)
            yield {"event": "qa", "data": {"iteration": iteration, "decision": qa_res.decision, "issues": qa_res.issues}}

            if qa_res.decision == "rejected" and iteration < 2:
                logger.warning(f"QA REJECTED stream iteration {iteration}: {qa_res.issues} — retrying for self-correction")
                continue

            if qa_res.decision == "rejected":
                try:
                    state.terminate("failed", "qa_failed")
                except Exception:
                    pass
                await save_checkpoint(state)
                yield {"event": "error", "data": {"status": "failed", "result": "Run failed: output did not pass verification"}}
                yield {"event": "done", "data": {"status": "failed", "result": "Run failed: output did not pass verification"}}
                return

            try:
                state.terminate("success", "success")
            except Exception:
                pass
            improve_resp = await improve_phase(state, request)
            # If the winning iteration already streamed REAL LLM tokens (ReAct path),
            # don't re-emit the full text. Static dispatch has no LLM stream →
            # typewriter-chunk the final answer so clients keep a streaming UX.
            if not streamed_real_tokens:
                final_text = str(improve_resp.final_result or "")
                chunk_size = 40
                for i in range(0, len(final_text), chunk_size):
                    yield {"event": "token", "data": {"text": final_text[i:i+chunk_size]}}
                    await asyncio.sleep(0)  # allow event loop to flush
            yield {"event": "done", "data": {"status": improve_resp.status, "result": improve_resp.final_result}}
            return

    escalated = await escalate_to_user(state)
    try:
        if not state.is_terminal:
            state.terminate("escalated", "max_iterations")
            await save_checkpoint(state)
    except Exception:
        pass
    yield {"event": "error", "data": {"status": escalated.status, "result": escalated.final_result}}
    yield {"event": "done", "data": {"status": escalated.status, "result": escalated.final_result}}


# ── Main Loop ───────────────────────────────────────────────────────

async def run_agent_loop(request: AgentRequest) -> AgentResponse:
    """Safety-wired agent loop (Phase B §3-6, §8, §13-15).

    Guarantees over the legacy counter-only loop:
    - versioned durable state with run identity + provenance manifest
    - resume: terminal states return the stored outcome without re-execution;
      completed side effects (idempotency keys) are never blindly replayed
    - hard per-run budgets (iterations/tools/tokens/cost/duration) even when
      the workspace daily budget is unlimited
    - explicit termination reasons (SUCCESS/FAILURE/NO_PROGRESS/CYCLE/
      TIMEOUT/TOKEN_BUDGET/TOOL_BUDGET/COST_BUDGET/POLICY_STOP/...)
    - structured-validation failures terminate as qa_failed, never success
    - trajectory evaluation persisted post-run (non-blocking)
    """
    from .loop_safety import LoopSafetyTracker, fingerprint as _fp
    from .state import DEFAULT_RUN_BUDGETS

    logger.info(f"START loop: request={request.id}, agent={request.agent_name}")
    state = await load_or_create_state(request.id)
    if request.workspace_id and not state.workspace_id:
        state.workspace_id = str(request.workspace_id)

    # Resume short-circuit: a terminal run must never re-execute side effects.
    if state.is_terminal and state.termination_reason:
        logger.info(f"RESUME terminal run {request.id}: {state.status}/{state.termination_reason} — no re-execution")
        final = "Task completed"
        for i in range(2, -1, -1):
            payload = (state.phases.get(f"observe_{i}", {}) or {}).get("payload", {})
            final = (payload.get("result", {}) or {}).get("summary", final)
            if final != "Task completed":
                break
        return AgentResponse(status=state.status, final_result=final, termination_reason=state.termination_reason)

    # Run identity + budgets (hard per-run ceilings; daily budget is separate).
    import hashlib as _hl
    state.run_id = state.run_id or request.id
    state.agent_id = request.agent_name or state.agent_id
    # §29: adopt caller correlation (durable so post-restart traces join).
    try:
        _corr = getattr(request, "correlation_id", None)
        if _corr and state.correlation_id in (None, "", request.id, state.run_id):
            state.correlation_id = str(_corr)
    except Exception:
        pass
    try:
        from .card_registry import get_agent_card as _gac
        _c = getattr(request.agent, "card", None) or _gac(request.agent_name or "")
        if _c is not None:
            state.agent_version = getattr(_c, "version", state.agent_version) or state.agent_version
    except Exception:
        pass
    state.goal_fingerprint = _fp(request.message)
    try:
        def _num(name: str, default: float) -> float:
            try:
                val = getattr(settings, name, None)
            except Exception:
                val = None
            if val is None:
                return default
            try:
                return float(val)
            except (TypeError, ValueError):
                return default

        run_budgets = {
            "max_iterations": _num("agent_max_iterations_per_run", 3),
            "max_tool_calls": _num("agent_max_tool_calls_per_run", 12),
            "max_tokens": _num("agent_max_tokens_per_run", 12000),
            "max_cost_usd": _num("agent_max_cost_per_run_usd", 0.50),
            "max_duration_s": _num("agent_max_duration_s", 120.0),
        }
    except Exception:
        run_budgets = dict(DEFAULT_RUN_BUDGETS)
    state.budgets = {**dict(DEFAULT_RUN_BUDGETS), **run_budgets}
    max_iters = max(1, int(state.budgets.get("max_iterations", 3)))

    tracker = LoopSafetyTracker(
        max_iterations=max_iters,
        max_tool_calls=int(state.budgets.get("max_tool_calls", 12)),
        max_tokens=int(state.budgets.get("max_tokens", 12000)),
        max_cost_usd=float(state.budgets.get("max_cost_usd", 0.50)),
        max_duration_s=float(state.budgets.get("max_duration_s", 120.0)),
    )
    # Restore tracker progress on resume (counts survive restarts via phases).
    try:
        _saved = state.phases.get("safety_tracker", {}) or {}
        tracker.tool_calls = int(_saved.get("tool_calls", 0))
        tracker.tokens_used = int(_saved.get("tokens_used", 0))
        tracker.cost_usd = float(_saved.get("cost_usd", 0.0))
        tracker.tool_fingerprints = list(_saved.get("tool_fingerprints", []))
        tracker.observation_fingerprints = list(_saved.get("observation_fingerprints", []))
        tracker.plan_fingerprints = list(_saved.get("plan_fingerprints", []))
    except Exception:
        pass
    start_iter = int(state.iteration or 0)
    if start_iter >= max_iters and not state.is_terminal:
        state.terminate("escalated", "max_iterations")
        await save_checkpoint(state)
        return AgentResponse(status=state.status, final_result="max retries exceeded",
                             termination_reason=state.termination_reason)

    for iteration in range(start_iter, max_iters):
        logger.info(f"--- Iteration {iteration + 1}/{max_iters} ---")
        state.iteration = iteration

        # §31 cooperative cancellation: re-read the durable flag so an API
        # cancel (or worker restart observing it) stops the run BEFORE any
        # further consequential step. No new side effects after this point.
        try:
            _fresh = await load_or_create_state(request.id)
            if _fresh.cancel_requested:
                state.cancel_requested = True
                state.cancel_requested_at = _fresh.cancel_requested_at
        except Exception:
            pass
        if state.cancel_requested:
            state.terminate("cancelled", "user_cancel")
            state.add_phase(f"terminated_{iteration}", {"reason": "user_cancel"})
            await save_checkpoint(state)
            logger.info(f"CANCELLED run={request.id} iter={iteration} — no further side effects")
            return AgentResponse(status=state.status,
                                 final_result="Run cancelled by user request",
                                 termination_reason=state.termination_reason)

        # Budget gate before new work (TOKEN/COST/TIMEOUT/TOOL budgets).
        _budget_hit = tracker.check_budgets()
        if _budget_hit in ("tool_budget", "token_budget", "cost_budget", "timeout"):
            state.terminate("failed", _budget_hit)
            state.add_phase(f"terminated_{iteration}", {"reason": _budget_hit, "safety": tracker.snapshot()})
            await save_checkpoint(state)
            return AgentResponse(status=state.status,
                                 final_result=f"Run stopped: {_budget_hit} budget exhausted",
                                 termination_reason=state.termination_reason)

        plan = await plan_phase(request, state)
        plan_fp = tracker.record_plan({"message": plan.get("message", ""), "agent": plan.get("agent_type", "")})
        state.plan_fingerprint = plan_fp
        # Context provenance: retrieval ids + fingerprint persisted (ids, not content).
        try:
            _rag = plan.get("rag_context", {}) or {}
            _ids = ([e.get("id") for e in _rag.get("entities", []) if e.get("id")]
                    + [d.get("id") for d in _rag.get("documents", []) if d.get("id")])
            state.retrieval_ids = _ids[:16]
            tracker.record_retrieval(state.retrieval_ids)
            try:
                from ..services.context_engine import context_fingerprint as _cf, ContextItem as _CI
                _items = [_CI(kind="memory", content=e.get("name", ""), provenance=f"ws:{state.workspace_id}:{e.get('id','')}")
                          for e in _rag.get("entities", [])[:8]]
                state.context_fingerprint = _cf(_items) if _items else ""
            except Exception:
                state.context_fingerprint = _fp(state.retrieval_ids)
            # ContextEngine manifest persisted verbatim (ids/fingerprints only).
            try:
                _cm = _rag.get("context_manifest")
                if isinstance(_cm, dict):
                    state.add_phase(f"context_manifest_{iteration}", _cm)
            except Exception:
                pass
            # Prompt manifest: compiler version + prompt version recorded for provenance.
            try:
                from ..services.prompt_compiler import COMPILER_VERSION as _cv
                state.compiler_version = _cv
            except Exception:
                pass
            try:
                from .card_registry import get_agent_card as _gac2
                _c2 = getattr(request.agent, "card", None) or _gac2(request.agent_name or "")
                if _c2 is not None:
                    state.prompt_version = f"card:{getattr(_c2, 'name', '')}@{getattr(_c2, 'version', '')}"
            except Exception:
                pass
        except Exception:
            pass
        state.add_phase(f"plan_{iteration}", plan)
        await save_checkpoint(state)

        act_result = await act_phase(plan, request, state=state)
        # Ceiling short-circuit: a spend/quota/timeout/tool/token stop carries
        # result._ceiling — terminate with the truthful reason immediately
        # instead of decaying into no_progress/escalated across retries.
        try:
            from .state import TERMINATION_REASONS as _TR
            _ck = (act_result.get("result", {}) or {}).get("_ceiling") if isinstance(act_result, dict) else None
            if _ck in _TR:
                _csummary = ((act_result.get("result", {}) or {}).get("summary") or f"Run stopped: {_ck}")
                state.terminate("failed", _ck)
                state.add_phase(f"terminated_{iteration}", {"reason": _ck})
                await save_checkpoint(state)
                logger.warning(f"CEILING run={request.id} iter={iteration} reason={_ck} — terminating")
                return AgentResponse(status=state.status, final_result=str(_csummary),
                                     termination_reason=state.termination_reason)
        except Exception as _cke:
            logger.debug(f"Ceiling check skipped: {_cke}")
        # Record tool/observation fingerprints for cycle + progress detection.
        try:
            for _tc in (act_result.get("tool_calls") or []):
                _fn = (_tc.get("function", {}) or {})
                tracker.record_tool(f"{_fn.get('name','')}:{_fp(_fn.get('arguments', {}))}")
        except Exception:
            pass
        # Completed side effects enter durable state (resume never replays them blindly).
        try:
            _res = act_result.get("result", {}) if isinstance(act_result, dict) else {}
            for _p in (_res.get("proposals", []) or []):
                if isinstance(_p, dict) and _p.get("idem_key"):
                    state.record_tool_call(str(_p.get("tool", act_result.get("agent_name", ""))), str(_p["idem_key"]), "proposed")
        except Exception:
            pass
        state.add_phase(f"act_{iteration}", act_result)
        await save_checkpoint(state)

        observe_result = await observe_phase(act_result)
        obs_fp = tracker.record_observation(observe_result.get("observation", ""))
        state.record_observation(observe_result.get("observation", ""))
        state.add_phase(f"observe_{iteration}", observe_result)
        await save_checkpoint(state)
        state.add_phase("safety_tracker", {
            "tool_calls": tracker.tool_calls, "tokens_used": tracker.tokens_used,
            "cost_usd": tracker.cost_usd, "tool_fingerprints": tracker.tool_fingerprints[-12:],
            "observation_fingerprints": tracker.observation_fingerprints[-12:],
            "plan_fingerprints": tracker.plan_fingerprints[-12:],
        })
        await save_checkpoint(state)

        # Cycle + no-progress detection (explicit termination, observable).
        if tracker.detect_cycle() == "cycle_detected":
            state.terminate("failed", "cycle_detected")
            state.add_phase(f"terminated_{iteration}", {"reason": "cycle_detected", "safety": tracker.snapshot()})
            await save_checkpoint(state)
            logger.warning(f"CYCLE detected run={request.id} iter={iteration} — terminating")
            return AgentResponse(status=state.status,
                                 final_result="Run stopped: repeated action cycle detected with no progress",
                                 termination_reason=state.termination_reason)
        if tracker.detect_no_progress(len(state.completed_tool_calls)) == "no_progress":
            state.terminate("failed", "no_progress")
            state.add_phase(f"terminated_{iteration}", {"reason": "no_progress", "safety": tracker.snapshot()})
            await save_checkpoint(state)
            logger.warning(f"NO-PROGRESS run={request.id} iter={iteration} — terminating")
            return AgentResponse(status=state.status,
                                 final_result="Run stopped: no progress across iterations",
                                 termination_reason=state.termination_reason)

        reflect_result = await reflect_phase(request, observe_result, iteration)
        state.add_phase(f"reflect_{iteration}", {
            "is_satisfied": reflect_result.is_satisfied,
            "reason": reflect_result.reason,
        })
        await save_checkpoint(state)

        if reflect_result.is_satisfied:
            # QA Verification Gate: validate schema, PII, harm, and grounding before commit
            from ..agents.qa_agent.handler import QAAgent

            qa_agent = QAAgent()
            qa_res = await qa_agent.validate(act_result, context=plan.get("agent_context"))
            state.add_phase(f"qa_{iteration}", {"decision": qa_res.decision, "issues": qa_res.issues})
            await save_checkpoint(state)

            if qa_res.decision == "rejected" and iteration < max_iters - 1:
                logger.warning(f"QA REJECTED loop iteration {iteration}: {qa_res.issues} — retrying for self-correction")
                continue

            if qa_res.decision == "rejected":
                # Validation failure is explicit — never reported as success.
                state.terminate("failed", "qa_failed")
                state.add_phase(f"terminated_{iteration}", {"reason": "qa_failed", "issues": qa_res.issues})
                await save_checkpoint(state)
                _eval_fail(state, request)
                return AgentResponse(status=state.status,
                                     final_result="Run failed: output did not pass verification",
                                     termination_reason=state.termination_reason)

            state.terminate("success", "success")
            resp = await improve_phase(state, request)
            await save_checkpoint(state)
            _eval_ok(state, request, resp)
            resp.termination_reason = state.termination_reason
            return resp

    state.terminate("escalated", "max_iterations")
    await save_checkpoint(state)
    return await escalate_to_user(state)


def _eval_ok(state, request, resp=None) -> None:
    """Persist trajectory evaluation post-run (non-blocking, Phase B §15)."""
    try:
        from ..services.trajectory_eval import evaluate_trajectory
        result = evaluate_trajectory(state.to_dict())
        state.add_phase("trajectory_eval", result)
        import asyncio as _aio
        try:
            loop = _aio.get_running_loop()
            loop.create_task(save_checkpoint(state))
        except RuntimeError:
            pass
    except Exception as exc:
        logger.debug(f"Trajectory eval skipped: {exc}")


def _eval_fail(state, request) -> None:
    try:
        from ..services.trajectory_eval import evaluate_trajectory
        result = evaluate_trajectory(state.to_dict())
        state.add_phase("trajectory_eval", result)
    except Exception as exc:
        logger.debug(f"Trajectory eval skipped: {exc}")
