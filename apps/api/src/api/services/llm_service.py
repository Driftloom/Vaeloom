import contextlib
import hashlib
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..config import settings
from .model_router import MODEL_CATALOG, model_router


def _infer_provider_from_model(model: str | None) -> str:
    if not model:
        return settings.llm_provider
    m = model.strip().lower()
    if m.startswith("groq/") or "groq" in m or m.startswith("openai/gpt-oss") or m.startswith("qwen/"):
        return "groq"
    if m.startswith("gemini") or m.startswith("google"):
        return "google"
    if m.startswith("gpt") or m.startswith("text-embedding") or m.startswith("o1") or m.startswith("o3"):
        return "openai"
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("mistral"):
        return "mistral"
    if m.startswith("cohere") or m.startswith("command"):
        return "cohere"
    # fallback to catalog
    cfg = MODEL_CATALOG.get(model)
    if cfg:
        return cfg.provider
    return settings.llm_provider


class LLMProviderError(Exception):
    pass


class LLMTransientError(LLMProviderError):
    """Raised on retryable provider errors like HTTP 429 (Rate Limit) and HTTP 5xx."""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


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
        system_key = settings.llm_api_key

        if prov in ("google", "gemini"):
            return prov, settings.gemini_api_key or system_key

        if inferred_prov == settings.llm_provider and system_key:
            return inferred_prov, system_key

        if prov == "openai" and system_key and settings.llm_provider == "openai":
            return prov, system_key

        if prov == "groq" and system_key and settings.llm_provider == "groq":
            return prov, system_key

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

        effective_prov = provider_override
        if not effective_prov:
            if self.embedding_model.startswith("gemini") or self.embedding_model.startswith("models/embedding"):
                effective_prov = "google"
            elif self.provider in ("google", "gemini"):
                effective_prov = "google"
            elif self.provider == "anthropic":
                effective_prov = "anthropic"
            elif self.provider == "openai":
                effective_prov = "openai"
            else:
                effective_prov = "openai"

        prov, key = await self._resolve_api_key(
            effective_prov,
            user_id=user_id,
            workspace_id=workspace_id,
            db=db,
            explicit_key=api_key_override,
        )
        if prov in ("google", "gemini"):
            return await self._google_embedding(text, api_key=key)
        if prov == "openai":
            return await self._openai_embedding(text, api_key=key)
        raise LLMProviderError(
            f"Provider '{prov}' does not support standalone embeddings; use Google (Gemini) or OpenAI for embeddings. Configure BYOK key in Settings."
        )

    async def _google_embedding(self, text: str, api_key: str | None = None) -> list[float]:
        import time as _t

        key = api_key or settings.gemini_api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing Gemini/Google API key — configure GEMINI_API_KEY")
        _emb_start = _t.monotonic()
        model_name = self.embedding_model or "gemini-embedding-2"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:embedContent"
        body = {
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": 1536,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    url,
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                    json=body,
                )
                if resp.status_code != 200:
                    raise LLMProviderError(f"Gemini embedding failed: {resp.status_code} {resp.text}")
                data = resp.json()
                emb = data.get("embedding", {}).get("values", [])
                if not emb:
                    raise LLMProviderError(f"Gemini embedding returned empty result: {data}")
                try:
                    from ..infrastructure.agent_observability import record_embedding_latency

                    record_embedding_latency((_t.monotonic() - _emb_start) * 1000)
                except Exception:
                    pass
                return emb
        finally:
            pass

    async def _openai_embedding(self, text: str, api_key: str | None = None) -> list[float]:
        import time as _t

        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing OpenAI API key — configure in Settings > API Keys (BYOK) or set LLM_API_KEY")
        _emb_start = _t.monotonic()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"input": text, "model": self.embedding_model},
            )
            if resp.status_code != 200:
                raise LLMProviderError(f"OpenAI embedding failed: {resp.status_code} {resp.text}")
            data = resp.json()
            emb = data["data"][0]["embedding"]
            try:
                from ..infrastructure.agent_observability import record_embedding_latency

                record_embedding_latency((_t.monotonic() - _emb_start) * 1000)
            except Exception:
                pass
            return emb
        finally:
            try:
                from ..infrastructure.agent_observability import record_embedding_latency

                # Only record on error path if not already recorded (non-200 already raised)
                pass
            except Exception:
                pass

    async def _anthropic_embedding(self, text: str) -> list[float]:
        raise LLMProviderError("Anthropic does not support standalone embeddings; use OpenAI for embeddings")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, LLMTransientError)),
        reraise=True,
    )
    async def _generate_completion_with_retry(
        self,
        messages: list[dict[str, Any]],
        effective_model: str,
        temperature: float,
        max_tokens: int,
        inferred_provider: str,
        effective_key: str | None,
        json_mode: bool = False,
    ) -> dict[str, Any]:
        if inferred_provider in ("openai", "groq"):
            return await self._openai_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key, provider=inferred_provider, json_mode=json_mode)
        else:
            return await self._anthropic_completion(messages, effective_model, temperature, max_tokens, api_key=effective_key, json_mode=json_mode)

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
        json_mode: bool = False,
    ) -> dict[str, Any]:
        """Generate a completion. json_mode=True requests provider-native JSON
        enforcement (Phase B §11): OpenAI/Groq get response_format json_object;
        Anthropic gets an explicit JSON-only system instruction (no native
        equivalent). The result carries json_mode metadata for provenance."""
        # ── P1b: auto-infer task_type from agent_name when caller left it as general
        # This wires model routing without touching 22 handler call-sites (MODEL-001 full wiring)
        if task_type == "general" and agent_name and agent_name != "unknown":
            try:
                from .model_router import AGENT_TASK_TYPE_MAP

                task_type = AGENT_TASK_TYPE_MAP.get(agent_name.lower(), task_type)
            except Exception:
                pass

        start = time.monotonic()
        # Resolve BYOK key for this completion + task-aware model selection (MODEL-001)
        # If caller did not pick a model, route via TASK_MODEL_MAP tier → provider-appropriate model.
        if not model and task_type != "general":
            try:
                from .model_router import model_router as _router

                # Route with provider matching current default so anthropic defaults stay anthropic
                default_provider = _infer_provider_from_model(self.model) if not provider_override else provider_override
                routed = _router.select_model(task_type, provider=default_provider)
                # Only override default when routed tier differs from default's tier (e.g., classify→fast)
                default_cfg = MODEL_CATALOG.get(self.model)
                if default_cfg is None or routed.tier != default_cfg.tier:
                    effective_model = routed.name
                    inferred_provider = provider_override or routed.provider
                else:
                    effective_model = self.model
                    inferred_provider = provider_override or _infer_provider_from_model(effective_model)
            except Exception:
                effective_model = model or self.model
                inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        else:
            effective_model = model or self.model
            inferred_provider = provider_override or _infer_provider_from_model(effective_model)

        # Build fallback tier candidates for resilient degraded operation
        fallback_candidates = [effective_model]
        curr_cfg = MODEL_CATALOG.get(effective_model)
        if curr_cfg:
            if curr_cfg.tier == "powerful":
                # Fallback to balanced, then fast
                fallback_candidates.extend([m.name for m in MODEL_CATALOG.values() if m.provider == curr_cfg.provider and m.tier == "balanced"][:1])
                fallback_candidates.extend([m.name for m in MODEL_CATALOG.values() if m.provider == curr_cfg.provider and m.tier == "fast"][:1])
            elif curr_cfg.tier == "balanced":
                # Fallback to fast
                fallback_candidates.extend([m.name for m in MODEL_CATALOG.values() if m.provider == curr_cfg.provider and m.tier == "fast"][:1])
            # Muse §23 provider diversity: same-tier models on OTHER providers,
            # chat-only (embeddings excluded — no generation support). Candidates
            # without a resolvable key are skipped at call time (missing-key
            # errors continue the chain, never abort it), so semantics only
            # change by tier — never by capability.
            fallback_candidates.extend([
                m.name for m in MODEL_CATALOG.values()
                if m.provider != curr_cfg.provider and m.tier == curr_cfg.tier
                and "embedding" not in m.name and m.name not in fallback_candidates
            ][:2])

        result: dict[str, Any] | None = None
        last_exc: Exception | None = None

        for candidate_model in fallback_candidates:
            candidate_provider = provider_override or _infer_provider_from_model(candidate_model)
            _prov, effective_key = await self._resolve_api_key(
                candidate_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
            )
            try:
                result = await self._generate_completion_with_retry(
                    messages=messages,
                    effective_model=candidate_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    inferred_provider=candidate_provider,
                    effective_key=effective_key,
                    json_mode=json_mode,
                )
                effective_model = candidate_model
                break
            except (LLMProviderError, httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                import logging as _lg
                _lg.getLogger(__name__).warning(f"Model {candidate_model} failed ({exc}); attempting failover...")
                continue

        if result is None:
            if last_exc:
                raise last_exc
            raise LLMProviderError("All model tier candidates failed to generate completion")


        # Model downgrade observability (Phase B §12): callers can see whether
        # the requested model served or a fallback tier won.
        try:
            result["model"] = effective_model
            result["fallback_chain"] = list(fallback_candidates[: fallback_candidates.index(effective_model) + 1])
            result["downgraded"] = effective_model != fallback_candidates[0]
            if result["downgraded"]:
                from .inference_policy import record_fallback as _record_fallback
                _record_fallback(agent_name, task_type, result["fallback_chain"], "tier failover")
        except Exception:
            pass

        # Track cost — also thread task_type routing hint (MODEL-001)
        latency_ms = (time.monotonic() - start) * 1000
        usage = result.get("usage", {})
        input_tokens = usage.get("prompt_tokens", usage.get("input_tokens", 0))
        output_tokens = usage.get("completion_tokens", usage.get("output_tokens", 0))
        # If caller passed task_type != general, log routing tier for observability
        try:
            from .model_router import TASK_MODEL_MAP

            tier = TASK_MODEL_MAP.get(task_type)
            if tier and task_type != "general":
                import logging as _lg

                _lg.getLogger(__name__).debug(f"LLM route task_type={task_type}→tier={tier} model={effective_model}")
        except Exception:
            pass
        model_config = MODEL_CATALOG.get(effective_model)
        if model_config:
            model_router.record_usage(
                agent_name=agent_name,
                task_type=task_type,
                model=model_config,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=latency_ms,
            )
        # Record prompt caching tokens if provider returned cached_tokens
        try:
            cached = usage.get("cached_tokens", usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)) if isinstance(usage.get("prompt_tokens_details"), dict) else usage.get("cached_tokens", 0)
            if cached:
                import logging as _lg

                _lg.getLogger(__name__).info(f"LLM cache hit task={task_type} cached={cached} total_in={input_tokens}")
        except Exception:
            pass

        return result

    async def _openai_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None, provider: str = "openai", json_mode: bool = False
    ) -> dict[str, Any]:
        key = api_key or self.api_key
        pname = "Groq" if provider == "groq" else "OpenAI"
        if not key:
            raise LLMProviderError(f"Missing {pname} API key — configure in Settings > API Keys (BYOK)")
        url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        body: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        if json_mode:
            # Provider-native structured enforcement (Phase B §11).
            body["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
            )
            if resp.status_code in (429, 500, 502, 503, 504):
                raise LLMTransientError(f"{pname} transient error: {resp.status_code} {resp.text}", status_code=resp.status_code)
            if resp.status_code != 200:
                raise LLMProviderError(f"{pname} completion failed: {resp.status_code} {resp.text}")
            data = resp.json()
            choice = data["choices"][0]
            return {
                "content": choice["message"].get("content", ""),
                "role": choice["message"]["role"],
                "finish_reason": choice["finish_reason"],
                "usage": data.get("usage", {}),
                "json_mode": json_mode,
            }

    async def _anthropic_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None, json_mode: bool = False
    ) -> dict[str, Any]:
        system = None
        anthropic_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})
        if json_mode:
            # No native response_format: constrain via explicit instruction (validated downstream).
            _instr = "Respond with a single valid JSON object only. No prose, no fences."
            system = f"{system}\n\n{_instr}" if system else _instr

        body: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": anthropic_messages,
        }
        # P1b: cache stable system prompt (ephemeral ttl) — 75% input savings on repeated ReAct rounds
        if system:
            body["system"] = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]

        key = api_key or self.api_key
        if not key:
            raise LLMProviderError("Missing Anthropic API key — configure in Settings > API Keys (BYOK)")

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise LLMTransientError(f"Anthropic transient error: {resp.status_code} {resp.text}", status_code=resp.status_code)
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
                "json_mode": json_mode,
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, LLMTransientError)),
        reraise=True,
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
        """Tool-calling completion with capability-aware fallback (Phase B §12).

        Never falls back to a model that cannot satisfy tool calling:
        embedding-only models are excluded from candidates. Downgrades stay
        within tool-capable chat models and are recorded in the result
        (fallback_chain / downgraded) for provenance.
        """
        from .model_router import MODEL_CATALOG as _CAT

        requested = model or self.model
        candidates = [requested]
        _cfg = _CAT.get(requested)
        if _cfg:
            if _cfg.tier == "powerful":
                candidates += [m.name for m in _CAT.values()
                               if m.provider == _cfg.provider and m.tier == "balanced" and "embedding" not in m.name][:1]
                candidates += [m.name for m in _CAT.values()
                               if m.provider == _cfg.provider and m.tier == "fast" and "embedding" not in m.name][:1]
            elif _cfg.tier == "balanced":
                candidates += [m.name for m in _CAT.values()
                               if m.provider == _cfg.provider and m.tier == "fast" and "embedding" not in m.name][:1]
            # Muse §23: same-tier cross-provider tool-capable models. Provider
            # mismatches and missing keys fail over (never abort); temperature,
            # tools, and tier are unchanged across the hop.
            candidates += [m.name for m in _CAT.values()
                           if m.provider != _cfg.provider and m.tier == _cfg.tier
                           and "embedding" not in m.name][:2]
        # Dedupe, keep order; drop embedding-only models (no tool support).
        seen: set[str] = set()
        candidates = [c for c in candidates
                      if "embedding" not in c and not (c in seen or seen.add(c))]

        last_exc: Exception | None = None
        for candidate_model in candidates:
            candidate_provider = provider_override or _infer_provider_from_model(candidate_model)
            _prov, effective_key = await self._resolve_api_key(
                candidate_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
            )
            try:
                if candidate_provider in ("openai", "groq"):
                    result = await self._openai_tool_completion(messages, tools, candidate_model, temperature, api_key=effective_key, provider=candidate_provider)
                else:
                    result = await self._anthropic_tool_completion(messages, tools, candidate_model, temperature, api_key=effective_key)
                result["model"] = candidate_model
                result["fallback_chain"] = list(candidates[: candidates.index(candidate_model) + 1])
                result["downgraded"] = candidate_model != candidates[0]
                if result["downgraded"]:
                    import logging as _lg
                    _lg.getLogger(__name__).warning(
                        f"Tool-call model downgraded {candidates[0]} -> {candidate_model} (capability-preserving fallback)")
                    try:
                        from .inference_policy import record_fallback as _record_fallback
                        _record_fallback("unknown", "tool_calling", result["fallback_chain"],
                                         "tool-capability-preserving failover")
                    except Exception:
                        pass
                return result
            except (LLMProviderError, LLMTransientError, httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                import logging as _lg
                _lg.getLogger(__name__).warning(f"Tool-call model {candidate_model} failed ({exc}); attempting capability-preserving failover...")
                continue
        if last_exc:
            raise last_exc
        raise LLMProviderError("All tool-capable model candidates failed")

    def _normalize_openai_messages(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        import json as _json
        cleaned = []
        for msg in messages:
            m = dict(msg)
            if "tool_calls" in m and isinstance(m["tool_calls"], list):
                tcs = []
                for tc in m["tool_calls"]:
                    tc_copy = dict(tc)
                    if "function" in tc_copy and isinstance(tc_copy["function"], dict):
                        fn = dict(tc_copy["function"])
                        if isinstance(fn.get("arguments"), (dict, list)):
                            fn["arguments"] = _json.dumps(fn["arguments"])
                        tc_copy["function"] = fn
                    tcs.append(tc_copy)
                m["tool_calls"] = tcs
            cleaned.append(m)
        return cleaned

    async def _openai_tool_completion(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float, api_key: str | None = None, provider: str = "openai"
    ) -> dict[str, Any]:
        key = api_key or self.api_key
        pname = "Groq" if provider == "groq" else "OpenAI"
        if not key:
            raise LLMProviderError(f"Missing {pname} API key — configure BYOK")
        url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        norm_messages = self._normalize_openai_messages(messages)
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": norm_messages, "tools": tools, "temperature": temperature},
            )
            if resp.status_code in (429, 500, 502, 503, 504):
                raise LLMTransientError(f"{pname} transient tool error: {resp.status_code} {resp.text}", status_code=resp.status_code)
            if resp.status_code != 200:
                raise LLMProviderError(f"{pname} tool completion failed: {resp.status_code} {resp.text}")
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
            if resp.status_code in (429, 500, 502, 503, 504):
                raise LLMTransientError(f"Anthropic transient tool error: {resp.status_code} {resp.text}", status_code=resp.status_code)
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

    async def generate_completion_with_tools_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        model: str | None = None,
        temperature: float = 0.7,
        *,
        api_key_override: str | None = None,
        provider_override: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Streaming variant of generate_completion_with_tools (true SSE token streaming).

        Yields typed events:
          {"type": "text_delta", "text": "..."}       — incremental assistant text as it arrives
          {"type": "tool_calls", "tool_calls": [...]} — complete accumulated tool calls
                                                        (same OpenAI-style shape as the buffered path)
          {"type": "done", "finish_reason": "..."}    — terminal event

        When no API key is resolvable (tests / unconfigured), delegates to the buffered
        generate_completion_with_tools and emits its result as single-shot events so
        callers get one uniform contract.
        """
        effective_model = model or self.model
        inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        _prov, effective_key = await self._resolve_api_key(
            inferred_provider, explicit_key=api_key_override
        )
        if not effective_key:
            # No key — fall back to the buffered path (mocked in tests, raises clearly in prod)
            result = await self.generate_completion_with_tools(
                messages=messages,
                tools=tools,
                model=model,
                temperature=temperature,
                api_key_override=api_key_override,
                provider_override=provider_override,
            )
            content = result.get("content", "")
            if isinstance(content, list):  # Anthropic block style
                text = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            else:
                text = str(content or "")
            if text:
                yield {"type": "text_delta", "text": text}
            tool_calls = result.get("tool_calls") or []
            if tool_calls:
                yield {"type": "tool_calls", "tool_calls": tool_calls}
            yield {"type": "done", "finish_reason": result.get("finish_reason") or ("tool_calls" if tool_calls else "end_turn")}
            return

        if inferred_provider in ("openai", "groq"):
            async for evt in self._openai_tool_completion_stream(messages, tools, effective_model, temperature, api_key=effective_key, provider=inferred_provider):
                yield evt
        else:
            async for evt in self._anthropic_tool_completion_stream(messages, tools, effective_model, temperature, api_key=effective_key):
                yield evt

    async def _openai_tool_completion_stream(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float, api_key: str | None = None, provider: str = "openai"
    ) -> AsyncGenerator[dict[str, Any], None]:
        import json as _json

        key = api_key or self.api_key
        pname = "Groq" if provider == "groq" else "OpenAI"
        if not key:
            raise LLMProviderError(f"Missing {pname} API key — configure BYOK")
        url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        # Accumulate tool_call fragments by index: {"index": 0, "id"?, "function": {"name"?, "arguments"?}}
        fragments: dict[int, dict[str, Any]] = {}
        finish_reason: str | None = None
        norm_messages = self._normalize_openai_messages(messages)
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": norm_messages, "tools": tools, "temperature": temperature, "stream": True},
            ) as resp:
                if resp.status_code != 200:
                    body = (await resp.aread())[:300]
                    raise LLMProviderError(f"{pname} tool stream failed: {resp.status_code} {body!r}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        break
                    data = _json.loads(payload)
                    choice = (data.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    if delta.get("content"):
                        yield {"type": "text_delta", "text": delta["content"]}
                    for frag in delta.get("tool_calls") or []:
                        idx = int(frag.get("index", 0))
                        acc = fragments.setdefault(idx, {"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                        if frag.get("id"):
                            acc["id"] = frag["id"]
                        fn = frag.get("function") or {}
                        if fn.get("name"):
                            acc["function"]["name"] += fn["name"]
                        if fn.get("arguments"):
                            acc["function"]["arguments"] += fn["arguments"]
                    if choice.get("finish_reason"):
                        finish_reason = choice["finish_reason"]

        if fragments:
            ordered = [fragments[i] for i in sorted(fragments)]
            for tc in ordered:
                raw_args = tc["function"]["arguments"]
                # Keep raw string on parse failure — ReAct caller handles str args already
                with contextlib.suppress(Exception):
                    tc["function"]["arguments"] = _json.loads(raw_args) if raw_args else {}
            yield {"type": "tool_calls", "tool_calls": ordered}
        yield {"type": "done", "finish_reason": finish_reason or ("tool_calls" if fragments else "stop")}

    async def _anthropic_tool_completion_stream(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]], model: str, temperature: float, api_key: str | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        import json as _json

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
            "stream": True,
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

        # Per-index state: {"type": "tool_use"/"text", "id", "name", "json": ""}
        blocks: dict[int, dict[str, Any]] = {}
        stop_reason: str | None = None
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=body) as resp:
                if resp.status_code != 200:
                    body_txt = (await resp.aread())[:300]
                    raise LLMProviderError(f"Anthropic tool stream failed: {resp.status_code} {body_txt!r}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = _json.loads(line[6:])
                    etype = data.get("type")
                    if etype == "content_block_start":
                        block = data.get("content_block") or {}
                        idx = int(data.get("index", 0))
                        if block.get("type") == "tool_use":
                            blocks[idx] = {"id": block.get("id", ""), "name": block.get("name", ""), "json": ""}
                    elif etype == "content_block_delta":
                        delta = data.get("delta") or {}
                        idx = int(data.get("index", 0))
                        dtype = delta.get("type")
                        if dtype == "text_delta" and delta.get("text"):
                            yield {"type": "text_delta", "text": delta["text"]}
                        elif dtype == "input_json_delta" and delta.get("partial_json"):
                            blocks.setdefault(idx, {"id": "", "name": "", "json": ""})["json"] += delta["partial_json"]
                    elif etype == "message_delta":
                        stop_reason = (data.get("delta") or {}).get("stop_reason", stop_reason)

        if blocks:
            tool_calls = []
            for idx in sorted(blocks):
                b = blocks[idx]
                try:
                    args = _json.loads(b["json"]) if b["json"] else {}
                except Exception:
                    args = b["json"]
                tool_calls.append({
                    "id": b["id"],
                    "type": "function",
                    "function": {"name": b["name"], "arguments": args},
                })
            yield {"type": "tool_calls", "tool_calls": tool_calls}
        yield {"type": "done", "finish_reason": stop_reason or ("tool_calls" if blocks else "end_turn")}

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
        if inferred_provider in ("openai", "groq"):
            async for chunk in self._openai_completion_stream(messages, effective_model, temperature, max_tokens, api_key=effective_key, provider=inferred_provider):
                yield chunk
        else:
            async for chunk in self._anthropic_completion_stream(messages, effective_model, temperature, max_tokens, api_key=effective_key):
                yield chunk

    async def _openai_completion_stream(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None, provider: str = "openai"
    ) -> AsyncGenerator[dict[str, Any], None]:
        key = api_key or self.api_key
        pname = "Groq" if provider == "groq" else "OpenAI"
        if not key:
            raise LLMProviderError(f"Missing {pname} API key — configure BYOK")
        url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": True},
            ) as resp:
                if resp.status_code != 200:
                    raise LLMProviderError(f"{pname} streaming completion failed: {resp.status_code}")
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
        if self.provider == "groq":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                return resp.status_code == 200
        elif self.provider == "openai":
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


LLMService._ORIGINAL_GENERATE_COMPLETION = LLMService.generate_completion
LLMService._ORIGINAL_GENERATE_COMPLETION_WITH_TOOLS = LLMService.generate_completion_with_tools

llm_service = LLMService()

