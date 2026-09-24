"""
Orchestrator Router — upgraded to wire all specialist agents + QA gate.
Two-stage intent classification: coarse category -> specific agent.
"""
import logging
import time
from typing import Any

from api.agents.conversation_agent.handler import ConversationAgent
from api.agents.qa_agent.handler import QAAgent, QAValidationResult
from api.infrastructure.agent_eval import detect_adversarial_prompt
from api.infrastructure.agent_observability import (
    AgentMetric,
    agent_span,
    kill_switch,
    metrics_collector,
    workspace_limiter,
)

from .agent_discovery import agent_registry as AGENT_REGISTRY
from .loop import AgentRequest, run_agent_loop

logger = logging.getLogger(__name__)

def _is_complex_multi_agent(message: str) -> bool:
    """Quick check without importing supervisor (avoids circular)."""
    if len(message.split()) < 8:
        return False
    try:
        from .capability_registry import capability_registry
        candidates = capability_registry.resolve_candidate_capabilities(message, top_k=5)
        unique_agents = {c.agent_id for c in candidates}
        return len(unique_agents) >= 2
    except Exception:
        return False


# ── Intent Classification Categories ───────────────────────────────

CATEGORY_AGENT_MAP = {
    "document_organization": ["organization", "workspace", "document", "pdf"],
    "career_resume": ["resume", "ats"],
    "job_search": ["job_search", "application", "internship"],
    "communication": ["gmail"],
    "schedule_time": ["scheduler", "calendar"],
    "memory_extraction": ["memory"],
    "planning_research": ["planning", "research"],
    "career_development": ["career", "learning"],
    "research_github": ["research", "github"],
    "coding_interview": ["coding"],
    "reminders_analytics": ["reminder", "analytics"],
    "recommendations": ["recommendation"],
    "reflection": ["reflection", "self_improvement"],
    "security_monitoring": ["security"],
    "integrations": ["connector", "plugin", "drive"],
}

# Keywords for coarse category classification
CATEGORY_KEYWORDS = {
    "document_organization": ["organize", "file", "rename", "folder", "categorize", "duplicate", "move", "workspace", "sprawl", "hierarchy", "pdf", "synthesize", "citation"],
    "career_resume": ["resume", "cv", "bullet", "achievement", "ats", "score", "tailor"],
    "job_search": ["job", "search", "apply", "application", "internship", "fellowship", "co-op", "career", "role", "position"],
    "communication": ["email", "gmail", "inbox", "draft", "reply", "mail"],
    "schedule_time": ["schedule", "deadline", "calendar", "reminder", "conflict", "event", "meeting", "availability", "slot"],
    "memory_extraction": ["extract", "memory", "entity", "knowledge", "graph", "remember"],
    "planning_research": ["plan", "planning", "roadmap", "research", "strategy", "milestone", "goal", "research"],
    "career_development": ["career", "path", "skill", "course", "learn", "training", "certification"],
    "research_github": ["company", "industry", "trend", "github", "repository", "profile"],
    "coding_interview": ["coding", "challenge", "leetcode", "algorithm", "code review", "interview prep"],
    "reminders_analytics": ["deadline", "remind", "follow up", "analytics", "metrics", "report", "trend"],
    "recommendations": ["recommend", "suggest", "match", "curate", "similar"],
    "reflection": ["weekly", "monthly", "summary", "digest", "review", "progress", "critique", "accuracy", "benchmark"],
    "security_monitoring": ["security", "pii", "monitor", "alert", "access", "suspicious"],
    "integrations": ["connector", "plugin", "integration", "extension", "setup", "configure", "install", "drive", "google drive", "sync"],
}


class UserRequest:
    def __init__(self, request_id: str, message: str, workspace_id: str, preferred_agent: str | None = None,
                 user_id: str | None = None, tenant_id: str | None = None, correlation_id: str | None = None):
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id
        self.preferred_agent = preferred_agent
        # Trusted caller identity (populated by the API layer from auth context;
        # None in non-HTTP/test contexts — consumers must fail closed).
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.correlation_id = correlation_id or request_id


