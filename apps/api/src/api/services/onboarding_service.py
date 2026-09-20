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
            # If workspace_id not provided, try to find default workspace (owned or invited membership)
            if not workspace_id:
                ws_result = await db.execute(
                    select(Workspace.id).where(Workspace.user_id == user_id).limit(1)
                )
                workspace_id = ws_result.scalar_one_or_none()

            if not workspace_id:
                from ..models.schema import WorkspaceUser
                wu_result = await db.execute(
                    select(WorkspaceUser.workspace_id).where(WorkspaceUser.user_id == user_id).limit(1)
                )
                workspace_id = wu_result.scalar_one_or_none()

            completed = ["WORKSPACE"] if workspace_id else []
            step = "RESUME" if workspace_id else "PROFILE"

            state = OnboardingState(
                user_id=user_id,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                current_step=step,
                completed_steps=completed,
                is_completed=False,
                step_data={"invited_workspace": str(workspace_id)} if workspace_id else {},
            )
            db.add(state)
            await db.commit()
            await db.refresh(state)
        else:
            # If user has an invited workspace membership (role='member') and onboarding is not completed
            if not state.is_completed:
                from ..models.schema import WorkspaceUser
                mem_res = await db.execute(
                    select(WorkspaceUser.workspace_id)
                    .where(WorkspaceUser.user_id == user_id, WorkspaceUser.role == "member")
                    .limit(1)
                )
                invited_ws = mem_res.scalar_one_or_none()
                if invited_ws and state.workspace_id != invited_ws:
                    state.workspace_id = invited_ws
                    completed = set(state.completed_steps or [])
                    completed.add("WORKSPACE")
                    state.completed_steps = list(completed)
                    if state.current_step in ("PROFILE", "WORKSPACE"):
                        state.current_step = "RESUME"
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

        # Zero-Trust Immutability Guard (GAP-ONB-02)
        if state and state.is_completed:
            raise HTTPException(
                status_code=400,
                detail="Onboarding has already been completed and cannot be modified. Use /reset to restart.",
            )

        # Zero-Trust Strict Step Prerequisites (GAP-ONB-01)
        STEP_SEQUENCE = ["PROFILE", "WORKSPACE", "RESUME", "CONNECTORS", "COMPLETED"]
        completed_set = set(state.completed_steps or []) if state else set()
        if state and state.workspace_id:
            completed_set.add("WORKSPACE")

        target_idx = STEP_SEQUENCE.index(step)
        current_idx = STEP_SEQUENCE.index(state.current_step) if (state and state.current_step in STEP_SEQUENCE) else 0

        if target_idx > current_idx + 1:
            # Attempting to skip ahead by more than 1 step: verify all preceding steps are completed
            for i in range(target_idx):
                prereq = STEP_SEQUENCE[i]
                if prereq not in completed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot proceed to step '{step}': prerequisite step '{prereq}' has not been completed.",
                    )
        elif target_idx == current_idx + 1:
            # Moving to the immediate next step: verify all steps up to current_idx are completed
            for i in range(current_idx):
                prereq = STEP_SEQUENCE[i]
                if prereq not in completed_set:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Cannot proceed to step '{step}': prerequisite step '{prereq}' has not been completed.",
                    )

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

    async def reset(
        self,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> OnboardingStateResponse:
        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            return await self.get_or_create_state(user_id=user_id, db=db)

        state.current_step = "PROFILE"
        state.completed_steps = []
        state.is_completed = False
        state.step_data = {}
        await db.commit()
        await db.refresh(state)
        return OnboardingStateResponse.model_validate(state)

    async def process_resume_upload(
        self,
        user_id: uuid.UUID,
        file: Any,
        db: AsyncSession,
    ) -> dict[str, Any]:
        import io
        import re
        from datetime import UTC, datetime

        filename = getattr(file, "filename", "resume.txt") or "resume.txt"
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        allowed_exts = {"pdf", "docx", "txt", "md", "json"}
        if ext not in allowed_exts:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: .{ext}. Allowed formats: {', '.join(sorted(allowed_exts))}",
            )

        content_bytes = await file.read()
        max_bytes = 10 * 1024 * 1024  # 10 MB
        if len(content_bytes) > max_bytes:
            raise HTTPException(status_code=413, detail="File too large — max 10MB")

        # Zero-Trust Magic Byte & Content Verification (GAP-ONB-03)
        if ext == "pdf":
            if not content_bytes.startswith(b"%PDF-"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid PDF file: missing %PDF- header magic bytes (spoofed or corrupted format)",
                )
        elif ext == "docx":
            if not content_bytes.startswith(b"PK\x03\x04"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid DOCX file: missing PK zip header magic bytes (spoofed or corrupted format)",
                )
        elif ext in ("txt", "md", "json"):
            if content_bytes.startswith(b"MZ") or content_bytes.startswith(b"\x7fELF"):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid text file: binary executable payload rejected",
                )
            try:
                content_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid text file: non-UTF-8 binary content rejected",
                )

        extracted_text = ""
        if ext in ("txt", "md", "json"):
            extracted_text = content_bytes.decode("utf-8", errors="ignore")
        elif ext == "pdf":
            try:
                import fitz
                doc = fitz.open(stream=content_bytes, filetype="pdf")
                for page in doc:
                    extracted_text += page.get_text() + "\n"
            except Exception as e:
                logger.warning(f"Failed to parse PDF with fitz: {e}")
                extracted_text = content_bytes.decode("utf-8", errors="ignore")
        elif ext == "docx":
            try:
                import docx
                doc = docx.Document(io.BytesIO(content_bytes))
                extracted_text = "\n".join(p.text for p in doc.paragraphs)
            except Exception as e:
                logger.warning(f"Failed to parse DOCX: {e}")
                extracted_text = content_bytes.decode("utf-8", errors="ignore")

        # Skill catalog matching
        skill_catalog = [
            "Python", "TypeScript", "JavaScript", "React", "Next.js", "Node.js",
            "FastAPI", "SQL", "PostgreSQL", "SQLite", "Redis", "Docker", "Kubernetes",
            "AWS", "GCP", "Azure", "GraphQL", "REST", "Git", "CI/CD", "Rust", "Go",
            "Java", "C++", "Tailwind", "PyTorch", "TensorFlow", "Scikit-Learn",
            "LangChain", "OpenAI", "Anthropic", "Playwright", "Jest", "Pytest"
        ]
        found_skills = []
        for s in skill_catalog:
            if re.search(r"\b" + re.escape(s) + r"\b", extracted_text, re.IGNORECASE):
                found_skills.append(s)

        # Get or create state
        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            state = OnboardingState(
                user_id=user_id,
                current_step="RESUME",
                completed_steps=[],
                is_completed=False,
                step_data={},
            )
            db.add(state)

        existing_data = dict(state.step_data or {})
        existing_data["resume"] = {
            "filename": filename,
            "extracted_skills": found_skills,
            "summary_snippet": extracted_text[:400].strip(),
            "uploaded_at": datetime.now(UTC).isoformat(),
        }

        # Merge extracted skills into existing skills string
        prev_skills = existing_data.get("skills", "")
        existing_skills_list = [s.strip() for s in prev_skills.split(",") if s.strip()] if prev_skills else []
        combined_skills = sorted(set(existing_skills_list + found_skills))
        existing_data["skills"] = ", ".join(combined_skills)
        state.step_data = existing_data

        completed = list(state.completed_steps or [])
        if "RESUME" not in completed:
            completed.append("RESUME")
        state.completed_steps = completed

        await db.commit()
        await db.refresh(state)

        return {
            "filename": filename,
            "extracted_skills": found_skills,
            "skills_count": len(found_skills),
            "state": OnboardingStateResponse.model_validate(state),
        }

    async def join_workspace(
        self,
        user_id: uuid.UUID,
        workspace_id: uuid.UUID,
        db: AsyncSession,
    ) -> OnboardingStateResponse:
        from ..models.schema import Workspace, WorkspaceUser

        # Verify workspace exists
        ws_res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
        ws = ws_res.scalar_one_or_none()
        if not ws:
            raise HTTPException(status_code=404, detail=f"Workspace '{workspace_id}' not found")

        # Check membership
        mem_res = await db.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.workspace_id == workspace_id,
                WorkspaceUser.user_id == user_id,
            )
        )
        membership = mem_res.scalar_one_or_none()
        is_owner = (ws.user_id == user_id)
        if not is_owner and not membership:
            # Zero-Trust Authorization Guard (GAP-TEN-02):
            # Caller must either already be invited/member or be the workspace owner.
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You have not been invited to join this workspace",
            )

        # Update onboarding state
        result = await db.execute(
            select(OnboardingState).where(OnboardingState.user_id == user_id)
        )
        state = result.scalar_one_or_none()
        if not state:
            state = OnboardingState(
                user_id=user_id,
                workspace_id=workspace_id,
                current_step="RESUME",
                completed_steps=["PROFILE", "WORKSPACE"],
                is_completed=False,
                step_data={"joined_workspace": str(workspace_id)},
            )
            db.add(state)
        else:
            state.workspace_id = workspace_id
            completed = set(state.completed_steps or [])
            completed.add("WORKSPACE")
            state.completed_steps = list(completed)
            if state.current_step in ("PROFILE", "WORKSPACE"):
                state.current_step = "RESUME"
            step_data = dict(state.step_data or {})
            step_data["joined_workspace"] = str(workspace_id)
            state.step_data = step_data

        await db.commit()
        await db.refresh(state)
        return OnboardingStateResponse.model_validate(state)


onboarding_service = OnboardingService()

