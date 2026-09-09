"""
Unit tests for PIOS Capability Engine.
Tests tag syntax parsing, validation tiers (V0-V4), and domain half-life decay.
"""
from datetime import UTC, datetime, timedelta
import pytest

from api.services.capability_engine import (
    CapabilityEngine,
    DecayStatus,
    ValidationTier,
    capability_engine,
)


def test_format_and_parse_capability_tag():
    tag = capability_engine.format_tag("backend", "distributed_systems", version="1.2", suffix="oss")
    assert tag == "capability:backend.distributed_systems@v1.2-oss"

    parsed = capability_engine.parse_tag(tag)
    assert parsed.is_valid is True
    assert parsed.domain == "backend"
    assert parsed.descriptor == "distributed_systems"
    assert parsed.version == "1.2"
    assert parsed.suffix == "oss"


def test_parse_invalid_or_legacy_tag():
    parsed = capability_engine.parse_tag("python-programming")
    assert parsed.is_valid is False
    assert parsed.domain == "general"
    assert parsed.descriptor == "python-programming"


def test_validation_tiers_progression():
    # V0: Unvalidated claim (no evidence, low confidence)
    v0 = capability_engine.determine_validation_tier(confidence=0.3, evidence_count=0)
    assert v0 == ValidationTier.V0

    # V1: Initial extraction
    v1 = capability_engine.determine_validation_tier(confidence=0.5, evidence_count=1)
    assert v1 == ValidationTier.V1

    # V2: Validated with sustained evidence (minimum for Opportunity matching)
    v2 = capability_engine.determine_validation_tier(confidence=0.8, evidence_count=2)
    assert v2 == ValidationTier.V2

    # V3: Mature Mastery (sustained cross-context evidence)
    v3 = capability_engine.determine_validation_tier(
        confidence=0.95, evidence_count=5, cross_context=True
    )
    assert v3 == ValidationTier.V3

    # V4: Cryptographically certified
    v4 = capability_engine.determine_validation_tier(
        confidence=0.8, evidence_count=1, is_externally_certified=True
    )
    assert v4 == ValidationTier.V4


def test_domain_half_life_decay():
    now = datetime.now(UTC)

    # Fresh skill demonstrated yesterday (frontend domain half-life: 180 days)
    yesterday = now - timedelta(days=1)
    decay_fac, dt_days, status = capability_engine.calculate_decay(
        last_demonstrated=yesterday, domain="frontend", reference_time=now
    )
    assert decay_fac > 0.95
    assert status == DecayStatus.FRESH

    # Skill demonstrated exactly one half-life ago (180 days for frontend)
    half_life_ago = now - timedelta(days=180)
    decay_fac, dt_days, status = capability_engine.calculate_decay(
        last_demonstrated=half_life_ago, domain="frontend", reference_time=now
    )
    assert 0.48 <= decay_fac <= 0.52  # 2^(-1) = 0.5
    assert status == DecayStatus.STALE

    # Systems domain has 730-day half-life: 180 days should still be active/fresh
    decay_sys, _, status_sys = capability_engine.calculate_decay(
        last_demonstrated=half_life_ago, domain="systems", reference_time=now
    )
    assert decay_sys > 0.80
    assert status_sys in (DecayStatus.FRESH, DecayStatus.ACTIVE)


def test_assess_capability_comprehensive():
    now = datetime.now(UTC)
    last_week = now - timedelta(days=7)

    assessment = capability_engine.assess_capability(
        name="FastAPI",
        domain="backend",
        base_confidence=0.9,
        evidence_list=["PR #12", "Commit abc123", "Tested in CI"],
        last_demonstrated=last_week,
    )

    assert assessment.name == "FastAPI"
    assert assessment.validation_tier in (ValidationTier.V2, ValidationTier.V3)
    assert assessment.is_matchable is True
    assert assessment.effective_confidence > 0.85
    assert assessment.decay_status == DecayStatus.FRESH
    assert "capability:backend.fastapi@v" in assessment.tag