# ── Muse §7 capability-aware selection ─────────────────────────────
# Agents are never selected merely by static-dictionary name. This scorer
# ranks candidates on keyword strength + capability (ACTIVE card with tools)
# + availability (kill-switch) + cost-tier fit, and is consulted on the live
# path (tie-breaks and low-confidence arbitration). Deterministic, no LLM.

def _agent_keyword_score(agent_name: str, msg_lower: str) -> float:
    """Capability exemplar strength for the agent."""
    try:
        from .capability_registry import capability_registry
        caps = capability_registry.get_by_agent(agent_name)
        if not caps:
            return 0.0
        matched = capability_registry.resolve_candidate_capabilities(msg_lower, top_k=5)
        for idx, c in enumerate(matched):
            if c.agent_id == agent_name:
                return round(max(0.2, 1.0 - (idx * 0.2)), 3)
    except Exception:
        pass
    return 0.0


def _agent_capability(agent_name: str) -> tuple[float, str]:
    """Capability factor: ACTIVE card with declared tools scores full.

    Returns (factor, reason). Unknown agents score 0 (fail-closed signal).
    """
    try:
        from .card_registry import get_agent_card
        card = get_agent_card(agent_name)
        if card is None:
            return 0.0, "no-card"
        status = getattr(card, "status", "ACTIVE") or "ACTIVE"
        if status != "ACTIVE":
            return 0.0, f"card-{status}"
        tools = getattr(card, "tools", []) or []
        if not tools:
            return 0.4, "card-no-tools"
        return 1.0, f"card-tools-{len(tools)}"
    except Exception:
        return 0.0, "card-unreadable"


def _agent_available(agent_name: str) -> tuple[float, str]:
    """Availability factor from the kill-switch (fail-fast, no side effects)."""
    try:
        from ..infrastructure.agent_observability import kill_switch
        if kill_switch.is_enabled(agent_name):
            return 1.0, "enabled"
        return 0.0, "killed"
    except Exception:
        return 1.0, "switch-unreadable"


def _task_cost_fit(agent_name: str, msg_lower: str) -> tuple[float, str]:
    """Cost-tier fit: simple queries prefer fast-tier agents, complex prefer
    balanced/powerful. Small weight — never overrides clear keyword intent."""
    try:
        from ..services.model_router import AGENT_TASK_TYPE_MAP, TASK_MODEL_MAP
        words = len(msg_lower.split())
        complex_cues = (" and ", "compare", "multi-step", "research", "strategy", "plan")
        tier = TASK_MODEL_MAP.get(AGENT_TASK_TYPE_MAP.get(agent_name, ""), "balanced")
        if words <= 8 and not any(c in msg_lower for c in complex_cues):
            return (1.0, "simple-fast-fit") if tier == "fast" else (0.6, "simple-nonfast")
        return (1.0, "complex-tier-fit") if tier in ("balanced", "powerful") else (0.6, "complex-fast")
    except Exception:
        return 0.6, "tier-unknown"


def score_agent_candidates(message: str, candidates: list[str] | None = None) -> list[dict[str, Any]]:
    """Rank agent candidates for a message. Returns [{agent, score, reasons}]
    sorted by score desc. Score = 0.55*keyword + 0.20*capability +
    0.15*availability + 0.10*cost_fit. Availability 0 excludes the agent
    from viable picks (fail-closed); capability 0 heavily penalizes."""
    msg_lower = (message or "").lower()
    names = list(candidates) if candidates else list(AGENT_REGISTRY.keys())
    ranked: list[dict[str, Any]] = []
    for name in names:
        kw = _agent_keyword_score(name, msg_lower)
        cap, cap_why = _agent_capability(name)
        avail, avail_why = _agent_available(name)
        cost, cost_why = _task_cost_fit(name, msg_lower)
        if avail <= 0.0:
            continue  # fail-closed: killed agents are not viable picks
        score = round(0.55 * kw + 0.20 * cap + 0.15 * avail + 0.10 * cost, 3)
        if cap <= 0.0:
            score = round(score * 0.3, 3)  # unknown agents sink, never vanish
        ranked.append({"agent": name, "score": score,
                       "reasons": {"keyword": kw, "capability": f"{cap}:{cap_why}",
                                   "availability": avail_why, "cost_fit": f"{cost}:{cost_why}"}})
    ranked.sort(key=lambda r: (-r["score"], r["agent"]))
    return ranked


