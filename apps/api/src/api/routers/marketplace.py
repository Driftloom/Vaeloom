"""Marketplace API Router.

Endpoints for browsing curated enterprise plugins, installing/uninstalling plugins
per workspace, and inspecting plugin capabilities.
"""

from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..services.marketplace_service import MarketplaceService

router = APIRouter(tags=["marketplace"])


class InstallPluginRequest(BaseModel):
    workspace_id: uuid.UUID
    config: Dict[str, Any] = Field(default_factory=dict)


class RateListingRequest(BaseModel):
    rating: float = Field(..., ge=1.0, le=5.0, description="Rating from 1.0 to 5.0")
    review: Optional[str] = Field(None, max_length=1000, description="Optional text review")


class ExecutePluginRequest(BaseModel):
    workspace_id: uuid.UUID
    action: str = Field(..., min_length=1, max_length=100)
    params: Dict[str, Any] = Field(default_factory=dict)


@router.get("/listings")
async def list_marketplace_listings(
    category: Optional[str] = Query(None, description="Filter by category (All, Integration, AI, etc.)"),
    search: Optional[str] = Query(None, description="Search term in name or description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List available plugins in the curated marketplace catalog."""
    return await MarketplaceService.list_listings(
        db=db,
        category=category,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/listings/{listing_id_or_slug}")
async def get_marketplace_listing(
    listing_id_or_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details of a specific marketplace plugin."""
    listing = await MarketplaceService.get_listing(db, listing_id_or_slug)
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Marketplace listing not found")

    return {
        "id": str(listing.id),
        "name": listing.name,
        "slug": listing.slug,
        "category": listing.category,
        "author": listing.author,
        "description": listing.description,
        "version": listing.version,
        "icon_url": listing.icon_url,
        "is_verified": listing.is_verified,
        "rating": listing.rating,
        "install_count": listing.install_count,
        "tags": listing.tags,
        "config_schema": listing.config_schema,
    }


@router.post("/listings/{listing_id}/install", status_code=status.HTTP_201_CREATED)
async def install_plugin(
    listing_id: uuid.UUID,
    req: InstallPluginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Install a marketplace plugin into a workspace."""
    user_id_str = current_user.get("sub") if current_user else None
    user_uuid = uuid.UUID(str(user_id_str)) if user_id_str else None

    try:
        install = await MarketplaceService.install_plugin(
            db=db,
            workspace_id=req.workspace_id,
            listing_id=listing_id,
            user_id=user_uuid,
            config=req.config,
        )
        return {
            "status": "installed",
            "install_id": str(install.id),
            "workspace_id": str(install.workspace_id),
            "listing_id": str(install.listing_id),
            "is_active": install.is_active,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/listings/{listing_id}/uninstall")
async def uninstall_plugin(
    listing_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Uninstall a marketplace plugin from a workspace."""
    success = await MarketplaceService.uninstall_plugin(
        db=db,
        workspace_id=workspace_id,
        listing_id=listing_id,
    )
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plugin install record not found")

    return {"ok": True, "uninstalled": True, "status": "uninstalled", "workspace_id": str(workspace_id), "listing_id": str(listing_id)}


@router.get("/installed")
async def get_installed_plugins(
    workspace_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all active installed plugins for a workspace."""
    items = await MarketplaceService.get_installed_plugins(db, workspace_id)
    return {"items": items, "total": len(items)}


@router.post("/seed")
async def seed_marketplace(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Seed default marketplace listings."""
    seeded = await MarketplaceService.seed_default_listings_if_empty(db)
    return {"ok": True, "status": "ok", "seeded_count": seeded, "count": seeded}


@router.post("/listings/{listing_id}/rate")
async def rate_marketplace_listing(
    listing_id: uuid.UUID,
    req: RateListingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Submit a rating and review for a marketplace plugin."""
    user_id_str = current_user.get("id") or current_user.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context required")
    try:
        user_uuid = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    try:
        return await MarketplaceService.rate_listing(
            db=db,
            listing_id=listing_id,
            user_id=user_uuid,
            rating=req.rating,
            review=req.review,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/installed/{install_id}/execute")
async def execute_plugin(
    install_id: uuid.UUID,
    req: ExecutePluginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Execute an action on an installed plugin in a workspace."""
    try:
        return await MarketplaceService.execute_plugin_action(
            db=db,
            workspace_id=req.workspace_id,
            install_id=install_id,
            action=req.action,
            params=req.params,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
