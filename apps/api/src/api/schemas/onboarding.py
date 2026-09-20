import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


VALID_ONBOARDING_STEPS = ["PROFILE", "WORKSPACE", "RESUME", "CONNECTORS", "COMPLETED"]


class OnboardingStateResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID | None = None
    current_step: str = "PROFILE"
    completed_steps: list[str] = Field(default_factory=list)
    is_completed: bool = False
    step_data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateOnboardingStepRequest(BaseModel):
    step: str = Field(..., description="The onboarding step being completed or transitioned to")
    step_data: dict[str, Any] = Field(default_factory=dict, description="Arbitrary step payload")


class CompleteOnboardingRequest(BaseModel):
    final_data: dict[str, Any] = Field(default_factory=dict, description="Optional completion payload")
