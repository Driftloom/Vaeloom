from datetime import datetime
from typing import Any

from pydantic import BaseModel


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    headline: str | None = None
    location: str | None = None
    phone: str | None = None
    social_links: dict[str, str] | None = None  # {"github": "url", "linkedin": "url"}
    job_title: str | None = None
    avatar_url: str | None = None
    preferences: dict[str, Any] | None = None


class SkillItem(BaseModel):
    name: str
    confidence: float = 0.0
    source: str = "memory"  # memory, user, inferred
    verified: bool = False
    tag: str | None = None
    validation_tier: str = "V1"  # V0, V1, V2, V3, V4
    effective_confidence: float | None = None
    decay_status: str | None = "fresh"  # fresh, active, stale
    decay_factor: float | None = 1.0
    is_matchable: bool = False
    category: str | None = "General"  # Languages, Frameworks, Cloud & DevOps, Databases, AI / ML, Soft Skills, Tools
    proficiency: str | None = "Intermediate"  # Beginner, Intermediate, Advanced, Expert
    years_experience: int | None = None


class CareerEntry(BaseModel):
    company: str
    role: str
    start_date: str | None = None
    end_date: str | None = None
    achievements: list[str] = []
    confidence: float = 0.0
    location: str | None = None
    employment_type: str | None = "Full-time"
    is_current: bool = False


class JobPreferences(BaseModel):
    job_types: list[str] = []
    salary_range: dict[str, Any] = {}
    preferred_industries: list[str] = []
    dealbreakers: list[str] = []
    remote_preference: str | None = None


class MemorySummary(BaseModel):
    type: str
    count: int
    last_updated: datetime | None = None


class EducationEntry(BaseModel):
    id: str | None = None
    institution: str
    degree: str
    field_of_study: str
    start_year: int | None = None
    graduation_year: int | None = None
    gpa: str | None = None
    show_gpa_on_resume: bool = False
    honors: list[str] = []


class ProjectEntry(BaseModel):
    id: str | None = None
    title: str
    tagline: str | None = None
    description: str
    technologies: list[str] = []
    metrics_summary: str | None = None
    live_url: str | None = None
    github_url: str | None = None
    featured: bool = True


class ApplicationVaultData(BaseModel):
    demographics_policy: str = "decline"  # "autofill", "decline", "blank"
    gender: str | None = None
    ethnicity: str | None = None
    veteran_status: str | None = None
    disability_status: str | None = None
    authorized_countries: list[str] = ["US"]
    visa_status: str = "Citizen"
    requires_sponsorship: bool = False
    security_clearance: str = "None"


class AgentDirectivesData(BaseModel):
    autonomy_mode: str = "copilot"  # "copilot", "semi_autonomous", "full_autopilot"
    min_match_threshold: int = 80
    daily_application_quota: int = 10
    min_base_salary: int | None = None
    target_base_salary: int | None = None
    target_total_comp: int | None = None
    currency: str = "USD"
    notice_period: str = "2 weeks"
    relocation_preference: str = "Remote only"
    travel_percentage: str = "0%"
    cover_letter_policy: str = "when_required"


class BlacklistItem(BaseModel):
    id: str
    company_name: str
    domain: str | None = None
    reason: str = "Current Employer"
    auto_inferred: bool = False


class ScreeningQuestionItem(BaseModel):
    id: str
    question: str
    answer: str
    category: str = "general"


class ProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    headline: str | None = None
    location: str | None = None
    phone: str | None = None
    social_links: dict[str, str] = {}
    job_title: str | None = None
    auth_provider: str = "email"
    preferences: dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime
    # Memory-derived fields
    skills: list[SkillItem] = []
    career_history: list[CareerEntry] = []
    job_preferences: JobPreferences | None = None
    memory_summary: list[MemorySummary] = []
    years_experience: int | None = None
    # Extended Enterprise Agent Brain fields
    education: list[EducationEntry] = []
    projects: list[ProjectEntry] = []
    application_vault: ApplicationVaultData | None = None
    agent_directives: AgentDirectivesData | None = None
    company_blacklist: list[BlacklistItem] = []
    screening_questions: list[ScreeningQuestionItem] = []

    model_config = {"from_attributes": True}


class ProfileCompletenessResponse(BaseModel):
    score: int  # 0-100
    total_fields: int
    filled_fields: int
    suggestions: list[dict[str, str]] = []  # [{"field": "bio", "action": "Add a bio", "boost": "+10%"}]


