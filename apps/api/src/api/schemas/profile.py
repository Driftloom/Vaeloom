from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any


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


class CareerEntry(BaseModel):
    company: str
    role: str
    start_date: str | None = None
    end_date: str | None = None
    achievements: list[str] = []
    confidence: float = 0.0


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


class UpdateCareerEntryRequest(BaseModel):
    workspace_id: str
    role: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    achievements: list[str] | None = None


class ProfileActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: str
    status: str = "completed"
    agent_name: str | None = None


