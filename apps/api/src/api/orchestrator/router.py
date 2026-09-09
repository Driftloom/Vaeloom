"""
Orchestrator Router — upgraded to wire all specialist agents + QA gate.
Two-stage intent classification: coarse category -> specific agent.
"""
import logging
import time
from typing import Any

from api.agents.analytics_agent.handler import AnalyticsAgent  # G7
from api.agents.application_agent.handler import ApplicationAgent
from api.agents.ats_agent.handler import ATSAgent
from api.agents.career_agent.handler import CareerAgent  # G1
from api.agents.coding_agent.handler import CodingAgent  # G5
from api.agents.connector_agent.handler import ConnectorAgent  # G11
from api.agents.drive_agent.handler import DriveAgent  # G13
from api.agents.github_agent.handler import GitHubAgent  # G4
from api.agents.gmail_agent.handler import GmailAgent
from api.agents.job_search_agent.handler import JobSearchAgent
from api.agents.learning_agent.handler import LearningAgent  # G2
from api.agents.memory.planning_agent import PlanningAgent  # Planning - roadmap
from api.agents.memory_agent.handler import MemoryAgentHandler
from api.agents.organization_agent.handler import OrganizationAgent
from api.agents.plugin_agent.handler import PluginAgent  # G12
from api.agents.qa_agent.handler import QAAgent, QAValidationResult
from api.agents.recommendation_agent.handler import RecommendationAgent  # G8
from api.agents.reflection_agent.handler import ReflectionAgent  # G9
from api.agents.reminder_agent.handler import ReminderAgent  # G6
from api.agents.research_agent.handler import ResearchAgent  # G3
from api.agents.resume_agent.handler import ResumeAgent
from api.agents.scheduler_agent.handler import SchedulerAgent
from api.agents.security_agent.handler import SecurityAgent  # G10
from api.infrastructure.agent_eval import detect_adversarial_prompt
from api.infrastructure.agent_observability import (
    AgentMetric,
    agent_span,
    kill_switch,
    metrics_collector,
    workspace_limiter,
)

from .loop import AgentRequest, run_agent_loop

logger = logging.getLogger(__name__)

# ── Light multi-agent heuristic (imported here to avoid circular at supervisor import time) ──
def _is_complex_multi_agent(message: str) -> bool:
    """Quick check without importing supervisor (avoids circular)."""
    if len(message.split()) < 8:
        return False
    msg_lower = message.lower()
    # Respect MVP scope lock: only count canonical categories when enforced (AC-02)
    try:
        from ..config import settings as _settings
        if _settings.mvp_scope_enforced:
            cats = sum(1 for cat, kws in CATEGORY_KEYWORDS.items() if cat in MVP_CATEGORY_AGENT_MAP and any(kw in msg_lower for kw in kws))
            return cats >= 2
    except Exception:
        pass
    cats = sum(1 for kws in CATEGORY_KEYWORDS.values() if any(kw in msg_lower for kw in kws))
    return cats >= 2

# ── Agent Registry ─────────────────────────────────────────────────

AGENT_REGISTRY: dict[str, type] = {
    "organization": OrganizationAgent,
    "memory": MemoryAgentHandler,
    "resume": ResumeAgent,
    "ats": ATSAgent,
    "job_search": JobSearchAgent,
    "application": ApplicationAgent,
    "gmail": GmailAgent,
    "scheduler": SchedulerAgent,
    "planning": PlanningAgent,
    "research": ResearchAgent,
    "career": CareerAgent,
    "learning": LearningAgent,
    "github": GitHubAgent,
    "coding": CodingAgent,
    "reminder": ReminderAgent,
    "analytics": AnalyticsAgent,
    "recommendation": RecommendationAgent,
    "reflection": ReflectionAgent,
    "security": SecurityAgent,
    "connector": ConnectorAgent,
    "plugin": PluginAgent,
    "drive": DriveAgent,
}

# ── Intent Classification Categories ───────────────────────────────

CATEGORY_AGENT_MAP = {
    "document_organization": ["organization"],
    "career_resume": ["resume", "ats"],
    "job_search": ["job_search", "application"],
    "communication": ["gmail"],
    "schedule_time": ["scheduler"],
    "memory_extraction": ["memory"],
    "planning_research": ["planning", "research"],
    "career_development": ["career", "learning"],
    "research_github": ["research", "github"],
    "coding_interview": ["coding"],
    "reminders_analytics": ["reminder", "analytics"],
    "recommendations": ["recommendation"],
    "reflection": ["reflection"],
    "security_monitoring": ["security"],
    "integrations": ["connector", "plugin", "drive"],
}

