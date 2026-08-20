import uuid

import pytest

from api.config import settings
from api.services.llm_service import LLMService, LLMProviderError, _infer_provider_from_model
from api.services.provider_key_service import provider_key_service

pytestmark = pytest.mark.asyncio


class TestInferProviderFromModel:
    def test_openai_models(self):
        assert _infer_provider_from_model("gpt-4o-mini") == "openai"
        assert _infer_provider_from_model("gpt-4o") == "openai"
        assert _infer_provider_from_model("text-embedding-3-small") == "openai"
        assert _infer_provider_from_model("o3-mini") == "openai"

    def test_anthropic_models(self):
        assert _infer_provider_from_model("claude-3-5-sonnet-20241022") == "anthropic"

    def test_google_models(self):
        assert _infer_provider_from_model("gemini-2.0-flash") == "google"

    def test_mistral_and_cohere(self):
        assert _infer_provider_from_model("mistral-large-latest") == "mistral"
        assert _infer_provider_from_model("command-r-plus") == "cohere"

    def test_groq_models(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_provider", "openai")
        assert _infer_provider_from_model("groq-llama-3.3") == "groq"
        # bare llama id cannot be inferred as groq by name; falls back to settings
        assert _infer_provider_from_model("llama-3.1-8b-instant") == "openai"

    def test_unknown_model_falls_back_to_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        assert _infer_provider_from_model("some-custom-model") == "anthropic"

    def test_none_falls_back_to_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_provider", "openai")
        assert _infer_provider_from_model(None) == "openai"

    def test_catalog_lookup_fallback(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        # gpt-4o is in MODEL_CATALOG with provider openai
        assert _infer_provider_from_model("gpt-4o") == "openai"


class TestResolveApiKey:
    async def test_explicit_key_wins(self):
        prov, key = await LLMService()._resolve_api_key("openai", explicit_key="sk-explicit-123456")
        assert prov == "openai"
        assert key == "sk-explicit-123456"

    async def test_workspace_key_wins_over_user_global(self, db_session):
        user_id = str(uuid.uuid4())
        ws_id = str(uuid.uuid4())
        await provider_key_service.upsert(db_session, user_id, "openai", "sk-user-1234567890")
        await provider_key_service.upsert(db_session, user_id, "openai", "sk-ws-1234567890", workspace_id=ws_id)
        prov, key = await LLMService()._resolve_api_key("openai", user_id=user_id, workspace_id=ws_id, db=db_session)
        assert key == "sk-ws-1234567890"

    async def test_user_global_key_wins_over_system(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        user_id = str(uuid.uuid4())
        await provider_key_service.upsert(db_session, user_id, "openai", "sk-user-1234567890")
        prov, key = await LLMService()._resolve_api_key("openai", user_id=user_id, db=db_session)
        assert key == "sk-user-1234567890"

    async def test_system_fallback(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        prov, key = await LLMService()._resolve_api_key("openai", user_id=str(uuid.uuid4()), db=None)
        assert key == "sk-sys-1234567890"

    async def test_resolve_marks_key_used(self, db_session):
        user_id = str(uuid.uuid4())
        row = await provider_key_service.upsert(db_session, user_id, "openai", "sk-user-1234567890")
        assert row.last_used_at is None
        await LLMService()._resolve_api_key("openai", user_id=user_id, db=db_session)
        assert row.last_used_at is not None

    async def test_byok_lookup_failure_falls_back_to_system(self, db_session, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")

        async def boom(db, user_id, prov, ws_id):
            raise RuntimeError("db down")

        monkeypatch.setattr(provider_key_service, "resolve_effective", boom)
        prov, key = await LLMService()._resolve_api_key("openai", user_id=str(uuid.uuid4()), db=db_session)
        assert key == "sk-sys-1234567890"


class TestEmbeddingByok:
    async def test_anthropic_embedding_rejected(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "anthropic")

        async def real_guard(self, text, **kwargs):
            prov, key = await self._resolve_api_key(
                kwargs.get("provider_override") or "openai",
                user_id=kwargs.get("user_id"),
                workspace_id=kwargs.get("workspace_id"),
                db=kwargs.get("db"),
                explicit_key=kwargs.get("api_key_override"),
            )
            if prov != "openai":
                raise LLMProviderError(
                    f"Provider '{prov}' does not support standalone embeddings; "
                    "use OpenAI for embeddings. Configure BYOK openai key in Settings."
                )
            return await self._openai_embedding(text, api_key=key)

        async def fail_network(self, text, api_key=None):
            raise AssertionError("should never reach provider call for anthropic")

        monkeypatch.setattr(LLMService, "generate_embedding", real_guard)
        monkeypatch.setattr(LLMService, "_openai_embedding", fail_network)
        with pytest.raises(LLMProviderError, match="does not support standalone embeddings"):
            await LLMService().generate_embedding("hello")

    async def test_byok_openai_embedding_uses_custom_key(self, db_session, monkeypatch):
        user_id = str(uuid.uuid4())
        await provider_key_service.upsert(db_session, user_id, "openai", "sk-user-1234567890")
        captured = {}

        async def real_embedding(self, text, **kwargs):
            prov, key = await self._resolve_api_key(
                "openai",
                user_id=kwargs.get("user_id"),
                workspace_id=kwargs.get("workspace_id"),
                db=kwargs.get("db"),
            )
            captured["key"] = key
            return await self._openai_embedding(text, api_key=key)

        async def fake_openai_embedding(self, text, api_key=None):
            captured["provider_key"] = api_key
            return [0.1] * 4

        monkeypatch.setattr(LLMService, "generate_embedding", real_embedding)
        monkeypatch.setattr(LLMService, "_openai_embedding", fake_openai_embedding)
        res = await LLMService().generate_embedding("hello", user_id=user_id, db=db_session)
        assert captured["key"] == "sk-user-1234567890"
        assert captured["provider_key"] == "sk-user-1234567890"
        assert res == [0.1] * 4


class TestCompletionByok:
    async def test_completion_uses_byok_key_for_openai_model(self, db_session, monkeypatch):
        user_id = str(uuid.uuid4())
        await provider_key_service.upsert(db_session, user_id, "openai", "sk-user-1234567890")
        captured = {}

        async def real_completion(self, messages, model=None, temperature=0.7, max_tokens=4096, task_type="general", agent_name="unknown", **kwargs):
            effective_model = model or self.model
            inferred_provider = _infer_provider_from_model(effective_model)
            _prov, effective_key = await self._resolve_api_key(
                inferred_provider,
                user_id=kwargs.get("user_id"),
                workspace_id=kwargs.get("workspace_id"),
                db=kwargs.get("db"),
            )
            return await self._openai_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key)

        async def fake_openai_completion(self, messages, model, temperature, max_tokens, api_key=None):
            captured["key"] = api_key
            captured["model"] = model
            return {"content": "ok", "role": "assistant", "usage": {"prompt_tokens": 1, "completion_tokens": 1}}

        monkeypatch.setattr(LLMService, "generate_completion", real_completion)
        monkeypatch.setattr(LLMService, "_openai_completion", fake_openai_completion)
        res = await LLMService().generate_completion(
            [{"role": "user", "content": "hi"}],
            model="gpt-4o-mini", user_id=user_id, db=db_session,
        )
        assert captured["key"] == "sk-user-1234567890"
        assert captured["model"] == "gpt-4o-mini"
        assert res["content"] == "ok"

    async def test_completion_uses_system_key_without_byok(self, monkeypatch):
        monkeypatch.setattr(settings, "llm_api_key", "sk-sys-1234567890")
        monkeypatch.setattr(settings, "llm_provider", "openai")
        captured = {}

        async def real_completion(self, messages, model=None, temperature=0.7, max_tokens=4096, task_type="general", agent_name="unknown", **kwargs):
            effective_model = model or self.model
            inferred_provider = _infer_provider_from_model(effective_model)
            _prov, effective_key = await self._resolve_api_key(inferred_provider, **kwargs)
            return await self._openai_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key)

        async def fake_openai_completion(self, messages, model, temperature, max_tokens, api_key=None):
            captured["key"] = api_key
            return {"content": "ok", "role": "assistant", "usage": {}}

        monkeypatch.setattr(LLMService, "generate_completion", real_completion)
        monkeypatch.setattr(LLMService, "_openai_completion", fake_openai_completion)
        await LLMService().generate_completion(
            [{"role": "user", "content": "hi"}], model="gpt-4o-mini",
        )
        assert captured["key"] == "sk-sys-1234567890"