async def _llm_classify_intent(message: str) -> tuple[str, float] | None:
    """Classify ambiguous or low-confidence queries using Jev System 1 (<50ms) with micro-LLM fallback."""
    if not message or len(message.strip()) < 3:
        return None

    # Step 1: TypeSafe AI Jev System 1 (<50ms deterministic classifier)
    try:
        from ..services.jev_service import jev_service
        registered_agents = list(AGENT_REGISTRY.keys())
        jev_agent = await jev_service.choice(
            prompt=message,
            options=registered_agents,
            context={"system": "intent_classification"},
            require_match=True,
        )
        if jev_agent and jev_agent in AGENT_REGISTRY:
            logger.info("ROUTER_JEV_S1_CLASSIFY: query='%s' -> %s", message[:50], jev_agent)
            return jev_agent, 0.88
    except Exception as exc:
        logger.debug("Jev System 1 intent classification error: %s", exc)

    # Step 2: Micro-LLM fallback if configured
    from ..config import settings

    if not settings.llm_api_key:
        return None

    try:
        import json
        import re

        from ..services.llm_service import llm_service

        agent_desc = [
            "- conversation: general chat, questions about capabilities, greetings, ambiguous requests, emotional support or coaching",
            "- organization: file and document organization, folders, categorization",
            "- memory: remember facts, retrieve memory, notes, profile context",
            "- resume: write, improve, tailor resume bullets or CV",
            "- ats: calculate ATS match scores, detect skill gaps, format audit",
            "- job_search: find jobs, roles, openings, browse listings",
            "- application: prepare job application, cover letter, job submission",
            "- gmail: check emails, draft replies, communication",
            "- scheduler: calendar, schedule meetings, interview slots, deadlines",
            "- career: long-term career strategy, promotions, career trajectory",
            "- learning: study courses, learn skills, certifications",
            "- research: company analysis, industry insights, market research",
            "- github: GitHub repositories, pull requests, code evidence",
            "- coding: technical interview questions, algorithms, coding challenges",
            "- reminder: set reminders, deadlines, follow-ups",
            "- analytics: performance metrics, reports, statistics",
            "- recommendation: curated recommendations, career matches",
        ]
        system_prompt = (
            "You are an intent classification engine. Classify the user query into exactly one of these agents:\n"
            + "\n".join(agent_desc)
            + "\n\nRespond strictly in valid JSON: {\"agent\": \"<agent_name>\", \"confidence\": <float 0.0 to 1.0>}"
        )

        resp = await llm_service.generate_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            temperature=0.0,
            max_tokens=512,
            task_type="intent_classify",
        )
        txt = resp.get("content", "").strip()
        m = re.search(r"\{.*\}", txt, re.DOTALL)
        if m:
            data = json.loads(m.group(0))
            ag = str(data.get("agent", "")).lower()
            conf = float(data.get("confidence", 0.85))
            if ag in AGENT_REGISTRY:
                return ag, max(0.0, min(1.0, conf))
    except Exception as exc:
        logger.debug(f"Micro-LLM intent classification skipped/failed: {exc}")
    return None


async def route_intent_and_plan(message: str, workspace_id: str | None = None) -> tuple[str, float, Any | None]:
    """Primary zero-trust cognitive routing returning (selected_agent, confidence, execution_plan)."""
    try:
        from .routing import routing_engine
        env, plan = await routing_engine.route(
            query=message,
            workspace_id=workspace_id or "00000000-0000-0000-0000-000000000001",
        )
        if env and env.selected_agent:
            return env.selected_agent, env.confidence, plan
    except Exception as exc:
        logger.debug(f"ROUTER_ENGINE: routing_engine fallback to legacy heuristics: {exc}")

    ag, conf = await classify_intent(message, workspace_id=workspace_id)
    return ag, conf, None


