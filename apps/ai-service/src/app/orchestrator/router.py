"""
Orchestrator Router — upgraded to wire all specialist agents + QA gate.
Two-stage intent classification: coarse category -> specific agent.
"""
import logging
from typing import Any, Dict, Optional

from .base import BaseAgent, Tool, MemoryScopes
from .loop import AgentRequest, run_agent_loop, AgentResponse

from app.agents.organization_agent.handler import OrganizationAgent
from app.agents.memory_agent.handler import MemoryAgentHandler
from app.agents.resume_agent.handler import ResumeAgent
from app.agents.ats_agent.handler import ATSAgent
from app.agents.job_search_agent.handler import JobSearchAgent
from app.agents.application_agent.handler import ApplicationAgent
from app.agents.gmail_agent.handler import GmailAgent
from app.agents.scheduler_agent.handler import SchedulerAgent
from app.agents.qa_agent.handler import QAAgent, QAValidationResult
from app.agents.career_agent.handler import CareerAgent  # G1
from app.agents.learning_agent.handler import LearningAgent  # G2
from app.agents.research_agent.handler import ResearchAgent  # G3
from app.agents.github_agent.handler import GitHubAgent  # G4
from app.agents.coding_agent.handler import CodingAgent  # G5
from app.agents.reminder_agent.handler import ReminderAgent  # G6
from app.agents.analytics_agent.handler import AnalyticsAgent  # G7
from app.agents.recommendation_agent.handler import RecommendationAgent  # G8
from app.agents.reflection_agent.handler import ReflectionAgent  # G9
from app.agents.security_agent.handler import SecurityAgent  # G10
from app.agents.connector_agent.handler import ConnectorAgent  # G11
from app.agents.plugin_agent.handler import PluginAgent  # G12

logger = logging.getLogger(__name__)

# ── Agent Registry ─────────────────────────────────────────────────

AGENT_REGISTRY: Dict[str, type] = {
    "organization": OrganizationAgent,
    "memory": MemoryAgentHandler,
    "resume": ResumeAgent,
    "ats": ATSAgent,
    "job_search": JobSearchAgent,
    "application": ApplicationAgent,
    "gmail": GmailAgent,
    "scheduler": SchedulerAgent,
    "career": CareerAgent,
    "learning": LearningAgent,
    "research": ResearchAgent,
    "github": GitHubAgent,
    "coding": CodingAgent,
    "reminder": ReminderAgent,
    "analytics": AnalyticsAgent,
    "recommendation": RecommendationAgent,
    "reflection": ReflectionAgent,
    "security": SecurityAgent,
    "connector": ConnectorAgent,
    "plugin": PluginAgent,
}

# ── Intent Classification Categories ───────────────────────────────

CATEGORY_AGENT_MAP = {
    "document_organization": ["organization"],
    "career_resume": ["resume", "ats"],
    "job_search": ["job_search", "application"],
    "communication": ["gmail"],
    "schedule_time": ["scheduler"],
    "memory_extraction": ["memory"],
    "career_development": ["career", "learning"],
    "research_github": ["research", "github"],
    "coding_interview": ["coding"],
    "reminders_analytics": ["reminder", "analytics"],
    "recommendations": ["recommendation"],
    "reflection": ["reflection"],
    "security_monitoring": ["security"],
    "integrations": ["connector", "plugin"],
}

# Keywords for coarse category classification
CATEGORY_KEYWORDS = {
    "document_organization": ["organize", "file", "rename", "folder", "categorize", "duplicate", "move"],
    "career_resume": ["resume", "cv", "bullet", "achievement", "ats", "score", "tailor"],
    "job_search": ["job", "search", "apply", "application", "internship", "career", "role", "position"],
    "communication": ["email", "gmail", "inbox", "draft", "reply", "mail"],
    "schedule_time": ["schedule", "deadline", "calendar", "reminder", "conflict", "event"],
    "memory_extraction": ["extract", "memory", "entity", "knowledge", "graph", "remember"],
    "career_development": ["career", "path", "skill", "course", "learn", "training", "certification"],
    "research_github": ["research", "company", "industry", "trend", "github", "repository", "profile"],
    "coding_interview": ["coding", "challenge", "leetcode", "algorithm", "code review", "interview prep"],
    "reminders_analytics": ["deadline", "remind", "follow up", "analytics", "metrics", "report", "trend"],
    "recommendations": ["recommend", "suggest", "match", "curate", "similar"],
    "reflection": ["weekly", "monthly", "summary", "digest", "review", "goal", "progress"],
    "security_monitoring": ["security", "pii", "monitor", "alert", "access", "suspicious"],
    "integrations": ["connector", "plugin", "integration", "extension", "setup", "configure", "install"],
}


class UserRequest:
    def __init__(self, request_id: str, message: str, workspace_id: str):
        self.id = request_id
        self.message = message
        self.workspace_id = workspace_id


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

    if best_category == "reminders_analytics":
        if any(kw in msg_lower for kw in ["deadline", "remind", "follow up", "task", "todo"]):
            return "reminder", confidence
        return "analytics", confidence

    if best_category == "integrations":
        if any(kw in msg_lower for kw in ["connector", "integration", "connect", "setup", "configure"]):
            return "connector", confidence
        return "plugin", confidence

    return agents_in_category[0], confidence


async def handle(request: UserRequest) -> Dict[str, Any]:
    """
    Orchestrator entry point.
    1. Classify intent -> select agent
    2. If confidence < 0.7, ask disambiguation question
    3. Run agent via agentic loop
    4. Pass output through QA gate
    5. Return approved result
    """
    logger.info(f"Handling request {request.id}: {request.message}")

    # ── 1. Intent Classification ───────────────────────────────────
    agent_name, confidence = await classify_intent(request.message)
    logger.info(f"Classified: agent={agent_name}, confidence={confidence}")

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
                    "Options: organize files, build/score resume, career guidance, "
                    "learning courses, company research, GitHub analysis, coding prep, "
                    "reminders, analytics, recommendations, weekly reflection, "
                    "security scan, integrations, plugins, email, schedule."
                ],
            },
        }

    # ── 3. Instantiate agent and run loop ──────────────────────────
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
    loop_response = await run_agent_loop(agent_request)

    # ── 4. QA Gate ─────────────────────────────────────────────────
    qa = QAAgent()
    agent_output = {
        "agent_name": agent_name,
        "action": "suggest",
        "confidence": confidence,
        "result": {"summary": loop_response.final_result, "details": None, "proposals": [], "questions": []},
    }

    max_qa_retries = 3
    for attempt in range(max_qa_retries):
        qa_result: QAValidationResult = await qa.validate(agent_output)
        if qa_result.decision == "approved":
            logger.info(f"QA APPROVED (attempt {attempt + 1})")
            return agent_output
        logger.warning(f"QA REJECTED (attempt {attempt + 1}): {qa_result.issues}")
        # In real impl, send back to agent for revision here

    # All QA retries exhausted — deliver best-effort with flag
    logger.warning("QA retries exhausted — delivering best-effort with flag")
    agent_output["qa_flag"] = "best_effort_after_retries"
    return agent_output
