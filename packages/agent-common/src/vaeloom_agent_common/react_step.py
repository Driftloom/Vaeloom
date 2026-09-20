from typing import Any, Optional
from pydantic import BaseModel, Field


class ReActStep(BaseModel):
    step_index: int
    thought: str
    action_name: Optional[str] = None
    action_input: dict[str, Any] = Field(default_factory=dict)
    observation: Optional[Any] = None
    is_final: bool = False
    final_answer: Optional[str] = None