async def classify_intent(message: str, workspace_id: str | None = None) -> tuple[str, float]:
    """Authoritative semantic intent classification via the zero-trust 6-layer RoutingEngine.

    Combines TypeSafe AI Jev System 1 with Gemma / LLM System 2.
    Falls back to legacy heuristic scoring if cognitive engine is offline.
    """
    # ── Primary: Zero-Trust 6-Layer Cognitive Routing Engine ─────────
    try:
        from .routing import routing_engine
        env, plan = await routing_engine.route(
            query=message,
            workspace_id=workspace_id or "00000000-0000-0000-0000-000000000001",
        )
        if env and env.selected_agent:
            return env.selected_agent, env.confidence
    except Exception as exc:
        logger.debug(f"ROUTER_ENGINE: routing_engine fallback to legacy heuristics: {exc}")

    msg_lower = message.lower()

    # ── Stage 0: Conversational greeting / small-talk fast-path ──────────────
    # Short social messages score zero keyword hits → fall into the low-confidence
    # clarification trap. Detect them early and route with high confidence to
    # ConversationAgent.
    # Note: Strip any leading @mention (e.g. @auto, @scheduler) or /command (e.g. /schedule)
    import re as _re
    clean_msg = _re.sub(r"^[@/]\w+\s*", "", msg_lower).strip()

    _GREETINGS = frozenset([
        "hi", "hello", "hey", "hlo", "hola", "howdy", "greetings", "sup", "yo",
        "hiya", "heyo", "heyy", "hihi", "hai", "heya", "namaste",
        "good morning", "good afternoon", "good evening", "good night",
        "how are you", "how r u", "how are u", "what's up", "whats up",
        "wassup", "wazzup", "wsp", "how's it going", "how is it going",
        "how's everything", "how's life", "how do you do",
        "bye", "goodbye", "see you", "later", "take care", "cya", "ttyl",
        "thanks", "thank you", "thx", "ty", "cheers",
    ])
    _stripped = clean_msg.rstrip("!?.,'\"")
    if _stripped in _GREETINGS:
        logger.info(f"ROUTER_GREETING: query='{message[:50]}' -> conversation (greeting fast-path)")
        return "conversation", 0.95
    _GREETING_PREFIXES = ("good morning", "good afternoon", "good evening", "good night", "how are", "how's")
    if any(_stripped.startswith(p) for p in _GREETING_PREFIXES):
        logger.info(f"ROUTER_GREETING_PREFIX: query='{message[:50]}' -> conversation (greeting prefix)")
        return "conversation", 0.95

    # ── Stage 0b: Psychological containment & emotional distress fast-path ──
    # Expressing burnout, anxiety, feeling overwhelmed, or job search fatigue
    # must route to ConversationAgent for Rogers OARS containment, not specialist
    # task execution (e.g. "I feel overwhelmed and stressed about job applications"
    # should NOT be treated as a job application creation request).
    _DISTRESS_KEYWORDS = (
        "overwhelmed", "stressed", "stress", "burnout", "burned out", "burnt out",
        "anxious", "anxiety", "depressed", "depression", "exhausted", "frustrated",
        "hopeless", "lost", "giving up", "give up", "imposter syndrome",
        "impostor syndrome", "panic", "panicking", "discouraged", "mental health",
        "feeling down", "stressed out", "so tired", "too much pressure",
    )
    if not message.strip().startswith(("@", "/")) and any(kw in clean_msg for kw in _DISTRESS_KEYWORDS):
        logger.info(f"ROUTER_DISTRESS: query='{message[:50]}' -> conversation (emotional containment fast-path)")
        return "conversation", 0.95

    # ── Stage 1: Dynamic Capability Resolution via Capability Registry ─────────
    try:
        from .capability_registry import capability_registry
        candidates = capability_registry.resolve_candidate_capabilities(message, top_k=5)
        if candidates:
            top_cap = candidates[0]
            top_agent = top_cap.agent_id

            has_explicit_cue = any(
                len(clean_msg) >= 3 and clean_msg in ex.lower()
                for ex in top_cap.semantic_exemplars
            )
            confidence = 0.90 if has_explicit_cue else 0.85

            try:
                _arb_cands = sorted({c.agent_id for c in candidates})
                _arb = score_agent_candidates(message, _arb_cands)
                if _arb and _arb[0]["score"] >= 0.6:
                    top_agent = _arb[0]["agent"]
                    confidence = max(confidence, min(0.95, _arb[0]["score"]))
            except Exception:
                pass

            logger.info(
                "ROUTER_CAPABILITY_RESOLVE: query='%s' -> agent=%s cap=%s conf=%.2f",
                message[:50], top_agent, top_cap.capability_id, confidence,
            )
            return top_agent, confidence
    except Exception as exc:
        logger.debug("ROUTER_CAPABILITY_ERROR: %s", exc)

    # For ambiguous or low-confidence queries, trigger micro-LLM intent calibration
    llm_match = await _llm_classify_intent(message)
    if llm_match:
        logger.info("ROUTER_LLM_CLASSIFY: query='%s' -> llm=%s (%.2f)", message[:50], llm_match[0], llm_match[1])
        return llm_match

    # Conversational partner fallback
    return "conversation", 0.85



