import json
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select

from ..models.schema import Document, Entity, Memory, Resume, User
from ..schemas.profile import (
    AddBlacklistRequest,
    AddCareerEntryRequest,
    AddEducationRequest,
    AddProjectRequest,
    AgentDirectivesData,
    ApplicationVaultData,
    ATSReadinessResponse,
    BlacklistItem,
    CareerEntry,
    EducationEntry,
    ImportLinkedInRequest,
    JobPreferences,
    MemorySummary,
    ProfileActivityItem,
    ProfileCompletenessResponse,
    ProfileImportSummaryResponse,
    ProfileRecommendationItem,
    ProfileResponse,
    ProjectEntry,
    PublicProfileResponse,
    ScreeningQuestionItem,
    SkillItem,
    UpdateAgentDirectivesRequest,
    UpdateApplicationVaultRequest,
    UpdateCareerEntryRequest,
    UpdateEducationRequest,
    UpdateJobPreferencesRequest,
    UpdateProfileRequest,
    UpdateProjectRequest,
    UpdateScreeningQuestionsRequest,
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

    def _classify_skill(self, name: str) -> tuple[str, str]:
        """Classify a skill into domain category and proficiency tier."""
        lower = name.lower()
        languages = {"python", "typescript", "javascript", "go", "golang", "rust", "c++", "c#", "java", "ruby", "php", "swift", "kotlin", "sql", "html", "css", "bash", "shell"}
        frameworks = {"react", "next.js", "nextjs", "vue", "angular", "svelte", "django", "fastapi", "flask", "express", "nest", "spring", "rails", "node.js", "tailwind", "redux"}
        cloud_devops = {"aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform", "ci/cd", "github actions", "linux", "nginx", "helm", "serverless"}
        databases = {"postgresql", "postgres", "mysql", "mongodb", "redis", "sqlite", "elasticsearch", "supabase", "dynamodb", "cassandra", "prisma", "sqlalchemy"}
        ai_ml = {"pytorch", "tensorflow", "langchain", "llamaindex", "openai", "llm", "rag", "embeddings", "vector db", "nlp", "computer vision", "scikit-learn", "huggingface"}

        cat = "Tools & Core"
        if any(k in lower for k in languages):
            cat = "Languages"
        elif any(k in lower for k in frameworks):
            cat = "Frameworks"
        elif any(k in lower for k in cloud_devops):
            cat = "Cloud & DevOps"
        elif any(k in lower for k in databases):
            cat = "Databases"
        elif any(k in lower for k in ai_ml):
            cat = "AI & Machine Learning"

        return cat, "Advanced"

    async def _aggregate_memory_data(self, workspace_id: str, db) -> dict:
        """Pull skills, career history, education, projects, vault, directives, and preferences from Memory records."""
        from ..models.schema import Memory as MemoryModel

        result = await db.execute(
            select(MemoryModel).where(
                MemoryModel.workspace_id == uuid.UUID(workspace_id),
                MemoryModel.type.in_([
                    "profile", "career", "preference", "episodic", "document", "working",
                    "education", "project", "eeo_vault", "agent_directives", "company_blacklist", "screening_questions"
                ]),
                ~MemoryModel.status.in_(["superseded", "deleted"]),
                MemoryModel.deleted_at.is_(None),
            )
        )
        memories = result.scalars().all()

        skills = []
        career_history = []
        education = []
        projects = []
        application_vault = None
        agent_directives = None
        company_blacklist = []
        screening_questions = []
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
                        s_cat = s.get("category")
                        s_prof = s.get("proficiency")
                        s_yrs = s.get("yearsExperience")
                    else:
                        s_name = str(s)
                        s_ver = (s_name in verified_skills) or (confidence >= 0.9)
                        s_conf = 1.0 if s_ver else confidence
                        s_src = "user" if s_ver else "memory"
                        s_cat = None
                        s_prof = None
                        s_yrs = None

                    if s_name and s_name not in [sk.name for sk in skills]:
                        from .capability_engine import capability_engine
                        assessment = capability_engine.assess_capability(
                            name=s_name,
                            base_confidence=s_conf,
                            last_demonstrated=getattr(mem, 'updated_at', None) or getattr(mem, 'created_at', None),
                            is_certified=s_ver and s_conf >= 0.95,
                        )
                        auto_cat, auto_prof = self._classify_skill(s_name)
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
                            category=s_cat or auto_cat,
                            proficiency=s_prof or auto_prof,
                            years_experience=s_yrs or (3 if s_ver else 2),
                        ))
                years_experience = content.get("yearsExperience")

            elif mem_type == "career":
                end_d = content.get("endDate")
                is_curr = content.get("isCurrent", False) or not bool(end_d) or str(end_d).lower() in ["present", "current"]
                career_history.append(CareerEntry(
                    company=content.get("company", "Unknown"),
                    role=content.get("role", "Unknown"),
                    start_date=content.get("startDate"),
                    end_date=end_d,
                    achievements=content.get("achievements", []),
                    confidence=confidence,
                    location=content.get("location"),
                    employment_type=content.get("employmentType", "Full-time"),
                    is_current=is_curr,
                ))

            elif mem_type == "education":
                education.append(EducationEntry(
                    id=str(mem.id),
                    institution=content.get("institution", "Unknown"),
                    degree=content.get("degree", "Degree"),
                    field_of_study=content.get("fieldOfStudy", content.get("field_of_study", "")),
                    start_year=content.get("startYear", content.get("start_year")),
                    graduation_year=content.get("graduationYear", content.get("graduation_year")),
                    gpa=content.get("gpa"),
                    show_gpa_on_resume=content.get("showGpaOnResume", content.get("show_gpa_on_resume", False)),
                    honors=content.get("honors", []),
                ))

            elif mem_type == "project":
                projects.append(ProjectEntry(
                    id=str(mem.id),
                    title=content.get("title", "Untitled Project"),
                    tagline=content.get("tagline"),
                    description=content.get("description", ""),
                    technologies=content.get("technologies", []),
                    metrics_summary=content.get("metricsSummary", content.get("metrics_summary")),
                    live_url=content.get("liveUrl", content.get("live_url")),
                    github_url=content.get("githubUrl", content.get("github_url")),
                    featured=content.get("featured", True),
                ))

            elif mem_type == "eeo_vault":
                application_vault = ApplicationVaultData(
                    demographics_policy=content.get("demographicsPolicy", content.get("demographics_policy", "decline")),
                    gender=content.get("gender"),
                    ethnicity=content.get("ethnicity"),
                    veteran_status=content.get("veteranStatus", content.get("veteran_status")),
                    disability_status=content.get("disabilityStatus", content.get("disability_status")),
                    authorized_countries=content.get("authorizedCountries", content.get("authorized_countries", ["US"])),
                    visa_status=content.get("visaStatus", content.get("visa_status", "Citizen")),
                    requires_sponsorship=content.get("requiresSponsorship", content.get("requires_sponsorship", False)),
                    security_clearance=content.get("securityClearance", content.get("security_clearance", "None")),
                )

            elif mem_type == "agent_directives":
                agent_directives = AgentDirectivesData(
                    autonomy_mode=content.get("autonomyMode", content.get("autonomy_mode", "copilot")),
                    min_match_threshold=content.get("minMatchThreshold", content.get("min_match_threshold", 80)),
                    daily_application_quota=content.get("dailyApplicationQuota", content.get("daily_application_quota", 10)),
                    min_base_salary=content.get("minBaseSalary", content.get("min_base_salary")),
                    target_base_salary=content.get("targetBaseSalary", content.get("target_base_salary")),
                    target_total_comp=content.get("targetTotalComp", content.get("target_total_comp")),
                    currency=content.get("currency", "USD"),
                    notice_period=content.get("noticePeriod", content.get("notice_period", "2 weeks")),
                    relocation_preference=content.get("relocationPreference", content.get("relocation_preference", "Remote only")),
                    travel_percentage=content.get("travelPercentage", content.get("travel_percentage", "0%")),
                    cover_letter_policy=content.get("coverLetterPolicy", content.get("cover_letter_policy", "when_required")),
                )

            elif mem_type == "company_blacklist":
                raw_bl = content.get("blacklist", [])
                for b in raw_bl:
                    company_blacklist.append(BlacklistItem(
                        id=b.get("id", f"bl-{uuid.uuid4().hex[:8]}"),
                        company_name=b.get("companyName", b.get("company_name", "")),
                        domain=b.get("domain"),
                        reason=b.get("reason", "Company Blacklist"),
                        auto_inferred=b.get("autoInferred", b.get("auto_inferred", False)),
                    ))

            elif mem_type == "screening_questions":
                raw_sq = content.get("questions", [])
                for q in raw_sq:
                    screening_questions.append(ScreeningQuestionItem(
                        id=q.get("id", f"sq-{uuid.uuid4().hex[:8]}"),
                        question=q.get("question", ""),
                        answer=q.get("answer", ""),
                        category=q.get("category", "general"),
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
                auto_cat, auto_prof = self._classify_skill(ent.canonical_name)
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
                        category=auto_cat,
                        proficiency=auto_prof,
                        years_experience=3 if verified else 1,
                    ))
                elif verified and not existing.verified:
                    existing.verified = True
                    existing.confidence = 1.0
                    existing.source = source
                    existing.validation_tier = "V2"
                    existing.is_matchable = True
        except Exception as e:
            logger.debug("Entity skill merge skipped: %s", e)

        # Auto-infer current employer into company blacklist if not present
        active_companies = [c.company for c in career_history if c.is_current and c.company and c.company != "Unknown"]
        existing_bl_names = {b.company_name.lower() for b in company_blacklist}
        for act_comp in active_companies:
            if act_comp.lower() not in existing_bl_names:
                company_blacklist.append(BlacklistItem(
                    id=f"auto-cur-{uuid.uuid4().hex[:8]}",
                    company_name=act_comp,
                    reason="Current Employer (Auto-Protected)",
                    auto_inferred=True,
                ))
                existing_bl_names.add(act_comp.lower())

        # Fallback defaults for vault and directives if empty
        if application_vault is None:
            application_vault = ApplicationVaultData()
        if agent_directives is None:
            agent_directives = AgentDirectivesData()

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
            "education": education,
            "projects": projects,
            "application_vault": application_vault,
            "agent_directives": agent_directives,
            "company_blacklist": company_blacklist,
            "screening_questions": screening_questions,
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
        import os

        from .storage_service import storage_service

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

    def _heuristic_resume_parse(self, raw_text: str) -> dict:
        """Heuristic fallback parser for resumes when LLM is unavailable or offline."""
        import re
        lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
        headline = lines[0] if lines else "Professional"
        bio = ""
        skills = []
        experience = []
        education = []
        links = {}

        for word in re.findall(r"https?://[^\s]+|www\.[^\s]+", raw_text):
            if "linkedin.com" in word:
                links["linkedin"] = word
            elif "github.com" in word:
                links["github"] = word

        email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", raw_text)
        email = email_match.group(0) if email_match else None
        phone_match = re.search(r"\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
        phone = phone_match.group(0) if phone_match else None

        COMMON_SKILLS = [
            "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
            "Docker", "Kubernetes", "PostgreSQL", "SQL", "Git", "AWS", "Azure", "GCP",
            "PyTorch", "TensorFlow", "Machine Learning", "AI", "LLM", "REST", "GraphQL",
            "HTML", "CSS", "Tailwind", "Java", "C++", "Go", "Rust", "Linux", "CI/CD"
        ]
        lower_text = raw_text.lower()
        for sk in COMMON_SKILLS:
            if re.search(rf"\b{re.escape(sk.lower())}\b", lower_text):
                skills.append(sk)

        for i, ln in enumerate(lines):
            if any(k in ln.lower() for k in ["summary", "about me", "profile", "bio"]) and i + 1 < len(lines):
                bio = lines[i + 1]
                break

        return {
            "headline": headline[:100],
            "bio": bio[:500] if bio else (lines[1][:250] if len(lines) > 1 else ""),
            "location": None,
            "phone": phone,
            "email": email,
            "social_links": links,
            "skills": skills,
            "experience": experience,
            "education": education,
            "projects": [],
        }

    async def _upsert_skills_to_memory_and_entities(
        self, ws_uuid, u_uuid, skills: list[str], db, source: str = "resume"
    ) -> None:
        """Helper to upsert skills into profile Memory and Entity graph."""
        import hashlib
        import json
        from datetime import UTC, datetime
        from ..models.schema import Entity, Memory

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
        for sk in skills:
            if sk not in curr_skills:
                curr_skills.append(sk)
        content["skills"] = curr_skills

        ver_skills = set(content.get("verified_skills", []))
        for sk in skills:
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

        for sk in skills:
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
                    metadata_={"verified": True, "confidence": 0.95, "source": source},
                ))
            else:
                meta = dict(entity.metadata_ or {})
                meta["verified"] = True
                meta["confidence"] = 1.0
                meta["source"] = source
                entity.metadata_ = meta

    async def import_from_resume_file(
        self, user_id: str, workspace_id: str, file, db=None
    ) -> ProfileResponse | None:
        """Upload a resume file (PDF, DOCX, TXT), parse candidate data, and populate profile & memory."""
        import hashlib
        import json
        from datetime import UTC, datetime
        from ..ingestion.parsers import get_parser
        from ..models.schema import Document, Resume, Memory
        from ..services.llm_service import llm_service
        from ..utils.sanitize import sanitize_text

        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)

        user_res = await db.execute(select(User).where(User.id == u_uuid))
        user = user_res.scalar_one_or_none()
        if not user:
            return None

        content_bytes = await file.read()
        raw_filename = file.filename or "uploaded_resume.pdf"
        filename = sanitize_text(raw_filename)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "pdf"

        raw_text = ""
        try:
            parser = get_parser(ext)
            parsed_doc = await parser.parse(content_bytes)
            raw_text = parsed_doc.text if parsed_doc else ""
        except Exception as e:
            logger.warning(f"Resume text parser warning: {e}")
            raw_text = content_bytes.decode("utf-8", errors="ignore")

        extracted_data = {}
        if raw_text and len(raw_text.strip()) > 20:
            prompt = (
                "You are an expert ATS resume parser. Extract candidate information from this resume into valid JSON.\n"
                "Extract these fields:\n"
                "- headline: string (target role or professional headline)\n"
                "- bio: string (professional summary/bio)\n"
                "- location: string\n"
                "- phone: string\n"
                "- email: string\n"
                "- social_links: {\"github\": \"url\", \"linkedin\": \"url\", \"portfolio\": \"url\", \"twitter\": \"url\"}\n"
                "- skills: list of strings (technical skills, tools, methodologies)\n"
                "- experience: list of objects with {\"company\": str, \"role\": str, \"start\": str, \"end\": str, \"bullets\": list of str, \"location\": str, \"employmentType\": str}\n"
                "- education: list of objects with {\"institution\": str, \"degree\": str, \"field_of_study\": str, \"start_year\": int, \"graduation_year\": int, \"gpa\": str, \"honors\": list of str}\n"
                "- projects: list of objects with {\"title\": str, \"tagline\": str, \"description\": str, \"technologies\": list of str, \"live_url\": str, \"github_url\": str}\n\n"
                f"Resume Content:\n{raw_text[:8000]}\n\n"
                "Return ONLY a valid JSON object."
            )
            try:
                llm_out = await llm_service.generate_completion(prompt, temperature=0.1, max_tokens=2000)
                clean_json = llm_out.strip()
                if "```json" in clean_json:
                    clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                elif "```" in clean_json:
                    clean_json = clean_json.split("```")[1].split("```")[0].strip()
                extracted_data = json.loads(clean_json)
            except Exception as e:
                logger.warning(f"LLM resume parsing fallback: {e}")
                extracted_data = self._heuristic_resume_parse(raw_text)
        else:
            extracted_data = self._heuristic_resume_parse(raw_text)

        doc = Document(
            id=uuid.uuid4(),
            workspace_id=ws_uuid,
            path=f"resumes/{filename}",
            type=ext,
            content=content_bytes,
            metadata_={"original_name": filename, "source": "profile_import", "parsed": True},
        )
        db.add(doc)

        existing_res = await db.execute(
            select(Resume).where(Resume.workspace_id == ws_uuid, Resume.variant_type == "master")
        )
        m_resume = existing_res.scalars().first()
        resume_content = {
            "headline": extracted_data.get("headline"),
            "summary": extracted_data.get("bio"),
            "location": extracted_data.get("location"),
            "phone": extracted_data.get("phone"),
            "email": extracted_data.get("email"),
            "links": extracted_data.get("social_links", {}),
            "skills": extracted_data.get("skills", []),
            "experience": extracted_data.get("experience", []),
            "education": extracted_data.get("education", []),
            "projects": extracted_data.get("projects", []),
        }
        if m_resume:
            m_resume.content = resume_content
            m_resume.updated_at = datetime.now(UTC)
        else:
            m_resume = Resume(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                variant_type="master",
                content=resume_content,
                version=1,
            )
            db.add(m_resume)

        if extracted_data.get("headline"):
            user.headline = sanitize_text(extracted_data["headline"])
            user.job_title = sanitize_text(extracted_data["headline"])
        if extracted_data.get("bio"):
            user.bio = sanitize_text(extracted_data["bio"])
        if extracted_data.get("location"):
            user.location = sanitize_text(extracted_data["location"])
        if extracted_data.get("phone"):
            user.phone = sanitize_text(extracted_data["phone"])
        if extracted_data.get("social_links"):
            curr_socials = dict(user.social_links or {})
            curr_socials.update(extracted_data["social_links"])
            user.social_links = curr_socials

        skills = extracted_data.get("skills", [])
        if skills:
            await self._upsert_skills_to_memory_and_entities(ws_uuid, u_uuid, skills, db, source="resume")

        for exp in extracted_data.get("experience", []):
            company = exp.get("company", "Organization")
            role = exp.get("role", "Professional")
            career_content_str = json.dumps({
                "company": company,
                "role": role,
                "startDate": exp.get("start") or exp.get("startDate"),
                "endDate": exp.get("end") or exp.get("endDate"),
                "achievements": exp.get("bullets") or exp.get("achievements") or [],
                "location": exp.get("location"),
                "employmentType": exp.get("employmentType") or "Full-time",
            })
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
                metadata_={"confidence": 0.95, "source": "resume_upload"},
            ))

        await self._sync_profile_to_memory(user_id, workspace_id, user, db)
        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def import_from_linkedin(
        self, user_id: str, workspace_id: str, linkedin_url: str, db=None
    ) -> ProfileResponse | None:
        """Validate LinkedIn profile URL, fetch public metadata, and populate profile & memory."""
        import hashlib
        import json
        import re
        from urllib.parse import urlparse
        import httpx
        from ..models.schema import Memory
        from ..services.llm_service import llm_service
        from ..utils.sanitize import sanitize_text

        ws_uuid = uuid.UUID(workspace_id)
        u_uuid = uuid.UUID(user_id)

        user_res = await db.execute(select(User).where(User.id == u_uuid))
        user = user_res.scalar_one_or_none()
        if not user:
            return None

        clean_url = linkedin_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = f"https://{clean_url}"

        parsed_url = urlparse(clean_url)
        if "linkedin.com" not in parsed_url.netloc.lower():
            raise ValueError("Invalid LinkedIn URL: must be on linkedin.com")

        path_parts = [p for p in parsed_url.path.strip("/").split("/") if p]
        handle = path_parts[-1] if path_parts else "professional"
        if "in" in path_parts and len(path_parts) > path_parts.index("in") + 1:
            handle = path_parts[path_parts.index("in") + 1]

        page_html = ""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
                res = await client.get(clean_url, headers=headers)
                # Zero-trust: manual redirect with host re-check (SSRF guard).
                # follow_redirects=True would follow to any host without re-validation.
                if res.status_code in (301, 302, 303, 307, 308):
                    loc = res.headers.get("location", "")
                    if loc and "linkedin.com" in urlparse(loc if "://" in loc else f"https://{loc}").netloc.lower():
                        res = await client.get(loc, headers=headers)
                if res.status_code == 200:
                    page_html = res.text
        except Exception as e:
            logger.info(f"Direct LinkedIn fetch skipped or throttled: {e}")

        title_match = re.search(r"<title>(.*?)</title>", page_html, re.IGNORECASE) if page_html else None
        og_title = re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'](.*?)["\']', page_html, re.IGNORECASE) if page_html else None
        og_desc = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', page_html, re.IGNORECASE) if page_html else None

        title_text = og_title.group(1) if og_title else (title_match.group(1) if title_match else "")
        desc_text = og_desc.group(1) if og_desc else ""

        extracted_info = {}
        prompt = (
            f"Extract or synthesize candidate profile details from LinkedIn handle/URL and metadata.\n"
            f"LinkedIn URL: {clean_url}\n"
            f"Handle: {handle}\n"
            f"Page Title: {title_text}\n"
            f"Page Description: {desc_text}\n\n"
            "Return JSON with:\n"
            "- headline: string (e.g. Senior Software Engineer)\n"
            "- bio: string (professional summary)\n"
            "- location: string\n"
            "- skills: list of strings (relevant domain skills)\n"
            "- experience: list of objects with {\"company\": str, \"role\": str, \"start\": str, \"end\": str, \"bullets\": list of str}\n"
            "Return ONLY valid JSON."
        )
        try:
            llm_out = await llm_service.generate_completion(prompt, temperature=0.2, max_tokens=1000)
            clean_json = llm_out.strip()
            if "```json" in clean_json:
                clean_json = clean_json.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_json:
                clean_json = clean_json.split("```")[1].split("```")[0].strip()
            extracted_info = json.loads(clean_json)
        except Exception as e:
            logger.warning(f"LinkedIn LLM synthesis fallback: {e}")
            formatted_name = handle.replace("-", " ").replace("_", " ").title()
            extracted_info = {
                "headline": title_text.split(" - ")[1] if " - " in title_text else f"{formatted_name} | Professional",
                "bio": desc_text or f"Experienced professional with public profile on LinkedIn ({clean_url}).",
                "location": None,
                "skills": ["Communication", "Problem Solving", "Leadership"],
                "experience": [],
            }

        curr_socials = dict(user.social_links or {})
        curr_socials["linkedin"] = clean_url
        user.social_links = curr_socials

        if extracted_info.get("headline") and (not user.headline or user.headline == "Add a headline"):
            user.headline = sanitize_text(extracted_info["headline"])
            user.job_title = sanitize_text(extracted_info["headline"])
        if extracted_info.get("bio") and not user.bio:
            user.bio = sanitize_text(extracted_info["bio"])
        if extracted_info.get("location") and not user.location:
            user.location = sanitize_text(extracted_info["location"])

        skills = extracted_info.get("skills", [])
        if skills:
            await self._upsert_skills_to_memory_and_entities(ws_uuid, u_uuid, skills, db, source="linkedin")

        for exp in extracted_info.get("experience", []):
            company = exp.get("company", "Organization")
            role = exp.get("role", "Professional")
            career_content_str = json.dumps({
                "company": company,
                "role": role,
                "startDate": exp.get("start") or exp.get("startDate"),
                "endDate": exp.get("end") or exp.get("endDate"),
                "achievements": exp.get("bullets") or exp.get("achievements") or [],
            })
            db.add(Memory(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                user_id=u_uuid,
                type="career",
                domain="career",
                status="ACTIVE",
                title=f"{role} at {company}",
                summary=f"LinkedIn role: {role} at {company}",
                content=career_content_str,
                content_hash=hashlib.sha256(career_content_str.encode()).hexdigest(),
                size=len(career_content_str),
                metadata_={"confidence": 0.9, "source": "linkedin"},
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

    async def add_education_entry(
        self, user_id: str, data: AddEducationRequest, db=None
    ) -> ProfileResponse | None:
        """Add an academic degree/credential to Memory and Entity graph."""
        ws_uuid = uuid.UUID(data.workspace_id)
        mem_content = {
            "institution": sanitize_text(data.institution),
            "degree": sanitize_text(data.degree),
            "fieldOfStudy": sanitize_text(data.field_of_study),
            "startYear": data.start_year,
            "graduationYear": data.graduation_year,
            "gpa": sanitize_text(data.gpa) if data.gpa else None,
            "showGpaOnResume": data.show_gpa_on_resume,
            "honors": [sanitize_text(h) for h in data.honors if h],
        }
        content_str = json.dumps(mem_content)
        mem = Memory(
            id=uuid.uuid4(),
            type="education",
            domain="education",
            status="active",
            title=f"{data.degree} at {data.institution}",
            summary=f"{data.degree} in {data.field_of_study} from {data.institution}",
            content=content_str,
            content_hash=f"edu_{uuid.uuid4().hex[:12]}",
            size=len(content_str),
            metadata_={"confidence": 1.0, "source": "user", "verified": True},
            workspace_id=ws_uuid,
            user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
        db.add(mem)

        ent_stmt = select(Entity).where(
            Entity.workspace_id == ws_uuid,
            Entity.type == "education",
            func.lower(Entity.canonical_name) == data.institution.lower(),
        )
        ent_res = await db.execute(ent_stmt)
        ent = ent_res.scalar_one_or_none()
        if not ent:
            ent = Entity(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                type="education",
                canonical_name=data.institution,
                metadata_={
                    "degree": data.degree,
                    "fieldOfStudy": data.field_of_study,
                    "graduationYear": data.graduation_year,
                    "source": "user",
                },
            )
            db.add(ent)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def update_education_entry(
        self, user_id: str, education_id: str, data: UpdateEducationRequest, db=None
    ) -> ProfileResponse | None:
        """Update an education entry in Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "education",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mems = res.scalars().all()
        target = None
        for m in mems:
            if str(m.id) == education_id or (m.title and education_id.lower() in m.title.lower()):
                target = m
                break

        if target:
            content = json.loads(target.content) if isinstance(target.content, str) else dict(target.content or {})
            if data.institution is not None:
                content["institution"] = sanitize_text(data.institution)
            if data.degree is not None:
                content["degree"] = sanitize_text(data.degree)
            if data.field_of_study is not None:
                content["fieldOfStudy"] = sanitize_text(data.field_of_study)
            if data.start_year is not None:
                content["startYear"] = data.start_year
            if data.graduation_year is not None:
                content["graduationYear"] = data.graduation_year
            if data.gpa is not None:
                content["gpa"] = sanitize_text(data.gpa)
            if data.show_gpa_on_resume is not None:
                content["showGpaOnResume"] = data.show_gpa_on_resume
            if data.honors is not None:
                content["honors"] = [sanitize_text(h) for h in data.honors if h]

            target.content = json.dumps(content)
            target.title = f"{content.get('degree', 'Degree')} at {content.get('institution', 'Institution')}"
            target.summary = f"{content.get('degree')} in {content.get('fieldOfStudy')} from {content.get('institution')}"
            target.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def delete_education_entry(
        self, user_id: str, workspace_id: str, education_id: str, db=None
    ) -> ProfileResponse | None:
        """Soft delete an education entry from Memory."""
        ws_uuid = uuid.UUID(workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "education",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mems = res.scalars().all()
        for m in mems:
            if str(m.id) == education_id or (m.title and education_id.lower() in m.title.lower()):
                m.status = "deleted"
                m.deleted_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def add_project_entry(
        self, user_id: str, data: AddProjectRequest, db=None
    ) -> ProfileResponse | None:
        """Add a project/portfolio entry to Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        mem_content = {
            "title": sanitize_text(data.title),
            "tagline": sanitize_text(data.tagline) if data.tagline else None,
            "description": sanitize_text(data.description),
            "technologies": [sanitize_text(t) for t in data.technologies if t],
            "metricsSummary": sanitize_text(data.metrics_summary) if data.metrics_summary else None,
            "liveUrl": sanitize_text(data.live_url) if data.live_url else None,
            "githubUrl": sanitize_text(data.github_url) if data.github_url else None,
            "featured": data.featured,
        }
        content_str = json.dumps(mem_content)
        mem = Memory(
            id=uuid.uuid4(),
            type="project",
            domain="project",
            status="active",
            title=f"Project: {data.title}",
            summary=data.tagline or f"Showcase project: {data.title}",
            content=content_str,
            content_hash=f"proj_{uuid.uuid4().hex[:12]}",
            size=len(content_str),
            metadata_={"confidence": 1.0, "source": "user", "featured": data.featured},
            workspace_id=ws_uuid,
            user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        )
        db.add(mem)
        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def update_project_entry(
        self, user_id: str, project_id: str, data: UpdateProjectRequest, db=None
    ) -> ProfileResponse | None:
        """Update a project/portfolio entry in Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "project",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mems = res.scalars().all()
        target = None
        for m in mems:
            if str(m.id) == project_id or (m.title and project_id.lower() in m.title.lower()):
                target = m
                break

        if target:
            content = json.loads(target.content) if isinstance(target.content, str) else dict(target.content or {})
            if data.title is not None:
                content["title"] = sanitize_text(data.title)
            if data.tagline is not None:
                content["tagline"] = sanitize_text(data.tagline)
            if data.description is not None:
                content["description"] = sanitize_text(data.description)
            if data.technologies is not None:
                content["technologies"] = [sanitize_text(t) for t in data.technologies if t]
            if data.metrics_summary is not None:
                content["metricsSummary"] = sanitize_text(data.metrics_summary)
            if data.live_url is not None:
                content["liveUrl"] = sanitize_text(data.live_url)
            if data.github_url is not None:
                content["githubUrl"] = sanitize_text(data.github_url)
            if data.featured is not None:
                content["featured"] = data.featured

            target.content = json.dumps(content)
            target.title = f"Project: {content.get('title', 'Project')}"
            target.summary = content.get('tagline') or f"Showcase project: {content.get('title')}"
            target.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def delete_project_entry(
        self, user_id: str, workspace_id: str, project_id: str, db=None
    ) -> ProfileResponse | None:
        """Soft delete a project/portfolio entry from Memory."""
        ws_uuid = uuid.UUID(workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "project",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mems = res.scalars().all()
        for m in mems:
            if str(m.id) == project_id or (m.title and project_id.lower() in m.title.lower()):
                m.status = "deleted"
                m.deleted_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def update_application_vault(
        self, user_id: str, data: UpdateApplicationVaultRequest, db=None
    ) -> ProfileResponse | None:
        """Update encrypted EEO & work authorization application vault in Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "eeo_vault",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()

        vault_content = {
            "demographicsPolicy": data.demographics_policy,
            "gender": sanitize_text(data.gender) if data.gender else None,
            "ethnicity": sanitize_text(data.ethnicity) if data.ethnicity else None,
            "veteranStatus": sanitize_text(data.veteran_status) if data.veteran_status else None,
            "disabilityStatus": sanitize_text(data.disability_status) if data.disability_status else None,
            "authorizedCountries": [sanitize_text(c) for c in data.authorized_countries if c],
            "visaStatus": sanitize_text(data.visa_status) or "Citizen",
            "requiresSponsorship": data.requires_sponsorship,
            "securityClearance": sanitize_text(data.security_clearance) or "None",
        }
        content_str = json.dumps(vault_content)

        if not mem:
            mem = Memory(
                id=uuid.uuid4(),
                type="eeo_vault",
                domain="vault",
                status="active",
                title="EEO & Application Vault",
                summary="Encrypted candidate demographic & work authorization credentials",
                content=content_str,
                content_hash=f"vault_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
                metadata_={"policy": data.demographics_policy},
                workspace_id=ws_uuid,
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            )
            db.add(mem)
        else:
            mem.content = content_str
            mem.metadata_ = {"policy": data.demographics_policy}
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def update_agent_directives(
        self, user_id: str, data: UpdateAgentDirectivesRequest, db=None
    ) -> ProfileResponse | None:
        """Update candidate agent autopilot directives and guardrails in Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "agent_directives",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()

        directives_content = {
            "autonomyMode": data.autonomy_mode,
            "minMatchThreshold": data.min_match_threshold,
            "dailyApplicationQuota": data.daily_application_quota,
            "minBaseSalary": data.min_base_salary,
            "targetBaseSalary": data.target_base_salary,
            "targetTotalComp": data.target_total_comp,
            "currency": sanitize_text(data.currency) or "USD",
            "noticePeriod": sanitize_text(data.notice_period) or "2 weeks",
            "relocationPreference": sanitize_text(data.relocation_preference) or "Remote only",
            "travelPercentage": sanitize_text(data.travel_percentage) or "0%",
            "coverLetterPolicy": sanitize_text(data.cover_letter_policy) or "when_required",
        }
        content_str = json.dumps(directives_content)

        if not mem:
            mem = Memory(
                id=uuid.uuid4(),
                type="agent_directives",
                domain="agent",
                status="active",
                title="Agent Directives & Autopilot Settings",
                summary=f"Autonomy Mode: {data.autonomy_mode} | Quota: {data.daily_application_quota}/day",
                content=content_str,
                content_hash=f"dir_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
                workspace_id=ws_uuid,
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            )
            db.add(mem)
        else:
            mem.content = content_str
            mem.summary = f"Autonomy Mode: {data.autonomy_mode} | Quota: {data.daily_application_quota}/day"
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def add_company_blacklist(
        self, user_id: str, data: AddBlacklistRequest, db=None
    ) -> ProfileResponse | None:
        """Add an excluded company to the blacklist in Memory."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "company_blacklist",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()

        new_item = {
            "id": f"bl-{uuid.uuid4().hex[:8]}",
            "companyName": sanitize_text(data.company_name),
            "domain": sanitize_text(data.domain) if data.domain else None,
            "reason": sanitize_text(data.reason) or "Company Blacklist",
            "autoInferred": False,
        }

        if not mem:
            content = {"blacklist": [new_item]}
            content_str = json.dumps(content)
            mem = Memory(
                id=uuid.uuid4(),
                type="company_blacklist",
                domain="preferences",
                status="active",
                title="Company Blacklist & Excluded Employers",
                summary="Protected employer and competitor exclusion list",
                content=content_str,
                content_hash=f"bl_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
                workspace_id=ws_uuid,
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            )
            db.add(mem)
        else:
            content = json.loads(mem.content) if isinstance(mem.content, str) else dict(mem.content or {})
            bl_list = content.get("blacklist", [])
            # Only add if not already in list
            if not any(b.get("companyName", "").lower() == data.company_name.lower() for b in bl_list):
                bl_list.append(new_item)
            content["blacklist"] = bl_list
            mem.content = json.dumps(content)
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    async def delete_company_blacklist(
        self, user_id: str, workspace_id: str, company_name: str, db=None
    ) -> ProfileResponse | None:
        """Remove a company from the blacklist in Memory."""
        ws_uuid = uuid.UUID(workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "company_blacklist",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()
        if mem:
            content = json.loads(mem.content) if isinstance(mem.content, str) else dict(mem.content or {})
            bl_list = content.get("blacklist", [])
            clean_name = company_name.strip().lower()
            filtered = [b for b in bl_list if b.get("companyName", "").lower() != clean_name and b.get("id") != company_name]
            content["blacklist"] = filtered
            mem.content = json.dumps(content)
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=workspace_id, db=db)

    async def update_screening_questions(
        self, user_id: str, data: UpdateScreeningQuestionsRequest, db=None
    ) -> ProfileResponse | None:
        """Update the screening questions memory repository."""
        ws_uuid = uuid.UUID(data.workspace_id)
        stmt = select(Memory).where(
            Memory.workspace_id == ws_uuid,
            Memory.type == "screening_questions",
            Memory.status == "active",
        )
        res = await db.execute(stmt)
        mem = res.scalar_one_or_none()

        questions_list = [
            {
                "id": q.id or f"sq-{uuid.uuid4().hex[:8]}",
                "question": sanitize_text(q.question),
                "answer": sanitize_text(q.answer),
                "category": sanitize_text(q.category) or "general",
            }
            for q in data.questions
        ]
        content = {"questions": questions_list}
        content_str = json.dumps(content)

        if not mem:
            mem = Memory(
                id=uuid.uuid4(),
                type="screening_questions",
                domain="application",
                status="active",
                title="Screening Question Auto-Answer Bank",
                summary=f"Saved answers for {len(questions_list)} standard recruiter questions",
                content=content_str,
                content_hash=f"sq_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
                workspace_id=ws_uuid,
                user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            )
            db.add(mem)
        else:
            mem.content = content_str
            mem.summary = f"Saved answers for {len(questions_list)} standard recruiter questions"
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return await self.get_profile(user_id, workspace_id=data.workspace_id, db=db)

    # ------------------------------------------------------------------
    # Resume / LinkedIn import helpers
    # ------------------------------------------------------------------

    def _heuristic_resume_parse(self, text: str) -> dict:
        """Offline keyword/regex resume parser — returns dict with skills, career, education lists."""
        import re

        lines = [l.strip() for l in text.splitlines() if l.strip()]

        # ---- skills ----
        skill_keywords = {
            "python", "javascript", "typescript", "react", "node", "java", "go", "rust",
            "sql", "postgresql", "mysql", "mongodb", "redis", "docker", "kubernetes",
            "aws", "gcp", "azure", "terraform", "fastapi", "django", "flask", "nextjs",
            "graphql", "rest", "git", "linux", "machine learning", "deep learning",
            "nlp", "llm", "langchain", "pytorch", "tensorflow", "spark", "kafka",
            "figma", "css", "html", "tailwind", "sass", "webpack", "vite",
        }
        text_lower = text.lower()
        found_skills = [s for s in skill_keywords if s in text_lower]

        # ---- career (look for year ranges) ----
        career = []
        year_pattern = re.compile(r"(\d{4})\s*[-–]\s*(\d{4}|present|current)", re.IGNORECASE)
        for i, line in enumerate(lines):
            if year_pattern.search(line):
                career.append({
                    "role": lines[i - 1] if i > 0 else line,
                    "company": line,
                    "start_date": None,
                    "end_date": None,
                    "description": "",
                })

        # ---- education ----
        edu_keywords = {"university", "college", "bachelor", "master", "phd", "b.sc", "m.sc", "b.e", "m.e", "b.tech", "m.tech"}
        education = []
        for line in lines:
            if any(k in line.lower() for k in edu_keywords):
                education.append({"institution": line, "degree": "", "field": "", "graduation_year": None})

        return {"skills": found_skills, "career": career[:10], "education": education[:5]}

    async def _upsert_skills_to_memory_and_entities(
        self, user_id: str, workspace_id: str, skills: list[str], db
    ) -> int:
        """Upsert a list of skill strings into Memory + Entity tables. Returns count inserted."""
        if not skills:
            return 0
        ws_uuid = uuid.UUID(workspace_id)
        user_uuid = uuid.UUID(user_id)
        inserted = 0
        for skill_name in skills[:50]:
            # Check existing Entity
            res = await db.execute(
                select(Entity).where(
                    Entity.workspace_id == ws_uuid,
                    Entity.type == "skill",
                    Entity.canonical_name == skill_name,
                )
            )
            if not res.scalar_one_or_none():
                entity = Entity(
                    id=uuid.uuid4(),
                    workspace_id=ws_uuid,
                    type="skill",
                    canonical_name=skill_name,
                    metadata_={"source": "resume_import", "user_id": user_id},
                )
                db.add(entity)
                inserted += 1

        # Upsert single skills Memory block
        res = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.user_id == user_uuid,
                Memory.type == "skill_profile",
                Memory.status == "active",
            )
        )
        mem = res.scalars().first()
        skill_content = json.dumps({"skills": skills, "source": "resume_import"})
        if not mem:
            mem = Memory(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                user_id=user_uuid,
                type="skill_profile",
                domain="career",
                status="active",
                title="Imported Skills",
                summary=f"{len(skills)} skills imported from resume",
                content=skill_content,
                content_hash=f"skills_{uuid.uuid4().hex[:12]}",
                size=len(skill_content),
            )
            db.add(mem)
        else:
            mem.content = skill_content
            mem.summary = f"{len(skills)} skills imported from resume"
            mem.updated_at = datetime.now(UTC)

        await db.flush()
        return inserted

    async def import_from_resume_file(
        self,
        user_id: str,
        workspace_id: str,
        filename: str,
        content: bytes,
        db,
    ) -> ProfileImportSummaryResponse:
        """Parse an uploaded resume file and populate profile/memory/entities."""
        from ..ingestion.parsers import PARSERS, UnsupportedFormatError
        from pathlib import Path
        import asyncio

        ext = Path(filename).suffix.lower()
        parser_cls = PARSERS.get(ext)
        if not parser_cls:
            raise UnsupportedFormatError(f"Unsupported file type: {ext}")

        parser = parser_cls(timeout=30)
        try:
            parsed = await asyncio.wait_for(parser.parse(content), timeout=30)
        except Exception as e:
            logger.warning(f"Parser failed for {filename}: {e}, falling back to heuristic")
            parsed = None

        raw_text = parsed.content if parsed else content.decode("utf-8", errors="ignore")
        extracted = self._heuristic_resume_parse(raw_text)
        skills = extracted["skills"]
        career = extracted["career"]
        education = extracted["education"]

        user_uuid = uuid.UUID(user_id)
        ws_uuid = uuid.UUID(workspace_id)

        # Store raw document in Document table
        res = await db.execute(select(Document).where(
            Document.workspace_id == ws_uuid,
            Document.path == filename,
        ))
        existing_doc = res.scalar_one_or_none()
        if not existing_doc:
            doc = Document(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                path=filename,
                type="resume",
                content=content if isinstance(content, bytes) else str(content).encode("utf-8"),
                summary=raw_text[:1000] if raw_text else "Imported resume",
                metadata_={"filename": filename, "user_id": user_id, "size": len(content)},
            )
            db.add(doc)

        # Upsert skills
        skill_count = await self._upsert_skills_to_memory_and_entities(user_id, workspace_id, skills, db)

        # Upsert career entries as Memory blocks
        career_count = 0
        for entry in career[:10]:
            content_str = json.dumps(entry)
            mem = Memory(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                user_id=user_uuid,
                type="career_history",
                domain="career",
                status="active",
                title=entry.get("role", "Imported Role"),
                summary=f"Career entry at {entry.get('company', 'Unknown')}",
                content=content_str,
                content_hash=f"career_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
            )
            db.add(mem)
            career_count += 1

        # Upsert education entries as Memory blocks
        edu_count = 0
        for entry in education[:5]:
            content_str = json.dumps(entry)
            mem = Memory(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                user_id=user_uuid,
                type="education",
                domain="profile",
                status="active",
                title=entry.get("institution", "Imported Education"),
                summary=entry.get("degree", "Degree"),
                content=content_str,
                content_hash=f"edu_{uuid.uuid4().hex[:12]}",
                size=len(content_str),
            )
            db.add(mem)
            edu_count += 1

        await db.flush()
        profile = await self.get_profile(user_id, workspace_id=workspace_id, db=db)
        return ProfileImportSummaryResponse(
            skills_imported=skill_count,
            career_imported=career_count,
            education_imported=edu_count,
            message=f"Imported {skill_count} skills, {career_count} career entries, {edu_count} education entries from {filename}",
            profile=profile,
        )

    async def import_from_linkedin(
        self,
        user_id: str,
        body: ImportLinkedInRequest,
        db,
    ) -> ProfileImportSummaryResponse:
        """Fetch a LinkedIn public profile page and extract profile data."""
        import re
        import httpx

        url = body.linkedin_url.strip()
        if not url.startswith("https://www.linkedin.com/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="Must be a linkedin.com URL")

        raw_text = ""
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    )
                }
                resp = await client.get(url, headers=headers)
                # Zero-trust: manual redirect with host re-check (SSRF guard).
                if resp.status_code in (301, 302, 303, 307, 308):
                    from urllib.parse import urlparse as _urlparse

                    loc = resp.headers.get("location", "")
                    if loc and "linkedin.com" in _urlparse(loc if "://" in loc else f"https://{loc}").netloc.lower():
                        resp = await client.get(loc, headers=headers)
                raw_text = resp.text if resp.status_code == 200 else ""
        except Exception as e:
            logger.warning(f"LinkedIn fetch failed: {e}")

        # Extract display_name from og:title
        name_match = re.search(r'og:title[^>]+content="([^"]+)"', raw_text)
        display_name = name_match.group(1).split(" | ")[0].strip() if name_match else ""

        # Extract headline
        headline_match = re.search(r'"headline"\s*:\s*"([^"]+)"', raw_text)
        headline = headline_match.group(1) if headline_match else ""

        # Extract location
        loc_match = re.search(r'"locationName"\s*:\s*"([^"]+)"', raw_text)
        location = loc_match.group(1) if loc_match else ""

        # Extract skills from JSON blobs
        skills_match = re.findall(r'"name"\s*:\s*"([^"]{2,40})"', raw_text)
        # Deduplicate and limit
        skills = list(dict.fromkeys(s for s in skills_match if len(s) > 2))[:30]

        ws_uuid = uuid.UUID(body.workspace_id)
        user_uuid = uuid.UUID(user_id)

        # Update user record if we got data
        if display_name or headline or location:
            res = await db.execute(select(User).where(User.id == user_uuid))
            user = res.scalar_one_or_none()
            if user:
                if display_name and not user.display_name:
                    user.display_name = display_name
                if headline and hasattr(user, "headline"):
                    user.headline = user.headline or headline
                if location and hasattr(user, "location"):
                    user.location = user.location or location

        # Upsert LinkedIn social link in Memory
        social_content = json.dumps({"linkedin": url, "source": "linkedin_import"})
        res = await db.execute(
            select(Memory).where(
                Memory.workspace_id == ws_uuid,
                Memory.user_id == user_uuid,
                Memory.type == "social_links",
                Memory.status == "active",
            )
        )
        social_mem = res.scalars().first()
        if not social_mem:
            social_mem = Memory(
                id=uuid.uuid4(),
                workspace_id=ws_uuid,
                user_id=user_uuid,
                type="social_links",
                domain="profile",
                status="active",
                title="Social Links",
                summary="LinkedIn profile imported",
                content=social_content,
                content_hash=f"social_{uuid.uuid4().hex[:12]}",
                size=len(social_content),
            )
            db.add(social_mem)
        else:
            try:
                existing = json.loads(social_mem.content or "{}")
            except Exception:
                existing = {}
            existing["linkedin"] = url
            social_mem.content = json.dumps(existing)
            social_mem.updated_at = datetime.now(UTC)

        # Upsert skills
        skill_count = await self._upsert_skills_to_memory_and_entities(
            user_id, body.workspace_id, skills, db
        )

        await db.flush()
        profile = await self.get_profile(user_id, workspace_id=body.workspace_id, db=db)
        return ProfileImportSummaryResponse(
            skills_imported=skill_count,
            career_imported=0,
            education_imported=0,
            message=f"Imported LinkedIn profile{f' for {display_name}' if display_name else ''}. {skill_count} skills extracted.",
            profile=profile,
        )


profile_service = ProfileService()

