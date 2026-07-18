"""
Scheduler Agent — maintain deadlines, detect conflicts, manage schedule.
Full autonomy for reminders (notify-only); suggest-only for adding/editing events.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class ScheduleEvent(BaseModel):
    event_id: str
    title: str
    start_time: str
    end_time: Optional[str] = None
    source: str  # gmail | manual | application
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
    default_autonomy = "full"  # For reminders only; suggest for edits

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
        """Check for scheduling conflicts across all event sources."""
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

        # Detect conflicts (simplified: check for same-time events)
        conflicts_found = []
        for i, evt_a in enumerate(parsed_events):
            for evt_b in parsed_events[i + 1:]:
                if self._times_overlap(evt_a, evt_b):
                    evt_a.has_conflict = True
                    evt_a.conflict_with = evt_b.event_id
                    evt_b.has_conflict = True
                    evt_b.conflict_with = evt_a.event_id
                    conflicts_found.append((evt_a.title, evt_b.title))

        if conflicts_found:
            return {
                "agent_name": "scheduler",
                "action": "suggest",
                "confidence": 0.9,
                "result": {
                    "summary": f"⚠️ {len(conflicts_found)} scheduling conflict(s) detected!",
                    "details": [e.model_dump() for e in parsed_events],
                    "proposals": [],
                    "questions": [
                        f"'{a}' conflicts with '{b}' — which takes priority?"
                        for a, b in conflicts_found
                    ],
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
        """
        Send a reminder notification. This is the ONLY action with full autonomy.
        Notify-only actions are safe to automate.
        """
        logger.info(f"REMINDER (full autonomy): {event.get('title', 'Event')}")
        return {
            "agent_name": "scheduler",
            "action": "execute",  # Full autonomy for reminders
            "confidence": 1.0,
            "result": {
                "summary": f"Reminder sent for: {event.get('title', 'Event')}",
                "details": {"event": event, "reminder_type": "notification"},
                "proposals": [],
                "questions": [],
            },
        }

    def _times_overlap(self, a: ScheduleEvent, b: ScheduleEvent) -> bool:
        """Check if two events overlap. Simplified comparison."""
        # In a real impl, parse ISO timestamps and compare ranges
        return a.start_time == b.start_time and a.start_time != ""
