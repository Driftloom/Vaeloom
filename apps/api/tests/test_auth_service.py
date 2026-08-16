import uuid
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.asyncio


class _MockScalarResult:
    def __init__(self, scalar=None, scalars_data=None):
        self._scalar = scalar
        self._scalars_data = scalars_data

    def scalar_one_or_none(self):
        return self._scalar

    def scalar_one(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return self._scalars_data or []


def _setup_refresh(mock_db):
    async def _refresh(obj):
        if not hasattr(obj, 'id') or obj.id is None:
            obj.id = uuid.uuid4()
        if hasattr(obj, 'auth_provider') and obj.auth_provider is None:
            obj.auth_provider = "email"
        if hasattr(obj, 'created_at') and obj.created_at is None:
            obj.created_at = datetime.now(timezone.utc)
        if hasattr(obj, 'updated_at') and obj.updated_at is None:
            obj.updated_at = datetime.now(timezone.utc)
    mock_db.refresh = AsyncMock(side_effect=_refresh)


class TestAuthService:
    @pytest.fixture
    def service(self):
        from api.services.auth_service import AuthService
        return AuthService()

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        _setup_refresh(db)
        return db

    @pytest.fixture
    def mock_user(self):
        user = MagicMock()
        user.id = uuid.uuid4()
        user.email = "test@example.com"
        user.display_name = "Test User"
        user.password_hash = "$2b$12$" + "x" * 50
        user.status = "ACTIVE"
        user.auth_provider = "email"
        user.created_at = datetime.now(timezone.utc)
        user.preferences = {}
        return user

    # ── signup ────────────────────────────────────────────────────────

    async def test_signup_email_already_registered(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=MagicMock())
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.signup("test@test.com", "password", db=mock_db)
        assert exc.value.status_code == 409

    async def test_signup_success(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        with patch.object(service, 'issue_token', new=AsyncMock()) as mock_issue:
            mock_issue.return_value = ("access_token", "refresh_token")
            result = await service.signup("test@test.com", "Str0ng!Pass", "Display", db=mock_db)
            assert result.access_token == "access_token"
            assert result.refresh_token == "refresh_token"
            assert result.user.email == "test@test.com"
            assert mock_db.flush.await_count >= 1

    async def test_signup_without_display_name(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        with patch.object(service, 'issue_token', new=AsyncMock()) as mock_issue:
            mock_issue.return_value = ("at", "rt")
            result = await service.signup("test@test.com", "Str0ng!Pass", db=mock_db)
            assert result.user.email == "test@test.com"

    # ── login ─────────────────────────────────────────────────────────

    async def test_login_user_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.login("test@test.com", "password", db=mock_db)
        assert exc.value.status_code == 401

    async def test_login_no_password_hash(self, service, mock_db, mock_user):
        mock_user.password_hash = None
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.login("test@test.com", "password", db=mock_db)
        assert exc.value.status_code == 401

    async def test_login_wrong_password(self, service, mock_db, mock_user):
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        with patch('bcrypt.checkpw', return_value=False):
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await service.login("test@test.com", "wrong", db=mock_db)
            assert exc.value.status_code == 401

    async def test_login_inactive_account(self, service, mock_db, mock_user):
        mock_user.status = "INACTIVE"
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        with patch('bcrypt.checkpw', return_value=True):
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc:
                await service.login("test@test.com", "password", db=mock_db)
            assert exc.value.status_code == 403

    async def test_login_success(self, service, mock_db, mock_user):
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        with patch('bcrypt.checkpw', return_value=True):
            with patch.object(service, 'issue_token', new=AsyncMock()) as mock_issue:
                mock_issue.return_value = ("access_token", "refresh_token")
                result = await service.login("test@test.com", "password", db=mock_db)
                assert result.access_token == "access_token"
                assert result.user.email == "test@example.com"

    # ── issue_token ───────────────────────────────────────────────────

    async def test_issue_token(self, service, mock_db):
        user_id = str(uuid.uuid4())
        with patch('secrets.token_urlsafe', return_value="rt_secret"):
            at, rt = await service.issue_token(user_id, "email@test.com", db=mock_db)
            assert rt == "rt_secret"
            assert at is not None
            mock_db.add.assert_called()

    async def test_issue_token_with_tenant_id(self, service, mock_db):
        user_id = str(uuid.uuid4())
        with patch('secrets.token_urlsafe', return_value="rt_secret"):
            at, rt = await service.issue_token(user_id, "email@test.com", tenant_id="t1", db=mock_db)
            assert rt == "rt_secret"

    # ── refresh_token ─────────────────────────────────────────────────

    async def test_refresh_token_invalid(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.refresh_token("bad_token", db=mock_db)
        assert exc.value.status_code == 401

    async def test_refresh_token_expired(self, service, mock_db):
        session = MagicMock()
        session.status = "ACTIVE"
        session.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        session.user_id = uuid.uuid4()
        mock_db.execute.return_value = _MockScalarResult(scalar=session)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.refresh_token("expired", db=mock_db)
        assert exc.value.status_code == 401

    async def test_refresh_token_inactive_session(self, service, mock_db):
        session = MagicMock()
        session.status = "ROTATED"
        session.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.user_id = uuid.uuid4()
        mock_db.execute.return_value = _MockScalarResult(scalar=session)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.refresh_token("rotated", db=mock_db)
        assert exc.value.status_code == 401

    async def test_refresh_token_user_not_found(self, service, mock_db):
        session = MagicMock()
        session.status = "ACTIVE"
        session.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.user_id = uuid.uuid4()
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=session),
            _MockScalarResult(scalar=None),
        ])
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.refresh_token("token", db=mock_db)
        assert exc.value.status_code == 401

    async def test_refresh_token_user_inactive(self, service, mock_db):
        session = MagicMock()
        session.status = "ACTIVE"
        session.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.user_id = uuid.uuid4()
        user = MagicMock()
        user.status = "INACTIVE"
        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=session),
            _MockScalarResult(scalar=user),
        ])
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            await service.refresh_token("token", db=mock_db)
        assert exc.value.status_code == 401

    async def test_refresh_token_success(self, service, mock_db):
        session = MagicMock()
        session.status = "ACTIVE"
        session.expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.user_id = uuid.uuid4()
        user = MagicMock()
        user.id = uuid.uuid4()
        user.email = "user@test.com"
        user.status = "ACTIVE"
        user.display_name = "User"
        user.auth_provider = "email"
        user.created_at = datetime.now(timezone.utc)

        mock_db.execute = AsyncMock(side_effect=[
            _MockScalarResult(scalar=session),
            _MockScalarResult(scalar=user),
        ])

        with patch.object(service, 'issue_token', new=AsyncMock()) as mock_issue:
            mock_issue.return_value = ("new_at", "new_rt")
            result = await service.refresh_token("token", db=mock_db)
            assert result.access_token == "new_at"
            assert result.refresh_token == "new_rt"
            assert session.status == "ROTATED"

    # ── validate_user ─────────────────────────────────────────────────

    async def test_validate_user_found_active(self, service, mock_db, mock_user):
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        result = await service.validate_user(str(mock_user.id), db=mock_db)
        assert result is mock_user

    async def test_validate_user_not_found(self, service, mock_db):
        mock_db.execute.return_value = _MockScalarResult(scalar=None)
        result = await service.validate_user(str(uuid.uuid4()), db=mock_db)
        assert result is None

    async def test_validate_user_inactive(self, service, mock_db, mock_user):
        mock_user.status = "INACTIVE"
        mock_db.execute.return_value = _MockScalarResult(scalar=mock_user)
        result = await service.validate_user(str(mock_user.id), db=mock_db)
        assert result is None

    # ── _create_jwt ───────────────────────────────────────────────────

    def test_create_jwt_without_tenant(self, service):
        with patch('jwt.encode', return_value="jwt_token") as mock_encode:
            token = service._create_jwt("uid", "email@test.com")
            assert token == "jwt_token"
            payload = mock_encode.call_args[0][0]
            assert payload["sub"] == "uid"
            assert "tenant_id" not in payload

    def test_create_jwt_with_tenant(self, service):
        with patch('jwt.encode', return_value="jwt_token") as mock_encode:
            token = service._create_jwt("uid", "email@test.com", tenant_id="tid")
            assert token == "jwt_token"
            payload = mock_encode.call_args[0][0]
            assert payload["tenant_id"] == "tid"