# ── MVP scope lock (INT-02 §2.2): 10 canonical agents ───────────────
# Orchestrator + Organization, Memory, Resume, ATS, Job Search &
# Application, Gmail, Scheduler. All other repo agents (career, learning,
# research, github, coding, reminder, analytics, recommendation,
# reflection, security, connector, plugin, drive, qa) are enterprise
# extras that must not run in MVP builds (CF-05, R5/R6).

MVP_CANONICAL_AGENTS = frozenset({
    "conversation", "organization", "memory", "resume", "ats", "job_search",
    "application", "gmail", "scheduler", "planning", "research",
})

# Categories that map only to canonical agents
MVP_CATEGORY_AGENT_MAP = {
    "document_organization": ["organization"],
    "career_resume": ["resume", "ats"],
    "job_search": ["job_search", "application"],
    "communication": ["gmail"],
    "schedule_time": ["scheduler"],
    "memory_extraction": ["memory"],
    "planning_research": ["planning", "research"],
}


def _handle_out_of_scope(agent_name: str, confidence: float) -> dict[str, Any]:
    logger.info("Out-of-MVP-scope agent requested: %s", agent_name)
    return {
        "agent_name": "orchestrator",
        "action": "out_of_scope",
        "confidence": confidence,
        "result": {
            "summary": (
                f"'{agent_name}' is outside the MVP scope. "
                "Available: organization, memory, resume, ATS, job search & application, "
                "gmail, scheduler, planning and research."
            ),
            "details": None,
            "proposals": [],
            "questions": [],
        },
    }


async def _qa_gate_output(agent_output: dict[str, Any], workspace_id: str, label: str) -> dict[str, Any]:
    """Shared QA gate: up to 3 approvals, else best-effort flag + pending approvals.

    Identical semantics for supervisor and graph paths (factored to avoid a
    second gate implementation drifting).
    """
    qa = QAAgent()
    for attempt in range(3):
        qa_result: QAValidationResult = await qa.validate(agent_output)
        if qa_result.decision == "approved":
            logger.info("%s QA APPROVED (attempt %d)", label, attempt + 1)
            await _attach_pending_approvals(agent_output, workspace_id)
            return agent_output
        logger.warning("%s QA REJECTED (attempt %d): %s", label, attempt + 1, qa_result.issues)
    agent_output["qa_flag"] = "best_effort_after_retries"
    await _attach_pending_approvals(agent_output, workspace_id)
    return agent_output


