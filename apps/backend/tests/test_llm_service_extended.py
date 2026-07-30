"""
Enterprise-grade tests for LLMService — exercises real HTTP code paths
by restoring monkeypatched methods and mocking httpx at the transport layer.
"""

import json
import hashlib
import pytest
import httpx

pytestmark = pytest.mark.asyncio

# Preserve original class methods before conftest.py's autouse mock_llm patches them
from backend.services.llm_service import LLMService as _LLMService, LLMProviderError

_ORIG_GENERATE_EMBEDDING = _LLMService.generate_embedding
_ORIG_GENERATE_COMPLETION = _LLMService.generate_completion


# ---------------------------------------------------------------------------
# Reusable mock HTTP primitives
# ---------------------------------------------------------------------------


class _MockResp:
    """Stand-in for httpx.Response."""
    __slots__ = ("status_code", "_json_data", "text")

    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.text = text

    def json(self):
        return self._json_data


def _resp(status_code=200, json_data=None, text=""):
    return _MockResp(status_code, json_data or {}, text)


class _StreamResp:
    """Returned by aiter_lines() inside a stream context."""
    def __init__(self, lines, status_code):
        self.status_code = status_code
        self._lines = lines

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class _StreamCtx:
    """Context manager returned by client.stream()."""
    def __init__(self, lines, status_code):
        self._lines = lines
        self._status = status_code

    async def __aenter__(self):
        return _StreamResp(self._lines, self._status)

    async def __aexit__(self, *args):
        pass


def _client_cls(post_return=None, get_return=None, stream_lines=None, stream_status=200):
    """Factory: returns a mock httpx.AsyncClient *class* for the given returns."""
    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, headers=None, json=None, **kwargs):
            if post_return is not None:
                return post_return
            return _resp(200, {})

        async def get(self, url, headers=None, **kwargs):
            if get_return is not None:
                return get_return
            return _resp(200, {})

        def stream(self, method, url, headers=None, json=None, **kwargs):
            return _StreamCtx(stream_lines or [], stream_status)

    _Client.__name__ = "MockAsyncClient"
    return _Client


# ---------------------------------------------------------------------------
# Helper: canned provider responses
# ---------------------------------------------------------------------------


def _openai_embed_resp():
    return _resp(200, {
        "data": [{"embedding": [0.1] * 1536}],
        "model": "text-embedding-3-small",
        "usage": {"prompt_tokens": 4, "total_tokens": 4},
    })


