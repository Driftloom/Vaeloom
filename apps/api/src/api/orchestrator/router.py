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
from api.infrastructure.agent_observability import AgentMetric, kill_switch, metrics_collector

from .loop import AgentRequest, run_agent_loop

logger = logging.getLogger(__name__)

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


async def classify_intent(message: str) -> tuple[str, float]:
    """
    Two-stage intent classification.
    Stage 1: Coarse category from keywords.
    Stage 2: Specific agent within category.
    Returns (agent_name, confidence).
    """
    msg_lower = message.lower()

    # Stage 1: Coarse category
    best_category = None
    best_score = 0

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score > best_score:
            best_score = score
            best_category = category

    if best_category is None or best_score == 0:
        return "memory", 0.5  # Default fallback

    confidence = min(best_score / 3.0, 1.0)  # Normalize

    # Stage 2: Pick specific agent within category
    agents_in_category = CATEGORY_AGENT_MAP.get(best_category, ["memory"])

    if len(agents_in_category) == 1:
        return agents_in_category[0], confidence

    # Disambiguate within category
    if best_category == "career_resume":
        if any(kw in msg_lower for kw in ["score", "ats", "gap", "keyword"]):
            return "ats", confidence
        return "resume", confidence

    if best_category == "job_search":
        if any(kw in msg_lower for kw in ["apply", "application", "submit", "cover letter"]):
            return "application", confidence
        return "job_search", confidence

    if best_category == "career_development":
        if any(kw in msg_lower for kw in ["course", "learn", "training", "certification", "study"]):
            return "learning", confidence
        return "career", confidence

    if best_category == "research_github":
        if any(kw in msg_lower for kw in ["github", "repository", "repo", "profile"]):
            return "github", confidence
        return "research", confidence

    if best_category == "planning_research":
        if any(kw in msg_lower for kw in ["plan", "roadmap", "milestone", "goal", "strategy"]):
            return "planning", confidence
        return "research", confidence

    if best_category == "reminders_analytics":
        if any(kw in msg_lower for kw in ["deadline", "remind", "follow up", "task", "todo"]):
            return "reminder", confidence
        return "analytics", confidence

    if best_category == "integrations":
        if any(kw in msg_lower for kw in ["connector", "integration", "connect", "setup", "configure"]):
            return "connector", confidence
        return "plugin", confidence

    return agents_in_category[0], confidence


# ── MVP scope lock (INT-02 §2.2): 8 canonical agents ────────────────
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

    # ── 3. Instantiate agent and run loop ──────────────────────────

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

    # Adversarial prompt detection
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

    agent_request = AgentRequest(
        agent=agent,
        request_id=request.id,
        message=request.message,
        workspace_id=request.workspace_id,
        agent_name=agent_name,
    )
    loop_start = time.monotonic()
    loop_response = await run_agent_loop(agent_request)
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
        qa_result: QAValidationResult = await qa.validate(agent_output)
        if qa_result.decision == "approved":
            logger.info("QA APPROVED (attempt %d)", attempt + 1)
            await _attach_pending_approvals(agent_output, request.workspace_id)
            return agent_output
        logger.warning("QA REJECTED (attempt %d): %s", attempt + 1, qa_result.issues)

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
