from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class CreateUserRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1)
    tenant_id: str
    role_ids: list[str] | None = None


class UpdateUserRequest(BaseModel):
    display_name: str | None = None
    email: EmailStr | None = None
    active: bool | None = None


class AssignRolesRequest(BaseModel):
    role_ids: list[str]


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    tenant_id: str
    active: bool
    roles: list[dict] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RoleRef(BaseModel):
    id: str
    name: str