def _openai_completion_resp(content="Hello from OpenAI", finish_reason="stop"):
    return _resp(200, {
        "choices": [{
            "message": {"content": content, "role": "assistant"},
            "finish_reason": finish_reason,
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
    })


def _anthropic_completion_resp(text="Hello from Claude", stop_reason="end_turn"):
    return _resp(200, {
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason,
        "usage": {"input_tokens": 15, "output_tokens": 25},
    })


def _openai_tool_resp():
    return _resp(200, {
        "choices": [{
            "message": {
                "content": "",
                "role": "assistant",
                "tool_calls": [{
                    "id": "call_abc",
                    "type": "function",
                    "function": {"name": "get_weather", "arguments": '{"city":"London"}'},
                }],
            },
            "finish_reason": "tool_calls",
        }],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    })


def _anthropic_tool_resp():
    return _resp(200, {
        "content": [
            {"type": "text", "text": "Let me check."},
            {"type": "tool_use", "id": "toolu_abc", "name": "get_weather", "input": {"city": "London"}},
        ],
        "stop_reason": "tool_use",
        "usage": {"input_tokens": 15, "output_tokens": 30},
    })


# ===================================================================
#  1. __init__
# ===================================================================


class TestInit:

    async def test_init_reads_settings(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test-abc")
        monkeypatch.setattr(settings, "llm_model", "gpt-4-turbo")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-ada-002")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        assert svc.provider == "openai"
        assert svc.api_key == "sk-test-abc"
        assert svc.model == "gpt-4-turbo"
        assert svc.embedding_model == "text-embedding-ada-002"


# ===================================================================
#  2-5. generate_embedding / _openai_embedding / _anthropic_embedding
# ===================================================================


class TestGenerateEmbedding:

    # 2
    async def test_empty_text_raises_error(self, monkeypatch):
        from backend.services.llm_service import LLMService, LLMProviderError

        monkeypatch.setattr(LLMService, "generate_embedding", _ORIG_GENERATE_EMBEDDING)

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Cannot generate embedding for empty text"):
            await svc.generate_embedding("")
        with pytest.raises(LLMProviderError, match="Cannot generate embedding for empty text"):
            await svc.generate_embedding("   ")

    # 3
    async def test_openai_embedding_success(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-3-small")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_openai_embed_resp()))

        result = await svc._openai_embedding("hello world")

        assert isinstance(result, list)
        assert len(result) == 1536
        assert result[0] == 0.1
        assert result[-1] == 0.1

    async def test_generate_embedding_openai_via_public_method(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-3-small")

        from backend.services.llm_service import LLMService

        monkeypatch.setattr(LLMService, "generate_embedding", _ORIG_GENERATE_EMBEDDING)
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_openai_embed_resp()))

        svc = LLMService()
        result = await svc.generate_embedding("some content")

        assert len(result) == 1536
        assert result[0] == 0.1

    # 4
    async def test_openai_embedding_http_error(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-3-small")

        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_resp(401, {}, text="Unauthorized"),
        ))

        with pytest.raises(LLMProviderError, match="OpenAI embedding failed: 401"):
            await svc._openai_embedding("test")

    # 5
    async def test_anthropic_embedding_raises_error(self, monkeypatch):
        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Anthropic does not support standalone embeddings"):
            await svc._anthropic_embedding("test")

    async def test_generate_embedding_anthropic_dispatch_raises(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")
        monkeypatch.setattr(settings, "embedding_model", "text-embedding-3-small")

        from backend.services.llm_service import LLMService, LLMProviderError

        monkeypatch.setattr(LLMService, "generate_embedding", _ORIG_GENERATE_EMBEDDING)

        svc = LLMService()
        with pytest.raises(LLMProviderError, match="Anthropic does not support standalone embeddings"):
            await svc.generate_embedding("some text")


# ===================================================================
#  6-11. generate_completion / _openai_completion / _anthropic_completion
# ===================================================================


class TestGenerateCompletion:

    # 6
    async def test_openai_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "llm_model", "gpt-4")

        from backend.services.llm_service import LLMService

        monkeypatch.setattr(LLMService, "generate_completion", _ORIG_GENERATE_COMPLETION)
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_openai_completion_resp()))

        svc = LLMService()
        result = await svc.generate_completion([{"role": "user", "content": "Hi"}])

        assert result["content"] == "Hello from OpenAI"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "stop"
        assert result["usage"]["prompt_tokens"] == 10

    # 7
    async def test_anthropic_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")
        monkeypatch.setattr(settings, "llm_model", "claude-3-5-sonnet-20241022")

        from backend.services.llm_service import LLMService

        monkeypatch.setattr(LLMService, "generate_completion", _ORIG_GENERATE_COMPLETION)
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_anthropic_completion_resp()))

        svc = LLMService()
        result = await svc.generate_completion([{"role": "user", "content": "Hi"}])

        assert result["content"] == "Hello from Claude"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "end_turn"
        assert result["usage"]["input_tokens"] == 15

    # 8
    async def test_openai_completion_success(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_openai_completion_resp(content="Hello!", finish_reason="stop"),
        ))

        result = await svc._openai_completion(
            [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
        )

        assert result["content"] == "Hello!"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "stop"
        assert result["usage"]["completion_tokens"] == 20

    async def test_openai_completion_null_content(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        resp = _resp(200, {
            "choices": [{"message": {"content": None, "role": "assistant"}, "finish_reason": "stop"}],
            "usage": {},
        })
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=resp))

        result = await svc._openai_completion(
            [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
        )

        assert result["content"] is None

    # 9
    async def test_openai_completion_http_error(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_resp(500, {}, text="Internal error"),
        ))

        with pytest.raises(LLMProviderError, match="OpenAI completion failed: 500"):
            await svc._openai_completion(
                [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
            )

    # 10
    async def test_anthropic_completion_success(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_anthropic_completion_resp(text="Hello Claude!", stop_reason="end_turn"),
        ))

        result = await svc._anthropic_completion(
            [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
        )

        assert result["content"] == "Hello Claude!"
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "end_turn"
        assert result["usage"]["input_tokens"] == 15
        assert result["usage"]["output_tokens"] == 25

    async def test_anthropic_completion_extracts_system_message(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()

        def _check_system_in_body(**kwargs):
            body = kwargs.get("json", {})
            assert "system" in body
            assert body["system"] == "You are a helpful assistant"
            return _anthropic_completion_resp()

        mc = _client_cls(post_return=_anthropic_completion_resp())()
        orig_post = mc.post

        async def post_with_check(url, headers=None, json=None, **kwargs):
            assert json is not None
            assert "system" in json
            assert json["system"] == "You are a helpful assistant"
            return _anthropic_completion_resp()

        mc.post = post_with_check
        # We need to use this specific instance; monkeypatch the constructor
        from backend.services import llm_service as _ls_mod
        orig_async = httpx.AsyncClient
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: mc)

        result = await svc._anthropic_completion(
            [
                {"role": "system", "content": "You are a helpful assistant"},
                {"role": "user", "content": "Hi"},
            ],
            "claude-3-5-sonnet-20241022", 0.7, 4096,
        )

        assert result["content"] == "Hello from Claude"

    async def test_anthropic_completion_multiple_text_blocks(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        resp = _resp(200, {
            "content": [
                {"type": "text", "text": "Hello "},
                {"type": "text", "text": "world!"},
            ],
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 5, "output_tokens": 10},
        })
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=resp))

        result = await svc._anthropic_completion(
            [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
        )

        assert result["content"] == "Hello world!"

    # 11
    async def test_anthropic_completion_http_error(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_resp(403, {}, text="Forbidden"),
        ))

        with pytest.raises(LLMProviderError, match="Anthropic completion failed: 403"):
            await svc._anthropic_completion(
                [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
            )


# ===================================================================
#  12-15. generate_completion_with_tools / tool completions
# ===================================================================


class TestGenerateCompletionWithTools:

    # 12
    async def test_openai_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "llm_model", "gpt-4")

        from backend.services.llm_service import LLMService

        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_openai_tool_resp()))

        svc = LLMService()
        result = await svc.generate_completion_with_tools(
            [{"role": "user", "content": "Weather?"}],
            [{"type": "function", "function": {"name": "get_weather"}}],
        )

        assert "tool_calls" in result
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["function"]["name"] == "get_weather"

    # 13
    async def test_anthropic_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")
        monkeypatch.setattr(settings, "llm_model", "claude-3-5-sonnet-20241022")

        from backend.services.llm_service import LLMService

        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_anthropic_tool_resp()))

        svc = LLMService()
        result = await svc.generate_completion_with_tools(
            [{"role": "user", "content": "Weather?"}],
            [{"name": "get_weather"}],
        )

        assert "tool_calls" in result
        assert len(result["tool_calls"]) == 1
        assert result["tool_calls"][0]["function"]["name"] == "get_weather"

    # 14
    async def test_openai_tool_completion_success(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_openai_tool_resp()))

        result = await svc._openai_tool_completion(
            [{"role": "user", "content": "Weather?"}],
            [{"type": "function", "function": {"name": "get_weather", "parameters": {}}}],
            "gpt-4", 0.7,
        )

        assert result["content"] == ""
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "tool_calls"
        assert len(result["tool_calls"]) == 1
        tc = result["tool_calls"][0]
        assert tc["id"] == "call_abc"
        assert tc["type"] == "function"
        assert tc["function"]["name"] == "get_weather"
        assert "London" in tc["function"]["arguments"]
        assert result["usage"]["completion_tokens"] == 5

    async def test_openai_tool_completion_http_error(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_resp(401, {}, text="Unauthorized"),
        ))

        with pytest.raises(LLMProviderError, match="OpenAI tool completion failed: 401"):
            await svc._openai_tool_completion(
                [{"role": "user", "content": "Hi"}], [{}], "gpt-4", 0.7,
            )

    # 15
    async def test_anthropic_tool_completion_success(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_anthropic_tool_resp()))

        result = await svc._anthropic_tool_completion(
            [{"role": "user", "content": "Weather?"}],
            [{"name": "get_weather"}],
            "claude-3-5-sonnet-20241022", 0.7,
        )

        assert len(result["content"]) == 1
        assert result["content"][0]["text"] == "Let me check."
        assert result["role"] == "assistant"
        assert result["finish_reason"] == "tool_use"
        assert len(result["tool_calls"]) == 1
        tc = result["tool_calls"][0]
        assert tc["id"] == "toolu_abc"
        assert tc["type"] == "function"
        assert tc["function"]["name"] == "get_weather"
        assert tc["function"]["arguments"]["city"] == "London"
        assert result["usage"]["output_tokens"] == 30

    async def test_anthropic_tool_completion_multiple_tool_uses(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        resp = _resp(200, {
            "content": [
                {"type": "text", "text": "Checking..."},
                {"type": "tool_use", "id": "tu1", "name": "get_weather", "input": {"city": "London"}},
                {"type": "tool_use", "id": "tu2", "name": "get_time", "input": {"city": "London"}},
            ],
            "stop_reason": "tool_use",
            "usage": {"input_tokens": 10, "output_tokens": 20},
        })
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=resp))

        result = await svc._anthropic_tool_completion(
            [{"role": "user", "content": "Weather & time?"}],
            [{"name": "get_weather"}, {"name": "get_time"}],
            "claude-3-5-sonnet-20241022", 0.7,
        )

        assert len(result["tool_calls"]) == 2
        assert result["tool_calls"][0]["id"] == "tu1"
        assert result["tool_calls"][1]["id"] == "tu2"

    async def test_anthropic_tool_completion_with_system_message(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        mc = _client_cls(post_return=_anthropic_tool_resp())()

        async def post_check(url, headers=None, json=None, **kwargs):
            assert json is not None
            assert "system" in json
            assert json["system"] == "Be concise"
            return _anthropic_tool_resp()

        mc.post = post_check
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: mc)

        result = await svc._anthropic_tool_completion(
            [
                {"role": "system", "content": "Be concise"},
                {"role": "user", "content": "Weather?"},
            ],
            [{"name": "get_weather"}],
            "claude-3-5-sonnet-20241022", 0.7,
        )

        assert result["finish_reason"] == "tool_use"

    async def test_anthropic_tool_completion_http_error(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            post_return=_resp(429, {}, text="Rate limited"),
        ))

        with pytest.raises(LLMProviderError, match="Anthropic tool completion failed: 429"):
            await svc._anthropic_tool_completion(
                [{"role": "user", "content": "Hi"}], [{}], "claude-3-5-sonnet-20241022", 0.7,
            )