# Keywords for coarse category classification
CATEGORY_KEYWORDS = {
    "document_organization": ["organize", "file", "rename", "folder", "categorize", "duplicate", "move"],
    "career_resume": ["resume", "cv", "bullet", "achievement", "ats", "score", "tailor"],
    "job_search": ["job", "search", "apply", "application", "internship", "career", "role", "position"],
    "communication": ["email", "gmail", "inbox", "draft", "reply", "mail"],
    "schedule_time": ["schedule", "deadline", "calendar", "reminder", "conflict", "event"],
    "memory_extraction": ["extract", "memory", "entity", "knowledge", "graph", "remember"],
    "planning_research": ["plan", "planning", "roadmap", "research", "strategy", "milestone", "goal", "research"],
    "career_development": ["career", "path", "skill", "course", "learn", "training", "certification"],
    "research_github": ["company", "industry", "trend", "github", "repository", "profile"],
    "coding_interview": ["coding", "challenge", "leetcode", "algorithm", "code review", "interview prep"],
    "reminders_analytics": ["deadline", "remind", "follow up", "analytics", "metrics", "report", "trend"],
    "recommendations": ["recommend", "suggest", "match", "curate", "similar"],
    "reflection": ["weekly", "monthly", "summary", "digest", "review", "progress"],
    "security_monitoring": ["security", "pii", "monitor", "alert", "access", "suspicious"],
    "integrations": ["connector", "plugin", "integration", "extension", "setup", "configure", "install", "drive", "google drive", "sync"],
}


class UserRequest:
    def __init__(self, request_id: str, message: str, workspace_id: str, preferred_agent: str | None = None):
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id
        self.preferred_agent = preferred_agent


# ── Muse §7 capability-aware selection ─────────────────────────────
# Agents are never selected merely by static-dictionary name. This scorer
# ranks candidates on keyword strength + capability (ACTIVE card with tools)
# + availability (kill-switch) + cost-tier fit, and is consulted on the live
# path (tie-breaks and low-confidence arbitration). Deterministic, no LLM.

