"""
PIOS Capability Engine.
Implements the Human Capability Graph standards from the PIOS Blueprint:
- Standardized Capability Tag Syntax: capability:<lane-domain>.<descriptor>@v<version>[-suffix]
- Validation Tiers (V0 to V4)
- Domain-specific half-life decay model
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class ValidationTier(str, Enum):
    V0 = "V0"  # Unvalidated / Raw claim
    V1 = "V1"  # Initial / Extracted from single unverified source
    V2 = "V2"  # Validated / Sustained evidence (minimum for Opportunity matching)
    V3 = "V3"  # Mature Mastery / Cross-context demonstrated depth
    V4 = "V4"  # Externally Certified / Cryptographically verifiable


class DecayStatus(str, Enum):
    FRESH = "fresh"      # decay >= 0.85
    ACTIVE = "active"    # 0.60 <= decay < 0.85
    STALE = "stale"      # decay < 0.60 (recommends refresher)


# Domain Half-Lives in days (PIOS Blueprint Specification)
DOMAIN_HALF_LIVES: dict[str, float] = {
    # Fast-moving frameworks
    "frontend": 180.0,
    "ui": 180.0,
    "web": 180.0,
    "mobile": 180.0,
    # Backend & Infrastructure
    "backend": 365.0,
    "cloud": 365.0,
    "database": 365.0,
    "devops": 365.0,
    "data_engineering": 365.0,
    # AI / Agents / LLM
    "agents": 240.0,
    "ai": 240.0,
    "ml": 300.0,
    # Core Fundamentals
    "algorithms": 730.0,
    "distributed_systems": 730.0,
    "security": 540.0,
    "networking": 730.0,
    "systems": 730.0,
}
DEFAULT_HALF_LIFE_DAYS = 365.0

# Regex for standard capability tag: capability:<domain>.<descriptor>@v<version>[-suffix]
TAG_PATTERN = re.compile(
    r"^capability:(?P<domain>[a-zA-Z0-9_\-]+)\.(?P<descriptor>[a-zA-Z0-9_\-]+)@v(?P<version>[0-9]+(?:\.[0-9]+)*)(?:-(?P<suffix>[a-zA-Z0-9_\-]+))?$"
)


@dataclass
class ParsedCapabilityTag:
    raw: str
    domain: str
    descriptor: str
    version: str
    suffix: str | None = None
    is_valid: bool = True


@dataclass
class CapabilityAssessment:
    name: str
    tag: str
    domain: str
    validation_tier: ValidationTier
    base_confidence: float
    effective_confidence: float
    decay_factor: float
    decay_status: DecayStatus
    days_since_demonstrated: float
    evidence_count: int
    is_matchable: bool  # Minimum V2 required for Opportunity Engine matching


class CapabilityEngine:
    """Core engine for capability tag parsing, validation tiering, and skill decay."""

    @staticmethod
    def format_tag(
        domain: str,
        descriptor: str,
        version: str = "1.0",
        suffix: str | None = None,
    ) -> str:
        """Generate standardized capability tag."""
        clean_domain = re.sub(r"[^a-zA-Z0-9_\-]", "-", domain.lower()).strip("-")
        clean_desc = re.sub(r"[^a-zA-Z0-9_\-]", "-", descriptor.lower()).strip("-")
        clean_ver = version.lstrip("v")
        tag = f"capability:{clean_domain}.{clean_desc}@v{clean_ver}"
        if suffix:
            clean_suf = re.sub(r"[^a-zA-Z0-9_\-]", "-", suffix.lower()).strip("-")
            tag += f"-{clean_suf}"
        return tag

    @staticmethod
    def parse_tag(tag_str: str) -> ParsedCapabilityTag:
        """Parse and validate standardized capability tag."""
        m = TAG_PATTERN.match(tag_str.strip())
        if not m:
            # Fallback for legacy / raw skill strings
            parts = tag_str.split(":", 1)
            desc = parts[1] if len(parts) > 1 else tag_str
            return ParsedCapabilityTag(
                raw=tag_str,
                domain="general",
                descriptor=re.sub(r"[^a-zA-Z0-9_\-]", "-", desc.lower()),
                version="1.0",
                suffix=None,
                is_valid=False,
            )
        return ParsedCapabilityTag(
            raw=tag_str,
            domain=m.group("domain"),
            descriptor=m.group("descriptor"),
            version=m.group("version"),
            suffix=m.group("suffix"),
            is_valid=True,
        )

    @staticmethod
    def calculate_decay(
        last_demonstrated: datetime | str | None,
        domain: str = "general",
        reference_time: datetime | None = None,
    ) -> tuple[float, float, DecayStatus]:
        """
        Calculate exponential decay factor based on domain half-life.
        Formula: decay = exp(-ln(2) * dt / t_half)
        Returns: (decay_factor [0.0..1.0], days_since_demonstrated, decay_status)
        """
        now = reference_time or datetime.now(UTC)

        if last_demonstrated is None:
            # Default to 90 days ago if no timestamp exists
            dt_days = 90.0
        elif isinstance(last_demonstrated, str):
            try:
                dt_obj = datetime.fromisoformat(last_demonstrated.replace("Z", "+00:00"))
                if dt_obj.tzinfo is None:
                    dt_obj = dt_obj.replace(tzinfo=UTC)
                dt_days = max(0.0, (now - dt_obj).total_seconds() / 86400.0)
            except Exception:
                dt_days = 90.0
        elif isinstance(last_demonstrated, datetime):
            dt_obj = last_demonstrated
            if dt_obj.tzinfo is None:
                dt_obj = dt_obj.replace(tzinfo=UTC)
            dt_days = max(0.0, (now - dt_obj).total_seconds() / 86400.0)
        else:
            dt_days = 90.0

        half_life = DOMAIN_HALF_LIVES.get(domain.lower(), DEFAULT_HALF_LIFE_DAYS)
        # Exponential half-life decay: 2^(-dt / t_half)
        decay_factor = math.pow(2.0, -dt_days / half_life)
        decay_factor = max(0.05, min(1.0, decay_factor))

        if decay_factor >= 0.85:
            status = DecayStatus.FRESH
        elif decay_factor >= 0.60:
            status = DecayStatus.ACTIVE
        else:
            status = DecayStatus.STALE

        return decay_factor, dt_days, status

    @staticmethod
    def determine_validation_tier(
        confidence: float,
        evidence_count: int,
        is_externally_certified: bool = False,
        cross_context: bool = False,
    ) -> ValidationTier:
        """
        Determine validation tier V0-V4 per PIOS Blueprint specification:
        - V0: Unvalidated claim (no evidence, confidence < 0.4)
        - V1: Initial extraction (single evidence, confidence < 0.7)
        - V2: Validated (sustained evidence >= 2, confidence >= 0.7)
        - V3: Mature Mastery (evidence >= 4, cross_context, confidence >= 0.9)
        - V4: Externally Certified (cryptographically verified or DID credential)
        """
        if is_externally_certified:
            return ValidationTier.V4
        if confidence >= 0.90 and evidence_count >= 4 and cross_context:
            return ValidationTier.V3
        if confidence >= 0.70 and evidence_count >= 1:
            return ValidationTier.V2
        if evidence_count >= 1 or confidence >= 0.40:
            return ValidationTier.V1
        return ValidationTier.V0

    def assess_capability(
        self,
        name: str,
        domain: str = "general",
        base_confidence: float = 0.8,
        evidence_list: list[Any] | None = None,
        last_demonstrated: datetime | str | None = None,
        is_certified: bool = False,
        cross_context: bool = False,
        tag: str | None = None,
    ) -> CapabilityAssessment:
        """Produce a complete PIOS capability assessment."""
        evidence = evidence_list or []
        evidence_count = len(evidence)

        # Standard tag
        canonical_tag = tag or self.format_tag(domain=domain, descriptor=name)

        # Decay calculation
        decay_factor, dt_days, decay_status = self.calculate_decay(
            last_demonstrated=last_demonstrated,
            domain=domain,
        )

        effective_confidence = round(base_confidence * decay_factor, 4)

        tier = self.determine_validation_tier(
            confidence=base_confidence,
            evidence_count=evidence_count,
            is_externally_certified=is_certified,
            cross_context=cross_context,
        )

        # Minimum V2 required for Opportunity Engine matching per PIOS spec
        is_matchable = tier in (ValidationTier.V2, ValidationTier.V3, ValidationTier.V4)

        return CapabilityAssessment(
            name=name,
            tag=canonical_tag,
            domain=domain,
            validation_tier=tier,
            base_confidence=base_confidence,
            effective_confidence=effective_confidence,
            decay_factor=round(decay_factor, 4),
            decay_status=decay_status,
            days_since_demonstrated=round(dt_days, 1),
            evidence_count=evidence_count,
            is_matchable=is_matchable,
        )


# Global singleton
capability_engine = CapabilityEngine()