# ===================================================================
#  16-18. generate_completion_stream / streaming
# ===================================================================


class TestGenerateCompletionStream:

    # 16
    async def test_openai_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")
        monkeypatch.setattr(settings, "llm_model", "gpt-4")

        from backend.services.llm_service import LLMService

        lines = [
            'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null,"index":0}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}',
            "data: [DONE]",
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        svc = LLMService()
        chunks = [chunk async for chunk in svc.generate_completion_stream(
            [{"role": "user", "content": "Hi"}],
        )]

        assert len(chunks) == 2
        assert chunks[0] == {"type": "content", "text": "Hello"}
        assert chunks[1] == {"type": "done", "finish_reason": "stop"}

    async def test_anthropic_dispatch(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")
        monkeypatch.setattr(settings, "llm_model", "claude-3-5-sonnet-20241022")

        from backend.services.llm_service import LLMService

        lines = [
            'data: {"type":"content_block_delta","delta":{"text":"Hello"}}',
            'data: {"type":"content_block_delta","delta":{"text":" world"}}',
            'data: {"type":"message_stop"}',
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        svc = LLMService()
        chunks = [chunk async for chunk in svc.generate_completion_stream(
            [{"role": "user", "content": "Hi"}],
        )]

        assert len(chunks) == 3
        assert chunks[0] == {"type": "content", "text": "Hello"}
        assert chunks[2] == {"type": "done", "finish_reason": "end_turn"}

    # 17
    async def test_openai_completion_stream(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()
        lines = [
            'data: {"choices":[{"delta":{"role":"assistant"},"index":0}]}',
            'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null,"index":0}]}',
            'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null,"index":0}]}',
            'data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}',
            "data: [DONE]",
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        chunks = [chunk async for chunk in svc._openai_completion_stream(
            [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
        )]

        assert len(chunks) == 3
        assert chunks[0] == {"type": "content", "text": "Hello"}
        assert chunks[1] == {"type": "content", "text": " world"}
        assert chunks[2] == {"type": "done", "finish_reason": "stop"}

    async def test_openai_stream_skips_non_data_lines(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()
        lines = [
            ": keep-alive comment",
            'data: {"choices":[{"delta":{"content":"A"},"finish_reason":null,"index":0}]}',
            "event: ping",
            "data: [DONE]",
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        chunks = [chunk async for chunk in svc._openai_completion_stream(
            [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
        )]

        assert len(chunks) == 1
        assert chunks[0] == {"type": "content", "text": "A"}

    async def test_openai_stream_http_error(self, monkeypatch):
        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            stream_lines=["data: ignored"], stream_status=400,
        ))

        with pytest.raises(LLMProviderError, match="OpenAI streaming completion failed: 400"):
            async for _ in svc._openai_completion_stream(
                [{"role": "user", "content": "Hi"}], "gpt-4", 0.7, 4096,
            ):
                pass

    # 18
    async def test_anthropic_completion_stream(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()
        lines = [
            'data: {"type":"content_block_delta","delta":{"text":"Hello"}}',
            'data: {"type":"content_block_delta","delta":{"text":" world"}}',
            'data: {"type":"content_block_stop"}',
            'data: {"type":"message_stop"}',
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        chunks = [chunk async for chunk in svc._anthropic_completion_stream(
            [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
        )]

        assert len(chunks) == 3
        assert chunks[0] == {"type": "content", "text": "Hello"}
        assert chunks[1] == {"type": "content", "text": " world"}
        assert chunks[2] == {"type": "done", "finish_reason": "end_turn"}

    async def test_anthropic_completion_stream_with_system_message(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()
        lines = [
            'data: {"type":"content_block_delta","delta":{"text":"Answer"}}',
            'data: {"type":"message_stop"}',
        ]
        mc = _client_cls(stream_lines=lines)()
        orig_stream = mc.stream

        def stream_check(method, url, headers=None, json=None, **kwargs):
            assert json is not None
            assert "system" in json
            assert json["system"] == "Be brief"
            return _StreamCtx(lines, 200)

        mc.stream = stream_check
        monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: mc)

        chunks = [chunk async for chunk in svc._anthropic_completion_stream(
            [
                {"role": "system", "content": "Be brief"},
                {"role": "user", "content": "Hi"},
            ],
            "claude-3-5-sonnet-20241022", 0.7, 4096,
        )]

        assert len(chunks) == 2
        assert chunks[0] == {"type": "content", "text": "Answer"}

    async def test_anthropic_stream_skips_non_data_lines(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()
        lines = [
            ": keepalive",
            'data: {"type":"content_block_delta","delta":{"text":"Hi"}}',
            "event: ping",
            'data: {"type":"message_stop"}',
        ]
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(stream_lines=lines))

        chunks = [chunk async for chunk in svc._anthropic_completion_stream(
            [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
        )]

        assert len(chunks) == 2

    async def test_anthropic_stream_http_error(self, monkeypatch):
        from backend.services.llm_service import LLMService, LLMProviderError

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(
            stream_lines=["data: ignored"], stream_status=500,
        ))

        with pytest.raises(LLMProviderError, match="Anthropic streaming completion failed: 500"):
            async for _ in svc._anthropic_completion_stream(
                [{"role": "user", "content": "Hi"}], "claude-3-5-sonnet-20241022", 0.7, 4096,
            ):
                pass


# ===================================================================
#  19-21. check_health
# ===================================================================


class TestCheckHealth:

    # 19
    async def test_openai_returns_true(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(get_return=_resp(200, {})))

        assert await svc.check_health() is True

    async def test_openai_returns_false_on_non_200(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "openai")
        monkeypatch.setattr(settings, "llm_api_key", "sk-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(get_return=_resp(401, {})))

        assert await svc.check_health() is False

    # 20
    async def test_anthropic_returns_true(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_resp(200, {})))

        assert await svc.check_health() is True

    async def test_anthropic_returns_false_on_non_200(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "anthropic")
        monkeypatch.setattr(settings, "llm_api_key", "sk-ant-test")

        from backend.services.llm_service import LLMService

        svc = LLMService()
        monkeypatch.setattr(httpx, "AsyncClient", _client_cls(post_return=_resp(403, {})))

        assert await svc.check_health() is False

    # 21
    async def test_unknown_provider_returns_false(self, monkeypatch):
        from backend.config import settings

        monkeypatch.setattr(settings, "llm_provider", "unknown")

        from backend.services.llm_service import LLMService

        svc = LLMService()

        assert await svc.check_health() is False


# ===================================================================
#  22. compute_content_hash
# ===================================================================


class TestComputeContentHash:

    async def test_deterministic_sha256(self, monkeypatch):
        from backend.services.llm_service import LLMService

        svc = LLMService()

        h1 = svc.compute_content_hash("hello")
        h2 = svc.compute_content_hash("hello")
        h3 = svc.compute_content_hash("world")

        assert h1 == h2
        assert h1 != h3
        assert len(h1) == 64
        assert all(c in "0123456789abcdef" for c in h1)
