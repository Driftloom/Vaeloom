import contextlib
import hashlib
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

_ORIG_ASYNC_CLIENT = httpx.AsyncClient


class _PooledClientContext:
    """Async context manager wrapper around persistent httpx.AsyncClient.
    Does not close the client on exit so connections are reused.
    """

    def __init__(self, client: Any) -> None:
        self.client = client

    async def __aenter__(self) -> Any:
        return self.client

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        return False

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


# ── Deterministic provider failure injection (Muse fallback completion) ──
# Test/development hook ONLY: armed explicitly via inject_provider_failure(),
# never from request data. Checked at the provider boundary inside
# _openai_completion / _anthropic_completion so the FULL runtime path
# (router → BYOK → provider → classifier → fallback → provenance) executes.
# Armed entries raise inside the real path; disarmed (default) = zero behavior
# change. Each entry: {"status_code": int, "error": str, "terminal": bool}.
_FAILURE_INJECTION: dict[str, dict[str, Any]] = {}


def inject_provider_failure(
    provider: str,
    *,
    status_code: int = 503,
    error: str = "injected provider failure",
    terminal: bool = False,
) -> None:
    """Arm deterministic failure for one provider (tests only)."""
    _FAILURE_INJECTION[provider.strip().lower()] = {
        "status_code": status_code, "error": error, "terminal": terminal,
    }


def clear_provider_failure_injection(provider: str | None = None) -> None:
    """Disarm injection (single provider or all)."""
    if provider is None:
        _FAILURE_INJECTION.clear()
    else:
        _FAILURE_INJECTION.pop(provider.strip().lower(), None)


def _check_failure_injection(provider: str) -> None:
    """Raise the armed failure for this provider, if any (provider boundary)."""
    entry = _FAILURE_INJECTION.get((provider or "").strip().lower())
    if not entry:
        return
    msg = f"injected {provider} failure: {entry['status_code']} {entry['error']}"
    if entry.get("terminal"):
        raise LLMProviderError(msg)
    raise LLMTransientError(msg, status_code=int(entry.get("status_code", 503)))


def _classify_exc(exc: BaseException) -> dict[str, Any]:
    """Classify any provider-call exception into the failure taxonomy."""
    import httpx as _httpx

    try:
        from .inference_policy import classify_provider_failure as _classify
    except Exception:  # pragma: no cover
        return {"category": "unknown", "fallback_allowed": True, "retry_same": True,
                "try_different_provider": True, "terminal": False}
    if isinstance(exc, LLMTransientError):
        return _classify(status_code=exc.status_code, error_text=str(exc),
                         exception_type=type(exc).__name__)
    if isinstance(exc, (_httpx.TimeoutException,)):
        return _classify(status_code=None, error_text=str(exc), exception_type="TimeoutException")
    if isinstance(exc, (_httpx.NetworkError,)):
        return _classify(status_code=None, error_text=str(exc), exception_type="NetworkError")
    # LLMProviderError carries the HTTP status inside its message
    # ("... failed: 401 ..."). Extract it so terminal errors short-circuit.
    import re as _re
    m = _re.search(r"\b(4\d\d|5\d\d)\b", str(exc)[:300])
    code = int(m.group(1)) if m else None
    return _classify(status_code=code, error_text=str(exc), exception_type=type(exc).__name__)


