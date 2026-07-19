import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func

from ..models.schema import Application


class ApplicationService:
    async def find_all(self, workspace_id: str, db=None, page: int = 1, page_size: int = 20):
        stmt = (
            select(Application)
            .where(Application.workspace_id == uuid.UUID(workspace_id))
            .order_by(Application.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        count_stmt = (
            select(func.count(Application.id))
            .where(Application.workspace_id == uuid.UUID(workspace_id))
        )

        result = await db.execute(stmt)
        apps = list(result.scalars().all())

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        return apps, total

    async def find_one(self, workspace_id: str, application_id: str, db=None):
        result = await db.execute(
            select(Application).where(
                Application.id == uuid.UUID(application_id),
                Application.workspace_id == uuid.UUID(workspace_id),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, workspace_id: str, dto, db=None):
        application = Application(
            workspace_id=uuid.UUID(workspace_id),
            job_external_id=dto.job_external_id,
            platform=dto.platform,
            status=dto.status,
            metadata_=dto.metadata,
        )
        db.add(application)
        await db.flush()
        await db.refresh(application)
        return application

    async def update_outcome(self, workspace_id: str, application_id: str, status: str, db=None):
        result = await db.execute(
            select(Application).where(
                Application.id == uuid.UUID(application_id),
                Application.workspace_id == uuid.UUID(workspace_id),
            )
        )
        application = result.scalar_one_or_none()
        if application:
            application.status = status
            application.outcome_at = datetime.now(timezone.utc)
            await db.flush()
            await db.refresh(application)
        return application


application_service = ApplicationService()
