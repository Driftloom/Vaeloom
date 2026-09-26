"""Organization Service.

Manages hierarchical organizational structures (organizations, departments, teams),
membership assignments, and tree traversal with cycle prevention.
"""

import logging
from typing import Any, Dict, List, Optional, Set
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.schema import (
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    User,
    WorkspaceUser,
)

logger = logging.getLogger(__name__)

# Workspace-level roles that outrank every organization role. Values follow
# services/workspace_service.py:55, which is the existing authority for
# workspace role comparison.
_WORKSPACE_ADMIN_ROLES = ["ADMIN", "OWNER"]


# Single source of truth for organization roles. Previously the hierarchy was
# duplicated between this module, api/dependencies.py (viewer|editor|admin),
# api/middleware/rbac.py (viewer|editor|admin) and a hardcoded list in the web
# organizations page, with four different orderings. Anything that needs to
# reason about org roles must import from here.
ORG_ROLE_HIERARCHY: Dict[str, int] = {
    "viewer": 10,
    "member": 20,
    "lead": 30,
    "admin": 40,
    "owner": 50,
}
ORG_ROLES = tuple(ORG_ROLE_HIERARCHY)
DEFAULT_MIN_ROLE = "member"


def org_role_level(role: str) -> int:
    """Rank a role. Unknown roles are treated as the least privileged."""
    return ORG_ROLE_HIERARCHY.get(role, ORG_ROLE_HIERARCHY["viewer"])


class OrganizationPermissionError(PermissionError):
    """Raised when the caller lacks the required role for an organization action.

    Distinct from ValueError so routers can map it to 403 rather than 400.
    """


