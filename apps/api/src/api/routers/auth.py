import asyncio
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..middleware.rate_limit import rate_limit
from ..schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    SignupRequest,
)
from ..services.auth_service import auth_service
from ..services.sso import SSOConfig, get_sso_provider
from ..services.workspace_service import workspace_service

logger = logging.getLogger(__name__)

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


@router.post("/forgot-password")
@rate_limit(max_requests=5, window_seconds=900)
async def forgot_password(dto: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.request_password_reset(email=dto.email, db=db)
    return {
        "status": "success",
        "message": "If an account with that email exists, password reset instructions have been sent.",
    }


@router.post("/reset-password")
@rate_limit(max_requests=5, window_seconds=900)
async def reset_password(dto: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if not dto.token and dto.email:
        await auth_service.request_password_reset(email=dto.email, db=db)
        return {
            "status": "success",
            "message": "If an account with that email exists, password reset instructions have been sent.",
        }

    if not dto.token:
        raise HTTPException(status_code=400, detail="Reset token is required")

    new_password = dto.password or dto.new_password
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")

    await auth_service.reset_password_with_token(token=dto.token, new_password=new_password, db=db)
    return {
        "status": "success",
        "message": "Password has been successfully reset.",
    }


@router.post("/logout", status_code=204)
async def logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import text
    user_id = current_user.get("sub")
    jti = current_user.get("jti")
    if jti:
        auth_service.revoke_token(jti=jti)
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


@router.post("/forgot-password", status_code=200)
@rate_limit(max_requests=5, window_seconds=300)
async def forgot_password(dto: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await auth_service.request_password_reset(email=dto.email, db=db)
    return {"message": "If that email is registered, a password reset link has been sent"}


@router.post("/reset-password", status_code=200)
@rate_limit(max_requests=5, window_seconds=300)
async def reset_password(dto: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    # Handles both request reset (with email) and complete reset (with token + password)
    if dto.token and (dto.password or dto.new_password):
        pwd = dto.new_password or dto.password or ""
        await auth_service.reset_password_with_token(token=dto.token, new_password=pwd, db=db)
        return {"message": "Password has been successfully reset. Please log in with your new password."}
    elif dto.email:
        await auth_service.request_password_reset(email=dto.email, db=db)
        return {"message": "If that email is registered, a password reset link has been sent"}
    else:
        raise HTTPException(status_code=400, detail="Must provide email or token with new password")


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

    email = payload.get("email") or payload.get("preferred_username") or payload.get("upn")
    if not email:
        raise HTTPException(status_code=401, detail="Email not provided by SSO provider")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        display_name = payload.get("name") or payload.get("preferred_username") or email.split("@")[0]
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
    _sso_states[state] = (provider, redirect_uri)
    try:
        from ..middleware.csrf import _get_redis

        r = _get_redis()
        if r is not None:
            import json

            await asyncio.to_thread(
                r.set,
                f"sso_state:{state}",
                json.dumps({"provider": provider, "redirect_uri": redirect_uri}),
                ex=900,
            )
    except Exception as e:
        logger.warning("SSO state Redis cache error: %s", e)
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

    stored = _sso_states.pop(state, None)
    if stored is None:
        try:
            from ..middleware.csrf import _get_redis

            r = _get_redis()
            if r is not None:
                import json

                raw = await asyncio.to_thread(r.get, f"sso_state:{state}")
                if raw:
                    await asyncio.to_thread(r.delete, f"sso_state:{state}")
                    data = json.loads(raw)
                    stored = (data["provider"], data["redirect_uri"])
        except Exception as e:
            logger.warning("SSO state Redis fetch error: %s", e)

    if stored is None:
        raise HTTPException(status_code=400, detail="Invalid or expired SSO state")
    if isinstance(stored, tuple):
        expected_provider, original_redirect_uri = stored
    else:
        expected_provider, original_redirect_uri = stored, None

    if expected_provider != provider:
        raise HTTPException(status_code=400, detail="Provider mismatch in SSO state")

    provider_config = settings.sso_providers.get(provider)
    if not provider_config:
        raise HTTPException(status_code=400, detail=f"Unsupported SSO provider: {provider}")

    redirect_uri = original_redirect_uri or str(request.url_for("sso_callback", provider=provider))
    sso = get_sso_provider(provider, SSOConfig(**provider_config))
    id_token = await sso.exchange_code(code, redirect_uri)
    if not id_token:
        raise HTTPException(status_code=401, detail="Failed to exchange authorization code")

    payload = await sso.validate_token(id_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid ID token")

    email = payload.get("email") or payload.get("preferred_username") or payload.get("upn")
    if not email:
        raise HTTPException(status_code=401, detail="Email not provided by SSO provider")

    payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        from ..models.schema import Tenant, Workspace

        display_name = payload.get("name") or payload.get("preferred_username") or email.split("@")[0]
        tenant = None
        try:
            tenant_res = await db.execute(select(Tenant).where(Tenant.slug == "default"))
            tenant = tenant_res.scalar_one_or_none()
            if not tenant:
                tenant = Tenant(name="Default", slug="default")
                db.add(tenant)
                await db.flush()
        except Exception:
            tenant = None

        user = User(
            email=email,
            display_name=display_name,
            auth_provider=provider,
            tenant_id=tenant.id if tenant else None,
        )
        db.add(user)
        await db.flush()

        workspace = Workspace(
            user_id=user.id,
            name=f"{display_name}'s Workspace",
        )
        db.add(workspace)
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


@router.get('/saml/metadata')
async def saml_sp_metadata(request: Request):
    """SAML 2.0 Service Provider Metadata endpoint.

    Returns standard XML metadata for Okta, Azure AD, Ping, and other enterprise IdPs.
    """
    saml_cfg = settings.sso_providers.get('saml', {})
    base_url = saml_cfg.get('sp_base_url') or str(request.base_url).rstrip('/')
    entity_id = saml_cfg.get('sp_entity_id') or f"{base_url}/api/v1/auth/saml/metadata"
    acs_url = f"{base_url}/api/v1/auth/saml/callback"

    metadata_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{entity_id}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="{acs_url}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>"""
    return Response(content=metadata_xml.strip(), media_type="application/xml")


@router.get('/saml/login')
async def saml_login(request: Request, redirect_url: str | None = None):
    """Initiate SAML 2.0 Single Sign-On.

    Generates AuthnRequest and redirects to the configured enterprise IdP SSO URL.
    """
    import base64
    import os
    import urllib.parse
    import uuid
    import zlib
    from datetime import datetime, timezone

    saml_cfg = settings.sso_providers.get('saml', {})
    idp_sso_url = saml_cfg.get('idp_sso_url') or os.environ.get('SAML_IDP_SSO_URL')
    if not idp_sso_url:
        raise HTTPException(
            status_code=503,
            detail="SAML IdP not provisioned: SAML_IDP_SSO_URL is not configured",
        )

    base_url = saml_cfg.get('sp_base_url') or str(request.base_url).rstrip('/')
    sp_entity_id = saml_cfg.get('sp_entity_id') or f"{base_url}/api/v1/auth/saml/metadata"
    acs_url = f"{base_url}/api/v1/auth/saml/callback"
    req_id = f"id_{uuid.uuid4().hex}"
    issue_instant = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    authn_request = (
        f'<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
        f'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" '
        f'ID="{req_id}" Version="2.0" IssueInstant="{issue_instant}" '
        f'Destination="{idp_sso_url}" AssertionConsumerServiceURL="{acs_url}" '
        f'ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">'
        f'<saml:Issuer>{sp_entity_id}</saml:Issuer>'
        f'<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>'
        f'</samlp:AuthnRequest>'
    )

    # SAML HTTP-Redirect binding: Deflate -> Base64 -> URL encode
    deflated = zlib.compress(authn_request.encode('utf-8'))[2:-4]
    b64_req = base64.b64encode(deflated).decode('ascii')
    params = {"SAMLRequest": b64_req}
    if redirect_url:
        params["RelayState"] = redirect_url

    delim = "&" if "?" in idp_sso_url else "?"
    target_url = f"{idp_sso_url}{delim}{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=target_url, status_code=302)


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
        # CONT-P13: fail-closed signatures. Unsigned assertions accepted only
        # behind explicit SAML_ALLOW_UNSIGNED=true (dev/IdP-migration windows).
        allow_unsigned = (saml_cfg.get('allow_unsigned') or os.environ.get('SAML_ALLOW_UNSIGNED') or 'false').lower() == 'true'
        if not cert and not allow_unsigned:
            raise HTTPException(status_code=503, detail='SAML IdP not provisioned (missing certificate)')
        provider = SAMLProvider(expected_issuer=issuer, idp_certificate=cert, require_signature=not allow_unsigned)
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
