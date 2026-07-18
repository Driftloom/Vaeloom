import hashlib
import time
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..config import settings


class LLMProviderError(Exception):
    pass


class LLMService:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.embedding_model = settings.embedding_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def generate_embedding(self, text: str) -> list[float]:
        if not text.strip():
            raise LLMProviderError("Cannot generate embedding for empty text")

        if self.provider == "openai":
            return await self._openai_embedding(text)
        return await self._anthropic_embedding(text)

    async def _openai_embedding(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
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
    ) -> dict[str, Any]:
        if self.provider == "openai":
            return await self._openai_completion(messages, model or self.model, temperature, max_tokens)
        return await self._anthropic_completion(messages, model or self.model, temperature, max_tokens)

    async def _openai_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
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
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int
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

        headers = {
            "x-api-key": self.api_key,
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
    ) -> dict[str, Any]:
        if self.provider == "openai":
            return await self._openai_tool_completion(messages, tools, model or self.model, temperature)
        return await self._anthropic_tool_completion(messages, tools, model or self.model, temperature)

    async def _openai_tool_completion(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
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
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float
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

        headers = {
            "x-api-key": self.api_key,
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