class AvatarUploadResponse(BaseModel):
    avatar_url: str


class ConfirmSkillRequest(BaseModel):
    skill_name: str
    workspace_id: str


class AddSkillRequest(BaseModel):
    skill_name: str
    workspace_id: str
    confidence: float = 1.0


class RemoveSkillRequest(BaseModel):
    skill_name: str
    workspace_id: str


class UpdateJobPreferencesRequest(BaseModel):
    workspace_id: str
    job_types: list[str] = []
    salary_range: dict[str, Any] = {}
    preferred_industries: list[str] = []
    dealbreakers: list[str] = []
    remote_preference: str | None = None


class AutoPopulateRequest(BaseModel):
    workspace_id: str


class PublicProfileResponse(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None
    headline: str | None = None
    location: str | None = None
    job_title: str | None = None
    social_links: dict[str, str] = {}
    skills: list[SkillItem] = []
    career_history: list[CareerEntry] = []
    years_experience: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ATSReadinessResponse(BaseModel):
    score: int
    status_label: str
    target_role: str | None = None
    total_skills_count: int = 0
    matching_skills: list[str] = []
    missing_skills: list[str] = []
    suggestions: list[str] = []
    keyword_match_pct: float = 0.0


class ProfileRecommendationItem(BaseModel):
    id: str
    agent_name: str
    category: str
    title: str
    description: str
    action_label: str
    action_url: str | None = None
    impact: str
    created_at: datetime


class AddCareerEntryRequest(BaseModel):
    workspace_id: str
    company: str
    role: str
    start_date: str | None = None
    end_date: str | None = None
    achievements: list[str] = []
    location: str | None = None
    employment_type: str | None = "Full-time"
    is_current: bool = False


class UpdateCareerEntryRequest(BaseModel):
    workspace_id: str
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    achievements: list[str] | None = None
    location: str | None = None
    employment_type: str | None = None
    is_current: bool | None = None


class ProfileActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: str
    status: str = "completed"
    agent_name: str | None = None


class AddEducationRequest(BaseModel):
    workspace_id: str
    institution: str
    degree: str
    field_of_study: str
    start_year: int | None = None
    graduation_year: int | None = None
    gpa: str | None = None
    show_gpa_on_resume: bool = False
    honors: list[str] = []


class UpdateEducationRequest(BaseModel):
    workspace_id: str
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    start_year: int | None = None
    graduation_year: int | None = None
    gpa: str | None = None
    show_gpa_on_resume: bool | None = None
    honors: list[str] | None = None


class AddProjectRequest(BaseModel):
    workspace_id: str
    title: str
    tagline: str | None = None
    description: str
    technologies: list[str] = []
    metrics_summary: str | None = None
    live_url: str | None = None
    github_url: str | None = None
    featured: bool = True


class UpdateProjectRequest(BaseModel):
    workspace_id: str
    title: str | None = None
    tagline: str | None = None
    description: str | None = None
    technologies: list[str] | None = None
    metrics_summary: str | None = None
    live_url: str | None = None
    github_url: str | None = None
    featured: bool | None = None


class UpdateApplicationVaultRequest(BaseModel):
    workspace_id: str
    demographics_policy: str = "decline"
    gender: str | None = None
    ethnicity: str | None = None
    veteran_status: str | None = None
    disability_status: str | None = None
    authorized_countries: list[str] = ["US"]
    visa_status: str = "Citizen"
    requires_sponsorship: bool = False
    security_clearance: str = "None"


class UpdateAgentDirectivesRequest(BaseModel):
    workspace_id: str
    autonomy_mode: str = "copilot"
    min_match_threshold: int = 80
    daily_application_quota: int = 10
    min_base_salary: int | None = None
    target_base_salary: int | None = None
    target_total_comp: int | None = None
    currency: str = "USD"
    notice_period: str = "2 weeks"
    relocation_preference: str = "Remote only"
    travel_percentage: str = "0%"
    cover_letter_policy: str = "when_required"


class AddBlacklistRequest(BaseModel):
    workspace_id: str
    company_name: str
    domain: str | None = None
    reason: str = "Current Employer"


class UpdateScreeningQuestionsRequest(BaseModel):
    workspace_id: str
    questions: list[ScreeningQuestionItem] = []