async def _run_graph_branch(request: UserRequest, agent_name: str, confidence: float) -> dict[str, Any] | None:
    """LangGraph direct path (gated, opt-in). Returns None when the graph path
    is unavailable so the caller falls through to the single-agent loop
    (availability ladder — same contract as ReAct's None fallthrough).

    When the graph EXECUTES, failures are truthful terminal results (never
    silent fallback to the loop — matches the activity's failed-not-legacy rule).
    """
    try:
        from ..graph.runner import run_graph_direct, should_use_graph
    except Exception as e:
        logger.debug("graph runner unavailable: %s", e)
        return None
    try:
        if not should_use_graph(request.id):
            return None
    except Exception:
        return None
    # Trusted identity: explicit request fields win, middleware context is backup.
    user_id = getattr(request, "user_id", None)
    tenant_id = getattr(request, "tenant_id", None)
    if not user_id or not tenant_id:
        try:
            from ..middleware.tenant import TenantContext as _TC
            user_id = user_id or _TC.get_user_id()
            tenant_id = tenant_id or _TC.get_tenant_id()
        except Exception:
            pass
    logger.info(f"GRAPH direct path for request {request.id} agent={agent_name}")
    result = await run_graph_direct(
        workspace_id=request.workspace_id,
        user_id=user_id,
        tenant_id=tenant_id,
        agent_id=agent_name,
        request_id=request.id,
        correlation_id=request.id,
        task=request.message,
    )
    return result


