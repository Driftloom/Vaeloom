from fastapi import Depends, HTTPException

from ..dependencies import get_current_user

ROLE_HIERARCHY: dict[str, int] = {
    "viewer": 1,
    "editor": 2,
    "admin": 3,
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "viewer": {
        "workspace:read",
    },
    "editor": {
        "workspace:read",
        "workspace:write",
    },
    "admin": {
        "workspace:read",
        "workspace:write",
        "workspace:delete",
        "workspace:manage_members",
        "workspace:manage_billing",
    },
}


def require_role(role: str):
    async def _check(current_user: dict | None = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        user_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
        user_level = max((ROLE_HIERARCHY.get(r, 0) for r in user_roles), default=0)
        required_level = ROLE_HIERARCHY.get(role, 0)
        if user_level < required_level:
            raise HTTPException(status_code=403, detail=f"Requires role: {role}")
        return current_user
    return _check


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