def _agent_keyword_score(agent_name: str, msg_lower: str) -> float:
    """Best category keyword strength among categories containing the agent."""
    best = 0
    for category, agents in CATEGORY_AGENT_MAP.items():
        if agent_name in agents:
            kws = CATEGORY_KEYWORDS.get(category, [])
            hits = sum(1 for kw in kws if kw in msg_lower)
            if kws:
                best = max(best, hits / max(1, len(kws)))
    return round(min(1.0, best * 2.0), 3)


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
    """Classify ambiguous or low-confidence queries using a fast micro-LLM."""
    from ..config import settings

    if not settings.llm_api_key or len(message.strip()) < 3:
        return None

    try:
        from ..services.llm_service import llm_service
        import json
        import re

        agent_desc = [
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
            max_tokens=64,
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


async def classify_intent(message: str) -> tuple[str, float]:
    """
    Two-stage intent classification with micro-LLM fallback and misroute telemetry.
    Stage 1: Coarse category from keywords (fast-path).
    Stage 2: Specific agent within category.
    Fallback: Micro-LLM intent classifier for ambiguous/low-confidence queries.
    Returns (agent_name, confidence).
    """
    msg_lower = message.lower()

    # Stage 1: Coarse category — collect all scores
    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        scores[category] = sum(1 for kw in keywords if kw in msg_lower)

    best_score = max(scores.values()) if scores else 0
    if best_score == 0:
        # Check LLM before default memory fallback
        llm_match = await _llm_classify_intent(message)
        if llm_match:
            logger.info(f"ROUTER_LLM_CLASSIFY: query='{message[:50]}' fallback -> {llm_match[0]} ({llm_match[1]:.2f})")
            return llm_match
        return "memory", 0.5  # Default fallback

    # Gather all categories tied at best_score and break tie via disambiguation strength
    tied = [cat for cat, sc in scores.items() if sc == best_score]
    if len(tied) == 1:
        best_category = tied[0]
    else:
        # Secondary: count of stage-2 disambiguator hits inside tied categories
        def _secondary(cat: str) -> int:
            if cat == "career_resume":
                return sum(1 for kw in ["score", "ats", "gap", "keyword"] if kw in msg_lower) + sum(1 for kw in ["resume", "cv", "bullet"] if kw in msg_lower)
            if cat == "job_search":
                return sum(1 for kw in ["apply", "application", "submit", "cover letter"] if kw in msg_lower)
            if cat == "career_development":
                return sum(1 for kw in ["course", "learn", "training", "certification", "study"] if kw in msg_lower)
            if cat == "research_github":
                return sum(1 for kw in ["github", "repository", "repo", "profile"] if kw in msg_lower)
            if cat == "planning_research":
                return sum(1 for kw in ["plan", "roadmap", "milestone", "goal", "strategy"] if kw in msg_lower)
            if cat == "reminders_analytics":
                return sum(1 for kw in ["deadline", "remind", "follow up", "task", "todo"] if kw in msg_lower)
            if cat == "integrations":
                return sum(1 for kw in ["connector", "integration", "connect", "setup", "configure"] if kw in msg_lower)
            return 0
        tied_sorted = sorted(tied, key=lambda c: _secondary(c), reverse=True)
        # Muse §7: capability-aware tie-break. When disambiguation strength
        # also ties, prefer the category whose agent scores higher on
        # capability/availability/cost — never by dictionary order alone.
        try:
            _top_secs = sorted({_secondary(c) for c in tied_sorted}, reverse=True)
            if len(_top_secs) > 1 and _top_secs[0] == _top_secs[1]:
                _tied_cats = [c for c in tied_sorted if _secondary(c) == _top_secs[0]]
                _cands: list[str] = []
                for _c in _tied_cats:
                    _cands.extend(CATEGORY_AGENT_MAP.get(_c, []))
                _ranked = score_agent_candidates(message, sorted(set(_cands)))
                if _ranked:
                    _by_agent = {r["agent"]: r["score"] for r in _ranked}
                    _cat_score = {c: max([_by_agent.get(a, 0.0) for a in CATEGORY_AGENT_MAP.get(c, [])] or [0.0]) for c in _tied_cats}
                    _best_cat = max(_tied_cats, key=lambda c: (_cat_score[c], -_tied_cats.index(c)))
                    if _cat_score[_best_cat] > 0:
                        tied_sorted = sorted(tied_sorted, key=lambda c: (c != _best_cat, tied_sorted.index(c)))
        except Exception:
            pass
        best_category = tied_sorted[0]

    confidence = min(best_score / 3.0, 1.0)
    if best_score == 2 and confidence < 0.75:
        if len(tied) == 1 or _secondary(best_category) > 0:  # type: ignore
            confidence = 0.8

    # Stage 2: Pick specific agent within category
    agents_in_category = CATEGORY_AGENT_MAP.get(best_category, ["memory"])

    if len(agents_in_category) == 1:
        fast_agent = agents_in_category[0]
    elif best_category == "career_resume":
        fast_agent = "ats" if any(kw in msg_lower for kw in ["score", "ats", "gap", "keyword"]) else "resume"
    elif best_category == "job_search":
        fast_agent = "application" if any(kw in msg_lower for kw in ["apply", "application", "submit", "cover letter"]) else "job_search"
    elif best_category == "career_development":
        fast_agent = "learning" if any(kw in msg_lower for kw in ["course", "learn", "training", "certification", "study"]) else "career"
    elif best_category == "research_github":
        fast_agent = "github" if any(kw in msg_lower for kw in ["github", "repository", "repo", "profile"]) else "research"
    elif best_category == "planning_research":
        fast_agent = "planning" if any(kw in msg_lower for kw in ["plan", "roadmap", "milestone", "goal", "strategy"]) else "research"
    elif best_category == "reminders_analytics":
        fast_agent = "reminder" if any(kw in msg_lower for kw in ["deadline", "remind", "follow up", "task", "todo"]) else "analytics"
    elif best_category == "integrations":
        fast_agent = "connector" if any(kw in msg_lower for kw in ["connector", "integration", "connect", "setup", "configure"]) else "plugin"
    else:
        fast_agent = agents_in_category[0]

    # If confident, return fast-path
    if confidence >= 0.75:
        return fast_agent, confidence

    # Muse §7: capability-aware arbitration before the micro-LLM fallback.
    # When the scorer decisively prefers a viable agent (margin >= 0.15 at
    # score >= 0.6), take it — capability/availability/cost evidence beats a
    # weak keyword signal and saves the model call. Otherwise fall through.
    try:
        _arb_cands = sorted(set(agents_in_category + [fast_agent]))
        _arb = score_agent_candidates(message, _arb_cands)
        if len(_arb) >= 1:
            _second = _arb[1]["score"] if len(_arb) > 1 else 0.0
            if _arb[0]["score"] >= 0.6 and (_arb[0]["score"] - _second) >= 0.15:
                logger.info(f"ROUTER_SCORER: query='{message[:50]}' fast={fast_agent}({confidence:.2f}) -> scorer={_arb[0]['agent']}({_arb[0]['score']:.2f})")
                return _arb[0]["agent"], max(confidence, min(0.85, _arb[0]["score"]))
    except Exception:
        pass

    # For ambiguous or low-confidence queries, trigger micro-LLM intent calibration
    llm_match = await _llm_classify_intent(message)
    if llm_match:
        logger.info(f"ROUTER_LLM_CLASSIFY: query='{message[:50]}' fast={fast_agent}({confidence:.2f}) -> llm={llm_match[0]}({llm_match[1]:.2f})")
        return llm_match

    # Log telemetry for low-confidence routes
    logger.info(f"ROUTER_LOW_CONFIDENCE: query='{message[:50]}' agent={fast_agent} conf={confidence:.2f}")
    return fast_agent, confidence


# ── MVP scope lock (INT-02 §2.2): 10 canonical agents ───────────────
# Orchestrator + Organization, Memory, Resume, ATS, Job Search &
# Application, Gmail, Scheduler. All other repo agents (career, learning,
# research, github, coding, reminder, analytics, recommendation,
# reflection, security, connector, plugin, drive, qa) are enterprise
# extras that must not run in MVP builds (CF-05, R5/R6).

MVP_CANONICAL_AGENTS = frozenset({
    "organization", "memory", "resume", "ats", "job_search",
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
    if preferred and preferred in AGENT_REGISTRY:
        agent_name, confidence = preferred, 0.98
        logger.info(f"Explicit agent override: {agent_name} (confidence={confidence})")
    else:
        agent_name, confidence = await classify_intent(request.message)
        logger.info(f"Classified: agent={agent_name}, confidence={confidence}")

    # ── 1b. MVP scope lock ─────────────────────────────────────────
    if settings.mvp_scope_enforced and agent_name not in MVP_CANONICAL_AGENTS:
        return _handle_out_of_scope(agent_name, confidence)

    # ── 2. Low confidence → ask clarification ──────────────────────
    if confidence < 0.7:
        logger.info(f"Low confidence ({confidence}) — asking clarification")
        return {
            "agent_name": "orchestrator",
            "action": "ask_clarification",
            "confidence": confidence,
            "result": {
                "summary": "I'm not sure which specialist to route this to.",
                "details": None,
                "proposals": [],
                "questions": [
                    "Could you clarify what you'd like help with? "
                    "Options: organize files, build roadmap/plan, research, build/score resume, career guidance, "
                    "learning courses, company research, GitHub analysis, coding prep, "
                    "reminders, analytics, recommendations, weekly reflection, "
                    "security scan, integrations, plugins, email, schedule."
                ],
            },
        }

    # ── 3. Multi-agent supervisor check (before single-agent guards) ───
    # If the message spans 2+ intent categories and no explicit agent was forced,
    # run the hierarchical supervisor DAG instead of single-agent loop.
    # Supervisor respects MVP scope lock internally (filters to canonical agents when enforced).
    if not preferred and _is_complex_multi_agent(request.message):
        try:
            from .supervisor import run_supervisor
            logger.info(f"SUPERVISOR triggered for multi-intent request: {request.message[:80]}")
            sup_start = time.monotonic()
            supervisor_output = await run_supervisor(request.message, request.workspace_id, request.id)
            sup_latency = (time.monotonic() - sup_start) * 1000
            # Record metrics for supervisor
            metrics_collector.record(AgentMetric(
                timestamp=time.time(), agent_name="supervisor", success=True, latency_ms=sup_latency, confidence=confidence,
            ))
            # ── QA Gate for supervisor output ─────────────────────
            qa = QAAgent()
            # If supervisor already produced merged summary, use it; else wrap
            agent_output = supervisor_output if supervisor_output.get("supervisor") else {
                "agent_name": supervisor_output.get("agent_name", "supervisor"),
                "action": supervisor_output.get("action", "suggest"),
                "confidence": supervisor_output.get("confidence", 0.87),
                "result": supervisor_output.get("result", {"summary": str(supervisor_output), "details": None, "proposals": [], "questions": []}),
            }
            for attempt in range(3):
                qa_result: QAValidationResult = await qa.validate(agent_output)
                if qa_result.decision == "approved":
                    logger.info(f"SUPERVISOR QA APPROVED (attempt {attempt+1})")
                    await _attach_pending_approvals(agent_output, request.workspace_id)
                    return agent_output
                logger.warning(f"SUPERVISOR QA REJECTED (attempt {attempt+1}): {qa_result.issues}")
            agent_output["qa_flag"] = "best_effort_after_retries"
            await _attach_pending_approvals(agent_output, request.workspace_id)
            return agent_output
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
    agent_output: dict[str, Any] = {
        "agent_name": agent_name,
        "action": "suggest",
        "confidence": confidence,
        "result": {"summary": loop_response.final_result, "details": None, "proposals": [], "questions": []},
    }

    max_qa_retries = 3
    for attempt in range(max_qa_retries):
        qa_result: QAValidationResult = await qa.validate(agent_output, context=getattr(loop_response, 'context', None))
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
