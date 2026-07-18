import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class LoopState:
    def __init__(self, request_id: str):
        self.request_id = request_id
        self.phases: Dict[str, Any] = {}

    def add_phase(self, phase_name: str, result: Any):
        self.phases[phase_name] = result

async def load_or_create_state(request_id: str) -> LoopState:
    # Mock Redis lookup
    logger.info(f"Loading state for {request_id}")
    return LoopState(request_id)

async def save_checkpoint(state: LoopState):
    # Mock Redis save
    logger.info(f"Checkpointing state for {state.request_id}: {list(state.phases.keys())}")
