import json
import time
from uuid import UUID
from typing import Any
from vaeloom_agent_contracts import SSEEvent, SSEEventType


class SSEFormatter:
    """Formats canonical SSE events for streaming endpoints."""

    @staticmethod
    def format_event(event_type: SSEEventType, session_id: UUID, step_index: int, payload: dict[str, Any]) -> str:
        evt = SSEEvent(
            event=event_type,
            session_id=session_id,
            step_index=step_index,
            payload=payload,
            timestamp=time.time(),
        )
        data = evt.model_dump_json()
        return f"event: {event_type.value}\ndata: {data}\n\n"
