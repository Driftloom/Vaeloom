import hashlib
import time
from typing import Any, AsyncGenerator, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..config import settings
from .model_router import model_router, ModelConfig, MODEL_CATALOG


def _infer_provider_from_model(model: str | None) -> str:
    if not model:
        return settings.llm_provider
    m = model.strip().lower()
    if m.startswith("gpt") or m.startswith("text-embedding") or m.startswith("o1") or m.startswith("o3"):
        return "openai"
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gemini") or m.startswith("google"):
        return "google"
    if m.startswith("mistral"):
        return "mistral"
    if m.startswith("cohere") or m.startswith("command"):
        return "cohere"
    if "groq" in m:
        return "groq"
    # fallback to catalog
    cfg = MODEL_CATALOG.get(model)
    if cfg:
        return cfg.provider
    return settings.llm_provider


class LLMProviderError(Exception):
    pass


class LLMService:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.embedding_model = settings.embedding_model

    async def _resolve_api_key(
        self,
        provider: str | None = None,
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        explicit_key: str | None = None,
    ) -> tuple[str, str]:
        """Resolve effective (provider, api_key) with BYOK priority: explicit > workspace > user > system.

        Returns (provider, api_key). If no key found, returns (provider, "") and caller should handle.
        """
        # Explicit override wins
        if explicit_key:
            prov = provider or settings.llm_provider
            return prov, explicit_key

        # Infer provider if not given
        prov = provider or settings.llm_provider

        # If DB context provided, try BYOK resolution
        if db is not None and user_id:
            try:
                # Lazy import to avoid circular
                from .provider_key_service import provider_key_service
                effective = await provider_key_service.resolve_effective(
                    db, user_id, prov, workspace_id
                )
                if effective.get("key"):
                    row = effective.get("row")
                    if row is not None:
                        await provider_key_service.mark_used(db, row)
                    return prov, effective["key"]
            except Exception:
                # Fall through to system key on BYOK lookup failure
                pass

        # System fallback
        inferred_prov = _infer_provider_from_model(prov) if prov else settings.llm_provider
        # For embedding case, provider is inferred as openai regardless of llm_provider
        # Use system key if matches
        system_key = settings.llm_api_key
        # If provider mismatch but we still have system key, use it only if provider matches llm_provider
        if inferred_prov == settings.llm_provider and system_key:
            return inferred_prov, system_key
        # If provider is openai and llm_provider is openai, return same
        if prov == "openai" and system_key and settings.llm_provider == "openai":
            return prov, system_key
        # Fallback still returns system key if available, else empty
        return prov, system_key or self.api_key

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def generate_embedding(
        self,
        text: str,
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        provider_override: str | None = None,
        api_key_override: str | None = None,
    ) -> list[float]:
        if not text.strip():
            raise LLMProviderError("Cannot generate embedding for empty text")

        # Embedding currently supports openai only; BYOK for openai embedding key
        prov, key = await self._resolve_api_key(
            provider_override or "openai",
            user_id=user_id,
            workspace_id=workspace_id,
            db=db,
            explicit_key=api_key_override,
        )
        # If provider is not openai, anthropic can't embed - still try openai fallback for embeddings
        if prov == "openai":
            return await self._openai_embedding(text, api_key=key)
        raise LLMProviderError(
            f"Provider '{prov}' does not support standalone embeddings; use OpenAI for embeddings. Configure BYOK openai key in Settings."
        )

    async def _openai_embedding(self, text: str, api_key: str | None = None) -> list[float]:
        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing OpenAI API key — configure in Settings > API Keys (BYOK) or set LLM_API_KEY")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"input": text, "model": self.embedding_model},
            )
            if resp.status_code != 200:
                raise LLMProviderError(f"OpenAI embedding failed: {resp.status_code} {resp.text}")
            data = resp.json()
            return data["data"][0]["embedding"]

    async def _anthropic_embedding(self, text: str) -> list[float]:
        raise LLMProviderError("Anthropic does not support standalone embeddings; use OpenAI for embeddings")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def generate_completion(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        task_type: str = "general",
        agent_name: str = "unknown",
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        api_key_override: str | None = None,
        provider_override: str | None = None,
    ) -> dict[str, Any]:
        start = time.monotonic()
        # Resolve BYOK key for this completion
        effective_model = model or self.model
        inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        _prov, effective_key = await self._resolve_api_key(
            inferred_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
        )
        if inferred_provider == "openai":
            result = await self._openai_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key)
        else:
            result = await self._anthropic_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key)

        # Track cost
        latency_ms = (time.monotonic() - start) * 1000
        usage = result.get("usage", {})
        input_tokens = usage.get("prompt_tokens", usage.get("input_tokens", 0))
        output_tokens = usage.get("completion_tokens", usage.get("output_tokens", 0))
        model_config = MODEL_CATALOG.get(model or self.model)
        if model_config:
            model_router.record_usage(
                agent_name=agent_name,
                task_type=task_type,
                model=model_config,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
            )

        return result

    async def _openai_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None
    ) -> dict[str, Any]:
        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing OpenAI API key — configure in Settings > API Keys (BYOK)")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens},
            )
            if resp.status_code != 200:
                raise LLMProviderError(f"OpenAI completion failed: {resp.status_code} {resp.text}")
            data = resp.json()
            choice = data["choices"][0]
            return {
                "content": choice["message"].get("content", ""),
                "role": choice["message"]["role"],
                "finish_reason": choice["finish_reason"],
                "usage": data.get("usage", {}),
            }

    async def _anthropic_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None
    ) -> dict[str, Any]:
        system = None
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

        body: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": anthropic_messages,
        }
        if system:
            body["system"] = system

        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing Anthropic API key — configure in Settings > API Keys (BYOK)")

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if resp.status_code != 200:
                raise LLMProviderError(f"Anthropic completion failed: {resp.status_code} {resp.text}")
            data = resp.json()
            content = ""
            for block in data.get("content", []):
                if block.get("type") == "text":
                    content += block.get("text", "")

            usage = data.get("usage", {})
            return {
                "content": content,
                "role": "assistant",
                "finish_reason": data.get("stop_reason", "end_turn"),
                "usage": {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                },
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def generate_completion_with_tools(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        api_key_override: str | None = None,
        provider_override: str | None = None,
    ) -> dict[str, Any]:
        effective_model = model or self.model
        inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        _prov, effective_key = await self._resolve_api_key(
            inferred_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
        )
        if inferred_provider == "openai":
            return await self._openai_tool_completion(messages, tools, effective_model, temperature, api_key=effective_key)
        return await self._anthropic_tool_completion(messages, tools, effective_model, temperature, api_key=effective_key)

    async def _openai_tool_completion(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float, api_key: str | None = None
    ) -> dict[str, Any]:
        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing OpenAI API key — configure BYOK")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "tools": tools, "temperature": temperature},
            )
            if resp.status_code != 200:
                raise LLMProviderError(f"OpenAI tool completion failed: {resp.status_code} {resp.text}")
            data = resp.json()
            choice = data["choices"][0]
            msg = choice["message"]
            return {
                "content": msg.get("content", ""),
                "role": msg["role"],
                "tool_calls": msg.get("tool_calls", []),
                "finish_reason": choice["finish_reason"],
                "usage": data.get("usage", {}),
            }

    async def _anthropic_tool_completion(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float, api_key: str | None = None
    ) -> dict[str, Any]:
        system = None
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

        body: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": anthropic_messages,
            "tools": tools,
        }
        if system:
            body["system"] = system

        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing Anthropic API key — configure BYOK")
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if resp.status_code != 200:
                raise LLMProviderError(f"Anthropic tool completion failed: {resp.status_code} {resp.text}")
            data = resp.json()
            content = []
            tool_calls = []
            for block in data.get("content", []):
                if block.get("type") == "text":
                    content.append({"type": "text", "text": block.get("text", "")})
                elif block.get("type") == "tool_use":
                    tool_calls.append({
                        "id": block.get("id", ""),
                        "type": "function",
                        "function": {"name": block.get("name", ""), "arguments": block.get("input", {})},
                    })

            usage = data.get("usage", {})
            return {
                "content": content,
                "role": "assistant",
                "tool_calls": tool_calls,
                "finish_reason": data.get("stop_reason", "end_turn"),
                "usage": {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                },
            }

    async def generate_completion_stream(
        self,
        messages: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        api_key_override: str | None = None,
        provider_override: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        effective_model = model or self.model
        inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        _prov, effective_key = await self._resolve_api_key(
            inferred_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
        )
        if inferred_provider == "openai":
            async for chunk in self._openai_completion_stream(messages, effective_model, temperature, max_tokens, api_key=effective_key):
                yield chunk
        else:
            async for chunk in self._anthropic_completion_stream(messages, effective_model, temperature, max_tokens, api_key=effective_key):
                yield chunk

    async def _openai_completion_stream(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing OpenAI API key — configure BYOK")
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": True},
            ) as resp:
                if resp.status_code != 200:
                    raise LLMProviderError(f"OpenAI streaming completion failed: {resp.status_code}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        break
                    import json
                    data = json.loads(payload)
                    choice = data["choices"][0]
                    delta = choice.get("delta", {})
                    if delta.get("content"):
                        yield {"type": "content", "text": delta["content"]}
                    if choice.get("finish_reason"):
                        yield {"type": "done", "finish_reason": choice["finish_reason"]}

    async def _anthropic_completion_stream(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        system = None
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})

        body: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
            "messages": anthropic_messages,
        }
        if system:
            body["system"] = system

        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing Anthropic API key — configure BYOK")
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=body) as resp:
                if resp.status_code != 200:
                    raise LLMProviderError(f"Anthropic streaming completion failed: {resp.status_code}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    import json
                    data = json.loads(payload)
                    if data.get("type") == "content_block_delta" and data.get("delta", {}).get("text"):
                        yield {"type": "content", "text": data["delta"]["text"]}
                    if data.get("type") == "message_stop":
                        yield {"type": "done", "finish_reason": "end_turn"}

    async def check_health(self) -> bool:
        if self.provider == "openai":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return resp.status_code == 200
        elif self.provider == "anthropic":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                    json={"model": "claude-3-haiku-20240307", "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]},
                )
                return resp.status_code == 200
        return False

    def compute_content_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()


llm_service = LLMService()
