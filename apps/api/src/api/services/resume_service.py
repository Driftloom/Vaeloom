import uuid

from fastapi import HTTPException
from sqlalchemy import select

from ..models.schema import Resume, ResumeArtifact


class ResumeService:
    async def list_for_workspace(self, workspace_id: str, db=None):
        result = await db.execute(
            select(Resume)
            .where(Resume.workspace_id == uuid.UUID(workspace_id))
            .order_by(Resume.created_at.desc())
        )
        return result.scalars().all()

    async def get_master(self, workspace_id: str, db=None):
        result = await db.execute(
            select(Resume).where(
                Resume.workspace_id == uuid.UUID(workspace_id),
                Resume.variant_type == "master",
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, resume_id: str, workspace_id: str | None, db=None) -> Resume:
        result = await db.execute(select(Resume).where(Resume.id == uuid.UUID(resume_id)))
        resume = result.scalar_one_or_none()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        if workspace_id and str(resume.workspace_id) != str(uuid.UUID(workspace_id)):
            raise HTTPException(status_code=403, detail="Resume does not belong to this workspace")
        return resume

    async def generate_variant(self, resume_id: str, dto, user_id: str, db=None):
        base = await self.get_by_id(resume_id, None, db=db)
        new_resume = Resume(
            workspace_id=base.workspace_id,
            variant_type=dto.variant_type,
            content=base.content,
            version=base.version + 1,
            generated_from_snapshot=str(base.id),
        )
        db.add(new_resume)
        await db.flush()
        await db.refresh(new_resume)
        return new_resume

    async def create_tailored_variant(self, resume_id: str, tailored_content: dict,
                                      meta: dict, user_id: str, db=None) -> Resume:
        """Persist a tailored variant produced by ResumeAgent.tailor_content."""
        base = await self.get_by_id(resume_id, None, db=db)
        variant = Resume(
            workspace_id=base.workspace_id,
            variant_type="tailored",
            content=tailored_content,
            version=base.version + 1,
            generated_from_snapshot=str(base.id),
        )
        db.add(variant)
        await db.flush()
        await db.refresh(variant)
        return variant

    # ── Artifacts ─────────────────────────────────────────────────────
    async def create_artifact(self, workspace_id: uuid.UUID, resume_id: uuid.UUID,
                              *, artifact_kind: str, template_slug: str | None,
                              fmt: str, filename: str, media_type: str,
                              data: bytes, db=None) -> ResumeArtifact:
        artifact = ResumeArtifact(
            workspace_id=workspace_id,
            resume_id=resume_id,
            artifact_kind=artifact_kind,
            template_slug=template_slug,
            format=fmt,
            filename=filename,
            media_type=media_type,
            file_size=len(data),
            content=data,
        )
        db.add(artifact)
        await db.flush()
        await db.refresh(artifact)
        return artifact

    async def get_artifact(self, artifact_id: str, workspace_id: str, db=None) -> ResumeArtifact:
        result = await db.execute(
            select(ResumeArtifact).where(
                ResumeArtifact.id == uuid.UUID(artifact_id),
                ResumeArtifact.workspace_id == uuid.UUID(workspace_id),
            )
        )
        artifact = result.scalar_one_or_none()
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return artifact

    async def list_artifacts(self, resume_id: str, workspace_id: str, db=None):
        result = await db.execute(
            select(ResumeArtifact)
            .where(
                ResumeArtifact.resume_id == uuid.UUID(resume_id),
                ResumeArtifact.workspace_id == uuid.UUID(workspace_id),
            )
            .order_by(ResumeArtifact.created_at.desc())
        )
        return result.scalars().all()


resume_service = ResumeService()
