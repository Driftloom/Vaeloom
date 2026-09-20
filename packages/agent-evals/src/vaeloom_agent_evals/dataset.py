from typing import Any, Optional
from pydantic import BaseModel, Field


class EvalScenario(BaseModel):
    scenario_id: str
    target_agent: str
    user_prompt: str
    expected_tools: list[str] = Field(default_factory=list)
    forbidden_tools: list[str] = Field(default_factory=list)
    expected_substrings: list[str] = Field(default_factory=list)
    max_allowed_steps: int = Field(default=10, ge=1)
