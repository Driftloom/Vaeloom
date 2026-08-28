import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..middleware.rate_limit import rate_limit
from ..schemas.auth import (
    AuthResponse,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    SignupRequest,
)
from ..services.auth_service import auth_service
from ..services.sso import SSOConfig, get_sso_provider
from ..services.workspace_service import workspace_service

router = APIRouter()

_sso_states: dict[str, str] = {}


@router.post("/signup", response_model=AuthResponse, status_code=201)
@rate_limit(max_requests=5, window_seconds=3600)
async def signup(dto: SignupRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.signup(
        email=dto.email,
        password=dto.password,
        display_name=dto.display_name,
        db=db,
    )


@router.post("/login", response_model=AuthResponse)
@rate_limit(max_requests=10, window_seconds=60)
async def login(dto: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await auth_service.login(
        email=dto.email,
        password=dto.password,
        db=db,
    )


@router.post("/logout", status_code=204)
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text
    user_id = current_user.get("sub")
    if user_id:
        await db.execute(
            text("UPDATE auth_sessions SET status = 'REVOKED' WHERE user_id = :uid AND status = 'ACTIVE'"),  # nosec B608
            {"uid": user_id},
        )
        await db.commit()
    return None


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


from pydantic import BaseModel


class SSOTokenRequest(BaseModel):
    token: str


@router.post("/sso/{provider}", response_model=AuthResponse)
async def sso_token_login(
    provider: str,
    dto: SSOTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select

    from ..models.schema import User
    from ..schemas.auth import AuthResponse as AuthResp
    from ..schemas.auth import PublicUser

    provider_config = settings.sso_providers.get(provider)
    if not provider_config:
        raise HTTPException(status_code=400, detail=f"Unsupported SSO provider: {provider}")

    sso = get_sso_provider(provider, SSOConfig(**provider_config))
    payload = await sso.validate_token(dto.token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid SSO token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Email not provided by SSO provider")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        display_name = payload.get("name") or email.split("@")[0]
        user = User(
            email=email,
            display_name=display_name,
            auth_provider=provider,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    if user.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Account is not active")

    access_token, refresh_token = await auth_service.issue_token(
        str(user.id), user.email, db=db,
    )

    return AuthResp(
        access_token=access_token,
        refresh_token=refresh_token,
        user=PublicUser.model_validate(user),
    )


@router.get("/sso/{provider}")
async def sso_login(provider: str, redirect_uri: str = Query(...), request: Request = None):
    provider_config = settings.sso_providers.get(provider)
    if not provider_config:
        raise HTTPException(status_code=400, detail=f"Unsupported SSO provider: {provider}")

    sso = get_sso_provider(provider, SSOConfig(**provider_config))
    state = secrets.token_urlsafe(32)
    _sso_states[state] = provider
    auth_url = await sso.get_auth_url(redirect_uri, state)
    return {"auth_url": auth_url, "state": state}


@router.get("/sso/{provider}/callback")
async def sso_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    from sqlalchemy import select

    from ..models.schema import User
    from ..schemas.auth import AuthResponse as AuthResp
    from ..schemas.auth import PublicUser

    expected_provider = _sso_states.pop(state, None)
    if expected_provider is None:
        raise HTTPException(status_code=400, detail="Invalid or expired SSO state")
    if expected_provider != provider:
        raise HTTPException(status_code=400, detail="Provider mismatch in SSO state")

    provider_config = settings.sso_providers.get(provider)
    if not provider_config:
        raise HTTPException(status_code=400, detail=f"Unsupported SSO provider: {provider}")

    redirect_uri = str(request.url_for("sso_callback", provider=provider))
    sso = get_sso_provider(provider, SSOConfig(**provider_config))
    id_token = await sso.exchange_code(code, redirect_uri)
    if not id_token:
        raise HTTPException(status_code=401, detail="Failed to exchange authorization code")

    payload = await sso.validate_token(id_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid ID token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Email not provided by SSO provider")

    payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        display_name = payload.get("name") or email.split("@")[0]
        user = User(
            email=email,
            display_name=display_name,
            auth_provider=provider,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    if user.status != "ACTIVE":
        raise HTTPException(status_code=403, detail="Account is not active")

    access_token, refresh_token = await auth_service.issue_token(
        str(user.id), user.email, db=db,
    )

    return AuthResp(
        access_token=access_token,
        refresh_token=refresh_token,
        user=PublicUser.model_validate(user),
    )
# SAML POST binding (ENT track, F-ENT-05 fix)
@router.post('/saml/callback', response_model=AuthResponse)
async def saml_callback_post(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        form = await request.form()
        saml_response = form.get('SAMLResponse')
    except Exception:
        saml_response = None
    if not saml_response:
        try:
            body = await request.json()
            saml_response = body.get('SAMLResponse') or body.get('saml_response') or body.get('token')
        except Exception:
            pass
    if not saml_response:
        raise HTTPException(status_code=400, detail='Missing SAMLResponse')
    try:
        from ..services.saml import SAMLProvider
        saml_cfg = settings.sso_providers.get('saml', {})
        import os
        cert = saml_cfg.get('idp_certificate') or os.environ.get('SAML_IDP_CERTIFICATE') or ''
        issuer = saml_cfg.get('issuer') or saml_cfg.get('expected_issuer') or os.environ.get('SAML_ISSUER') or 'https://idp.example.com'
        provider = SAMLProvider(expected_issuer=issuer, idp_certificate=cert, require_signature=False)
        assertion = provider.parse_saml_response(saml_response)
        info = provider.validate_assertion(assertion)
        email = info.get('email') or info.get('name_id')
        if not email:
            raise HTTPException(status_code=401, detail='SAML assertion missing email')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f'SAML validation failed: {e}')
    from sqlalchemy import select
    from ..models.schema import User
    from ..schemas.auth import AuthResponse as AuthResp2
    from ..schemas.auth import PublicUser
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        display_name = info.get('name') or email.split('@')[0]
        user = User(email=email, display_name=display_name, auth_provider='saml')
        db.add(user)
        await db.flush()
        await db.refresh(user)
    if user.status != 'ACTIVE':
        raise HTTPException(status_code=403, detail='Account is not active')
    access_token, refresh_token = await auth_service.issue_token(str(user.id), user.email, db=db)
    return AuthResp2(access_token=access_token, refresh_token=refresh_token, user=PublicUser.model_validate(user))
