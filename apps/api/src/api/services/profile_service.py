import uuid
import json
import logging
from datetime import datetime, UTC
from sqlalchemy import select, func
from ..models.schema import User, Memory, Entity, Resume, Document
from ..schemas.profile import (
    ProfileResponse, UpdateProfileRequest, ProfileCompletenessResponse,
    SkillItem, CareerEntry, JobPreferences, MemorySummary,
    UpdateJobPreferencesRequest, PublicProfileResponse,
    ATSReadinessResponse, ProfileRecommendationItem,
    AddCareerEntryRequest, UpdateCareerEntryRequest, ProfileActivityItem,
)
from ..utils.sanitize import sanitize_text

logger = logging.getLogger(__name__)


class ProfileService:
    async def get_profile(self, user_id: str, workspace_id: str | None = None, db=None) -> ProfileResponse | None:
        """Get user profile with memory-derived data."""
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return None

        # Build base profile from user record
        profile_data = {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "bio": user.bio if hasattr(user, 'bio') else None,
            "headline": user.headline if hasattr(user, 'headline') else None,
            "location": user.location if hasattr(user, 'location') else None,
            "phone": user.phone if hasattr(user, 'phone') else None,
            "social_links": user.social_links if hasattr(user, 'social_links') else {},
            "job_title": user.job_title if hasattr(user, 'job_title') else None,
            "auth_provider": user.auth_provider,
            "preferences": user.preferences or {},
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }

        # Aggregate memory-derived data if workspace_id provided
        if workspace_id:
            try:
                profile_data.update(await self._aggregate_memory_data(workspace_id, db))
            except Exception as e:
                logger.warning("Failed to aggregate memory data: %s", e)

        return ProfileResponse(**profile_data)

    async def _aggregate_memory_data(self, workspace_id: str, db) -> dict:
        """Pull skills, career history, preferences from Memory records."""
        from ..models.schema import Memory as MemoryModel
        
        result = await db.execute(
            select(MemoryModel).where(
                MemoryModel.workspace_id == uuid.UUID(workspace_id),
                MemoryModel.type.in_(["profile", "career", "preference", "episodic", "document", "working"]),
                ~MemoryModel.status.in_(["superseded", "deleted"]),
                MemoryModel.deleted_at.is_(None),
            )
        )
        memories = result.scalars().all()

        skills = []
        career_history = []
        job_preferences = None
        years_experience = None
        memory_counts = {}

        for mem in memories:
            mem_type = mem.type
            memory_counts[mem_type] = memory_counts.get(mem_type, 0) + 1
            
            content = mem.content if isinstance(mem.content, dict) else {}
            if isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except (json.JSONDecodeError, TypeError):
                    content = {}

            confidence = getattr(mem, 'confidence', 0.0) or 0.0

            if mem_type == "profile":
                # Extract skills from profile memory
                raw_skills = content.get("skills", [])
                verified_skills = set(content.get("verified_skills", []))
                for s in raw_skills:
                    if isinstance(s, dict):
                        s_name = s.get("name")
                        s_conf = s.get("confidence", confidence)
                        s_ver = s.get("verified", s_conf >= 0.9)
                        s_src = s.get("source", "memory")
                    else:
                        s_name = str(s)
                        s_ver = (s_name in verified_skills) or (confidence >= 0.9)
                        s_conf = 1.0 if s_ver else confidence
                        s_src = "user" if s_ver else "memory"

                    if s_name and s_name not in [sk.name for sk in skills]:
                        from .capability_engine import capability_engine
                        assessment = capability_engine.assess_capability(
                            name=s_name,
                            base_confidence=s_conf,
                            last_demonstrated=getattr(mem, 'updated_at', None) or getattr(mem, 'created_at', None),
                            is_certified=s_ver and s_conf >= 0.95,
                        )
                        skills.append(SkillItem(
                            name=s_name,
                            confidence=s_conf,
                            source=s_src,
                            verified=s_ver,
                            tag=assessment.tag,
                            validation_tier=assessment.validation_tier.value,
                            effective_confidence=assessment.effective_confidence,
                            decay_status=assessment.decay_status.value,
                            decay_factor=assessment.decay_factor,
                            is_matchable=assessment.is_matchable,
                        ))
                years_experience = content.get("yearsExperience")

            elif mem_type == "career":
                career_history.append(CareerEntry(
                    company=content.get("company", "Unknown"),
                    role=content.get("role", "Unknown"),
                    start_date=content.get("startDate"),
                    end_date=content.get("endDate"),
                    achievements=content.get("achievements", []),
                    confidence=confidence,
                ))

            elif mem_type == "preference":
                job_preferences = JobPreferences(
                    job_types=content.get("jobTypes", []),
                    salary_range=content.get("salaryRange", {}),
                    preferred_industries=content.get("preferredIndustries", []),
                    dealbreakers=content.get("dealbreakers", []),
                    remote_preference=content.get("remotePreference"),
                )

        # Merge skills from Entity table
        try:
            entity_result = await db.execute(
                select(Entity).where(
                    Entity.workspace_id == uuid.UUID(workspace_id),
                    Entity.type == "skill",
                )
            )
            for ent in entity_result.scalars().all():
                meta = ent.metadata_ or {}
                conf = meta.get("confidence", 0.9)
                verified = meta.get("verified", False) or conf >= 0.9
                source = meta.get("source", "memory")
                existing = next((s for s in skills if s.name.lower() == ent.canonical_name.lower()), None)
                if not existing:
                    from .capability_engine import capability_engine
                    assessment = capability_engine.assess_capability(
                        name=ent.canonical_name,
                        base_confidence=conf,
                        last_demonstrated=getattr(ent, 'updated_at', None) or getattr(ent, 'created_at', None),
                        is_certified=verified and conf >= 0.95,
                    )
                    skills.append(SkillItem(
                        name=ent.canonical_name,
                        confidence=conf,
                        source=source,
                        verified=verified,
                        tag=assessment.tag,
                        validation_tier=assessment.validation_tier.value,
                        effective_confidence=assessment.effective_confidence,
                        decay_status=assessment.decay_status.value,
                        decay_factor=assessment.decay_factor,
                        is_matchable=assessment.is_matchable,
                    ))
                elif verified and not existing.verified:
                    existing.verified = True
                    existing.confidence = 1.0
                    existing.source = source
                    existing.validation_tier = "V2"
                    existing.is_matchable = True
        except Exception as e:
            logger.debug("Entity skill merge skipped: %s", e)

        # Build memory summary
        # Count ALL memory types for the summary
        all_result = await db.execute(
            select(MemoryModel.type, func.count(MemoryModel.id)).where(
                MemoryModel.workspace_id == uuid.UUID(workspace_id),
            ).group_by(MemoryModel.type)
        )
        memory_summary = [
            MemorySummary(type=row[0], count=row[1])
            for row in all_result.all()
        ]

        return {
            "skills": skills,
            "career_history": career_history,
            "job_preferences": job_preferences,
            "years_experience": years_experience,
            "memory_summary": memory_summary,
        }

    async def update_profile(
        self,
        user_id: str,
        data: UpdateProfileRequest,
        workspace_id: str | None = None,
        db=None,
    ) -> ProfileResponse | None:
        """Update user profile fields and mirror changes to workspace memory."""
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return None

        # Update fields that were provided
        if data.display_name is not None:
            user.display_name = sanitize_text(data.display_name) or user.display_name
        if data.bio is not None:
            user.bio = sanitize_text(data.bio)
        if data.headline is not None:
            user.headline = sanitize_text(data.headline)
        if data.location is not None:
            user.location = sanitize_text(data.location)
        if data.phone is not None:
            user.phone = sanitize_text(data.phone)
        if data.social_links is not None:
            # Sanitize each URL
            user.social_links = {k: sanitize_text(v) or "" for k, v in data.social_links.items()}
        if data.job_title is not None:
            user.job_title = sanitize_text(data.job_title)
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        if data.preferences is not None:
            user.preferences = {**(user.preferences or {}), **data.preferences}

        if workspace_id:
            try:
                await self._sync_profile_to_memory(user_id, workspace_id, user, db)
            except Exception as e:
                logger.warning("Failed to sync profile to memory: %s", e)

        await db.flush()
        await db.refresh(user)

        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def get_completeness(self, user_id: str, workspace_id: str | None = None, db=None) -> ProfileCompletenessResponse:
        """Calculate profile completeness score."""
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return ProfileCompletenessResponse(score=0, total_fields=0, filled_fields=0)

        fields = [
            ("display_name", user.display_name, "Update your display name", 5),
            ("avatar", user.avatar_url, "Upload a profile photo", 15),
            ("bio", getattr(user, 'bio', None), "Write a short bio", 10),
            ("headline", getattr(user, 'headline', None), "Add a professional headline", 10),
            ("location", getattr(user, 'location', None), "Set your location", 5),
            ("job_title", getattr(user, 'job_title', None), "Add your current job title", 10),
            ("social_links", bool(getattr(user, 'social_links', None)), "Connect your GitHub or LinkedIn", 10),
        ]

        # Memory-based completeness
        memory_fields = []
        if workspace_id:
            from ..models.schema import Memory as MemoryModel
            for mem_type, label, boost in [
                ("profile", "Let Vaeloom learn your skills (connect sources)", 15),
                ("career", "Add career history to memory", 10),
                ("preference", "Set your job preferences", 10),
            ]:
                count_result = await db.execute(
                    select(func.count(MemoryModel.id)).where(
                        MemoryModel.workspace_id == uuid.UUID(workspace_id),
                        MemoryModel.type == mem_type,
                    )
                )
                has_data = (count_result.scalar() or 0) > 0
                memory_fields.append((f"memory_{mem_type}", has_data, label, boost))

        all_fields = fields + memory_fields
        total = len(all_fields)
        filled = sum(1 for _, val, _, _ in all_fields if val)
        score = int((filled / total) * 100) if total > 0 else 0

        suggestions = []
        for field_name, val, action, boost in all_fields:
            if not val:
                suggestions.append({
                    "field": field_name,
                    "action": action,
                    "boost": f"+{boost}%",
                })

        return ProfileCompletenessResponse(
            score=score,
            total_fields=total,
            filled_fields=filled,
            suggestions=suggestions,
        )

    async def upload_avatar(self, user_id: str, file_data: bytes, content_type: str, db=None) -> str:
        """Upload avatar to storage and update user record."""
        from .storage_service import storage_service
        
        # Generate unique key
        ext = "png"
        if "jpeg" in content_type or "jpg" in content_type:
            ext = "jpg"
        elif "webp" in content_type:
            ext = "webp"
        key = f"avatars/{user_id}.{ext}"

        # Upload to storage
        await storage_service.upload(key, file_data)
        
        # Generate URL
        try:
            avatar_url = await storage_service.get_signed_url(key, expires_in=86400 * 365)
        except Exception:
            # Fallback: construct URL manually for local/dev
            avatar_url = f"/api/v1/profile/avatar/{user_id}"

        # Update user record
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if user:
            user.avatar_url = avatar_url
            await db.flush()

        return avatar_url

    async def get_avatar(self, user_id: str) -> tuple[bytes, str] | None:
        """Retrieve avatar image bytes and content type."""
        from .storage_service import storage_service
        import os

        types = [("png", "image/png"), ("jpg", "image/jpeg"), ("webp", "image/webp")]
        for ext, media_type in types:
            key = f"avatars/{user_id}.{ext}"
            try:
                data = await storage_service.download(key)
                if data:
                    return data, media_type
            except Exception:
                pass

            # Local filesystem fallback
            local_path = os.path.join(os.getcwd(), "data", "avatars", f"{user_id}.{ext}")
            if os.path.exists(local_path):
                try:
                    with open(local_path, "rb") as f:
                        return f.read(), media_type
                except Exception:
                    pass

        return None

    async def _sync_profile_to_memory(self, user_id: str, workspace_id: str, user: User, db) -> None:
        """Mirror bio, headline, and profile fields into Memory record so agents can access them."""
        import hashlib
        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)

        result = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.type == "profile",
            )
        )
        mem = result.scalars().first()
        content = {}
        if mem:
            if isinstance(mem.content, dict):
                content = dict(mem.content)
            elif isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except Exception:
                    content = {}

        content["name"] = user.display_name
        content["email"] = user.email
        content["headline"] = user.headline
        content["bio"] = user.bio
        content["location"] = user.location
        content["job_title"] = user.job_title
        content_str = json.dumps(content)

        if mem:
            mem.content = content_str
            mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
            mem.size = len(content_str)
            mem.title = f"Profile: {user.display_name}"
            mem.updated_at = datetime.now(UTC)
        else:
            new_mem = Memory(
                id=uuid.uuid4(),
                type="profile",
                domain="profile",
                status="ACTIVE",
                title=f"Profile: {user.display_name}",
                summary=f"User profile for {user.display_name}",
                content=content_str,
                content_hash=hashlib.sha256(content_str.encode()).hexdigest(),
                size=len(content_str),
                user_id=u_uuid,
                workspace_id=ws_uuid,
            )
            db.add(new_mem)

    async def confirm_skill(self, user_id: str, workspace_id: str, skill_name: str, db=None) -> ProfileResponse | None:
        """Confirm a skill, setting confidence=1.0 and verified=True in memory and entity graph."""
        import hashlib
        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)
        clean_skill = sanitize_text(skill_name).strip()
        if not clean_skill:
            return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

        # 1. Update or create Memory record
        result = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.type == "profile",
            )
        )
        mem = result.scalars().first()
        content = {}
        if mem:
            if isinstance(mem.content, dict):
                content = dict(mem.content)
            elif isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except Exception:
                    content = {}

        skills_list = content.get("skills", [])
        if clean_skill not in skills_list:
            skills_list.append(clean_skill)
        content["skills"] = skills_list

        verified_skills = set(content.get("verified_skills", []))
        verified_skills.add(clean_skill)
        content["verified_skills"] = list(verified_skills)

        content_str = json.dumps(content)
        if mem:
            mem.content = content_str
            mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
            mem.size = len(content_str)
            mem.updated_at = datetime.now(UTC)
        else:
            mem = Memory(
                id=uuid.uuid4(),
                type="profile",
                domain="profile",
                status="ACTIVE",
                title="User Profile & Skills",
                content=content_str,
                content_hash=hashlib.sha256(content_str.encode()).hexdigest(),
                size=len(content_str),
                user_id=u_uuid,
                workspace_id=ws_uuid,
            )
            db.add(mem)

        # 2. Update or create Entity record
        ent_res = await db.execute(
            select(Entity).where(
                Entity.workspace_id == ws_uuid,
                Entity.type == "skill",
                func.lower(Entity.canonical_name) == clean_skill.lower(),
            )
        )
        entity = ent_res.scalars().first()
        if entity:
            meta = dict(entity.metadata_ or {})
            meta["verified"] = True
            meta["confidence"] = 1.0
            meta["source"] = "user"
            entity.metadata_ = meta
        else:
            new_entity = Entity(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                type="skill",
                canonical_name=clean_skill,
                metadata_={"verified": True, "confidence": 1.0, "source": "user"},
            )
            db.add(new_entity)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def add_skill(self, user_id: str, workspace_id: str, skill_name: str, confidence: float = 1.0, db=None) -> ProfileResponse | None:
        """Add a new skill to profile memory and knowledge graph."""
        import hashlib
        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)
        clean_skill = sanitize_text(skill_name).strip()
        if not clean_skill:
            return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

        result = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.type == "profile",
            )
        )
        mem = result.scalars().first()
        content = {}
        if mem:
            if isinstance(mem.content, dict):
                content = dict(mem.content)
            elif isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except Exception:
                    content = {}

        skills_list = content.get("skills", [])
        if clean_skill not in skills_list:
            skills_list.append(clean_skill)
        content["skills"] = skills_list

        if confidence >= 0.9:
            verified_skills = set(content.get("verified_skills", []))
            verified_skills.add(clean_skill)
            content["verified_skills"] = list(verified_skills)

        content_str = json.dumps(content)
        if mem:
            mem.content = content_str
            mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
            mem.size = len(content_str)
            mem.updated_at = datetime.now(UTC)
        else:
            mem = Memory(
                id=uuid.uuid4(),
                type="profile",
                domain="profile",
                status="ACTIVE",
                title="User Profile & Skills",
                content=content_str,
                content_hash=hashlib.sha256(content_str.encode()).hexdigest(),
                size=len(content_str),
                user_id=u_uuid,
                workspace_id=ws_uuid,
            )
            db.add(mem)

        # Entity
        ent_res = await db.execute(
            select(Entity).where(
                Entity.workspace_id == ws_uuid,
                Entity.type == "skill",
                func.lower(Entity.canonical_name) == clean_skill.lower(),
            )
        )
        entity = ent_res.scalars().first()
        if not entity:
            new_entity = Entity(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                type="skill",
                canonical_name=clean_skill,
                metadata_={"verified": confidence >= 0.9, "confidence": confidence, "source": "user"},
            )
            db.add(new_entity)
        else:
            meta = dict(entity.metadata_ or {})
            meta["confidence"] = max(meta.get("confidence", 0.0), confidence)
            if confidence >= 0.9:
                meta["verified"] = True
            entity.metadata_ = meta

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def remove_skill(self, user_id: str, workspace_id: str, skill_name: str, db=None) -> ProfileResponse | None:
        """Remove a skill from profile memory and entity graph."""
        import hashlib
        ws_uuid = uuid.UUID(workspace_id)
        clean_skill = sanitize_text(skill_name).strip()

        result = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.type == "profile",
            )
        )
        mem = result.scalars().first()
        if mem:
            content = {}
            if isinstance(mem.content, dict):
                content = dict(mem.content)
            elif isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except Exception:
                    content = {}
            skills_list = [s for s in content.get("skills", []) if s.lower() != clean_skill.lower()]
            verified_skills = [s for s in content.get("verified_skills", []) if s.lower() != clean_skill.lower()]
            content["skills"] = skills_list
            content["verified_skills"] = verified_skills
            content_str = json.dumps(content)
            mem.content = content_str
            mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
            mem.size = len(content_str)
            mem.updated_at = datetime.now(UTC)

        ent_res = await db.execute(
            select(Entity).where(
                Entity.workspace_id == ws_uuid,
                Entity.type == "skill",
                func.lower(Entity.canonical_name) == clean_skill.lower(),
            )
        )
        for entity in ent_res.scalars().all():
            await db.delete(entity)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def update_job_preferences(
        self,
        user_id: str,
        data: UpdateJobPreferencesRequest,
        db=None,
    ) -> ProfileResponse | None:
        """Update job preferences in memory and mirror to knowledge graph."""
        import hashlib
        ws_uuid = uuid.UUID(data.workspace_id)
        u_uuid = uuid.UUID(user_id)

        result = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.type == "preference",
            )
        )
        mem = result.scalars().first()
        content = {
            "jobTypes": data.job_types,
            "salaryRange": data.salary_range,
            "preferredIndustries": data.preferred_industries,
            "dealbreakers": data.dealbreakers,
            "remotePreference": data.remote_preference,
        }
        content_str = json.dumps(content)

        if mem:
            mem.content = content_str
            mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
            mem.size = len(content_str)
            mem.updated_at = datetime.now(UTC)
        else:
            mem = Memory(
                id=uuid.uuid4(),
                type="preference",
                domain="preference",
                status="ACTIVE",
                title="Job & Career Preferences",
                content=content_str,
                content_hash=hashlib.sha256(content_str.encode()).hexdigest(),
                size=len(content_str),
                user_id=u_uuid,
                workspace_id=ws_uuid,
            )
            db.add(mem)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def auto_populate_from_resume(self, user_id: str, workspace_id: str, db=None) -> ProfileResponse | None:
        """Extract skills, career, bio, and headline from resume/documents and populate memory and profile."""
        import hashlib
        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)

        user_res = await db.execute(select(User).where(User.id == u_uuid))
        user = user_res.scalar_one_or_none()
        if not user:
            return None

        # 1. Look for Master resume first, then any resume
        res_query = (
            select(Resume)
            .where(Resume.workspace_id == ws_uuid)
            .order_by((Resume.variant_type == "master").desc(), Resume.updated_at.desc())
        )
        res_exec = await db.execute(res_query)
        resume = res_exec.scalars().first()

        extracted_skills: list[str] = []
        extracted_career: list[dict] = []
        extracted_bio: str | None = None
        extracted_headline: str | None = None
        extracted_location: str | None = None
        extracted_phone: str | None = None
        extracted_socials: dict[str, str] = {}

        if resume and resume.content:
            content = resume.content if isinstance(resume.content, dict) else {}
            if isinstance(resume.content, str):
                try:
                    content = json.loads(resume.content)
                except Exception:
                    content = {}

            # Bio / summary
            extracted_bio = content.get("summary") or content.get("bio")
            # Headline / role
            extracted_headline = content.get("headline") or content.get("role") or content.get("target_role")
            extracted_location = content.get("location")
            extracted_phone = content.get("phone")

            # Socials / links
            links = content.get("links") or {}
            for k in ["github", "linkedin", "portfolio", "website", "twitter"]:
                val = links.get(k) or content.get(k)
                if val and isinstance(val, str):
                    extracted_socials[k] = val

            # Skills
            raw_skills = content.get("skills") or []
            if isinstance(raw_skills, list):
                for sk in raw_skills:
                    if isinstance(sk, str) and sk.strip():
                        extracted_skills.append(sk.strip())
                    elif isinstance(sk, dict):
                        items = sk.get("items") or ([sk.get("name")] if sk.get("name") else [])
                        for it in items:
                            if isinstance(it, str) and it.strip():
                                extracted_skills.append(it.strip())
                            elif isinstance(it, dict) and it.get("name"):
                                extracted_skills.append(str(it["name"]).strip())

            # Experience
            raw_exp = content.get("experience") or []
            if isinstance(raw_exp, list):
                for exp in raw_exp:
                    if isinstance(exp, dict):
                        extracted_career.append({
                            "company": exp.get("company", "Organization"),
                            "role": exp.get("role", "Professional"),
                            "startDate": exp.get("start") or exp.get("startDate"),
                            "endDate": exp.get("end") or exp.get("endDate"),
                            "achievements": exp.get("bullets") or exp.get("achievements") or [],
                        })

        # 2. Check documents if no resume or to supplement
        if not extracted_skills or not extracted_career:
            doc_query = (
                select(Document)
                .where(Document.workspace_id == ws_uuid)
                .order_by(Document.created_at.desc())
            )
            doc_exec = await db.execute(doc_query)
            docs = doc_exec.scalars().all()
            for doc in docs:
                if doc.summary and not extracted_bio:
                    extracted_bio = doc.summary[:500]
                meta = doc.metadata_ or {}
                doc_skills = meta.get("skills") or meta.get("extracted_skills") or []
                if isinstance(doc_skills, list):
                    for s in doc_skills:
                        if isinstance(s, str) and s.strip() and s.strip() not in extracted_skills:
                            extracted_skills.append(s.strip())

        # 3. Update User fields if currently empty or updateable
        if extracted_headline and (not user.headline or user.headline.strip() == ""):
            user.headline = sanitize_text(extracted_headline)
        if extracted_headline and (not user.job_title or user.job_title.strip() == ""):
            user.job_title = sanitize_text(extracted_headline)
        if extracted_bio and (not user.bio or user.bio.strip() == ""):
            user.bio = sanitize_text(extracted_bio)
        if extracted_location and (not user.location or user.location.strip() == ""):
            user.location = sanitize_text(extracted_location)
        if extracted_phone and (not user.phone or user.phone.strip() == ""):
            user.phone = sanitize_text(extracted_phone)
        if extracted_socials:
            curr_socials = dict(user.social_links or {})
            curr_socials.update(extracted_socials)
            user.social_links = curr_socials

        # 4. Upsert extracted skills into profile Memory and Entity table
        if extracted_skills:
            mem_res = await db.execute(
                select(Memory).where(
                    Memory.workspace_id == ws_uuid,
                    Memory.type == "profile",
                )
            )
            mem = mem_res.scalars().first()
            content = {}
            if mem:
                if isinstance(mem.content, dict):
                    content = dict(mem.content)
                elif isinstance(mem.content, str):
                    try:
                        content = json.loads(mem.content)
                    except Exception:
                        content = {}

            curr_skills = content.get("skills", [])
            for sk in extracted_skills:
                if sk not in curr_skills:
                    curr_skills.append(sk)
            content["skills"] = curr_skills

            ver_skills = set(content.get("verified_skills", []))
            for sk in extracted_skills:
                ver_skills.add(sk)
            content["verified_skills"] = list(ver_skills)

            content_str = json.dumps(content)
            if mem:
                mem.content = content_str
                mem.content_hash = hashlib.sha256(content_str.encode()).hexdigest()
                mem.size = len(content_str)
                mem.updated_at = datetime.now(UTC)
            else:
                mem = Memory(
                    id=uuid.uuid4(),
                    type="profile",
                    domain="profile",
                    status="ACTIVE",
                    title="User Profile & Skills",
                    content=content_str,
                    content_hash=hashlib.sha256(content_str.encode()).hexdigest(),
                    size=len(content_str),
                    user_id=u_uuid,
                    workspace_id=ws_uuid,
                )
                db.add(mem)

            # Upsert into Entity table for knowledge graph
            for sk in extracted_skills:
                ent_res = await db.execute(
                    select(Entity).where(
                        Entity.workspace_id == ws_uuid,
                        Entity.type == "skill",
                        func.lower(Entity.canonical_name) == sk.lower(),
                    )
                )
                entity = ent_res.scalars().first()
                if not entity:
                    db.add(Entity(
                        id=uuid.uuid4(),
                        workspace_id=ws_uuid,
                        type="skill",
                        canonical_name=sk,
                        metadata_={"verified": True, "confidence": 0.95, "source": "resume"},
                    ))
                else:
                    meta = dict(entity.metadata_ or {})
                    meta["verified"] = True
                    meta["confidence"] = 1.0
                    meta["source"] = "resume"
                    entity.metadata_ = meta

        # 5. Upsert extracted career entries into career Memory
        for exp in extracted_career:
            company = exp.get("company", "Unknown")
            role = exp.get("role", "Unknown")
            career_content_str = json.dumps({
                "company": company,
                "role": role,
                "startDate": exp.get("startDate"),
                "endDate": exp.get("endDate"),
                "achievements": exp.get("achievements", []),
            })
            existing_career = await db.execute(
                select(Memory).where(
                    Memory.workspace_id == ws_uuid,
                    Memory.type == "career",
                    func.lower(Memory.title).contains(company.lower()),
                )
            )
            cm = existing_career.scalars().first()
            if not cm:
                db.add(Memory(
                    id=uuid.uuid4(),
                    workspace_id=ws_uuid,
                    user_id=u_uuid,
                    type="career",
                    domain="career",
                    status="ACTIVE",
                    title=f"{role} at {company}",
                    summary=f"Career role: {role} at {company}",
                    content=career_content_str,
                    content_hash=hashlib.sha256(career_content_str.encode()).hexdigest(),
                    size=len(career_content_str),
                    metadata_={"confidence": 0.95},
                ))

        await self._sync_profile_to_memory(user_id, workspace_id, user, db)
        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def get_public_profile(self, user_id: str, db=None) -> PublicProfileResponse | None:
        """Get public read-only profile for portfolio and external sharing."""
        try:
            u_uuid = uuid.UUID(user_id)
        except (ValueError, TypeError):
            return None

        result = await db.execute(select(User).where(User.id == u_uuid))
        user = result.scalar_one_or_none()
        if not user:
            return None

        # Gather memories for this user
        mem_res = await db.execute(
            select(Memory).where(
                Memory.user_id == u_uuid,
                Memory.type.in_(["profile", "career"]),
            )
        )
        memories = mem_res.scalars().all()

        skills: list[SkillItem] = []
        career_history: list[CareerEntry] = []
        years_exp = None

        for mem in memories:
            content = mem.content if isinstance(mem.content, dict) else {}
            if isinstance(mem.content, str):
                try:
                    content = json.loads(mem.content)
                except Exception:
                    content = {}
            conf = getattr(mem, "confidence", 0.0) or 0.0

            if mem.type == "profile":
                raw_skills = content.get("skills", [])
                verified_skills = set(content.get("verified_skills", []))
                for s in raw_skills:
                    if isinstance(s, dict):
                        s_name = s.get("name")
                        s_conf = s.get("confidence", conf)
                        s_ver = s.get("verified", s_conf >= 0.9)
                        s_src = s.get("source", "memory")
                    else:
                        s_name = str(s)
                        s_ver = (s_name in verified_skills) or (conf >= 0.9)
                        s_conf = 1.0 if s_ver else conf
                        s_src = "user" if s_ver else "memory"

                    if s_name and s_ver and s_name not in [sk.name for sk in skills]:
                        skills.append(SkillItem(
                            name=s_name,
                            confidence=s_conf,
                            source=s_src,
                            verified=s_ver,
                        ))
                years_exp = content.get("yearsExperience")

            elif mem.type == "career":
                career_history.append(CareerEntry(
                    company=content.get("company", "Unknown"),
                    role=content.get("role", "Unknown"),
                    start_date=content.get("startDate"),
                    end_date=content.get("endDate"),
                    achievements=content.get("achievements", []),
                    confidence=conf,
                ))

        return PublicProfileResponse(
            id=str(user.id),
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            bio=getattr(user, "bio", None),
            headline=getattr(user, "headline", None),
            location=getattr(user, "location", None),
            job_title=getattr(user, "job_title", None),
            social_links=getattr(user, "social_links", {}) or {},
            skills=skills,
            career_history=career_history,
            years_experience=years_exp,
            created_at=user.created_at,
        )

    async def calculate_ats_readiness(self, user_id: str, workspace_id: str, db=None) -> ATSReadinessResponse:
        """Calculate dynamic ATS readiness score and skill gap recommendations against target role."""
        profile = await self.get_profile(user_id, workspace_id=workspace_id, db=db)
        if not profile:
            return ATSReadinessResponse(
                score=0,
                status_label="Needs Attention",
                target_role=None,
                total_skills_count=0,
                matching_skills=[],
                missing_skills=[],
                suggestions=["Complete your profile to generate ATS readiness metrics."],
                keyword_match_pct=0.0,
            )

        # 1. Determine target role
        target_role = "Full Stack Engineer"
        if profile.job_preferences and profile.job_preferences.job_types:
            target_role = profile.job_preferences.job_types[0]
        elif profile.headline:
            target_role = profile.headline
        elif profile.job_title:
            target_role = profile.job_title

        # 2. Industry standard benchmark skills for tech roles
        role_benchmarks: dict[str, list[str]] = {
            "frontend": ["React", "TypeScript", "Next.js", "Tailwind CSS", "HTML5", "CSS3", "JavaScript", "Jest", "GraphQL", "Web Performance"],
            "backend": ["Python", "FastAPI", "PostgreSQL", "Docker", "REST API", "Redis", "SQLAlchemy", "AsyncIO", "Microservices", "Git"],
            "ai": ["Python", "PyTorch", "LLMs", "LangChain", "Vector DBs", "Embeddings", "HuggingFace", "Fine-Tuning", "FastAPI", "NumPy"],
            "full stack": ["React", "TypeScript", "Python", "FastAPI", "Next.js", "PostgreSQL", "Docker", "REST API", "Tailwind CSS", "Git"],
            "devops": ["Docker", "Kubernetes", "AWS", "CI/CD", "Terraform", "Linux", "GitHub Actions", "Prometheus", "Python", "Security"],
        }

        # Match benchmark cluster based on target_role text
        target_lower = target_role.lower()
        if "ai" in target_lower or "machine learning" in target_lower or "ml" in target_lower:
            benchmark = role_benchmarks["ai"]
        elif "frontend" in target_lower or "front-end" in target_lower or "ui" in target_lower:
            benchmark = role_benchmarks["frontend"]
        elif "backend" in target_lower or "back-end" in target_lower or "distributed" in target_lower:
            benchmark = role_benchmarks["backend"]
        elif "devops" in target_lower or "cloud" in target_lower or "sre" in target_lower:
            benchmark = role_benchmarks["devops"]
        else:
            benchmark = role_benchmarks["full stack"]

        user_skills_map = {s.name.lower(): s.name for s in profile.skills}
        matching: list[str] = []
        missing: list[str] = []

        for req in benchmark:
            if req.lower() in user_skills_map:
                matching.append(user_skills_map[req.lower()])
            else:
                missing.append(req)

        # Keyword match percentage
        match_ratio = len(matching) / len(benchmark) if benchmark else 0.0
        keyword_pct = round(match_ratio * 100, 1)

        # Completeness bonus (having bio, headline, experience boosts ATS ranking)
        completeness = await self.get_completeness(user_id, workspace_id=workspace_id, db=db)
        comp_ratio = (completeness.score or 0) / 100.0

        raw_score = int(round((match_ratio * 70.0) + (comp_ratio * 30.0)))
        score = min(100, max(15, raw_score)) if profile.skills or profile.career_history else raw_score

        if score >= 85:
            status_label = "Excellent (Job-Ready)"
        elif score >= 70:
            status_label = "Good (Competitive)"
        elif score >= 50:
            status_label = "Fair (Needs Optimization)"
        else:
            status_label = "Needs Attention"

        suggestions: list[str] = []
        if missing:
            suggestions.append(f"Add in-demand keywords: {', '.join(missing[:3])} to match {target_role} ATS filters.")
        if not profile.bio:
            suggestions.append("Add an impactful executive summary with industry focus.")
        if not profile.career_history:
            suggestions.append("Add past career experiences with quantified achievements.")
        if score >= 80:
            suggestions.append("Your profile has high ATS visibility. You're ready to tailor resumes for targeted applications.")

        return ATSReadinessResponse(
            score=score,
            status_label=status_label,
            target_role=target_role,
            total_skills_count=len(profile.skills),
            matching_skills=matching,
            missing_skills=missing[:4],
            suggestions=suggestions,
            keyword_match_pct=keyword_pct,
        )

    async def get_agent_recommendations(self, user_id: str, workspace_id: str, db=None) -> list[ProfileRecommendationItem]:
        """Generate proactive agent recommendations for career acceleration and profile optimization."""
        profile = await self.get_profile(user_id, workspace_id=workspace_id, db=db)
        if not profile:
            return []

        ats = await self.calculate_ats_readiness(user_id, workspace_id, db=db)
        items: list[ProfileRecommendationItem] = []
        now = datetime.now(UTC)

        # 1. ATS & Skill Recommendation
        if ats.missing_skills:
            top_miss = ats.missing_skills[0]
            items.append(ProfileRecommendationItem(
                id=f"rec-skill-{uuid.uuid4().hex[:8]}",
                agent_name="Skill Scout Agent",
                category="skill_gap",
                title=f"Verify {top_miss} for {ats.target_role}",
                description=f"Recruiters looking for {ats.target_role} actively filter for {top_miss}. Add or confirm it on your profile to boost match by +15%.",
                action_label=f"Add {top_miss}",
                action_url=None,
                impact="+15% ATS Match",
                created_at=now,
            ))

        # 2. Resume Tailor Agent Recommendation
        items.append(ProfileRecommendationItem(
            id=f"rec-resume-{uuid.uuid4().hex[:8]}",
            agent_name="Resume Tailor Agent",
            category="resume_tuning",
            title="Auto-Tailor Resume for Active Market",
            description=f"Compile your {len(profile.skills)} verified skills and career highlights into an ATS-optimized Harvard or ModernCV resume.",
            action_label="Open Resume Builder",
            action_url=f"/workspace/{workspace_id}/resume",
            impact="Instant PDF",
            created_at=now,
        ))

        # 3. Career Strategy Agent Recommendation
        if not profile.bio or len(profile.bio) < 50:
            items.append(ProfileRecommendationItem(
                id=f"rec-bio-{uuid.uuid4().hex[:8]}",
                agent_name="Career Strategy Agent",
                category="profile_boost",
                title="Synthesize Executive Bio",
                description="Your connected work has enough context to generate an authoritative 3-sentence executive summary.",
                action_label="Auto-Populate",
                action_url=None,
                impact="+10% Profile Strength",
                created_at=now,
            ))
        else:
            items.append(ProfileRecommendationItem(
                id=f"rec-market-{uuid.uuid4().hex[:8]}",
                agent_name="Job Search Agent",
                category="job_opportunity",
                title=f"High-Intent Matches in {ats.target_role}",
                description="3 new roles posted in the last 48h match >80% of your verified skills and remote preferences.",
                action_label="Explore Roles",
                action_url=f"/workspace/{workspace_id}/job-search",
                impact="3 Matches",
                created_at=now,
            ))

        return items

    async def add_career_entry(
        self, user_id: str, data: AddCareerEntryRequest, db=None
    ) -> ProfileResponse | None:
        """Add a career experience entry to Memory and Entity graph."""
        ws_uuid = uuid.UUID(data.workspace_id)
        
        mem_content = {
            "company": sanitize_text(data.company),
            "role": sanitize_text(data.role),
            "startDate": sanitize_text(data.start_date) if data.start_date else None,
            "endDate": sanitize_text(data.end_date) if data.end_date else None,
            "achievements": [sanitize_text(a) for a in data.achievements if a],
        }
        content_str = json.dumps(mem_content)
        content_hash = f"career_{uuid.uuid4().hex[:12]}"
        
        mem = Memory(
            id=uuid.uuid4(),
            type="career",
            domain="career",
            status="active",
            title=f"{data.role} at {data.company}",
            summary=f"Career history at {data.company}",
            content=content_str,
            content_hash=content_hash,
            size=len(content_str),
            metadata_={"confidence": 1.0, "source": "user", "verified": True},
            workspace_id=ws_uuid,
            user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
        db.add(mem)
        
        ent_stmt = select(Entity).where(
            Entity.workspace_id == ws_uuid,
            Entity.type == "experience",
            func.lower(Entity.canonical_name) == data.company.lower(),
        )
        ent_res = await db.execute(ent_stmt)
        ent = ent_res.scalar_one_or_none()
        if not ent:
            ent = Entity(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                type="experience",
                canonical_name=data.company,
                metadata_={
                    "role": data.role,
                    "achievements": data.achievements,
                    "startDate": data.start_date,
                    "endDate": data.end_date,
                    "confidence": 1.0,
                    "source": "user",
                },
            )
            db.add(ent)
        else:
            meta = dict(ent.metadata_ or {})
            meta.update({
                "role": data.role,
                "achievements": data.achievements,
                "startDate": data.start_date,
                "endDate": data.end_date,
            })
            ent.metadata_ = meta
            
        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def update_career_entry(
        self, user_id: str, company: str, data: UpdateCareerEntryRequest, db=None
    ) -> ProfileResponse | None:
        """Update an existing career experience entry in Memory and Entity graph."""
        ws_uuid = uuid.UUID(data.workspace_id)
        
        mem_stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "career",
            func.lower(Memory.title).contains(company.lower()),
            Memory.status == "active",
        )
        mem_res = await db.execute(mem_stmt)
        mem = mem_res.scalar_one_or_none()
        if mem:
            try:
                curr_content = json.loads(mem.content) if isinstance(mem.content, str) else dict(mem.content or {})
            except Exception:
                curr_content = {}
            if data.role is not None:
                curr_content["role"] = sanitize_text(data.role)
                mem.title = f"{data.role} at {company}"
            if data.start_date is not None:
                curr_content["startDate"] = sanitize_text(data.start_date)
            if data.end_date is not None:
                curr_content["endDate"] = sanitize_text(data.end_date)
            if data.achievements is not None:
                curr_content["achievements"] = [sanitize_text(a) for a in data.achievements if a]
            
            content_str = json.dumps(curr_content)
            mem.content = content_str
            mem.size = len(content_str)
            
        ent_stmt = select(Entity).where(
            Entity.workspace_id == ws_uuid,
            Entity.type == "experience",
            func.lower(Entity.canonical_name) == company.lower(),
        )
        ent_res = await db.execute(ent_stmt)
        ent = ent_res.scalar_one_or_none()
        if ent:
            meta = dict(ent.metadata_ or {})
            if data.role is not None:
                meta["role"] = data.role
            if data.start_date is not None:
                meta["startDate"] = data.start_date
            if data.end_date is not None:
                meta["endDate"] = data.end_date
            if data.achievements is not None:
                meta["achievements"] = data.achievements
            ent.metadata_ = meta
            
        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def delete_career_entry(
        self, user_id: str, workspace_id: str, company: str, db=None
    ) -> ProfileResponse | None:
        """Soft delete a career entry from Memory and Entity graph."""
        ws_uuid = uuid.UUID(workspace_id)
        
        mem_stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "career",
            func.lower(Memory.title).contains(company.lower()),
            Memory.status == "active",
        )
        mem_res = await db.execute(mem_stmt)
        mems = mem_res.scalars().all()
        for mem in mems:
            mem.status = "deleted"
            mem.deleted_at = datetime.now(UTC)
            
        ent_stmt = select(Entity).where(
            Entity.workspace_id == ws_uuid,
            Entity.type == "experience",
            func.lower(Entity.canonical_name) == company.lower(),
        )
        ent_res = await db.execute(ent_stmt)
        ent = ent_res.scalar_one_or_none()
        if ent:
            await db.delete(ent)
            
        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def get_profile_activity(
        self, user_id: str, workspace_id: str, db=None
    ) -> list[ProfileActivityItem]:
        """Fetch profile-specific event stream."""
        ws_uuid = uuid.UUID(workspace_id)
        activities: list[ProfileActivityItem] = []
        
        mem_stmt = (
            select(Memory)
            .where(
                Memory.workspace_id == ws_uuid,
                Memory.type.in_(["profile", "career", "preference", "document"]),
            )
            .order_by(Memory.created_at.desc())
            .limit(10)
        )
        mem_res = await db.execute(mem_stmt)
        mems = mem_res.scalars().all()
        for mem in mems:
            t_name = mem.type.capitalize()
            action_desc = mem.summary or f"{t_name} memory updated"
            d = mem.created_at or datetime.now(UTC)
            activities.append(ProfileActivityItem(
                id=f"act-mem-{mem.id.hex[:8]}",
                type=f"memory.{mem.type}",
                title=f"{t_name} Memory Update",
                description=action_desc,
                timestamp=d.strftime("%b %d, %H:%M"),
                status="completed",
                agent_name="Memory Agent",
            ))
            
        try:
            res_stmt = (
                select(Resume)
                .where(Resume.workspace_id == ws_uuid)
                .order_by(Resume.updated_at.desc())
                .limit(5)
            )
            res_res = await db.execute(res_stmt)
            resumes = res_res.scalars().all()
            for r in resumes:
                d = r.updated_at or datetime.now(UTC)
                activities.append(ProfileActivityItem(
                    id=f"act-res-{r.id.hex[:8]}",
                    type="resume.tailor",
                    title=f"Resume {r.variant_type.capitalize()}",
                    description=f"Resume variant v{r.version} updated",
                    timestamp=d.strftime("%b %d, %H:%M"),
                    status="completed",
                    agent_name="Resume Agent",
                ))
        except Exception as e:
            logger.debug(f"Resume activity query skipped: {e}")

        activities.sort(key=lambda a: a.timestamp, reverse=True)
        return activities[:10]


profile_service = ProfileService()

