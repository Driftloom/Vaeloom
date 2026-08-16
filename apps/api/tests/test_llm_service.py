import pytest
import httpx
from unittest.mock import MagicMock

pytestmark = pytest.mark.asyncio


class TestLLMService:
    async def _patch_llm(self, monkeypatch, provider="anthropic"):
        from api.services.llm_service import LLMService, LLMProviderError
        from api.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "test-key")
        monkeypatch.setattr(settings, "llm_provider", provider)
        monkeypatch.setattr(settings, "llm_model", "claude-3-5-sonnet-20241022")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-3-small")

        async def _generate_embedding(self, text):
            if not text.strip():
                raise LLMProviderError("Cannot generate embedding for empty text")
            if self.provider == "openai":
                return await self._openai_embedding(text)
            return await self._anthropic_embedding(text)

        async def _generate_completion(self, messages, model=None, temperature=0.7, max_tokens=4096):
            if self.provider == "openai":
                return await self._openai_completion(messages, model or self.model, temperature, max_tokens)
            return await self._anthropic_completion(messages, model or self.model, temperature, max_tokens)

        monkeypatch.setattr(LLMService, "generate_embedding", _generate_embedding)
        monkeypatch.setattr(LLMService, "generate_completion", _generate_completion)
        return LLMService, LLMProviderError

    def _mock_openai_embedding_response(self):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json = MagicMock(return_value={
            "data": [{"embedding": [0.1] * 1536}],
            "model": "text-embedding-3-small",
            "usage": {"prompt_tokens": 4, "total_tokens": 4},
        })
        mock_resp.text = ""
        return mock_resp

    def _mock_openai_completion_response(self):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json = MagicMock(return_value={
            "choices": [{"message": {"content": "Hello from OpenAI", "role": "assistant"}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20},
        })
        mock_resp.text = ""
        return mock_resp

    def _mock_anthropic_completion_response(self):
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json = MagicMock(return_value={
            "content": [{"type": "text", "text": "Hello from Claude"}],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 15, "output_tokens": 25},
        })
        mock_resp.text = ""
        return mock_resp

    async def test_generate_embedding_empty_text_raises_error(self, monkeypatch):
        LLMService, LLMProviderError = await self._patch_llm(monkeypatch)
        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Cannot generate embedding for empty text"):
            await svc.generate_embedding("")
        with pytest.raises(LLMProviderError, match="Cannot generate embedding for empty text"):
            await svc.generate_embedding("   ")

    async def test_generate_embedding_openai_success(self, monkeypatch):
        LLMService, _ = await self._patch_llm(monkeypatch, provider="openai")

        mock_resp = self._mock_openai_embedding_response()

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        result = await svc.generate_embedding("test content")
        assert len(result) == 1536
        assert result[0] == 0.1

    async def test_generate_embedding_anthropic_raises_error(self, monkeypatch):
        LLMService, LLMProviderError = await self._patch_llm(monkeypatch, provider="anthropic")

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Anthropic does not support standalone embeddings"):
            await svc.generate_embedding("test")

    async def test_generate_completion_openai_success(self, monkeypatch):
        LLMService, _ = await self._patch_llm(monkeypatch, provider="openai")

        mock_resp = self._mock_openai_completion_response()

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        result = await svc.generate_completion([{"role": "user", "content": "Hi"}])
        assert result["content"] == "Hello from OpenAI"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "stop"

    async def test_generate_completion_anthropic_success(self, monkeypatch):
        LLMService, _ = await self._patch_llm(monkeypatch, provider="anthropic")

        mock_resp = self._mock_anthropic_completion_response()

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        result = await svc.generate_completion([{"role": "user", "content": "Hi"}])
        assert result["content"] == "Hello from Claude"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "end_turn"

    async def test_generate_completion_with_system_message(self, monkeypatch):
        LLMService, _ = await self._patch_llm(monkeypatch, provider="anthropic")

        mock_resp = self._mock_anthropic_completion_response()

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            body = json
            assert "system" in body
            assert body["system"] == "You are helpful"
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        result = await svc.generate_completion([
            {"role": "system", "content": "You are helpful"},
            {"role": "user", "content": "Hi"},
        ])
        assert result["content"] == "Hello from Claude"

    async def test_generate_completion_http_401_error(self, monkeypatch):
        LLMService, LLMProviderError = await self._patch_llm(monkeypatch, provider="openai")

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            mock_resp = MagicMock(spec=httpx.Response)
            mock_resp.status_code = 401
            mock_resp.text = "Unauthorized"
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="OpenAI completion failed: 401"):
            await svc.generate_completion([{"role": "user", "content": "Hi"}])

    async def test_generate_completion_http_500_error(self, monkeypatch):
        LLMService, LLMProviderError = await self._patch_llm(monkeypatch, provider="anthropic")

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            mock_resp = MagicMock(spec=httpx.Response)
            mock_resp.status_code = 500
            mock_resp.text = "Internal Server Error"
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Anthropic completion failed: 500"):
            await svc.generate_completion([{"role": "user", "content": "Hi"}])

    async def test_generate_completion_openai_http_401(self, monkeypatch):
        LLMService, LLMProviderError = await self._patch_llm(monkeypatch, provider="openai")

        async def fake_post(self, url, headers=None, json=None, **kwargs):
            mock_resp = MagicMock(spec=httpx.Response)
            mock_resp.status_code = 401
            mock_resp.text = "Unauthorized"
            return mock_resp

        monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="OpenAI completion failed: 401"):
            await svc.generate_completion([{"role": "user", "content": "Hi"}])

    async def test_compute_content_hash(self, monkeypatch):
        from api.services.llm_service import LLMService
        svc = LLMService()
        h1 = svc.compute_content_hash("hello")
        h2 = svc.compute_content_hash("hello")
        h3 = svc.compute_content_hash("world")
        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64
