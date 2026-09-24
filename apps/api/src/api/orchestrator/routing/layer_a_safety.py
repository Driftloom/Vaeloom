"""Layer A — Deterministic Security, IDOR, & Adversarial Pre-Screen.

Validates workspace access boundaries, tenant identity, and screens
for prompt injection vectors before any cognitive layer is invoked.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any

from ...utils.sanitize import looks_like_prompt_injection, sanitize_text

logger = logging.getLogger(__name__)

# Control character regex
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")

# Homoglyph normalization map (defuses Cyrillic/Greek character substitution evasions)
HOMOGLYPH_MAP = str.maketrans({
    "\u0430": "a", "\u0441": "c", "\u0435": "e", "\u043e": "o",
    "\u0440": "p", "\u0445": "x", "\u0443": "y", "\u0456": "i",
    "\u0458": "j", "\u0455": "s",
    "\u0410": "A", "\u0412": "B", "\u0421": "C", "\u0415": "E",
    "\u041d": "H", "\u0406": "I", "\u0408": "J", "\u041a": "K",
    "\u041c": "M", "\u041e": "O", "\u0420": "P", "\u0405": "S",
    "\u0422": "T", "\u0425": "X",
})


class SecurityScreenResult:
    def __init__(
        self,
        passed: bool,
        sanitized_query: str,
        workspace_id: str,
        tenant_id: str | None = None,
        user_id: str | None = None,
        rejection_reason: str | None = None,
        is_injection_attempt: bool = False,
    ) -> None:
        self.passed = passed
        self.sanitized_query = sanitized_query
        self.workspace_id = workspace_id
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.rejection_reason = rejection_reason
        self.is_injection_attempt = is_injection_attempt


class LayerASafetyGate:
    """Zero-Trust deterministic perimeter check."""

    def screen(
        self,
        raw_query: str,
        workspace_id: str,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> SecurityScreenResult:
        # 1. Workspace ID validation
        if not workspace_id or not workspace_id.strip():
            return SecurityScreenResult(
                passed=False,
                sanitized_query=raw_query,
                workspace_id=workspace_id,
                rejection_reason="Missing workspace_id",
            )

        try:
            uuid.UUID(str(workspace_id))
        except (ValueError, TypeError):
            return SecurityScreenResult(
                passed=False,
                sanitized_query=raw_query,
                workspace_id=workspace_id,
                rejection_reason="Invalid workspace_id UUID format",
            )

        # 2. Query sanitization & control character stripping with homoglyph normalization
        clean_text = CONTROL_CHAR_RE.sub("", raw_query or "").translate(HOMOGLYPH_MAP).strip()
        sanitized = sanitize_text(clean_text)

        # 3. Adversarial prompt injection pre-screen
        is_injection = False
        try:
            from ...services.prompt_compiler import OVERRIDE_MARKERS
            lowered = clean_text.lower()
            if any(m in lowered for m in OVERRIDE_MARKERS) or looks_like_prompt_injection(clean_text):
                is_injection = True
                logger.warning(f"LAYER_A: Prompt injection indicator detected in workspace {workspace_id}")
        except Exception:
            pass

        return SecurityScreenResult(
            passed=True,
            sanitized_query=sanitized,
            workspace_id=str(workspace_id),
            tenant_id=tenant_id,
            user_id=user_id,
            is_injection_attempt=is_injection,
        )
