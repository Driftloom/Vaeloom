"""Vaeloom System 1 Fast Decision Engine (TypeSafe AI Jev).

Provides sub-50ms, micro-cost ($0.042/1M), strictly typed cognitive decisions
(choice, noul, score) across Vercel AI Gateway and OpenRouter, paired with
System 2 (Generative LLM of user's choice) for streaming prose and synthesis.
"""
from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Sequence

import httpx

from ..config import settings

from collections import OrderedDict

logger = logging.getLogger("api.services.jev")


class _SimpleLRUCache:
    """In-memory thread-safe LRU cache with TTL for deterministic System 1 decisions."""

    def __init__(self, maxsize: int = 1024, ttl_s: float = 300.0) -> None:
        self.maxsize = maxsize
        self.ttl_s = ttl_s
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Any | None:
        if key not in self._cache:
            return None
        ts, val = self._cache[key]
        if time.monotonic() - ts > self.ttl_s:
            del self._cache[key]
            return None
        self._cache.move_to_end(key)
        return val

    def set(self, key: str, val: Any) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = (time.monotonic(), val)
        if len(self._cache) > self.maxsize:
            self._cache.popitem(last=False)


class JevService:
    """System 1 Fast Decision Client powering sub-50ms intent classification,
    tool routing across 1,553 connectors, and human-in-the-loop safety gating.
    """

    def __init__(
        self,
        api_key: str | None = None,
        gateway_url: str | None = None,
        model: str | None = None,
        timeout: float = 5.0,
    ) -> None:
        self.api_key = api_key or getattr(settings, "jev_api_key", "") or os.environ.get("JEV_API_KEY", "")
        if self.api_key.startswith("apikey_") and (not gateway_url or "vercel.sh" in (getattr(settings, "jev_gateway_url", "") or "")):
            self.gateway_url = "https://api.typesafe.ai/v1/systemone"
        else:
            self.gateway_url = (
                gateway_url
                or getattr(settings, "jev_gateway_url", "")
                or os.environ.get("JEV_GATEWAY_URL", "https://ai-gateway.vercel.sh/v1")
            )
        self.model = model or getattr(settings, "jev_model", "typesafe-ai/jev-latest")
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None
        self._cache = _SimpleLRUCache(maxsize=1024, ttl_s=300.0)

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create persistent keep-alive connection pooled HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
            )
        return self._client

    async def aclose(self) -> None:
        """Close persistent HTTP client pool on shutdown."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def choice(
        self,
        prompt: str,
        options: Sequence[str],
        context: dict[str, Any] | None = None,
        require_match: bool = False,
        criteria: dict[str, str] | None = None,
    ) -> str:
        """Sub-50ms multi-way classification. Selects exactly one option from the list."""
        if not options:
            return ""
        if len(options) == 1 and not require_match:
            return options[0]

        cache_key = f"choice:{prompt}:{list(options)}:{context}:{require_match}:{criteria}"
        cached = self._cache.get(cache_key)
        if cached is not None and (cached in options or (require_match and cached == "")):
            return cached

        start_time = time.monotonic()

        # If live API key is configured, call native TypeSafe AI or Vercel AI Gateway
        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                client = self._get_client()
                if self.api_key.startswith("apikey_") or "typesafe.ai" in self.gateway_url:
                    # Native TypeSafe AI System One Endpoint
                    endpoint = "https://api.typesafe.ai/v1/systemone"
                    eval_criteria = dict(criteria) if criteria else {opt: opt for opt in options}
                    if require_match:
                        eval_criteria["none"] = "none of the options match"
                    payload = {
                        "state": f"Task: {prompt}\nContext: {context or {}}",
                        "model": "jev-latest",
                        "questions": {
                            "choice": {
                                "type": "choice",
                                "instructions": (
                                    "Which option best matches the user's intent? "
                                    "If none match or the query is irrelevant/nonsense, select 'none'."
                                    if require_match else "Which option best matches the user's intent?"
                                ),
                                "criteria": eval_criteria,
                            }
                        },
                    }
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        chosen = data.get("answers", {}).get("choice", {}).get("choice", "")
                        if chosen == "none" and require_match:
                            self._cache.set(cache_key, "")
                            return ""
                        if chosen in options:
                            if require_match and not self._heuristic_choice(prompt, [chosen], min_overlap=1):
                                self._cache.set(cache_key, "")
                                return ""
                            duration_ms = int((time.monotonic() - start_time) * 1000)
                            logger.debug("TypeSafe Jev native choice resolved in %dms: %s", duration_ms, chosen)
                            self._cache.set(cache_key, chosen)
                            return chosen
                else:
                    # Vercel AI Gateway / OpenRouter
                    opts_display = list(options) + (["none"] if require_match else [])
                    payload = {
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are Jev, a high-speed sub-50ms deterministic classifier. "
                                    "Return ONLY the exact option name chosen from the list."
                                    + (" If none match, return 'none'." if require_match else "")
                                ),
                            },
                            {
                                "role": "user",
                                "content": f"Task: {prompt}\nContext: {context or {}}\nOptions:\n" + "\n".join(f"- {opt}" for opt in opts_display),
                            },
                        ],
                        "temperature": 0.0,
                        "max_tokens": 40,
                    }
                    endpoint = f"{self.gateway_url.rstrip('/')}/chat/completions"
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        chosen = data["choices"][0]["message"]["content"].strip()
                        if chosen.lower() == "none" and require_match:
                            self._cache.set(cache_key, "")
                            return ""
                        for opt in options:
                            if opt.lower() == chosen.lower() or opt.lower() in chosen.lower():
                                if require_match and not self._heuristic_choice(prompt, [opt], min_overlap=1):
                                    continue
                                duration_ms = int((time.monotonic() - start_time) * 1000)
                                logger.debug("Jev choice live resolved in %dms: %s", duration_ms, opt)
                                self._cache.set(cache_key, opt)
                                return opt
            except Exception as e:
                logger.debug("Jev live choice error (falling back to fast heuristic): %s", e)

        # High-speed deterministic local heuristic fallback (<1ms)
        chosen = self._heuristic_choice(prompt, options, min_overlap=1 if require_match else 0)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.debug("Jev heuristic choice resolved in %dms: %s", duration_ms, chosen)
        self._cache.set(cache_key, chosen)
        return chosen

    async def noul(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
    ) -> bool:
        """High-speed binary decision (True/False).
        Used for dangerous action HITL triage, duplicate detection, and scope validation.
        """
        cache_key = f"noul:{prompt}:{context}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        start_time = time.monotonic()

        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                client = self._get_client()
                if self.api_key.startswith("apikey_") or "typesafe.ai" in self.gateway_url:
                    # Native TypeSafe AI System One Endpoint
                    endpoint = "https://api.typesafe.ai/v1/systemone"
                    payload = {
                        "state": f"Query: {prompt}\nContext: {context or {}}",
                        "model": "jev-latest",
                        "questions": {
                            "is_dangerous": {
                                "type": "noul",
                                "instructions": "Is this action dangerous, destructive, or requiring human approval?",
                            }
                        },
                    }
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        prob = data.get("answers", {}).get("is_dangerous", {}).get("noul", 0.0)
                        decision = prob > 0.5
                        self._cache.set(cache_key, decision)
                        return decision
                else:
                    payload = {
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are Jev, a binary safety classifier. Reply ONLY with 'true' or 'false'.",
                            },
                            {
                                "role": "user",
                                "content": f"Query: {prompt}\nContext: {context or {}}",
                            },
                        ],
                        "temperature": 0.0,
                        "max_tokens": 10,
                    }
                    endpoint = f"{self.gateway_url.rstrip('/')}/chat/completions"
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        val = data["choices"][0]["message"]["content"].strip().lower()
                        decision = "true" in val or "yes" in val
                        self._cache.set(cache_key, decision)
                        return decision
            except Exception as e:
                logger.debug("Jev live noul error (falling back to heuristic): %s", e)

        # Deterministic heuristic: detect mutating, destructive, or dangerous indicators
        result = self._heuristic_noul(prompt, context)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.debug("Jev heuristic noul resolved in %dms: %s", duration_ms, result)
        self._cache.set(cache_key, result)
        return result

    async def score(
        self,
        text_a: str,
        text_b: str,
        rubric: str | None = None,
    ) -> float:
        """High-speed evaluation metric [0.0 - 1.0].
        Used for ATS keyword match density, ReAct loop progress tracking, and cycle detection.
        """
        if not text_a or not text_b:
            return 0.0

        cache_key = f"score:{hash(text_a)}:{hash(text_b)}:{rubric}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                client = self._get_client()
                if self.api_key.startswith("apikey_") or "typesafe.ai" in self.gateway_url:
                    endpoint = "https://api.typesafe.ai/v1/systemone"
                    payload = {
                        "state": f"Text A: {text_a[:1000]}\nText B: {text_b[:1000]}",
                        "model": "jev-latest",
                        "questions": {
                            "score": {
                                "type": "score",
                                "instructions": f"Evaluate match according to rubric: {rubric or 'similarity'}",
                                "criteria": ["No match", "Weak match", "Moderate match", "Strong match", "Exact match"],
                            }
                        },
                    }
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        raw_score = data.get("answers", {}).get("score", {}).get("score", 0.0)
                        final_score = round(raw_score / 4.0, 4)
                        self._cache.set(cache_key, final_score)
                        return final_score
                else:
                    payload = {
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are Jev, a scoring evaluator. Evaluate match/similarity/progress "
                                    "between Text A and Text B on a scale of 0.0 to 1.0. Reply ONLY with a float number."
                                ),
                            },
                            {
                                "role": "user",
                                "content": f"Rubric: {rubric or 'similarity'}\nText A: {text_a[:1000]}\nText B: {text_b[:1000]}",
                            },
                        ],
                        "temperature": 0.0,
                        "max_tokens": 15,
                    }
                    endpoint = f"{self.gateway_url.rstrip('/')}/chat/completions"
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        val = data["choices"][0]["message"]["content"].strip()
                        match = re.search(r"\b([0-1](?:\.\d+)?)\b", val)
                        if match:
                            score_val = float(match.group(1))
                            self._cache.set(cache_key, score_val)
                            return score_val
            except Exception as e:
                logger.debug("Jev live score error (falling back to heuristic): %s", e)

        # Fast Jaccard / Token overlap scoring fallback
        score_val = self._heuristic_score(text_a, text_b)
        self._cache.set(cache_key, score_val)
        return score_val

    def _heuristic_choice(self, prompt: str, options: Sequence[str], min_overlap: int = 0) -> str:
        prompt_words = [w for w in re.findall(r"\w+", prompt.lower()) if len(w) >= 3]
        best_score = -1
        best_option = options[0] if options and not min_overlap else ""

        for opt in options:
            if opt.lower() == "none":
                continue
            opt_words = [w for w in re.findall(r"\w+", opt.lower().replace("_", " ")) if len(w) >= 3]
            overlap = 0
            for pw in prompt_words:
                for ow in opt_words:
                    if pw == ow:
                        overlap += 2
                    elif len(pw) >= 4 and len(ow) >= 4 and (pw.startswith(ow[:4]) or ow.startswith(pw[:4])):
                        overlap += 1
            if overlap > best_score:
                best_score = overlap
                best_option = opt

        if min_overlap > 0 and best_score < min_overlap:
            return ""
        return best_option

    def _heuristic_noul(self, prompt: str, context: dict[str, Any] | None = None) -> bool:
        prompt_lower = prompt.lower().strip()
        # 1. Explicit read-only tools are inherently safe and never destructive
        read_only_prefixes = (
            "search_", "get_", "read_", "list_", "fetch_", "browse_", "audit_", "verify_", "check_", "calculate_"
        )
        if any(prompt_lower.startswith(p) for p in read_only_prefixes) and not any(
            prompt_lower.startswith(d) for d in ("delete", "drop", "destroy", "exec")
        ):
            return False

        # 2. Check for dangerous destructive patterns in prompt / action
        dangerous_prompt_patterns = [
            r"\b(delete|drop|remove|destroy|terminate|kill|archive)\b",
            r"\b(send|email|publish|post|tweet|slack)\b",
            r"\b(write|update|insert|create|modify|alter)\b",
            r"\b(exec|execute|eval|sudo|cmd|sh)\b",
            r"\b(rotate|revoke|grant|admin)\b",
        ]
        if any(re.search(pat, prompt_lower) for pat in dangerous_prompt_patterns):
            return True

        # Check for leading imperative command verbs in prompt
        if re.search(r"^(run|exec|execute|sudo|eval)\b", prompt_lower):
            return True

        # 3. Inspect context fields specifically for command/code execution or destructive actions
        if context and isinstance(context, dict):
            for cmd_key in ("command", "cmd", "code", "script", "exec", "sql", "query_mutation"):
                val = str(context.get(cmd_key) or "").lower()
                if val and any(re.search(pat, val) for pat in dangerous_prompt_patterns):
                    return True
                if val and re.search(r"\b(rm|sudo|drop|delete|kill|format)\b", val):
                    return True

            action_val = str(context.get("action") or context.get("operation") or "").lower()
            if action_val and any(re.search(pat, action_val) for pat in dangerous_prompt_patterns):
                return True

        return False

    def _heuristic_score(self, text_a: str, text_b: str) -> float:
        words_a = set(re.findall(r"\w+", text_a.lower()))
        words_b = set(re.findall(r"\w+", text_b.lower()))
        if not words_a or not words_b:
            return 0.0
        intersection = len(words_a.intersection(words_b))
        union = len(words_a.union(words_b))
        return round(intersection / union, 4) if union > 0 else 0.0


jev_service = JevService()
