import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

STATE_DIR = Path(os.environ.get("VAELOOM_STATE_DIR", str(Path.home() / ".vaeloom" / "state")))


class LoopState:
    def __init__(self, request_id: str):
        self.request_id = request_id
        self.phases: dict[str, Any] = {}
        self.created_at: str = datetime.now(UTC).isoformat()
        self.updated_at: str = self.created_at

    def add_phase(self, phase_name: str, result: Any):
        self.phases[phase_name] = result
        self.updated_at = datetime.now(UTC).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "phases": self._serialize_phases(),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    def _serialize_phases(self) -> dict[str, Any]:
        serialized = {}
        for key, value in self.phases.items():
            if hasattr(value, "model_dump"):
                serialized[key] = value.model_dump()
            elif hasattr(value, "dict"):
                serialized[key] = value.dict()
            elif isinstance(value, (str, int, float, bool, list, dict)):
                serialized[key] = value
            else:
                serialized[key] = str(value)
        return serialized

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LoopState":
        state = cls(data["request_id"])
        state.phases = data.get("phases", {})
        state.created_at = data.get("created_at", "")
        state.updated_at = data.get("updated_at", "")
        return state


async def load_or_create_state(request_id: str) -> LoopState:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{request_id}.json"
    if state_file.exists():
        try:
            data = json.loads(state_file.read_text())
            logger.info(f"Loaded existing state for {request_id}")
            return LoopState.from_dict(data)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load state for {request_id}: {e}")
    return LoopState(request_id)


async def save_checkpoint(state: LoopState):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_file = STATE_DIR / f"{state.request_id}.json"
    try:
        state_file.write_text(json.dumps(state.to_dict(), indent=2, default=str))
        logger.info(f"Checkpoint saved for {state.request_id}: phases={list(state.phases.keys())}")
    except OSError as e:
        logger.error(f"Failed to save checkpoint for {state.request_id}: {e}")
