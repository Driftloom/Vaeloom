"""Organizations API Router.

Endpoints for managing enterprise organizational hierarchies (departments, teams),
memberships, and role assignments.
"""

from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..services.organization_service import OrganizationService

router = APIRouter(tags=["organizations"])


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default="department", description="organization | department | team")
    parent_id: Optional[uuid.UUID] = None
    workspace_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    allowed_domains: Optional[List[str]] = Field(default=None, description="Allowed email domains")
    default_role: str = Field(default="member", description="Default role for new members")


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    allowed_domains: Optional[List[str]] = None
    default_role: Optional[str] = None


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: str = Field(default="member", description="admin | lead | member | viewer")
    status: str = Field(default="active", description="active | invited | suspended")


class CreateInvitationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field(default="member", description="admin | lead | member | viewer")


def _get_tenant_id(current_user: dict) -> uuid.UUID:
    tid = current_user.get("tenant_id")
    if not tid:
        # Fallback to sub as user/tenant default if not multi-tenant
        tid = current_user.get("sub")
    try:
        return uuid.UUID(str(tid))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid tenant context required",
        )



@router.get("/tree")
async def get_organization_tree(
    workspace_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the full hierarchical organization tree."""
    tenant_id = _get_tenant_id(current_user)
    tree = await OrganizationService.get_organization_tree(db, tenant_id, workspace_id)
    return {"items": tree, "total": len(tree)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_organization(
    req: CreateOrganizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new organization, department, or team node."""
    tenant_id = _get_tenant_id(current_user)
    try:
        org = await OrganizationService.create_organization(
            db=db,
            tenant_id=tenant_id,
            name=req.name,
            org_type=req.type,
            parent_id=req.parent_id,
            workspace_id=req.workspace_id,
            description=req.description,
            allowed_domains=req.allowed_domains,
            default_role=req.default_role,
        )
        return {
            "id": str(org.id),
            "name": org.name,
            "type": org.type,
            "parent_id": str(org.parent_id) if org.parent_id else None,
            "description": org.description,
            "allowed_domains": org.allowed_domains or [],
            "default_role": org.default_role,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.patch("/{org_id}")
async def update_organization(
    org_id: uuid.UUID,
    req: UpdateOrganizationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update an organization node with cycle prevention."""
    tenant_id = _get_tenant_id(current_user)
    try:
        org = await OrganizationService.update_organization(
            db=db,
            org_id=org_id,
            tenant_id=tenant_id,
            name=req.name,
            org_type=req.type,
            parent_id=req.parent_id,
            description=req.description,
            allowed_domains=req.allowed_domains,
            default_role=req.default_role,
        )
        return {
            "id": str(org.id),
            "name": org.name,
            "type": org.type,
            "parent_id": str(org.parent_id) if org.parent_id else None,
            "description": org.description,
            "allowed_domains": org.allowed_domains or [],
            "default_role": org.default_role,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{org_id}")
async def delete_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete an organization node."""
    tenant_id = _get_tenant_id(current_user)
    deleted = await OrganizationService.delete_organization(db, org_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return {"ok": True, "status": "deleted", "id": str(org_id)}


@router.get("/{org_id}/members")
async def list_organization_members(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all members of an organization."""
    tenant_id = _get_tenant_id(current_user)
    try:
        members = await OrganizationService.list_members(db, org_id, tenant_id)
        return {"items": members, "total": len(members)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def add_organization_member(
    org_id: uuid.UUID,
    req: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Add or update a member in an organization."""
    tenant_id = _get_tenant_id(current_user)
    try:
        member = await OrganizationService.add_member(
            db=db,
            org_id=org_id,
            tenant_id=tenant_id,
            user_id=req.user_id,
            role=req.role,
            status=req.status,
        )
        return {
            "id": str(member.id),
            "organization_id": str(member.organization_id),
            "user_id": str(member.user_id),
            "role": member.role,
            "status": member.status,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{org_id}/members/{user_id}")
async def remove_organization_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Remove a member from an organization."""
    tenant_id = _get_tenant_id(current_user)
    removed = await OrganizationService.remove_member(db, org_id, tenant_id, user_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in organization")
    return {"ok": True, "status": "removed", "user_id": str(user_id)}


@router.post("/{org_id}/invitations", status_code=status.HTTP_201_CREATED)
async def create_organization_invitation(
    org_id: uuid.UUID,
    req: CreateInvitationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new invitation for an organization with domain check and token generation."""
    tenant_id = _get_tenant_id(current_user)
    user_id_str = current_user.get("id") or current_user.get("sub")
    user_id = uuid.UUID(str(user_id_str)) if user_id_str else None
    try:
        invitation, raw_token = await OrganizationService.create_invitation(
            db=db,
            org_id=org_id,
            tenant_id=tenant_id,
            email=req.email,
            role=req.role,
            invited_by=user_id,
        )
        return {
            "id": str(invitation.id),
            "organization_id": str(invitation.organization_id),
            "email": invitation.email,
            "role": invitation.role,
            "status": invitation.status,
            "token": raw_token,
            "expires_at": invitation.expires_at.isoformat() if invitation.expires_at else None,
            "created_at": invitation.created_at.isoformat() if invitation.created_at else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{org_id}/invitations")
async def list_organization_invitations(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List pending and historical invitations for an organization."""
    tenant_id = _get_tenant_id(current_user)
    try:
        invites = await OrganizationService.list_invitations(db, org_id, tenant_id)
        return {"items": invites, "total": len(invites)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete("/invitations/{invitation_id}")
async def revoke_organization_invitation(
    invitation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Revoke a pending organization invitation."""
    tenant_id = _get_tenant_id(current_user)
    user_id_str = current_user.get("id") or current_user.get("sub")
    user_id = uuid.UUID(str(user_id_str)) if user_id_str else None
    revoked = await OrganizationService.revoke_invitation(
        db, invitation_id, tenant_id, revoked_by=user_id
    )
    if not revoked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    return {"ok": True, "status": "revoked", "id": str(invitation_id)}


@router.post("/invitations/{token}/accept")
async def accept_organization_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Accept an organization invitation with a secure token."""
    user_id_str = current_user.get("id") or current_user.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User context required")
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    try:
        res = await OrganizationService.accept_invitation(db, token, user_id)
        return res
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
