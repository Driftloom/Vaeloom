"""
Gmail Agent — classify email, extract deadlines, draft responses.
NEVER sends email without user approval. Draft-only policy.
Supports both scheduled (6 AM daily) and push-triggered paths.
"""
import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ClassifiedEmail(BaseModel):
    email_id: str
    subject: str
    sender: str
    classification: str
    extracted_deadline: Optional[str] = None
    is_high_priority: bool = False


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
        classified: List[ClassifiedEmail] = []
        high_priority: List[ClassifiedEmail] = []

        for email in emails:
            classification = await self._classify(email)
            is_hp = classification.classification in ("urgent",) or classification.is_high_priority

            classified.append(classification)
            if is_hp:
                high_priority.append(classification)

        if trigger == "push" and high_priority:
            logger.info(f"PUSH TRIGGER: {len(high_priority)} high-priority emails detected")
            return {
                "agent_name": "gmail",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": f"{len(high_priority)} high-priority email(s) detected!",
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

    async def _classify(self, email: Dict[str, Any]) -> ClassifiedEmail:
        if not settings.llm_api_key:
            return self._keyword_classify(email)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an email classification assistant. Classify the email and extract any deadlines. Return ONLY valid JSON: {\"classification\": \"urgent\"|\"important\"|\"informational\"|\"low_priority\", \"is_high_priority\": bool, \"deadline\": \"description or null\"}"},
                {"role": "user", "content": f"Subject: {email.get('subject', '')}\nFrom: {email.get('sender', '')}\nBody: {email.get('body', '')}"},
            ], temperature=0.3, max_tokens=200)
            text = response["content"].strip()
            text = text.replace("```json", "").replace("```", "").strip()
            data = json.loads(text)
            return ClassifiedEmail(
                email_id=email.get("id", "unknown"),
                subject=email.get("subject", ""),
                sender=email.get("sender", ""),
                classification=data.get("classification", "informational"),
                extracted_deadline=data.get("deadline"),
                is_high_priority=data.get("is_high_priority", False),
            )
        except Exception as e:
            logger.warning(f"LLM classification failed, falling back to keyword: {e}")
            return self._keyword_classify(email)

    def _keyword_classify(self, email: Dict[str, Any]) -> ClassifiedEmail:
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

        deadline = self._extract_deadline_keyword(email)

        return ClassifiedEmail(
            email_id=email.get("id", "unknown"),
            subject=email.get("subject", ""),
            sender=email.get("sender", ""),
            classification=classification,
            extracted_deadline=deadline,
            is_high_priority=is_high_priority,
        )

    def _extract_deadline_keyword(self, email: Dict[str, Any]) -> Optional[str]:
        body = email.get("body", "").lower()
        if "tomorrow" in body:
            return "tomorrow"
        if "deadline" in body:
            return "deadline_detected"
        return None
