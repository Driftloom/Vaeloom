import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.profile import (
    ProfileResponse,
    UpdateProfileRequest,
    ProfileCompletenessResponse,
    AvatarUploadResponse,
    ConfirmSkillRequest,
    AddSkillRequest,
    RemoveSkillRequest,
    UpdateJobPreferencesRequest,
    AutoPopulateRequest,
    PublicProfileResponse,
    ATSReadinessResponse,
    ProfileRecommendationItem,
    AddCareerEntryRequest,
    UpdateCareerEntryRequest,
    ProfileActivityItem,
)
from ..services.profile_service import profile_service
from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ProfileResponse)
async def get_profile(
    workspace_id: str | None = Query(None, description="Workspace ID for memory-derived data"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's profile with memory-derived data."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.get_profile(user_id, workspace_id=workspace_id, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    return profile


@router.put("", response_model=ProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.update_profile(user_id, body, workspace_id=workspace_id, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    return profile


@router.post("/avatar", response_model=AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a profile avatar image."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Validate file
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    max_size = getattr(settings, 'profile_avatar_max_bytes', 5 * 1024 * 1024)
    data = await file.read()
    if len(data) > max_size:
        raise HTTPException(status_code=400, detail=f"Image must be under {max_size // (1024*1024)}MB")

    avatar_url = await profile_service.upload_avatar(user_id, data, file.content_type, db=db)
    return AvatarUploadResponse(avatar_url=avatar_url)


@router.get("/avatar/{user_id}")
async def get_avatar(user_id: str):
    """Retrieve the avatar image for a user."""
    result = await profile_service.get_avatar(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Avatar not found")
    data, media_type = result
    return Response(content=data, media_type=media_type)


@router.get("/completeness", response_model=ProfileCompletenessResponse)
async def get_completeness(
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get profile completeness score with suggestions."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return await profile_service.get_completeness(user_id, workspace_id=workspace_id, db=db)


@router.post("/skills/confirm", response_model=ProfileResponse)
async def confirm_skill(
    body: ConfirmSkillRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a skill, updating memory and knowledge graph with verified=True."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.confirm_skill(user_id, body.workspace_id, body.skill_name, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.post("/skills", response_model=ProfileResponse)
async def add_skill(
    body: AddSkillRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a skill to profile memory and knowledge graph."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.add_skill(
        user_id, body.workspace_id, body.skill_name, confidence=body.confidence, db=db
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.delete("/skills/{skill_name}", response_model=ProfileResponse)
async def remove_skill(
    skill_name: str,
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a skill from profile memory and knowledge graph."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.remove_skill(user_id, workspace_id, skill_name, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.put("/preferences", response_model=ProfileResponse)
async def update_preferences(
    body: UpdateJobPreferencesRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update job and career preferences in memory."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.update_job_preferences(user_id, body, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.post("/auto-populate", response_model=ProfileResponse)
async def auto_populate(
    body: AutoPopulateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-populate user profile, skills, and career memories from workspace resume / documents."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.auto_populate_from_resume(user_id, body.workspace_id, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.get("/public/{user_id}", response_model=PublicProfileResponse)
async def get_public_profile(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get public read-only profile for external sharing."""
    profile = await profile_service.get_public_profile(user_id, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="Public profile not found")
    return profile


@router.get("/ats-readiness", response_model=ATSReadinessResponse)
async def get_ats_readiness(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate live ATS readiness score and skill matches/gaps."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return await profile_service.calculate_ats_readiness(user_id, workspace_id, db=db)


@router.get("/recommendations", response_model=list[ProfileRecommendationItem])
async def get_recommendations(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get proactive agent recommendations tailored for the profile."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return await profile_service.get_agent_recommendations(user_id, workspace_id, db=db)


@router.post("/career", response_model=ProfileResponse)
async def add_career(
    body: AddCareerEntryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new career experience entry to Memory and Entity graph."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.add_career_entry(user_id, body, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.put("/career/{company}", response_model=ProfileResponse)
async def update_career(
    company: str,
    body: UpdateCareerEntryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing career experience entry in Memory and Entity graph."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.update_career_entry(user_id, company, body, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.delete("/career/{company}", response_model=ProfileResponse)
async def delete_career(
    company: str,
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a career experience entry from Memory and Entity graph."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = await profile_service.delete_career_entry(user_id, workspace_id, company, db=db)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return profile


@router.get("/activity", response_model=list[ProfileActivityItem])
async def get_profile_activity(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get profile-specific activity stream."""
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    return await profile_service.get_profile_activity(user_id, workspace_id, db=db)


