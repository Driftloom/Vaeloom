"""
Agent Context Loader — hydrates AgentContext from database state for a workspace.

Pulls:
- User profile & preferences
- Master resume & career entities
- Relational knowledge graph context
Replaces synthetic dummy {"name": "User"} data with real workspace memory.
"""
import logging
import uuid
from typing import Any

from sqlalchemy import select

from ..database import async_session_factory
from ..models.schema import Document, Entity, User
from .base import AgentContext

logger = logging.getLogger(__name__)


class AgentContextLoader:
    """Loads authoritative workspace memory state into an AgentContext."""

    async def load_context(
        self,
        workspace_id: str,
        user_id: str | None = None,
        rag_context: dict[str, Any] | None = None,
        db: Any = None,
    ) -> AgentContext:
        context = AgentContext(
            workspace_id=workspace_id,
            user_id=user_id,
            rag_context=rag_context or {},
        )
        if not workspace_id:
            context.profile.setdefault("name", "User")
            context.profile.setdefault("email", "user@example.com")
            context.profile.setdefault("education", [])
            context.profile.setdefault("experience", [])
            context.profile.setdefault("skills", [])
            return context

        try:
            if db is not None:
                await self._hydrate_context(context, workspace_id, user_id, db)
            else:
                async with async_session_factory() as session:
                    await self._hydrate_context(context, workspace_id, user_id, session)
        except Exception as exc:
            logger.warning(f"AgentContextLoader non-blocking error: {exc}")

        # Ensure minimal required fields for safe execution
        context.profile.setdefault("name", "User")
        context.profile.setdefault("email", "user@example.com")
        context.profile.setdefault("education", [])
        context.profile.setdefault("experience", [])
        context.profile.setdefault("skills", [])

        return context

    async def _hydrate_context(
        self,
        context: AgentContext,
        workspace_id: str,
        user_id: str | None,
        session: Any,
    ) -> None:
                # 1. Load User Profile & Workspace Memory via profile_service
                resolved_user_id = user_id
                if not resolved_user_id:
                    try:
                        from ..models.schema import WorkspaceUser
                        wu_stmt = select(WorkspaceUser.user_id).where(WorkspaceUser.workspace_id == uuid.UUID(str(workspace_id))).limit(1)
                        wu_res = await session.execute(wu_stmt)
                        resolved_user_id = wu_res.scalar_one_or_none()
                    except Exception:
                        resolved_user_id = None

                profile_loaded = False
                if resolved_user_id:
                    try:
                        from ..services.profile_service import profile_service
                        prof_res = await profile_service.get_profile(
                            user_id=str(resolved_user_id),
                            workspace_id=str(workspace_id),
                            db=session,
                        )
                        if prof_res:
                            context.profile = {
                                "id": prof_res.id,
                                "name": prof_res.display_name or "User",
                                "display_name": prof_res.display_name or "User",
                                "email": prof_res.email,
                                "bio": prof_res.bio,
                                "headline": prof_res.headline,
                                "location": prof_res.location,
                                "phone": prof_res.phone,
                                "job_title": prof_res.job_title,
                                "social_links": prof_res.social_links or {},
                                "skills": [s.name for s in prof_res.skills],
                                "skills_detailed": [s.model_dump() for s in prof_res.skills],
                                "career_history": [c.model_dump() for c in prof_res.career_history],
                                "job_preferences": prof_res.job_preferences.model_dump() if prof_res.job_preferences else {},
                                "preferences": prof_res.preferences or {},
                                "years_experience": prof_res.years_experience,
                            }
                            if prof_res.job_preferences:
                                context.preferences = [
                                    {"name": "job_types", "value": prof_res.job_preferences.job_types},
                                    {"name": "salary_range", "value": prof_res.job_preferences.salary_range},
                                    {"name": "preferred_industries", "value": prof_res.job_preferences.preferred_industries},
                                    {"name": "dealbreakers", "value": prof_res.job_preferences.dealbreakers},
                                    {"name": "remote_preference", "value": prof_res.job_preferences.remote_preference},
                                ]
                            profile_loaded = True
                    except Exception as e:
                        logger.debug(f"Profile service context loading skipped: {e}")

                if not profile_loaded and resolved_user_id:
                    try:
                        u_uid = uuid.UUID(str(resolved_user_id))
                        user = await session.get(User, u_uid)
                        if user:
                            context.profile = {
                                "name": user.display_name,
                                "email": user.email,
                                "preferences": user.preferences or {},
                            }
                    except Exception as e:
                        logger.debug(f"Fallback user profile fetch skipped: {e}")

                try:
                    w_uuid = uuid.UUID(str(workspace_id))
                except Exception:
                    w_uuid = workspace_id

                # 2. Load Career & Skills Entities
                try:
                    stmt = (
                        select(Entity)
                        .where(Entity.workspace_id == w_uuid)
                        .where(Entity.type.in_(["skill", "career", "preference", "education", "experience"]))
                        .limit(50)
                    )
                    res = await session.execute(stmt)
                    entities = res.scalars().all()

                    skills = []
                    education = []
                    experience = []
                    preferences = []

                    for ent in entities:
                        meta = ent.metadata_ or {}
                        if ent.type == "skill":
                            skills.append(ent.canonical_name)
                        elif ent.type == "education":
                            education.append({
                                "institution": ent.canonical_name,
                                "degree": meta.get("degree", "Degree"),
                                "year": meta.get("year"),
                            })
                        elif ent.type == "experience":
                            experience.append({
                                "company": ent.canonical_name,
                                "role": meta.get("role", "Role"),
                                "achievements": meta.get("achievements", []),
                            })
                        elif ent.type == "preference":
                            preferences.append({
                                "name": ent.canonical_name,
                                "metadata": meta,
                            })

                    context.preferences = preferences
                    if "skills" not in context.profile or not context.profile["skills"]:
                        context.profile["skills"] = skills
                    context.profile.setdefault("education", education)
                    context.profile.setdefault("experience", experience)
                    context.profile.setdefault("name", context.profile.get("name") or "User")
                    context.profile.setdefault("email", context.profile.get("email") or "user@example.com")
                except Exception as e:
                    logger.debug(f"Entities load skipped: {e}")

                # 3. Load Latest Master Resume Document if available
                try:
                    doc_stmt = (
                        select(Document)
                        .where(Document.workspace_id == w_uuid)
                        .where(Document.path.ilike("%resume%"))
                        .order_by(Document.updated_at.desc())
                        .limit(1)
                    )
                    doc_res = await session.execute(doc_stmt)
                    latest_resume_doc = doc_res.scalars().first()
                    if latest_resume_doc:
                        context.master_resume = {
                            "document_id": str(latest_resume_doc.id),
                            "path": latest_resume_doc.path,
                            "summary": latest_resume_doc.summary,
                        }
                except Exception as e:
                    logger.debug(f"Resume document load skipped: {e}")


context_loader = AgentContextLoader()
