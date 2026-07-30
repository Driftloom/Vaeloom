import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import pytest

from backend.services.api_keys import APIKeyManager, api_key_manager

pytestmark = pytest.mark.asyncio


class TestAPIKeyManager:
    def test_generate_key_has_prefix(self):
        raw, key_hash = api_key_manager.generate_key()
        assert raw.startswith("vael_")
        assert len(raw) > 40

    def test_generate_key_entropy_check(self):
        raw, key_hash = api_key_manager.generate_key()
        assert len(raw) >= 40

    def test_hash_key_returns_bcrypt(self):
        h = api_key_manager.hash_key("test-key-123")
        assert h.startswith("$2b$") or h.startswith("$2a$")

    def test_validate_key_correct(self):
        raw, key_hash = api_key_manager.generate_key()
        assert api_key_manager.validate_key(raw, key_hash) is True

    def test_validate_key_incorrect(self):
        _, key_hash = api_key_manager.generate_key()
        assert api_key_manager.validate_key("wrong-key", key_hash) is False

    async def test_create_key(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Test Key",
            user_id=str(uuid.uuid4()),
            permissions=["read"],
            db=db_session,
        )
        assert raw.startswith("vael_")
        assert api_key.name == "Test Key"
        assert api_key.enabled is True
        assert api_key.key_prefix == raw[:10]

    async def test_get_key_not_found(self, db_session):
        key = await api_key_manager.get_key(str(uuid.uuid4()), db_session)
        assert key is None

    async def test_rotate_key(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Rotate Test",
            user_id=str(uuid.uuid4()),
            db=db_session,
        )
        old_hash = api_key.key_hash
        new_raw, rotated = await api_key_manager.rotate_key(str(api_key.id), db_session)
        assert new_raw.startswith("vael_")
        assert rotated.version == 2
        assert rotated.rotated_at is not None
        assert rotated.key_hash != old_hash

    async def test_revoke_key(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Revoke Test",
            user_id=str(uuid.uuid4()),
            db=db_session,
        )
        await api_key_manager.revoke_key(str(api_key.id), db_session)
        updated = await api_key_manager.get_key(str(api_key.id), db_session)
        assert updated.enabled is False

    async def test_revoke_nonexistent_raises(self, db_session):
        with pytest.raises(ValueError, match="API key not found"):
            await api_key_manager.revoke_key(str(uuid.uuid4()), db_session)

    async def test_enforce_rotation_returns_true_when_expired(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Rotation Test",
            user_id=str(uuid.uuid4()),
            db=db_session,
        )
        api_key.created_at = datetime.now(timezone.utc) - timedelta(days=100)
        needs = await api_key_manager.enforce_rotation(str(api_key.id), db_session, max_age_days=90)
        assert needs is True

    async def test_enforce_rotation_returns_false_when_recent(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Recent Key",
            user_id=str(uuid.uuid4()),
            db=db_session,
        )
        needs = await api_key_manager.enforce_rotation(str(api_key.id), db_session, max_age_days=90)
        assert needs is False

    async def test_enforce_rotation_nonexistent_raises(self, db_session):
        with pytest.raises(ValueError, match="API key not found"):
            await api_key_manager.enforce_rotation(str(uuid.uuid4()), db_session)

    async def test_list_keys(self, db_session):
        user_id = str(uuid.uuid4())
        await api_key_manager.create_key(name="Key 1", user_id=user_id, db=db_session)
        await api_key_manager.create_key(name="Key 2", user_id=user_id, db=db_session)
        keys = await api_key_manager.list_keys(user_id, db_session)
        assert len(keys) == 2

    async def test_validate_key_with_db(self, db_session):
        raw, api_key = await api_key_manager.create_key(
            name="Validate Test",
            user_id=str(uuid.uuid4()),
            db=db_session,
        )
        assert api_key_manager.validate_key(raw, api_key.key_hash) is True

    async def test_generate_unique_hashes(self):
        _, h1 = api_key_manager.generate_key()
        _, h2 = api_key_manager.generate_key()
        assert h1 != h2
