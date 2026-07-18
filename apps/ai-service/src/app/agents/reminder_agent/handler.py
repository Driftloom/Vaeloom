"""
Reminder Agent — manage deadlines, follow-ups, and task reminders.
Full autonomy (reminders only). Respects user's time and priority preferences.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ReminderAgent(BaseAgent):
    mission = "Manage deadlines, follow-ups, and task reminders"
    tools = [
        Tool(name="check_deadlines", description="Check upcoming deadlines and alert user"),
        Tool(name="schedule_followup", description="Schedule follow-up reminders for tasks"),
        Tool(name="sort_by_priority", description="Sort and prioritize pending items"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["tasks", "deadlines", "schedule", "priorities"],
        write_types=["tasks", "deadlines", "reminders"],
    )
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return {
            "agent_name": "reminder",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need details to manage reminders.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What task or deadline should I track?",
                    "When is it due?",
                ],
            },
        }

    async def check_deadlines(
        self,
        tasks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_deadlines(tasks)
        try:
            tasks_str = "; ".join([f"{t.get('name','Task')} due {t.get('due_date','unknown')} (priority: {t.get('priority','medium')})" for t in tasks])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a deadline management assistant. Analyze deadlines and provide alerts. Return JSON with: urgent_items, upcoming_deadlines, overdue_items, recommended_actions, priority_order."},
                {"role": "user", "content": f"Tasks:\n{tasks_str}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "reminder",
                "action": "alert",
                "confidence": 0.9,
                "result": {
                    "summary": f"Deadline check: {len(tasks)} tasks analyzed",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Deadline check failed: {e}")
            return self._fallback_deadlines(tasks)

    async def schedule_followup(
        self,
        context: str,
        proposed_time: Optional[str] = None,
        recurrence: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_followup(context)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a scheduling assistant. Help schedule follow-up reminders. Return JSON with: scheduled_reminder, suggested_times, recurrence_pattern, confirmation_details."},
                {"role": "user", "content": f"Context: {context}\nProposed time: {proposed_time or 'Best available'}\nRecurrence: {recurrence or 'None'}"},
            ], temperature=0.4, max_tokens=512)
            return {
                "agent_name": "reminder",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Follow-up scheduled for: {context[:50]}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Follow-up scheduling failed: {e}")
            return self._fallback_followup(context)

    async def sort_by_priority(
        self,
        items: List[Dict[str, Any]],
        criteria: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_priority(items)
        try:
            items_str = "; ".join([f"{i.get('name','Item')} (due: {i.get('due_date','N/A')}, urgency: {i.get('urgency','medium')})" for i in items])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a prioritization expert. Sort and prioritize tasks. Return JSON with: prioritized_list, reasoning, urgent_actions, deferrable_items, recommended_focus."},
                {"role": "user", "content": f"Items:\n{items_str}\nCriteria: {criteria or 'Default (deadline + urgency)'}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "reminder",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Prioritized {len(items)} items",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Priority sort failed: {e}")
            return self._fallback_priority(items)

    def _fallback_deadlines(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "reminder",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Deadline check on {len(tasks)} tasks",
                "details": {"tasks_count": len(tasks), "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_followup(self, context: str) -> Dict[str, Any]:
        return {
            "agent_name": "reminder",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Follow-up for: {context[:50]}",
                "details": {"context": context, "note": "Detailed scheduling requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_priority(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "reminder",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Priority sort of {len(items)} items",
                "details": {"items_count": len(items), "note": "Detailed prioritization requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
