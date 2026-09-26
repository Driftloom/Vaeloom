"""Organizations API Router.

Endpoints for managing enterprise organizational hierarchies (departments, teams),
memberships, and role assignments.
"""

from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..services.organization_service import (
    ORG_ROLES,
    OrganizationPermissionError,
    OrganizationService,
)

router = APIRouter(tags=["organizations"])

# Roles are a closed set. Previously `role` was a bare `str` whose only
# enumeration was a docstring, so any authenticated caller could request
# role="owner" (or any unrecognised string) for a member or an invitation.
OrgRole = Literal["viewer", "member", "lead", "admin", "owner"]
MemberStatus = Literal["active", "invited", "suspended"]


class CreateOrganizationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: str = Field(default="department", description="organization | department | team")
    parent_id: Optional[uuid.UUID] = None
    workspace_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    allowed_domains: Optional[List[str]] = Field(default=None, description="Allowed email domains")
    default_role: OrgRole = Field(default="member", description="Default role for new members")


class UpdateOrganizationRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    allowed_domains: Optional[List[str]] = None
    default_role: Optional[OrgRole] = None


class AddMemberRequest(BaseModel):
    user_id: uuid.UUID
    role: OrgRole = Field(default="member", description="admin | lead | member | viewer")
    status: MemberStatus = Field(default="active", description="active | invited | suspended")


class CreateInvitationRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: OrgRole = Field(default="member", description="admin | lead | member | viewer")


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


def _current_user_id(current_user: dict) -> uuid.UUID:
    raw = current_user.get("id") or current_user.get("sub")
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User context required"
        )
    try:
        return uuid.UUID(str(raw))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")


def require_org_role(min_role: str):
    """FastAPI dependency enforcing a minimum organization role.

    This is the authorization boundary for every organization mutation. Hiding a
    control in the UI is not an authorization check; the server must refuse the
    write regardless of what the client renders.

    Use on endpoints whose path contains `:org_id`. Returns the caller's
    effective role so the handler can additionally refuse to grant a role above
    the caller's own.
    """

    async def _checker(
        org_id: uuid.UUID,
        db: AsyncSession = Depends(get_db),
        current_user: dict = Depends(get_current_user),
    ) -> str:
        try:
            return await OrganizationService.require_org_permission(
                db=db,
                org_id=org_id,
                user_id=_current_user_id(current_user),
                min_role=min_role,
            )
        except OrganizationPermissionError as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    return _checker



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
            # The creator becomes owner so the new node is administrable.
            owner_id=_current_user_id(current_user),
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
    _role: str = Depends(require_org_role("admin")),
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
    _role: str = Depends(require_org_role("owner")),
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
    _role: str = Depends(require_org_role("viewer")),
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
    actor_role: str = Depends(require_org_role("admin")),
):
    """Add or update a member in an organization."""
    tenant_id = _get_tenant_id(current_user)
    # Defence in depth: holding `admin` is not enough to mint an `owner`.
    try:
        OrganizationService.assert_can_grant_role(actor_role, req.role)
    except OrganizationPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
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
    _role: str = Depends(require_org_role("admin")),
):
    """Remove a member from an organization."""
    tenant_id = _get_tenant_id(current_user)
    # Guard against an admin removing the last owner and orphaning the org.
    if user_id == _current_user_id(current_user):
        remaining = await OrganizationService.list_members(db, org_id, tenant_id)
        owners = [m for m in remaining if m.get("role") == "owner" and m.get("status") == "active"]
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last active owner of an organization",
            )
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
    actor_role: str = Depends(require_org_role("admin")),
):
    """Create a new invitation for an organization with domain check and token generation."""
    tenant_id = _get_tenant_id(current_user)
    user_id = _current_user_id(current_user)
    try:
        OrganizationService.assert_can_grant_role(actor_role, req.role)
    except OrganizationPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
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
    # The response contains every invitee's email address, so it is admin-only.
    _role: str = Depends(require_org_role("admin")),
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
    user_id = _current_user_id(current_user)
    # This route is keyed by invitation id, not org id, so the owning
    # organization has to be resolved before the role can be checked.
    org_id = await OrganizationService.get_invitation_org_id(db, invitation_id, tenant_id)
    if org_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    try:
        await OrganizationService.require_org_permission(
            db=db, org_id=org_id, user_id=user_id, min_role="admin"
        )
    except OrganizationPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
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
    except OrganizationPermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
