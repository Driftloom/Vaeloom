"""Export service — user-triggered data export (NFR-23)."""
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import (
    Memory, Document, Application, Resume, ScheduleEvent, User,
)


@dataclass
class ExportJob:
    id: str
    user_id: str
    workspace_id: str
    status: str = "pending"
    created_at: str = ""
    completed_at: str = ""
    download_url: str = ""
    error: str = ""


@dataclass
class ExportData:
    user: dict = field(default_factory=dict)
    memories: list[dict] = field(default_factory=list)
    documents: list[dict] = field(default_factory=list)
    applications: list[dict] = field(default_factory=list)
    resumes: list[dict] = field(default_factory=list)
    schedule_events: list[dict] = field(default_factory=list)
    approvals: list[dict] = field(default_factory=list)
    export_metadata: dict = field(default_factory=dict)


class ExportService:
    async def create_export(
        self, db: AsyncSession, user_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> ExportData:
        """Generate JSON archive of all user data."""
        export = ExportData()

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            export.user = {
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "created_at": str(user.created_at),
            }

        result = await db.execute(
            select(Memory).where(Memory.workspace_id == workspace_id)
        )
        for mem in result.scalars():
            export.memories.append({
                "id": str(mem.id),
                "type": mem.type,
                "domain": mem.domain,
                "title": mem.title,
                "summary": mem.summary,
                "content": mem.content,
                "created_at": str(mem.created_at),
            })

        result = await db.execute(
            select(Document).where(Document.workspace_id == workspace_id)
        )
        for doc in result.scalars():
            export.documents.append({
                "id": str(doc.id),
                "path": doc.path,
                "type": doc.type,
                "summary": doc.summary,
                "created_at": str(doc.created_at),
            })

        result = await db.execute(
            select(Application).where(Application.workspace_id == workspace_id)
        )
        for app in result.scalars():
            export.applications.append({
                "id": str(app.id),
                "job_external_id": app.job_external_id,
                "platform": app.platform,
                "status": app.status,
                "created_at": str(app.created_at),
            })

        result = await db.execute(
            select(Resume).where(Resume.workspace_id == workspace_id)
        )
        for res in result.scalars():
            export.resumes.append({
                "id": str(res.id),
                "variant_type": res.variant_type,
                "version": res.version,
                "created_at": str(res.created_at),
            })

        result = await db.execute(
            select(ScheduleEvent).where(ScheduleEvent.workspace_id == workspace_id)
        )
        for ev in result.scalars():
            export.schedule_events.append({
                "id": str(ev.id),
                "title": ev.title,
                "date": str(ev.date),
                "type": ev.type,
            })

        export.export_metadata = {
            "user_id": str(user_id),
            "workspace_id": str(workspace_id),
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "total_memories": len(export.memories),
            "total_documents": len(export.documents),
            "total_applications": len(export.applications),
        }

        return export

    async def get_export_json(self, export_data: ExportData) -> str:
        """Serialize export to JSON string."""
        return json.dumps({
            "user": export_data.user,
            "memories": export_data.memories,
            "documents": export_data.documents,
            "applications": export_data.applications,
            "resumes": export_data.resumes,
            "schedule_events": export_data.schedule_events,
            "approvals": export_data.approvals,
            "export_metadata": export_data.export_metadata,
        }, indent=2, default=str)