class LLMService:
    def __init__(self) -> None:
        self.provider = settings.llm_provider
        self.api_key = settings.llm_api_key
        self.model = settings.llm_model
        self.embedding_model = settings.embedding_model
        # EV-10: Persistent HTTP client for connection pooling
        self._http_client: httpx.AsyncClient = httpx.AsyncClient(
            timeout=120.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
        # EV-08: Output safety validator
        try:
            from api.services.llm_validator import LLMResponseValidator
            self._output_validator = LLMResponseValidator()
        except Exception:
            self._output_validator = None  # type: ignore[assignment]

    async def close(self) -> None:
        """Gracefully close the persistent HTTP client."""
        await self._http_client.aclose()

    def _get_http_client_context(self) -> Any:
        if httpx.AsyncClient is not _ORIG_ASYNC_CLIENT:
            return httpx.AsyncClient(timeout=120.0)
        return _PooledClientContext(self._http_client)

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
        correlation_id: str | None = None,
        fallback_time_budget_s: float = 90.0,
    ) -> dict[str, Any]:
        """Generate a completion. json_mode=True requests provider-native JSON
        enforcement (Phase B §11): OpenAI/Groq get response_format json_object;
        Anthropic gets an explicit JSON-only system instruction (no native
        equivalent). The result carries json_mode metadata for provenance.

        Cross-provider fallback (Muse completion): the chain fails over across
        provider boundaries on RETRYABLE failures only (timeout/rate-limit/5xx/
        network). TERMINAL failures (auth/invalid-request/context-limit/
        unsupported-capability) abort immediately — fallback cannot help and
        must not burn budget. Every result carries full provenance
        (requested/primary/final provider+model, failure category, attempt
        count, correlation ID). Spend + time budgets are re-checked before each
        fallback hop so primary+fallback retries can never silently overrun.
        """
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
        requested_model = fallback_candidates[0]
        requested_provider = provider_override or _infer_provider_from_model(requested_model)
        failure_category: str | None = None
        attempt_count = 0
        corr_id = correlation_id or f"llm-{int(start * 1000)}"

        for hop, candidate_model in enumerate(fallback_candidates):
            candidate_provider = provider_override or _infer_provider_from_model(candidate_model)
            # Capability-aware: skip candidates that cannot hold the request
            # (context-window preservation) or cannot generate (embeddings).
            _ccfg = MODEL_CATALOG.get(candidate_model)
            if "embedding" in candidate_model:
                continue
            if _ccfg is not None and max_tokens > _ccfg.max_tokens:
                import logging as _lg
                _lg.getLogger(__name__).warning(
                    f"FALLBACK_SKIP correlation={corr_id} model={candidate_model} "
                    f"reason=context_window max_tokens={max_tokens} capacity={_ccfg.max_tokens}")
                continue
            # Budget-aware: re-check spend + elapsed-time before every fallback hop
            # (hop 0 already passed the loop pre-act gate; hops burn extra calls).
            if hop > 0:
                try:
                    from .agent_costs import agent_cost_tracker as _tracker
                    if workspace_id:
                        _bstat = await _tracker.check_budget(workspace_id)
                        if not _bstat.get("allowed", True):
                            from .agent_costs import BudgetExceededError as _BE
                            raise _BE(f"Workspace spend budget exhausted before fallback hop {hop}")
                except Exception as _be:
                    if type(_be).__name__ == "BudgetExceededError":
                        raise
                if (time.monotonic() - start) > fallback_time_budget_s:
                    raise LLMProviderError(
                        f"Fallback time budget exhausted ({fallback_time_budget_s}s) after {hop} hops")
            _prov, effective_key = await self._resolve_api_key(
                candidate_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
            )
            _hop_start = time.monotonic()
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
                try:
                    from .inference_policy import record_provider_outcome as _rpo
                    _rpo(candidate_provider, success=True,
                         latency_ms=(time.monotonic() - _hop_start) * 1000,
                         served_after_fallback=(hop > 0))
                except Exception:
                    pass
                break
            except (LLMProviderError, httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                attempt_count += 1
                _policy = _classify_exc(exc)
                failure_category = _policy["category"]
                try:
                    from .inference_policy import record_provider_outcome as _rpo
                    _rpo(candidate_provider, success=False,
                         latency_ms=(time.monotonic() - _hop_start) * 1000,
                         failure_category=failure_category, fallback_hop=True)
                except Exception:
                    pass
                import logging as _lg
                _lg.getLogger(__name__).warning(
                    f"FALLBACK_HOP correlation={corr_id} agent={agent_name} "
                    f"primary={requested_model} failed_model={candidate_model} "
                    f"provider={candidate_provider} category={failure_category} "
                    f"terminal={_policy['terminal']} hop={hop} attempt={attempt_count}")
                if _policy.get("terminal"):
                    # Terminal failures (auth/invalid/context/capability) must
                    # NOT fail over — raise immediately with category attached.
                    exc._failure_category = failure_category  # type: ignore[attr-defined]
                    raise
                continue

        if result is None:
            if last_exc:
                try:
                    last_exc._failure_category = failure_category  # type: ignore[attr-defined]
                except Exception:
                    pass
                raise last_exc
            raise LLMProviderError("All model tier candidates failed to generate completion")


        # Model downgrade observability (Phase B §12): callers can see whether
        # the requested model served or a fallback tier won. Full provenance
        # block answers: who was requested, who failed how, who ultimately served.
        try:
            result["model"] = effective_model
            result["fallback_chain"] = list(fallback_candidates[: fallback_candidates.index(effective_model) + 1])
            result["downgraded"] = effective_model != fallback_candidates[0]
            result["requested_model"] = requested_model
            result["primary_provider"] = requested_provider
            result["final_provider"] = _infer_provider_from_model(effective_model)
            result["final_model"] = effective_model
            result["failure_category"] = failure_category
            result["fallback_provider"] = result["final_provider"] if result["downgraded"] else None
            result["fallback_model"] = effective_model if result["downgraded"] else None
            result["attempt_count"] = attempt_count + 1
            result["correlation_id"] = corr_id
            if result["downgraded"]:
                from .inference_policy import record_fallback as _record_fallback
                _record_fallback(agent_name, task_type, result["fallback_chain"],
                                 f"failover category={failure_category}")
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
        # EV-06: Wire agent cost tracking (was inert — track_usage never called)
        try:
            from .agent_costs import agent_cost_tracker
            if workspace_id and input_tokens + output_tokens > 0:
                await agent_cost_tracker.track_usage(
                    agent_name=agent_name,
                    workspace_id=workspace_id,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    model=effective_model,
                )
        except Exception as _cost_exc:
            import logging as _lg
            _lg.getLogger(__name__).debug(f"Cost tracking skipped: {_cost_exc}")

        # EV-08: Post-completion output safety validation
        try:
            if self._output_validator:
                safety_errors = await self._output_validator.validate_safety(
                    result.get("content", "")
                )
                if safety_errors:
                    import logging as _lg
                    _lg.getLogger(__name__).warning(
                        "LLM output safety issues: %s", safety_errors
                    )
                    result["safety_warnings"] = safety_errors
        except Exception as _val_exc:
            import logging as _lg
            _lg.getLogger(__name__).debug(f"Output validation skipped: {_val_exc}")

        return result

    _raw_generate_completion = generate_completion

    async def _openai_completion(
        self, messages: list[dict[str, Any]], model: str, temperature: float, max_tokens: int, api_key: str | None = None, provider: str = "openai", json_mode: bool = False
    ) -> dict[str, Any]:
        key = api_key or self.api_key
        pname = "Groq" if provider == "groq" else "OpenAI"
        if not key:
            raise LLMProviderError(f"Missing {pname} API key — configure in Settings > API Keys (BYOK)")
        _check_failure_injection(provider)
        url = "https://api.groq.com/openai/v1/chat/completions" if provider == "groq" else "https://api.openai.com/v1/chat/completions"
        body: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
        if json_mode:
            # Provider-native structured enforcement (Phase B §11).
            body["response_format"] = {"type": "json_object"}
        async with self._get_http_client_context() as client:
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
        _check_failure_injection("anthropic")

        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "Content-Type": "application/json",
        }

        async with self._get_http_client_context() as client:
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
        correlation_id: str | None = None,
        fallback_time_budget_s: float = 90.0,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        """Tool-calling completion with capability-aware fallback (Phase B §12).

        Never falls back to a model that cannot satisfy tool calling:
        embedding-only models are excluded from candidates, and candidates
        whose context window cannot hold max_tokens are skipped. Downgrades stay
        within tool-capable chat models and are recorded in the result
        (fallback_chain / downgraded + full provenance) for audit.

        Fallback policy mirrors generate_completion: RETRYABLE failures
        (timeout/rate-limit/5xx/network) fail over across provider boundaries;
        TERMINAL failures (auth/invalid-request/context-limit/unsupported
        capability) abort immediately. Spend + time budgets are re-checked
        before each hop. Tool side effects are NOT duplicated by fallback: the
        hop happens BEFORE any tool executes (model selection), and every
        downstream tool execution carries a deterministic idempotency key
        (inference_policy.idempotency_key + tool_idempotency UNIQUE).
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
        requested_provider = provider_override or _infer_provider_from_model(requested)
        failure_category: str | None = None
        attempt_count = 0
        _tool_start = time.monotonic()
        corr_id = correlation_id or f"llm-tool-{int(_tool_start * 1000)}"
        for hop, candidate_model in enumerate(candidates):
            candidate_provider = provider_override or _infer_provider_from_model(candidate_model)
            # Capability-aware: context-window preservation (tool-capable only
            # already enforced by candidate construction + embedding exclusion).
            _ccfg = _CAT.get(candidate_model)
            if _ccfg is not None and max_tokens > _ccfg.max_tokens:
                import logging as _lg
                _lg.getLogger(__name__).warning(
                    f"FALLBACK_SKIP correlation={corr_id} model={candidate_model} "
                    f"reason=context_window max_tokens={max_tokens} capacity={_ccfg.max_tokens}")
                continue
            if hop > 0:
                try:
                    from .agent_costs import agent_cost_tracker as _tracker
                    if workspace_id:
                        _bstat = await _tracker.check_budget(workspace_id)
                        if not _bstat.get("allowed", True):
                            from .agent_costs import BudgetExceededError as _BE
                            raise _BE(f"Workspace spend budget exhausted before tool fallback hop {hop}")
                except Exception as _be:
                    if type(_be).__name__ == "BudgetExceededError":
                        raise
                if (time.monotonic() - _tool_start) > fallback_time_budget_s:
                    raise LLMProviderError(
                        f"Tool fallback time budget exhausted ({fallback_time_budget_s}s) after {hop} hops")
            _prov, effective_key = await self._resolve_api_key(
                candidate_provider, user_id=user_id, workspace_id=workspace_id, db=db, explicit_key=api_key_override
            )
            _hop_start = time.monotonic()
            try:
                if candidate_provider in ("openai", "groq"):
                    result = await self._openai_tool_completion(messages, tools, candidate_model, temperature, api_key=effective_key, provider=candidate_provider)
                else:
                    result = await self._anthropic_tool_completion(messages, tools, candidate_model, temperature, api_key=effective_key)
                try:
                    from .inference_policy import record_provider_outcome as _rpo
                    _rpo(candidate_provider, success=True,
                         latency_ms=(time.monotonic() - _hop_start) * 1000,
                         served_after_fallback=(hop > 0))
                except Exception:
                    pass
                result["model"] = candidate_model
                result["fallback_chain"] = list(candidates[: candidates.index(candidate_model) + 1])
                result["downgraded"] = candidate_model != candidates[0]
                result["requested_model"] = requested
                result["primary_provider"] = requested_provider
                result["final_provider"] = candidate_provider
                result["final_model"] = candidate_model
                result["failure_category"] = failure_category
                result["fallback_provider"] = candidate_provider if result["downgraded"] else None
                result["fallback_model"] = candidate_model if result["downgraded"] else None
                result["attempt_count"] = attempt_count + 1
                result["correlation_id"] = corr_id
                if result["downgraded"]:
                    import logging as _lg
                    _lg.getLogger(__name__).warning(
                        f"FALLBACK_HOP correlation={corr_id} tool-call downgraded {candidates[0]} -> {candidate_model} "
                        f"(capability-preserving, category={failure_category})")
                    try:
                        from .inference_policy import record_fallback as _record_fallback
                        _record_fallback("unknown", "tool_calling", result["fallback_chain"],
                                         f"tool-capability-preserving failover category={failure_category}")
                    except Exception:
                        pass
                return result
            except (LLMProviderError, LLMTransientError, httpx.TimeoutException, httpx.NetworkError) as exc:
                last_exc = exc
                attempt_count += 1
                _policy = _classify_exc(exc)
                failure_category = _policy["category"]
                try:
                    from .inference_policy import record_provider_outcome as _rpo
                    _rpo(candidate_provider, success=False,
                         latency_ms=(time.monotonic() - _hop_start) * 1000,
                         failure_category=failure_category, fallback_hop=True)
                except Exception:
                    pass
                import logging as _lg
                _lg.getLogger(__name__).warning(
                    f"FALLBACK_HOP correlation={corr_id} tool-call model={candidate_model} "
                    f"provider={candidate_provider} category={failure_category} "
                    f"terminal={_policy['terminal']} hop={hop} attempt={attempt_count}")
                if _policy.get("terminal"):
                    try:
                        exc._failure_category = failure_category  # type: ignore[attr-defined]
                    except Exception:
                        pass
                    raise
                continue
        if last_exc:
            try:
                last_exc._failure_category = failure_category  # type: ignore[attr-defined]
            except Exception:
                pass
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
        _check_failure_injection(provider)
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
        _check_failure_injection("anthropic")
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
        user_id: str | None = None,
        workspace_id: str | None = None,
        db=None,
        correlation_id: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Streaming variant of generate_completion_with_tools (true SSE token streaming).

        Yields typed events:
          {"type": "text_delta", "text": "..."}       — incremental assistant text as it arrives
          {"type": "tool_calls", "tool_calls": [...]} — complete accumulated tool calls
                                                         (same OpenAI-style shape as the buffered path)
          {"type": "done", "finish_reason": "..."}    — terminal event

        BYOK/auth context (user_id/workspace_id/db) is resolved per call so the
        stream uses the workspace key, never a foreign key. Streaming performs a
        SINGLE provider attempt (no mid-stream hop — a hop would corrupt the
        token stream); retryable stream failures are explicit errors and the
        caller falls back to the buffered path with full fallback semantics.

        When no API key is resolvable (tests / unconfigured), delegates to the buffered
        generate_completion_with_tools and emits its result as single-shot events so
        callers get one uniform contract.
        """
        effective_model = model or self.model
        inferred_provider = provider_override or _infer_provider_from_model(effective_model)
        _prov, effective_key = await self._resolve_api_key(
            inferred_provider, user_id=user_id, workspace_id=workspace_id, db=db,
            explicit_key=api_key_override
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
                user_id=user_id,
                workspace_id=workspace_id,
                db=db,
                correlation_id=correlation_id,
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
        _check_failure_injection(provider)
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
        _check_failure_injection("anthropic")
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
        _check_failure_injection(provider)
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
        _check_failure_injection("anthropic")
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

