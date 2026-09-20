import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import OnboardingState, Workspace
from ..schemas.onboarding import OnboardingStateResponse, VALID_ONBOARDING_STEPS


class OnboardingService:
    async def get_or_create_state(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None = None,
        workspace_id: uuid.UUID | None = None,
        db: AsyncSession | None = None,
    ) -> OnboardingStateResponse:
        if db is None:
            raise HTTPException(status_code=500, detail="Database session required")

        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            # If workspace_id not provided, try to find default workspace
            if not workspace_id:
                ws_result = await db.execute(
                    select(Workspace.id).where(Workspace.user_id == user_id).limit(1)
                )
                workspace_id = ws_result.scalar_one_or_none()

            state = OnboardingState(
                user_id=user_id,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                current_step="PROFILE",
                completed_steps=[],
                is_completed=False,
                step_data={},
            )
            db.add(state)
            await db.commit()
            await db.refresh(state)

        return OnboardingStateResponse.model_validate(state)

    async def update_step(
        self,
        user_id: uuid.UUID,
        step: str,
        step_data: dict[str, Any],
        db: AsyncSession,
    ) -> OnboardingStateResponse:
        if step not in VALID_ONBOARDING_STEPS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid onboarding step: '{step}'. Valid steps are: {VALID_ONBOARDING_STEPS}",
            )

        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            state = OnboardingState(
                user_id=user_id,
                current_step=step,
                completed_steps=[],
                is_completed=(step == "COMPLETED"),
                step_data=step_data or {},
            )
            db.add(state)
        else:
            current = state.current_step
            completed_steps = list(state.completed_steps or [])
            if current not in completed_steps and current != step:
                completed_steps.append(current)
            state.completed_steps = completed_steps
            state.current_step = step

            existing_data = dict(state.step_data or {})
            if step_data:
                existing_data[step.lower()] = step_data
                existing_data.update(step_data)
            state.step_data = existing_data

            if step == "COMPLETED":
                state.is_completed = True

        await db.commit()
        await db.refresh(state)
        return OnboardingStateResponse.model_validate(state)

    async def complete(
        self,
        user_id: uuid.UUID,
        final_data: dict[str, Any],
        db: AsyncSession,
    ) -> OnboardingStateResponse:
        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            state = OnboardingState(
                user_id=user_id,
                current_step="COMPLETED",
                completed_steps=["PROFILE", "WORKSPACE", "RESUME", "CONNECTORS"],
                is_completed=True,
                step_data=final_data or {},
            )
            db.add(state)
        else:
            state.current_step = "COMPLETED"
            state.is_completed = True
            completed_steps = set(state.completed_steps or [])
            completed_steps.update(["PROFILE", "WORKSPACE", "RESUME", "CONNECTORS"])
            state.completed_steps = list(completed_steps)
            if final_data:
                existing_data = dict(state.step_data or {})
                existing_data.update(final_data)
                state.step_data = existing_data

        await db.commit()
        await db.refresh(state)
        return OnboardingStateResponse.model_validate(state)


onboarding_service = OnboardingService()
