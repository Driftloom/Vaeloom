import uuid

from fastapi import HTTPException
from sqlalchemy import select

from ..models.schema import Resume


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

    async def generate_variant(self, resume_id: str, dto, user_id: str, db=None):
        result = await db.execute(select(Resume).where(Resume.id == uuid.UUID(resume_id)))
        base = result.scalar_one_or_none()
        if not base:
            raise HTTPException(status_code=404, detail="Resume not found")
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


resume_service = ResumeService()
