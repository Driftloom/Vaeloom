"""
Gmail Agent — classify email, extract deadlines, draft responses.
NEVER sends email without user approval. Draft-only policy.
Supports both scheduled (6 AM daily) and push-triggered paths.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class ClassifiedEmail(BaseModel):
    email_id: str
    subject: str
    sender: str
    classification: str  # urgent | important | informational | low_priority
    extracted_deadline: Optional[str] = None
    is_high_priority: bool = False  # interview, deadline-today


class GmailAgent(BaseAgent):
    mission = "Classify mail, extract deadlines/tasks, draft responses (never send)"
    tools = [
        Tool(name="search_gmail", description="Search Gmail inbox"),
        Tool(name="draft_email", description="Draft email (never sends)"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["communications"],
        write_types=["schedule_events", "episodic"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "gmail",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need access to your Gmail to classify emails.",
                "details": None,
                "proposals": [],
                "questions": ["Would you like to connect your Gmail account?"],
            },
        }

    async def classify_emails(
        self, emails: List[Dict[str, Any]], trigger: str = "scheduled"
    ) -> Dict[str, Any]:
        """
        Classify a batch of emails. Supports both 'scheduled' and 'push' triggers.
        Push-triggered path fires immediately on high-priority items.
        """
        classified: List[ClassifiedEmail] = []
        high_priority: List[ClassifiedEmail] = []

        for email in emails:
            classification = self._classify(email)
            deadline = self._extract_deadline(email)
            is_hp = classification.classification in ("urgent",) or classification.is_high_priority

            classified.append(classification)
            if is_hp:
                high_priority.append(classification)

        # If push-triggered and we found high-priority items, flag them immediately
        if trigger == "push" and high_priority:
            logger.info(f"PUSH TRIGGER: {len(high_priority)} high-priority emails detected")
            return {
                "agent_name": "gmail",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": f"🚨 {len(high_priority)} high-priority email(s) detected!",
                    "details": [e.model_dump() for e in high_priority],
                    "proposals": [],
                    "questions": [],
                },
                "metadata": {"trigger": "push", "high_priority_count": len(high_priority)},
            }

        return {
            "agent_name": "gmail",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": f"Classified {len(classified)} emails: {len(high_priority)} high-priority.",
                "details": [e.model_dump() for e in classified],
                "proposals": [],
                "questions": [],
            },
            "metadata": {"trigger": trigger},
        }

    def _classify(self, email: Dict[str, Any]) -> ClassifiedEmail:
        """Classify a single email."""
        subject = email.get("subject", "").lower()
        body = email.get("body", "").lower()
        combined = f"{subject} {body}"

        is_high_priority = False
        if any(kw in combined for kw in ["interview", "deadline today", "urgent", "immediate"]):
            classification = "urgent"
            is_high_priority = True
        elif any(kw in combined for kw in ["offer", "deadline", "follow up", "action required"]):
            classification = "important"
        elif any(kw in combined for kw in ["newsletter", "unsubscribe", "promotion"]):
            classification = "low_priority"
        else:
            classification = "informational"

        deadline = self._extract_deadline(email)

        return ClassifiedEmail(
            email_id=email.get("id", "unknown"),
            subject=email.get("subject", ""),
            sender=email.get("sender", ""),
            classification=classification,
            extracted_deadline=deadline,
            is_high_priority=is_high_priority,
        )

    def _extract_deadline(self, email: Dict[str, Any]) -> Optional[str]:
        """Extract deadline from email content. Real impl uses NLP/LLM."""
        body = email.get("body", "").lower()
        if "tomorrow" in body:
            return "tomorrow"
        if "deadline" in body:
            return "deadline_detected"
        return None
