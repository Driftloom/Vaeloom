from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.auth import (
    SignupRequest, LoginRequest, RefreshRequest, AuthResponse, MeResponse,
)
from ..schemas.workspace import WorkspaceResponse
from ..services.auth_service import auth_service
from ..services.workspace_service import workspace_service

router = APIRouter()


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(dto: SignupRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.signup(
        email=dto.email,
        password=dto.password,
        display_name=dto.display_name,
        db=db,
    )


@router.post("/login", response_model=AuthResponse)
async def login(dto: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(
        email=dto.email,
        password=dto.password,
        db=db,
    )


@router.get("/me", response_model=MeResponse)
async def me(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await auth_service.validate_user(user_id=user_id, db=db)
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    workspaces = await workspace_service.list_for_user(user_id=user_id, db=db)

    return MeResponse(
        user=user,
        workspaces=workspaces,
    )


@router.post("/refresh", response_model=AuthResponse)
async def refresh(dto: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.refresh_token(
        refresh_token=dto.refresh_token,
        db=db,
    )
