import uuid

import pytest

from api.config import settings
from api.services.encryption import decrypt_value
from api.services.provider_key_service import ProviderKeyService, _hint_for_key

pytestmark = pytest.mark.asyncio


@pytest.fixture
def svc():
    return ProviderKeyService()


class TestHint:
    def test_hint_masks_middle_of_key(self):
        hint, prefix = _hint_for_key("sk-proj-abcdefghijklmnopqrstuvwxyz1234")
        assert hint == "...1234"
        assert "abcdefghijklmnopqrstuvwxyz" not in hint
        assert prefix == "sk-proj"

    def test_hint_short_key(self):
        hint, prefix = _hint_for_key("shortkey")
        assert hint == "...tkey"
        assert prefix == "shortke"


class TestUpsert:
    async def test_upsert_encrypts_key(self, db_session, svc):
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "openai", "sk-test-1234567890abcdef")
        assert row.provider == "openai"
        assert row.encrypted_key != "sk-test-1234567890abcdef"
        assert decrypt_value(row.encrypted_key) == "sk-test-1234567890abcdef"
        assert row.key_hint == "...cdef"
        assert row.is_active is True

    async def test_upsert_rejects_short_key(self, db_session, svc):
        with pytest.raises(ValueError, match="too short"):
            await svc.upsert(db_session, str(uuid.uuid4()), "openai", "short")

    async def test_upsert_rejects_unknown_provider(self, db_session, svc):
        with pytest.raises(ValueError, match="Unsupported provider"):
            await svc.upsert(db_session, str(uuid.uuid4()), "deepseek", "sk-test-1234567890abcdef")

    async def test_upsert_rotates_existing_key(self, db_session, svc):
        user_id = str(uuid.uuid4())
        await svc.upsert(db_session, user_id, "anthropic", "sk-ant-test-111111111111")
        row2 = await svc.upsert(db_session, user_id, "anthropic", "sk-ant-test-999999999999")
        assert row2.key_hint == "...9999"
        assert decrypt_value(row2.encrypted_key) == "sk-ant-test-999999999999"


class TestResolveEffective:
    async def test_workspace_key_wins_over_user_global(self, db_session, svc):
        user_id = str(uuid.uuid4())
        ws_id = str(uuid.uuid4())
        await svc.upsert(db_session, user_id, "openai", "sk-user-global-123456")
        await svc.upsert(db_session, user_id, "openai", "sk-workspace-123456", workspace_id=ws_id)
        eff = await svc.resolve_effective(db_session, user_id, "openai", ws_id)
        assert eff["source"] == "workspace"
        assert eff["key"] == "sk-workspace-123456"

    async def test_user_global_key_wins_over_system(self, db_session, svc, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        user_id = str(uuid.uuid4())
        await svc.upsert(db_session, user_id, "openai", "sk-user-global-123456")
        eff = await svc.resolve_effective(db_session, user_id, "openai", None)
        assert eff["source"] == "user"
        assert eff["key"] == "sk-user-global-123456"

    async def test_system_fallback_when_no_custom_key(self, db_session, svc, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        eff = await svc.resolve_effective(db_session, str(uuid.uuid4()), "openai", None)
        assert eff["source"] == "system"
        assert eff["key"] == "sk-sys-1234567890"
        assert eff["row"] is None

    async def test_inactive_user_key_is_skipped(self, db_session, svc, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "openai", "sk-user-global-123456")
        await svc.set_active(db_session, row.id, user_id, False)
        eff = await svc.resolve_effective(db_session, user_id, "openai", None)
        assert eff["source"] == "system"

    async def test_no_key_anywhere_returns_none(self, db_session, svc, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "")
        eff = await svc.resolve_effective(db_session, str(uuid.uuid4()), "anthropic", None)
        assert eff["source"] == "none"
        assert eff["key"] is None


class TestMarkUsed:
    async def test_mark_used_sets_timestamp(self, db_session, svc):
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "openai", "sk-test-1234567890abcdef")
        assert row.last_used_at is None
        await svc.mark_used(db_session, row)
        assert row.last_used_at is not None


class TestValidate:
    async def test_custom_provider_skips_network(self, db_session, svc):
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "custom", "my-custom-key-123456")
        is_valid, msg, _ = await svc.validate(db_session, row)
        assert is_valid is True
        assert row.is_valid is True
        assert row.last_validated_at is not None

    async def test_openai_validation_uses_bearer_header(self, db_session, svc, monkeypatch):
        import httpx

        captured = {}

        class FakeClient:
            def __init__(self, *a, **k):
                self.status_code = 200

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, *a, **k):
                captured["headers"] = k.get("headers", {})
                return self

            async def post(self, *a, **k):
                return self

        monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "openai", "sk-test-1234567890abcdef")
        is_valid, msg, _ = await svc.validate(db_session, row)
        assert is_valid is True
        assert "Valid" in msg
        assert captured["headers"]["Authorization"] == "Bearer sk-test-1234567890abcdef"


class TestDelete:
    async def test_delete_removes_row(self, db_session, svc):
        user_id = str(uuid.uuid4())
        row = await svc.upsert(db_session, user_id, "openai", "sk-test-1234567890abcdef")
        assert await svc.delete(db_session, row.id, user_id) is True
        assert await svc.delete(db_session, row.id, user_id) is False

    async def test_delete_other_users_key_denied(self, db_session, svc):
        owner = str(uuid.uuid4())
        other = str(uuid.uuid4())
        row = await svc.upsert(db_session, owner, "openai", "sk-test-1234567890abcdef")
        assert await svc.delete(db_session, row.id, other) is False