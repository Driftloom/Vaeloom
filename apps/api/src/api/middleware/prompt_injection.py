"""
Prompt Injection Detection Middleware — scans user input for injection patterns.
Returns 400 with X-Injection-Detected header when injection is detected.
Configurable via PROMPT_INJECTION_CHECK env var.
"""
import base64
import logging
import os
import re

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("vaeloom-api.middleware.prompt_injection")

SKIP_PATHS = frozenset({
    "/health", "/health/ready", "/docs", "/openapi.json", "/redoc", "/metrics",
})

INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+(instructions|directions|prompts|commands)", re.IGNORECASE),
    re.compile(r"(system|new)\s+prompt", re.IGNORECASE),
    re.compile(r"(forget|disregard|ignore)\s+(everything|all\s+previous)", re.IGNORECASE),
    re.compile(r"\[\[SYSTEM\]\]", re.IGNORECASE),
    re.compile(r"<system>", re.IGNORECASE),
    re.compile(r"<\s*system\s*>", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now\s+)?(a\s+)?(free|unbound|unrestricted|ungoverned)", re.IGNORECASE),
    re.compile(r"(?:your\s+)?new\s+(prompt|instructions|directives)\s*(?:\:|is|=)", re.IGNORECASE),
    re.compile(r"output\s+your\s+(prompt|instructions|system\s+message)", re.IGNORECASE),
    re.compile(r"return\s+the\s+(prompt|instructions|system\s+message)", re.IGNORECASE),
    re.compile(r"reveal\s+(your|the)\s+(prompt|instructions|system)", re.IGNORECASE),
    re.compile(r"base64.*(?:decode|encode|encod)", re.IGNORECASE),
    re.compile(r"(?:admin|root|superuser)\s*(?:\:|bypass|override)", re.IGNORECASE),
    re.compile(r"role\s*(?:\:|=\s*)\s*(system|assistant)", re.IGNORECASE),
]

BASE64_PAYLOAD_PATTERN = re.compile(r"[A-Za-z0-9+/]{40,}={0,2}")
OVERRIDE_PATTERN = re.compile(r"(override|bypass|disable)\s*(all\s+)?(safety|security|restriction|filter|guardrail)", re.IGNORECASE)


class PromptInjectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware that scans user input for prompt injection patterns.
    Returns 400 with X-Injection-Detected: true header when detected.
    """

    def __init__(self, app, enabled: bool | None = None):
        super().__init__(app)
        env_val = os.environ.get("PROMPT_INJECTION_CHECK", "true").lower()
        self._enabled = enabled if enabled is not None else (env_val in ("true", "1", "yes"))

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self._enabled or request.url.path in SKIP_PATHS:
            return await call_next(request)

        body = await self._get_body(request)

        if body:
            detection = self._scan(body)
            if detection:
                logger.warning(
                    "Prompt injection detected  path=%s  method=%s  pattern=%s",
                    request.url.path, request.method, detection,
                )
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Request blocked: potential prompt injection detected"},
                    headers={"X-Injection-Detected": "true"},
                )
            # LLM classifier fallback (second layer) — only when regex silent and LLM available
            # Enabled via INJECTION_LLM_CLASSIFIER=true (cost-controlled, P14)
            # This closes F-08: ingestion bypass already handled via pipeline.py:5b, this handles middleware bypass
            try:
                from ..services.injection_classifier import classify_injection_llm

                llm_flag = await classify_injection_llm(body)
                if llm_flag is True:
                    logger.warning(
                        "Prompt injection detected via LLM classifier path=%s method=%s",
                        request.url.path, request.method,
                    )
                    return JSONResponse(
                        status_code=400,
                        content={"detail": "Request blocked: potential prompt injection detected (llm)"},
                        headers={"X-Injection-Detected": "true", "X-Detection-Layer": "llm"},
                    )
            except Exception as e:
                logger.debug("LLM injection classifier error: %s", e)

        return await call_next(request)

    async def _get_body(self, request: Request) -> str | None:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type or "application/x-www-form-urlencoded" in content_type:
            try:
                body_bytes = await request.body()
                body_str = body_bytes.decode("utf-8", errors="replace")
                return body_str
            except Exception:
                return None
        return None

    def _scan(self, text: str) -> str | None:
        for pattern in INJECTION_PATTERNS:
            match = pattern.search(text)
            if match:
                return f"injection_pattern: {pattern.pattern[:60]}"

        if BASE64_PAYLOAD_PATTERN.search(text):
            try:
                decoded = base64.b64decode(
                    BASE64_PAYLOAD_PATTERN.search(text).group()
                ).decode("utf-8", errors="replace")
                if any(kw in decoded.lower() for kw in ["system", "prompt", "instructions", "ignore", "forget"]):
                    return "base64_encoded_injection"
            except Exception:
                pass

        if OVERRIDE_PATTERN.search(text):
            return "override_pattern"

        return None