async def handle(request: UserRequest) -> dict[str, Any]:
    """
    Orchestrator entry point.
    1. Classify intent -> select agent
    2. If confidence < 0.7, ask disambiguation question
    3. Run agent via agentic loop
    4. Pass output through QA gate
    5. Return approved result
    """
    from ..config import settings

    logger.info(f"Handling request {request.id}: {request.message} (preferred={getattr(request, 'preferred_agent', None)})")

    # ── 0. Adversarial screen FIRST (Wave 2, 2026-09-06) ─────────────
    # Untrusted input is screened before classification/routing/inference.
    # Previously this ran after intent classification, so low-confidence
    # attacks (e.g. PII requests) exited as ask_clarification and were never
    # screened. fail-closed on critical detections.
    adversarial = detect_adversarial_prompt(request.message)
    if adversarial:
        critical = [d for d in adversarial if d["severity"] == "critical"]
        if critical:
            logger.warning("Adversarial prompt detected: %s", critical)
            return {
                "agent_name": "orchestrator",
                "action": "error",
                "confidence": 0.0,
                "result": {
                    "summary": "Your input was flagged for potential security concerns. Please rephrase.",
                    "details": None,
                    "proposals": [],
                    "questions": [],
                },
            }

    # ── 1. Intent Classification (explicit agent override for enterprise chat) ──
    preferred = getattr(request, 'preferred_agent', None)
    execution_plan = None
    if preferred and preferred in AGENT_REGISTRY:
        agent_name, confidence = preferred, 0.98
        logger.info(f"Explicit agent override: {agent_name} (confidence={confidence})")
    else:
        try:
            agent_name, confidence, execution_plan = await route_intent_and_plan(request.message, workspace_id=request.workspace_id)
        except Exception:
            agent_name, confidence = await classify_intent(request.message)
            execution_plan = None
        logger.info(f"Classified: agent={agent_name}, confidence={confidence}")

    if execution_plan:
        setattr(request, "execution_plan", execution_plan)


    # ── 1b. MVP scope lock ─────────────────────────────────────────
    if settings.mvp_scope_enforced and agent_name not in MVP_CANONICAL_AGENTS:
        return _handle_out_of_scope(agent_name, confidence)

    # ── 2. Low confidence → consultative assistance ─────────────────
    if confidence < 0.7:
        logger.info(f"Low confidence ({confidence:.2f}) — routing to consultative conversation partner")
        agent_name = "conversation"
        confidence = 0.85


    # ── 2b. LangGraph direct path (gated, opt-in) ────────────────────
    # When enabled, the compiled graph orchestrates (its supervisor node owns
    # multi-agent). Unavailable → None → existing paths unchanged.
    try:
        _graph_out = await _run_graph_branch(request, agent_name, confidence)
        if _graph_out is not None:
            return await _qa_gate_output(_graph_out, request.workspace_id, "GRAPH")
    except ValueError as _ge:
        # Trusted-context/topology failures fail closed (never fall through).
        logger.warning("GRAPH branch refused: %s", _ge)
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"Graph execution refused: {_ge}", "details": None,
                       "proposals": [], "questions": []},
        }
    except Exception as e:
        logger.warning(f"GRAPH branch failed, falling back to single-agent: {e}")

    # ── 3. Multi-agent supervisor check (before single-agent guards) ───
    # If the message spans 2+ intent categories and no explicit agent was forced,
    # run the hierarchical supervisor DAG instead of single-agent loop.
    # Supervisor respects MVP scope lock internally (filters to canonical agents when enforced).
    if not preferred and _is_complex_multi_agent(request.message):
        try:
            from .supervisor import run_supervisor
            logger.info(f"SUPERVISOR triggered for multi-intent request: {request.message[:80]}")
            sup_start = time.monotonic()
            supervisor_output = await run_supervisor(
                request.message,
                request.workspace_id,
                request.id,
                user_id=request.user_id,
                tenant_id=request.tenant_id,
                correlation_id=getattr(request, "correlation_id", None) or request.id,
            )
            sup_latency = (time.monotonic() - sup_start) * 1000
            # Record metrics for supervisor
            metrics_collector.record(AgentMetric(
                timestamp=time.time(), agent_name="supervisor", success=True, latency_ms=sup_latency, confidence=confidence,
            ))
            # ── QA Gate for supervisor output (shared helper — identical semantics)
            agent_output = supervisor_output if supervisor_output.get("supervisor") else {
                "agent_name": supervisor_output.get("agent_name", "supervisor"),
                "action": supervisor_output.get("action", "suggest"),
                "confidence": supervisor_output.get("confidence", 0.87),
                "result": supervisor_output.get("result", {"summary": str(supervisor_output), "details": None, "proposals": [], "questions": []}),
            }
            return await _qa_gate_output(agent_output, request.workspace_id, "SUPERVISOR")
        except Exception as e:
            logger.warning(f"SUPERVISOR failed, falling back to single-agent: {e}")

    # ── 3b. Instantiate agent and run loop ─────────────────────────

    # Kill switch check
    if not kill_switch.is_enabled(agent_name):
        logger.warning("Agent '%s' is disabled by kill switch", agent_name)
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": f"Agent '{agent_name}' is temporarily disabled",
                "details": None,
                "proposals": [],
                "questions": ["Please try again later or contact support."],
            },
        }

    # Adversarial prompt detection — defense in depth (primary screen is step 0
    # at the top of handle(); this catches anything re-entering past it).
    adversarial = detect_adversarial_prompt(request.message)
    if adversarial:
        critical = [d for d in adversarial if d["severity"] == "critical"]
        if critical:
            logger.warning("Adversarial prompt detected: %s", critical)
            return {
                "agent_name": agent_name,
                "action": "error",
                "confidence": 0.0,
                "result": {
                    "summary": "Your input was flagged for potential security concerns. Please rephrase.",
                    "details": None,
                    "proposals": [],
                    "questions": [],
                },
            }

    agent_cls = AGENT_REGISTRY.get(agent_name)
    if not agent_cls:
        logger.error(f"No agent registered for '{agent_name}'")
        return {
            "agent_name": "orchestrator",
            "action": "error",
            "confidence": 0.0,
            "result": {"summary": f"No agent found for '{agent_name}'", "details": None, "proposals": [], "questions": []},
        }

    agent = agent_cls()
    logger.info(f"Routed to agent: {agent.__class__.__name__}")

    # P1c: workspace/global concurrency guard — fail-fast with rate-limit error
    if not await workspace_limiter.acquire(request.workspace_id):
        logger.warning(f"CONCURRENCY LIMIT: workspace {request.workspace_id} at capacity, rejecting")
        return {
            "agent_name": agent_name,
            "action": "error",
            "confidence": 0.0,
            "result": {
                "summary": "System at capacity for this workspace — please retry shortly.",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }

    agent_request = AgentRequest(
        agent=agent,
        request_id=request.id,
        message=request.message,
        workspace_id=request.workspace_id,
        agent_name=agent_name,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        correlation_id=getattr(request, "correlation_id", None) or request.id,
    )
    loop_start = time.monotonic()
    # P1c: OTel span per orchestrator dispatch
    with agent_span("orchestrator.handle", agent=agent_name, workspace_id=request.workspace_id):
        loop_response = await run_agent_loop(agent_request)
    workspace_limiter.release(request.workspace_id)
    loop_latency_ms = (time.monotonic() - loop_start) * 1000

    # Record agent metrics
    metrics_collector.record(AgentMetric(
        timestamp=time.time(),
        agent_name=agent_name,
        success=loop_response.status == "success",
        latency_ms=loop_latency_ms,
        confidence=confidence,
    ))

    # ── 4. QA Gate (mandatory) ─────────────────────────────────────
    qa = QAAgent()
    raw_res = loop_response.result if isinstance(loop_response.result, dict) else {}
    if not raw_res and isinstance(loop_response.final_result, dict):
        raw_res = loop_response.final_result

    merged_res: dict[str, Any] = {
        "summary": loop_response.final_result if isinstance(loop_response.final_result, str) else raw_res.get("summary", ""),
        "details": raw_res.get("details", None),
        "proposals": raw_res.get("proposals", []),
        "questions": raw_res.get("questions", []),
    }
    for k, v in raw_res.items():
        if k not in merged_res:
            merged_res[k] = v

    agent_output: dict[str, Any] = {
        "agent_name": agent_name,
        "action": getattr(loop_response, "action", "suggest"),
        "confidence": confidence,
        "result": merged_res,
    }

    max_qa_retries = 3
    for attempt in range(max_qa_retries):
        try:
            qa_result: QAValidationResult = await qa.validate(agent_output, context=getattr(loop_response, 'context', None))
        except TypeError:
            qa_result = await qa.validate(agent_output)
        if qa_result.decision == "approved":
            logger.info("QA APPROVED (attempt %d)", attempt + 1)
            await _attach_pending_approvals(agent_output, request.workspace_id)
            return agent_output
        logger.warning("QA REJECTED (attempt %d): %s", attempt + 1, qa_result.issues)

    # Fail-closed on critical safety issues (PII, harm, injection, grounding)
    _CRITICAL_MARKERS = {"PII", "Harmful", "injection", "Grounding violation"}
    if any(
        any(m.lower() in issue.lower() for m in _CRITICAL_MARKERS)
        for issue in qa_result.issues
    ):
        logger.error(
            "QA FAIL-CLOSED: critical issues after retries: %s",
            qa_result.issues,
        )
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail="Response failed quality validation — blocked for safety",
        )
    # Non-critical issues: deliver with warning flag
    logger.warning("QA retries exhausted — delivering best-effort with flag")
    agent_output["qa_flag"] = "best_effort_after_retries"
    await _attach_pending_approvals(agent_output, request.workspace_id)
    return agent_output


async def _attach_pending_approvals(agent_output: dict[str, Any], workspace_id: str) -> None:
    """Surface actionable pending approvals as proposal cards in chat output.

    Each card carries `approval_id` so the frontend can call the approve/reject
    endpoints directly instead of faking a decision locally.
    """
    if not workspace_id:
        return
    try:
        from .loop import fetch_pending_approvals

        pending = await fetch_pending_approvals(workspace_id)
        if pending:
            result = agent_output.get("result") or {}
            result["proposals"] = pending
            agent_output["result"] = result
    except Exception as exc:
        logger.warning(f"Failed to attach pending approvals (non-blocking): {exc}")
