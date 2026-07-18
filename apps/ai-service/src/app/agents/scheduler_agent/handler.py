"""
Scheduler Agent — maintain deadlines, detect conflicts, manage schedule.
Full autonomy for reminders (notify-only); suggest-only for adding/editing events.
"""
import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ScheduleEvent(BaseModel):
    event_id: str
    title: str
    start_time: str
    end_time: Optional[str] = None
    source: str
    has_conflict: bool = False
    conflict_with: Optional[str] = None


class SchedulerAgent(BaseAgent):
    mission = "Maintain deadlines, detect conflicts, manage schedule"
    tools = [
        Tool(name="create_calendar_event", description="Create calendar event"),
        Tool(name="list_calendar_events", description="List calendar events"),
        Tool(name="search_documents", description="Search for deadline sources"),
        Tool(name="notify_user", description="Send reminder notification"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["schedule_events", "timeline", "deadlines"],
        write_types=["timeline"],
    )
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return {
            "agent_name": "scheduler",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to manage this schedule item.",
                "details": None,
                "proposals": [],
                "questions": ["What event or deadline would you like me to track?"],
            },
        }

    async def check_conflicts(
        self, events: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        parsed_events = [
            ScheduleEvent(
                event_id=e.get("id", f"evt_{i}"),
                title=e.get("title", "Untitled"),
                start_time=e.get("start_time", ""),
                end_time=e.get("end_time"),
                source=e.get("source", "manual"),
            )
            for i, e in enumerate(events)
        ]

        conflicts_found = []
        for i, evt_a in enumerate(parsed_events):
            for evt_b in parsed_events[i + 1:]:
                if await self._times_overlap(evt_a, evt_b):
                    evt_a.has_conflict = True
                    evt_a.conflict_with = evt_b.event_id
                    evt_b.has_conflict = True
                    evt_b.conflict_with = evt_a.event_id
                    conflicts_found.append((evt_a.title, evt_b.title))

        if conflicts_found:
            conflict_details = []
            for a_title, b_title in conflicts_found:
                conflict_details.append(f"'{a_title}' conflicts with '{b_title}' — which takes priority?")

            return {
                "agent_name": "scheduler",
                "action": "suggest",
                "confidence": 0.9,
                "result": {
                    "summary": f"{len(conflicts_found)} scheduling conflict(s) detected!",
                    "details": [e.model_dump() for e in parsed_events],
                    "proposals": [],
                    "questions": conflict_details,
                },
            }

        return {
            "agent_name": "scheduler",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": f"No conflicts found across {len(parsed_events)} events.",
                "details": [e.model_dump() for e in parsed_events],
                "proposals": [],
                "questions": [],
            },
        }

    async def send_reminder(self, event: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"REMINDER: {event.get('title', 'Event')}")
        return {
            "agent_name": "scheduler",
            "action": "execute",
            "confidence": 1.0,
            "result": {
                "summary": f"Reminder sent for: {event.get('title', 'Event')}",
                "details": {"event": event, "reminder_type": "notification"},
                "proposals": [],
                "questions": [],
            },
        }

    async def _times_overlap(self, a: ScheduleEvent, b: ScheduleEvent) -> bool:
        if not a.start_time or not b.start_time:
            return False

        if settings.llm_api_key:
            try:
                response = await llm_service.generate_completion([
                    {"role": "system", "content": "Determine if two scheduled events overlap in time. Return ONLY valid JSON: {\"overlap\": bool, \"reason\": \"...\"}. Consider that events with no end_time are 1 hour long."},
                    {"role": "user", "content": f"Event A: '{a.title}' starts at {a.start_time}, ends at {a.end_time or 'not specified'}\nEvent B: '{b.title}' starts at {b.start_time}, ends at {b.end_time or 'not specified'}."},
                ], temperature=0.1, max_tokens=150)
                text = response["content"].strip()
                text = text.replace("```json", "").replace("```", "").strip()
                data = json.loads(text)
                return data.get("overlap", False)
            except Exception as e:
                logger.warning(f"LLM conflict check failed, using simple check: {e}")

        return a.start_time == b.start_time and a.start_time != ""