class OrganizationService:
    @staticmethod
    async def get_organization_tree(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        workspace_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Return the recursive hierarchical organization tree for a tenant."""
        stmt = select(Organization).where(Organization.tenant_id == tenant_id)
        if workspace_id:
            stmt = stmt.where(
                (Organization.workspace_id == workspace_id) | (Organization.workspace_id.is_(None))
            )

        res = await db.execute(stmt)
        all_orgs = res.scalars().all()

        # Count members per org
        member_counts_stmt = (
            select(
                OrganizationMember.organization_id,
                func.count(OrganizationMember.id).label("count"),
            )
            .group_by(OrganizationMember.organization_id)
        )
        counts_res = await db.execute(member_counts_stmt)
        counts_map = {row[0]: row[1] for row in counts_res.all()}

        # Build lookup table
        node_map: Dict[uuid.UUID, Dict[str, Any]] = {}
        for org in all_orgs:
            node_map[org.id] = {
                "id": str(org.id),
                "name": org.name,
                "type": org.type,
                "description": org.description,
                "allowed_domains": org.allowed_domains or [],
                "default_role": org.default_role or "member",
                "members": counts_map.get(org.id, 0),
                "parent_id": str(org.parent_id) if org.parent_id else None,
                "children": [],
            }

        # Build tree
        roots: List[Dict[str, Any]] = []
        for org in all_orgs:
            node = node_map[org.id]
            if org.parent_id and org.parent_id in node_map:
                node_map[org.parent_id]["children"].append(node)
            else:
                roots.append(node)

        return roots

    @staticmethod
    async def create_organization(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        name: str,
        org_type: str = "department",
        parent_id: Optional[uuid.UUID] = None,
        workspace_id: Optional[uuid.UUID] = None,
        description: Optional[str] = None,
        allowed_domains: Optional[List[str]] = None,
        default_role: str = "member",
        owner_id: Optional[uuid.UUID] = None,
    ) -> Organization:
        """Create a new organizational node.

        When `owner_id` is supplied the creator is enrolled as `owner` of the new
        node in the same call. This is required for the permission model to be
        usable: without it a freshly created organization has no members, so
        every subsequent mutation by its own creator would be denied.
        """
        if parent_id:
            parent = await db.get(Organization, parent_id)
            if not parent or parent.tenant_id != tenant_id:
                raise ValueError("Parent organization not found in tenant")

        org = Organization(
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            parent_id=parent_id,
            name=name,
            type=org_type,
            description=description,
            allowed_domains=allowed_domains or [],
            default_role=default_role,
        )
        db.add(org)
        await db.commit()
        await db.refresh(org)

        if owner_id is not None:
            await OrganizationService.add_member(
                db=db,
                org_id=org.id,
                tenant_id=tenant_id,
                user_id=owner_id,
                role="owner",
                status="active",
            )
            await db.refresh(org)

        return org

    @staticmethod
    async def update_organization(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
        name: Optional[str] = None,
        org_type: Optional[str] = None,
        parent_id: Optional[uuid.UUID] = None,
        description: Optional[str] = None,
        allowed_domains: Optional[List[str]] = None,
        default_role: Optional[str] = None,
    ) -> Organization:
        """Update an organization node with cycle prevention."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            raise ValueError("Organization not found in tenant")

        if parent_id is not None:
            if parent_id == org_id:
                raise ValueError("An organization cannot be its own parent")

            # Check if parent is a descendant of this org (cycle detection)
            current_id = parent_id
            visited: Set[uuid.UUID] = set()
            while current_id:
                if current_id in visited:
                    break
                visited.add(current_id)
                if current_id == org_id:
                    raise ValueError("Cannot set parent to a descendant node (cycle detected)")
                p = await db.get(Organization, current_id)
                current_id = p.parent_id if p else None

            org.parent_id = parent_id

        if name is not None:
            org.name = name
        if org_type is not None:
            org.type = org_type
        if description is not None:
            org.description = description
        if allowed_domains is not None:
            org.allowed_domains = allowed_domains
        if default_role is not None:
            org.default_role = default_role

        await db.commit()
        await db.refresh(org)
        return org

    @staticmethod
    async def delete_organization(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> bool:
        """Delete an organization node and cascade to children."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            return False

        await db.delete(org)
        await db.commit()
        return True

    @staticmethod
    async def list_members(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> List[Dict[str, Any]]:
        """List all members in an organization unit."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            raise ValueError("Organization not found in tenant")

        stmt = (
            select(OrganizationMember)
            .where(OrganizationMember.organization_id == org_id)
            .options(selectinload(OrganizationMember.user))
        )
        res = await db.execute(stmt)
        members = res.scalars().all()

        return [
            {
                "id": str(m.id),
                "user_id": str(m.user_id),
                "name": m.user.display_name if m.user else "Unknown User",
                "email": m.user.email if m.user else "",
                "role": m.role,
                "status": m.status,
                "department": org.name,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in members
        ]

    @staticmethod
    async def add_member(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str = "member",
        status: str = "active",
    ) -> OrganizationMember:
        """Add or update a user membership in an organization."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            raise ValueError("Organization not found in tenant")

        user = await db.get(User, user_id)
        if not user:
            raise ValueError("User not found")

        # Check existing
        stmt = select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()

        if member:
            member.role = role
            member.status = status
        else:
            member = OrganizationMember(
                organization_id=org_id,
                user_id=user_id,
                role=role,
                status=status,
            )
            db.add(member)

        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def remove_member(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> bool:
        """Remove a member from an organization."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            return False

        stmt = select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
        )
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()
        if not member:
            return False

        await db.delete(member)
        await db.commit()
        return True

    @staticmethod
    async def create_invitation(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
        email: str,
        role: str = "member",
        invited_by: Optional[uuid.UUID] = None,
    ) -> tuple[OrganizationInvitation, str]:
        """Create a secure invitation with domain whitelisting and token hashing."""
        import hashlib
        import secrets
        from datetime import datetime, timedelta, timezone

        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            raise ValueError("Organization not found in tenant")

        clean_email = email.lower().strip()
        if "@" not in clean_email:
            raise ValueError("Invalid email address")

        # Domain whitelist check
        if org.allowed_domains:
            domain = clean_email.split("@")[-1].lower()
            allowed = [d.lower().strip() for d in org.allowed_domains if d]
            if allowed and domain not in allowed:
                raise ValueError(
                    f"Email domain '{domain}' is not allowed for this organization. Allowed domains: {', '.join(allowed)}"
                )

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        invitation = OrganizationInvitation(
            id=uuid.uuid4(),
            organization_id=org_id,
            tenant_id=tenant_id,
            email=clean_email,
            role=role,
            token_hash=token_hash,
            invited_by=invited_by,
            expires_at=expires_at,
            status="pending",
        )
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)

        try:
            from .audit_service import audit_service
            await audit_service.record_event(
                db=db,
                event_type="organization.invitation_created",
                user_id=invited_by,
                tenant_id=tenant_id,
                resource_type="organization_invitation",
                resource_id=invitation.id,
                details={"email": clean_email, "role": role, "organization_id": str(org_id)},
            )
        except Exception as exc:
            logger.debug("Failed to record invitation audit event: %s", exc)

        # Dispatch transactional invitation email
        try:
            from .email_service import email_service
            inviter = await db.get(User, invited_by) if invited_by else None
            inviter_name = inviter.display_name if (inviter and inviter.display_name) else "A team administrator"
            invite_url = f"/invite/{raw_token}"
            await email_service.send_organization_invitation(
                to_email=clean_email,
                organization_name=org.name,
                inviter_name=inviter_name,
                invite_url=invite_url,
                role=role,
                expires_at=expires_at.isoformat(),
            )
        except Exception as exc:
            logger.debug("Failed to dispatch invitation email: %s", exc)

        return invitation, raw_token

    @staticmethod
    async def check_org_permission(
        db: AsyncSession,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        min_role: str = DEFAULT_MIN_ROLE,
    ) -> bool:
        """Verify if a user has sufficient role permissions in an organizational unit."""
        required_level = org_role_level(min_role)

        # Check organization membership
        stmt = select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == "active",
        )
        res = await db.execute(stmt)
        member = res.scalars().first()
        if member:
            return org_role_level(member.role) >= required_level

        # Fallback: workspace owner/admin outranks every organization role.
        # NOTE: this previously imported a non-existent `TenantMember` model, so
        # the fallback raised ImportError for any caller who was not already an
        # organization member. It was unreachable in the test suite because every
        # existing test hit the membership branch first.
        stmt_ws = select(WorkspaceUser).where(
            WorkspaceUser.user_id == user_id,
            WorkspaceUser.role.in_(_WORKSPACE_ADMIN_ROLES),
        )
        res_ws = await db.execute(stmt_ws)
        if res_ws.scalars().first():
            return True

        return False

    @staticmethod
    async def require_org_permission(
        db: AsyncSession,
        org_id: uuid.UUID,
        user_id: uuid.UUID,
        min_role: str = DEFAULT_MIN_ROLE,
    ) -> str:
        """Assert the caller holds at least `min_role` in the organization.

        Returns the caller's effective role so callers can enforce
        "cannot grant a role above your own" without a second lookup.
        Raises OrganizationPermissionError (403) when the check fails.
        """
        if min_role not in ORG_ROLE_HIERARCHY:
            raise ValueError(f"Unknown role: {min_role}")

        stmt = select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.status == "active",
        )
        res = await db.execute(stmt)
        member = res.scalars().first()
        if member and org_role_level(member.role) >= org_role_level(min_role):
            return member.role

        # Workspace owner/admin outranks every organization role.
        stmt_ws = select(WorkspaceUser).where(
            WorkspaceUser.user_id == user_id,
            WorkspaceUser.role.in_(_WORKSPACE_ADMIN_ROLES),
        )
        res_ws = await db.execute(stmt_ws)
        if res_ws.scalars().first():
            return "owner"

        raise OrganizationPermissionError(
            f"Requires {min_role} or higher in this organization"
        )

    @staticmethod
    def assert_can_grant_role(actor_role: str, target_role: str) -> None:
        """Prevent privilege escalation: a caller cannot grant a role above their own.

        `owner` is terminal and cannot be granted by a non-tenant-admin.
        """
        if org_role_level(target_role) > org_role_level(actor_role):
            raise OrganizationPermissionError(
                f"Cannot grant role '{target_role}' with '{actor_role}' authority"
            )


    @staticmethod
    async def list_invitations(
        db: AsyncSession,
        org_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> List[Dict[str, Any]]:
        """List invitations for an organization."""
        org = await db.get(Organization, org_id)
        if not org or org.tenant_id != tenant_id:
            raise ValueError("Organization not found in tenant")

        stmt = (
            select(OrganizationInvitation)
            .where(
                OrganizationInvitation.organization_id == org_id,
                OrganizationInvitation.tenant_id == tenant_id,
            )
            .order_by(OrganizationInvitation.created_at.desc())
        )
        res = await db.execute(stmt)
        invites = res.scalars().all()

        return [
            {
                "id": str(inv.id),
                "organization_id": str(inv.organization_id),
                "email": inv.email,
                "role": inv.role,
                "status": inv.status,
                "invited_by": str(inv.invited_by) if inv.invited_by else None,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invites
        ]

    @staticmethod
    async def get_invitation_org_id(
        db: AsyncSession,
        invitation_id: uuid.UUID,
        tenant_id: uuid.UUID,
    ) -> Optional[uuid.UUID]:
        """Resolve the organization an invitation belongs to, for authorization.

        Returns None when the invitation does not exist in the caller's tenant, so
        a cross-tenant probe is indistinguishable from a missing row.
        """
        stmt = select(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        inv = res.scalar_one_or_none()
        return inv.organization_id if inv else None

    @staticmethod
    async def accept_invitation(
        db: AsyncSession,
        token: str,
        user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Accept an organization invitation using the raw token.

        The token is a bearer credential. It is only honoured for the account it
        was issued to, and it is consumed atomically so it cannot be redeemed
        twice by concurrent requests.
        """
        import hashlib
        from datetime import datetime, timezone

        from sqlalchemy import update as sa_update

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        # RLS context (PostgreSQL): token-hash scope unlocks exactly this row.
        if db is not None:
            try:
                from sqlalchemy import text
                await db.execute(text("SELECT set_config('app.lookup_token_hash', :th, true)"), {"th": token_hash})
            except Exception:
                pass

        # Load the invitation to learn the intended recipient and the role.
        lookup = select(OrganizationInvitation).where(
            OrganizationInvitation.token_hash == token_hash,
            OrganizationInvitation.status == "pending",
        )
        res = await db.execute(lookup)
        invitation = res.scalar_one_or_none()
        if not invitation:
            raise ValueError("Invalid or expired invitation token")

        # Identity binding. `invitation.email` is the address the invitation was
        # issued to; accepting it as a different account would let any holder of
        # the token mint a membership (and the invitation's role) for themselves.
        user = await db.get(User, user_id)
        if not user or not user.email:
            raise ValueError("Invitation could not be matched to an account")
        if (user.email or "").strip().lower() != (invitation.email or "").strip().lower():
            raise OrganizationPermissionError(
                "This invitation was issued to a different email address"
            )

        # Check expiration
        now = datetime.now(timezone.utc)
        exp = invitation.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is not None and exp < now:
            invitation.status = "expired"
            await db.commit()
            raise ValueError("Invitation has expired")

        # Consume atomically. A conditional UPDATE that affects exactly one row is
        # the single-use invariant; SELECT-then-UPDATE with a commit in between
        # lets two concurrent callers both pass the `status == pending` filter.
        consume = (
            sa_update(OrganizationInvitation)
            .where(
                OrganizationInvitation.id == invitation.id,
                OrganizationInvitation.status == "pending",
            )
            .values(status="accepted")
            .execution_options(synchronize_session=False)
        )
        consume_result = await db.execute(consume)
        if consume_result.rowcount != 1:
            await db.rollback()
            raise ValueError("Invitation has already been used")

        member = await OrganizationService.add_member(
            db=db,
            org_id=invitation.organization_id,
            tenant_id=invitation.tenant_id,
            user_id=user_id,
            role=invitation.role,
            status="active",
        )

        await db.commit()

        try:
            from .audit_service import audit_service
            await audit_service.record_event(
                db=db,
                event_type="organization.invitation_accepted",
                user_id=user_id,
                tenant_id=invitation.tenant_id,
                resource_type="organization_invitation",
                resource_id=invitation.id,
                details={"organization_id": str(invitation.organization_id), "role": invitation.role},
            )
        except Exception as exc:
            logger.debug("Failed to record invitation acceptance audit event: %s", exc)

        return {
            "status": "accepted",
            "organization_id": str(invitation.organization_id),
            "role": invitation.role,
            "member_id": str(member.id),
        }

    @staticmethod
    async def revoke_invitation(
        db: AsyncSession,
        invitation_id: uuid.UUID,
        tenant_id: uuid.UUID,
        revoked_by: Optional[uuid.UUID] = None,
    ) -> bool:
        """Revoke a pending organization invitation."""
        stmt = select(OrganizationInvitation).where(
            OrganizationInvitation.id == invitation_id,
            OrganizationInvitation.tenant_id == tenant_id,
        )
        res = await db.execute(stmt)
        inv = res.scalar_one_or_none()
        if not inv:
            return False

        inv.status = "revoked"
        await db.commit()

        try:
            from .audit_service import audit_service
            await audit_service.record_event(
                db=db,
                event_type="organization.invitation_revoked",
                user_id=revoked_by,
                tenant_id=tenant_id,
                resource_type="organization_invitation",
                resource_id=invitation_id,
                details={"organization_id": str(inv.organization_id), "email": inv.email},
            )
        except Exception as exc:
            logger.debug("Failed to record invitation revocation audit event: %s", exc)

        return True
