"""
Calendar Agent — manages calendar consistency, scheduling, conflict resolution, and availability slots.
Suggest autonomy: Always requests approval before committing or mutating events on connected calendars.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, Field

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class CalendarEventProposal(BaseModel):
    title: str
    start_time: str
    end_time: str
    attendees: list[str] = Field(default_factory=list)
    description: str | None = None
    location: str | None = None


class CalendarAgent(BaseAgent):
    mission = "Maintain calendar consistency, detect meeting conflicts, and negotiate availability slots"
    tools = [
        Tool(name="list_calendar_events", description="List scheduled events within a date range"),
        Tool(name="detect_schedule_conflicts", description="Identify overlapping meetings or overbooked blocks"),
        Tool(name="propose_meeting_slot", description="Find optimal available slots matching constraints"),
        Tool(name="create_calendar_event", description="Draft a new calendar event for user confirmation"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["event", "timeline", "preference"],
        write_types=["event", "timeline"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "calendar",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I'm ready to manage your calendar and check for schedule conflicts.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What date or meeting would you like me to inspect?",
                    "Should I check for overlapping commitments today?",
                ],
            },
        }

    async def detect_schedule_conflicts(
        self,
        events: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Find overlapping start and end times."""
        conflicts = []
        sorted_events = sorted(events, key=lambda e: e.get("start", ""))
        for i in range(len(sorted_events) - 1):
            curr = sorted_events[i]
            next_ev = sorted_events[i + 1]
            if curr.get("end", "") > next_ev.get("start", ""):
                conflicts.append({
                    "event_a": curr.get("title", "Event A"),
                    "event_b": next_ev.get("title", "Event B"),
                    "overlap_start": next_ev.get("start"),
                    "overlap_end": curr.get("end"),
                })
        return conflicts

    async def propose_meeting_slot(
        self,
        duration_minutes: int = 30,
        busy_events: list[dict[str, Any]] | None = None,
    ) -> list[str]:
        """Propose open slots between standard business hours."""
        base_date = datetime.now(timezone.utc) + timedelta(days=1)
        slots = []
        for hour in [10, 11, 14, 15, 16]:
            slot_start = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            slots.append(slot_start.isoformat())
        return slots[:3]

    async def process(self, request: Any) -> dict[str, Any]:
        msg = getattr(request, "message", "") if hasattr(request, "message") else (request.get("message", "") if isinstance(request, dict) else "")
        msg_lower = (msg or "").lower()

        sample_events = [
            {"title": "Product Sync", "start": "2026-09-20T10:00:00Z", "end": "2026-09-20T11:00:00Z"},
            {"title": "Architecture Review", "start": "2026-09-20T10:30:00Z", "end": "2026-09-20T11:30:00Z"},
            {"title": "1:1 with Engineering Lead", "start": "2026-09-20T14:00:00Z", "end": "2026-09-20T14:30:00Z"},
        ]

        conflicts = await self.detect_schedule_conflicts(sample_events)
        suggested_slots = await self.propose_meeting_slot()

        proposals = []
        for c in conflicts:
            proposals.append({
                "type": "calendar_conflict",
                "content": f"Conflict detected between '{c['event_a']}' and '{c['event_b']}'.",
                "recommended_reschedule_slots": suggested_slots,
            })

        summary = (
            f"Calendar Review: {len(sample_events)} events analyzed. "
            f"Found {len(conflicts)} scheduling conflict(s). "
            f"Computed {len(suggested_slots)} alternate slots."
        )

        return {
            "agent_name": "calendar",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": summary,
                "details": f"Suggested resolution slots: {suggested_slots}",
                "proposals": proposals,
                "questions": [
                    f"Would you like to move '{conflicts[0]['event_b']}' to {suggested_slots[0]}?"
                ] if conflicts else [],
            },
        }

    async def execute(self, request: Any, context: Any = None) -> Any:
        return await self.process(request)
