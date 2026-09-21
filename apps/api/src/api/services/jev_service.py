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

logger = logging.getLogger("api.services.jev")


class JevService:
    """System 1 Fast Decision Client powering sub-50ms intent classification,
    tool routing across 1,553 connectors, and human-in-the-loop safety gating.
    """

    def __init__(
        self,
        api_key: str | None = None,
        gateway_url: str | None = None,
        model: str | None = None,
        timeout: float = 1.2,
    ) -> None:
        self.api_key = api_key or getattr(settings, "jev_api_key", "") or os.environ.get("JEV_API_KEY", "")
        self.gateway_url = (
            gateway_url
            or getattr(settings, "jev_gateway_url", "")
            or os.environ.get("JEV_GATEWAY_URL", "https://ai-gateway.vercel.sh/v1")
        )
        self.model = model or getattr(settings, "jev_model", "typesafe-ai/jev-latest")
        self.timeout = timeout

    async def choice(
        self,
        prompt: str,
        options: Sequence[str],
        context: dict[str, Any] | None = None,
    ) -> str:
        """Sub-50ms multi-way classification. Selects exactly one option from the list."""
        if not options:
            return ""
        if len(options) == 1:
            return options[0]

        start_time = time.monotonic()

        # If live API key is configured, call Vercel AI Gateway / OpenRouter
        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are Jev, a high-speed sub-50ms deterministic classifier. "
                                "Return ONLY the exact option name chosen from the list."
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Task: {prompt}\nContext: {context or {}}\nOptions:\n" + "\n".join(f"- {opt}" for opt in options),
                        },
                    ],
                    "temperature": 0.0,
                    "max_tokens": 40,
                }
                endpoint = f"{self.gateway_url.rstrip('/')}/chat/completions"
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        chosen = data["choices"][0]["message"]["content"].strip()
                        for opt in options:
                            if opt.lower() == chosen.lower() or opt.lower() in chosen.lower():
                                duration_ms = int((time.monotonic() - start_time) * 1000)
                                logger.debug("Jev choice live resolved in %dms: %s", duration_ms, opt)
                                return opt
            except Exception as e:
                logger.debug("Jev live choice error (falling back to fast heuristic): %s", e)

        # High-speed deterministic local heuristic fallback (<1ms)
        chosen = self._heuristic_choice(prompt, options)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.debug("Jev heuristic choice resolved in %dms: %s", duration_ms, chosen)
        return chosen

    async def noul(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
    ) -> bool:
        """High-speed binary decision (True/False).
        Used for dangerous action HITL triage, duplicate detection, and scope validation.
        """
        start_time = time.monotonic()

        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
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
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        val = data["choices"][0]["message"]["content"].strip().lower()
                        return "true" in val or "yes" in val
            except Exception as e:
                logger.debug("Jev live noul error (falling back to heuristic): %s", e)

        # Deterministic heuristic: detect mutating, destructive, or dangerous indicators
        result = self._heuristic_noul(prompt, context)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.debug("Jev heuristic noul resolved in %dms: %s", duration_ms, result)
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

        if self.api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
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
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        val = data["choices"][0]["message"]["content"].strip()
                        match = re.search(r"\b([0-1](?:\.\d+)?)\b", val)
                        if match:
                            return float(match.group(1))
            except Exception as e:
                logger.debug("Jev live score error (falling back to heuristic): %s", e)

        # Fast Jaccard / Token overlap scoring fallback
        return self._heuristic_score(text_a, text_b)

    def _heuristic_choice(self, prompt: str, options: Sequence[str]) -> str:
        prompt_words = set(re.findall(r"\w+", prompt.lower()))
        best_score = -1
        best_option = options[0]

        for opt in options:
            opt_words = set(re.findall(r"\w+", opt.lower().replace("_", " ")))
            overlap = len(prompt_words.intersection(opt_words))
            if overlap > best_score:
                best_score = overlap
                best_option = opt

        return best_option

    def _heuristic_noul(self, prompt: str, context: dict[str, Any] | None = None) -> bool:
        combined = f"{prompt} {context or ''}".lower()
        dangerous_patterns = [
            r"\b(delete|drop|remove|destroy|terminate|kill|archive)\b",
            r"\b(send|email|publish|post|tweet|slack)\b",
            r"\b(write|update|insert|create|modify|alter)\b",
            r"\b(exec|execute|eval|run|sudo|cmd|sh)\b",
            r"\b(rotate|revoke|grant|admin)\b",
        ]
        return any(re.search(pat, combined) for pat in dangerous_patterns)

    def _heuristic_score(self, text_a: str, text_b: str) -> float:
        words_a = set(re.findall(r"\w+", text_a.lower()))
        words_b = set(re.findall(r"\w+", text_b.lower()))
        if not words_a or not words_b:
            return 0.0
        intersection = len(words_a.intersection(words_b))
        union = len(words_a.union(words_b))
        return round(intersection / union, 4) if union > 0 else 0.0


jev_service = JevService()
