from fastapi import Depends, HTTPException

from ..dependencies import ROLE_HIERARCHY, get_current_user
from ..dependencies import require_role as require_role  # single source of truth (hierarchical)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {"workspace:read"},
    "editor": {"workspace:read", "workspace:write"},
    "admin": {"workspace:read", "workspace:write", "workspace:delete", "workspace:manage_members", "workspace:manage_billing"},
}


def require_permission(permission: str):
    async def _check(current_user: dict | None = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        user_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
        for role in user_roles:
            if permission in ROLE_PERMISSIONS.get(role, set()):
                return current_user
        raise HTTPException(status_code=403, detail=f"Requires permission: {permission}")
    return _check
