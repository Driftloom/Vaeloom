"""
Conversation Agent — Executive career companion, cognitive scaffolding, and conversational partner.
Handles greetings, general chat, boundary tests (e.g. '9876'), stress/crisis de-escalation,
and consultative guidance. Never outputs sterile robotic rejection walls or exposes internal machine scores.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.orchestrator.proposals_engine import action_proposal_engine
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ConversationAgent(BaseAgent):
    mission = (
        "Executive career companion, cognitive scaffolding, and conversational partner. "
        "Provides empathetic containment, clarifies goals, guides users toward high-leverage workflows, "
        "and coordinates specialist tools invisibly behind the scenes."
    )
    tools = [
        Tool(name="search_documents", description="Search workspace career documents and resumes"),
        Tool(name="query_graph", description="Query long-term knowledge graph for career entities and skills"),
        Tool(name="web_search", description="Real-time web search for company news, market trends, and salaries"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "skills", "education", "experience", "timeline"],
        write_types=[],
    )
    default_autonomy = "full"

    async def fallback(self) -> dict[str, Any]:
        """Graceful fallback when execution is interrupted."""
        return {
            "agent_name": "conversation",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": (
                    "I am here and ready to help. Whether you want to tailor your resume for a specific role, "
                    "run a semantic ATS scan, search for verified jobs, or map out your career progression, "
                    "just choose an option below or type what you'd like to do."
                ),
                "details": None,
                "proposals": [],
                "questions": [],
                "action_chips": [
                    "📄 Resume Studio",
                    "🔍 Find Target Roles",
                    "📊 ATS Health Audit",
                    "📅 Calendar & Deadlines",
                ],
            },
        }

    async def execute(
        self,
        content: str,
        source_type: str = "user_input",
        source_id: str = "input_0",
        workspace_id: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        # Strip RAG context block if appended by orchestrator loop
        user_raw = re.split(r"\n\n\[Context from", content, maxsplit=1)[0].strip()
        msg = user_raw
        msg_lower = msg.lower()

        # ── 1. Fast-Path Greeting Handling ──────────────────────────────────
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
        _stripped = re.sub(r"^[@/]\w+\s*", "", msg_lower).strip().rstrip("!?.,'\"")
        
        farewell_tokens = frozenset(["bye", "goodbye", "see you", "later", "take care", "cya", "ttyl"])
        thanks_tokens = frozenset(["thanks", "thank you", "thx", "ty", "cheers"])

        # Dynamically generate state-aware action proposals & chips
        dyn_proposals = await action_proposal_engine.generate_proposals(
            query=msg,
            workspace_id=str(workspace_id) if workspace_id else "00000000-0000-0000-0000-000000000000",
        )
        dynamic_chips = [p.title for p in dyn_proposals]
        proposals_payload = [p.model_dump() for p in dyn_proposals]

        if _stripped in farewell_tokens:
            return {
                "agent_name": "conversation",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": "Goodbye! 👋 Come back anytime — your career workspace and notes are saved and ready.",
                    "details": None,
                    "proposals": proposals_payload,
                    "questions": [],
                    "action_chips": dynamic_chips,
                },
            }

        if _stripped in thanks_tokens:
            return {
                "agent_name": "conversation",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": "You're very welcome! 😊 Let me know whenever you want to work on your next milestone.",
                    "details": None,
                    "proposals": proposals_payload,
                    "questions": [],
                    "action_chips": dynamic_chips,
                },
            }

        if _stripped in _GREETINGS or any(_stripped.startswith(p) for p in ("good morning", "good afternoon", "good evening", "good night", "how are", "how's")):
            return {
                "agent_name": "conversation",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": (
                        "Hello! 👋 I'm Vaeloom, your executive career partner and second brain. "
                        "I can help you build an ATS-proof resume, discover and analyze target roles, "
                        "track deadlines, and prepare for high-stakes interviews.\n\n"
                        "What would you like to focus on today?"
                    ),
                    "details": None,
                    "proposals": proposals_payload,
                    "questions": [],
                    "action_chips": dynamic_chips,
                },
            }

        # ── 2. Boundary Testing / Cryptic Inputs (e.g. '9876', 'asdf') ────────
        is_pure_digits = msg.isdigit()
        is_low_entropy = bool(re.match(r"^[a-zA-Z]{1,4}$", msg) and len(set(msg.lower())) <= 2)
        if is_pure_digits or is_low_entropy:
            return {
                "agent_name": "conversation",
                "action": "suggest",
                "confidence": 0.88,
                "result": {
                    "summary": (
                        "Looks like a quick keyboard test! I'm fully online and ready to assist you. "
                        "We can jump straight into refining your resume, benchmarking market compensation, "
                        "or exploring fresh opportunities."
                    ),
                    "details": None,
                    "proposals": proposals_payload,
                    "questions": [],
                    "action_chips": dynamic_chips,
                },
            }

        # ── 3. Generative Cognitive Synthesis with System 2 / Connected LLM ──
        if settings.llm_api_key or getattr(settings, "ollama_api_key", None):
            try:
                system_prompt = (
                    "You are Vaeloom, an elite executive career strategist, psychological counselor, "
                    "and second brain. You treat the user with unconditional positive regard, deep empathy, "
                    "and strategic competence.\n\n"
                    "Core Principles:\n"
                    "1. Psychological Containment: If the user expresses anxiety, burnout, or job search fatigue, "
                    "validate their feelings (Carl Rogers OARS). Never dismiss them or offer toxic positivity.\n"
                    "2. Senior Competence: Speak with executive clarity. Frame accomplishments around measurable "
                    "business impact (Google X-Y-Z formula: Accomplished [X], measured by [Y], by doing [Z]).\n"
                    "3. Action Scaffolding: Keep your response concise (<3 sentences where possible) and end with "
                    "a clear, low-friction micro-step.\n"
                    "4. Zero Internal Telemetry: Never mention bot names, confidence scores, or routing algorithms."
                )

                resp = await llm_service.generate_completion(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": msg},
                    ],
                    temperature=0.7,
                    max_tokens=512,
                )
                text = resp.get("content", "").strip()
                if text:
                    return {
                        "agent_name": "conversation",
                        "action": "suggest",
                        "confidence": 0.90,
                        "result": {
                            "summary": text,
                            "details": None,
                            "proposals": proposals_payload,
                            "questions": [],
                            "action_chips": dynamic_chips,
                        },
                    }
            except Exception as e:
                logger.warning(f"ConversationAgent LLM completion failed, falling back to deterministic: {e}")

        # ── 4. Deterministic Consultative Fallback ───────────────────────────
        return {
            "agent_name": "conversation",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": (
                    "I understand you're looking for guidance. To make sure you get the highest leverage, "
                    "how can I best assist you right now?"
                ),
                "details": None,
                "proposals": proposals_payload,
                "questions": [],
                "action_chips": dynamic_chips,
            },
        }
